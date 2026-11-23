import { randomUUID } from 'node:crypto';
import type { Db } from 'mongodb';
interface Lease { id: string; expiresAt: Date }
interface SlotDocument { _id: string; leases: Lease[] }
/** Shared Mongo lease guard. Lease > 180s request deadline; crashed owners expire after 210s. */
export function mongoAiSlots(db: Db, limit: number, clock = Date.now) {
  const collection = db.collection<SlotDocument>('ai_runtime_v1');
  return async () => {
    const id = randomUUID(), now = new Date(clock());
    const alive = { $filter: { input: { $ifNull: ['$leases', []] }, as: 'lease', cond: { $gt: ['$$lease.expiresAt', now] } } };
    const update = [{ $set: { leases: { $cond: [{ $lt: [{ $size: alive }, limit] },
      { $concatArrays: [alive, [{ id, expiresAt: new Date(now.getTime() + 210000) }]] }, alive] } } }];
    let record;
    try { record = await collection.findOneAndUpdate({ _id: 'global' }, update, { upsert: true, returnDocument: 'after' }); }
    catch (error) {
      if (!error || typeof error !== 'object' || !('code' in error) || error.code !== 11000) throw error;
      record = await collection.findOneAndUpdate({ _id: 'global' }, update, { returnDocument: 'after' });
    }
    if (!record?.leases.some(lease => lease.id === id)) return null;
    return async () => { await collection.updateOne({ _id: 'global' }, { $pull: { leases: { id } } }); };
  };
}
