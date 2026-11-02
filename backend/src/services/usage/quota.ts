import type { Collection } from 'mongodb';

export interface UsageCounter { _id: string; count: number; expiresAt: Date }

// Atomic conditional increment: concurrent requests cannot overshoot the cap.
export async function consumeCounter(collection: Collection<UsageCounter>, key: string, limit: number, expiresAt: Date) {
  try {
    const counter = await collection.findOneAndUpdate({ _id: key, count: { $lt: limit } },
      { $inc: { count: 1 }, $setOnInsert: { expiresAt } }, { upsert: true, returnDocument: 'after' });
    return counter !== null;
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 11000) return false;
    throw error;
  }
}

export function mongoQuota(collection: Collection<UsageCounter>, daily: number, minute: number) {
  return async () => {
    const now = Date.now();
    const day = Math.floor(now / 86400000);
    const min = Math.floor(now / 60000);
    // Global limits survive restarts and apply across backend instances.
    if (!await consumeCounter(collection, `minute:${min}`, minute, new Date((min + 2) * 60000))) return false;
    return consumeCounter(collection, `day:${day}`, daily, new Date((day + 2) * 86400000));
  };
}
