import { randomUUID } from 'node:crypto';
import type { Db } from 'mongodb';
import type { Principal } from '../../auth/appToken.ts';
import type { UserUsage, QuotaDecision } from '../../../../shared/types/usage.ts';
export interface UserUsageDocument { _id: string; userId: string; day: number; dailyUsed: number; minute: number; minuteUsed: number; lastAccepted: string }
export interface UserUsageRepository {
  read(userId: string): Promise<UserUsageDocument | null>;
  accept(userId: string, day: number, minute: number, daily: number, perMinute: number, requestId: string): Promise<UserUsageDocument>;
}
const duplicate = (error: unknown) => error && typeof error === 'object' && 'code' in error && error.code === 11000;
export function mongoUserUsage(db: Db): UserUsageRepository {
  const collection = db.collection<UserUsageDocument>('ai_user_usage_v1');
  return {
    read: _id => collection.findOne({ _id }),
    async accept(userId, day, minute, daily, perMinute, requestId) {
      const currentDay = { $eq: ['$day', day] }, currentMinute = { $eq: ['$minute', minute] };
      const used = { $cond: [currentDay, { $ifNull: ['$dailyUsed', 0] }, 0] };
      const minuteUsed = { $cond: [currentMinute, { $ifNull: ['$minuteUsed', 0] }, 0] };
      const allowed = { $and: [{ $lt: [used, daily] }, { $lt: [minuteUsed, perMinute] }] };
      // Match only unique _id; conditional pipeline changes BOTH counters or neither.
      // No $expr in an upsert filter, and no multi-document transaction dependency.
      const update = [{ $set: { userId, day: { $cond: [allowed, day, '$day'] }, minute: { $cond: [allowed, minute, '$minute'] },
        dailyUsed: { $cond: [allowed, { $add: [used, 1] }, '$dailyUsed'] },
        minuteUsed: { $cond: [allowed, { $add: [minuteUsed, 1] }, '$minuteUsed'] },
        lastAccepted: { $cond: [allowed, requestId, '$lastAccepted'] } } }];
      try { return (await collection.findOneAndUpdate({ _id: userId }, update, { upsert: true, returnDocument: 'after' }))!; }
      catch (error) {
        if (!duplicate(error)) throw error;
        return (await collection.findOneAndUpdate({ _id: userId }, update, { returnDocument: 'after' }))!;
      }
    },
  };
}
export function createUserQuota(repository: UserUsageRepository, daily: number, perMinute: number, clock = Date.now) {
  const userId = (principal: Principal) => {
    if (principal.kind !== 'user' || !/^[a-f0-9]{24}$/.test(principal.id)) throw new Error('User session required.');
    return principal.id;
  };
  const overview = (record: UserUsageDocument | null, now: number): UserUsage => {
    const day = Math.floor(now / 86400000), used = record?.day === day ? record.dailyUsed : 0;
    return { dailyLimit: daily, dailyUsed: used, dailyRemaining: Math.max(0, daily - used), resetAt: new Date((day + 1) * 86400000).toISOString(), minuteLimit: perMinute };
  };
  return {
    read: async (principal: Principal) => overview(await repository.read(userId(principal)), clock()),
    async consume(principal: Principal): Promise<QuotaDecision> {
      const id = userId(principal), now = clock(), day = Math.floor(now / 86400000), minute = Math.floor(now / 60000), requestId = randomUUID();
      const record = await repository.accept(id, day, minute, daily, perMinute, requestId);
      if (record.lastAccepted === requestId) return { allowed: true };
      const dayFull = record.day === day && record.dailyUsed >= daily;
      return { allowed: false, reason: dayFull ? 'day' : 'minute', retryAfterSeconds: Math.max(1, Math.ceil(((dayFull ? (day + 1) * 86400000 : (minute + 1) * 60000) - now) / 1000)) };
    },
  };
}
export async function createUsageIndexes(db: Db) {
  await db.collection('ai_request_rate_v1').createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
  await db.collection('ai_user_usage_v1').createIndex({ userId: 1 }, { unique: true });
}
