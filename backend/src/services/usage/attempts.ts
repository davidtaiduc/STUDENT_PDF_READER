import type { Db } from 'mongodb';
import { consumeCounter, type UsageCounter } from './quota.ts';
export function mongoAiAttempts(db: Db, limit: number) {
  const collection = db.collection<UsageCounter>('ai_request_rate_v1');
  return async (userId: string) => {
    const minute = Math.floor(Date.now() / 60000);
    return consumeCounter(collection, `${userId}:${minute}`, limit, new Date((minute + 2) * 60000));
  };
}
