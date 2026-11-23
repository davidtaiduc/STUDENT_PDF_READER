import { ObjectId, type Db, type Filter } from 'mongodb';
import { consumeCounter, type UsageCounter } from '../services/usage/quota.ts';
export interface UserDocument { _id: ObjectId; email: string; displayName: string; passwordHash: string; createdAt: Date; updatedAt: Date; sessionVersion?: number; emailVerifiedAt?: Date }
export interface SessionDocument { _id: ObjectId; userId: ObjectId; tokenHash: string; createdAt: Date; expiresAt: Date; version?: number }
export interface AuthRepository {
  findUser(email: string): Promise<UserDocument | null>;
  insertUser(user: UserDocument): Promise<void>;
  insertSession(session: SessionDocument): Promise<void>;
  findSession(hash: string, now: Date): Promise<SessionDocument | null>;
  userById(id: ObjectId): Promise<UserDocument | null>;
  revoke(hash: string): Promise<void>;
  consume(key: string, limit: number, expiresAt: Date): Promise<boolean>;
  updateName(id: ObjectId, name: string): Promise<UserDocument | null>;
  changePassword(id: ObjectId, expectedHash: string, version: number, newHash: string): Promise<boolean>;
  revokeAll(id: ObjectId, expectedHash: string, version: number): Promise<boolean>;
  listSessions(id: ObjectId, version: number, now: Date): Promise<SessionDocument[]>;
  revokeSession(id: ObjectId, userId: ObjectId): Promise<boolean>;
  revokeOthers(userId: ObjectId, currentId: ObjectId): Promise<void>;
}
const userVersion = (version: number): Filter<UserDocument> => version === 0
  ? { $or: [{ sessionVersion: 0 }, { sessionVersion: { $exists: false } }] } : { sessionVersion: version };
export function mongoAuthRepository(db: Db): AuthRepository {
  const users = db.collection<UserDocument>('users'), sessions = db.collection<SessionDocument>('sessions');
  const limits = db.collection<UsageCounter>('auth_rate_limits');
  return {
    findUser: email => users.findOne({ email }),
    insertUser: async user => { await users.insertOne(user); },
    insertSession: async session => { await sessions.insertOne(session); },
    findSession: (tokenHash, now) => sessions.findOne({ tokenHash, expiresAt: { $gt: now } }),
    userById: _id => users.findOne({ _id }),
    revoke: async tokenHash => { await sessions.deleteOne({ tokenHash }); },
    consume: (key, limit, expiry) => consumeCounter(limits, key, limit, expiry),
    updateName: (_id, displayName) => users.findOneAndUpdate({ _id }, { $set: { displayName, updatedAt: new Date() } }, { returnDocument: 'after' }),
    // Compare-and-swap and generation change are ONE atomic document update.
    changePassword: async (_id, passwordHash, version, newHash) => (await users.updateOne({ _id, passwordHash, ...userVersion(version) },
      { $set: { passwordHash: newHash, updatedAt: new Date() }, $inc: { sessionVersion: 1 } })).modifiedCount === 1,
    revokeAll: async (_id, passwordHash, version) => (await users.updateOne({ _id, passwordHash, ...userVersion(version) },
      { $inc: { sessionVersion: 1 } })).modifiedCount === 1,
    listSessions: (userId, version, now) => sessions.find({ userId, expiresAt: { $gt: now },
      ...(version === 0 ? { $or: [{ version: 0 }, { version: { $exists: false } }] } : { version }) })
      .sort({ createdAt: -1, _id: -1 }).limit(100).toArray(),
    revokeSession: async (_id, userId) => (await sessions.deleteOne({ _id, userId })).deletedCount === 1,
    revokeOthers: async (userId, currentId) => { await sessions.deleteMany({ userId, _id: { $ne: currentId } }); },
  };
}
export async function createAuthIndexes(db: Db) {
  await db.collection('users').createIndex({ email: 1 }, { unique: true });
  await db.collection('sessions').createIndex({ tokenHash: 1 }, { unique: true });
  await db.collection('sessions').createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
  await db.collection('sessions').createIndex({ userId: 1, createdAt: -1 });
  await db.collection('auth_rate_limits').createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
}
