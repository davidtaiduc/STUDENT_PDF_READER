import { createUsageIndexes } from '../services/usage/userQuota.ts';
import { createAuthIndexes } from '../auth/repository.ts';
import { MongoClient } from 'mongodb';
import type { UsageCounter } from '../services/usage/quota.ts';

// One connection pool per process; future user/session repositories share it.
export function createDatabase(uri: string, databaseName: string) {
  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 3000,
    connectTimeoutMS: 3000, socketTimeoutMS: 5000, maxPoolSize: 10 });
  const db = client.db(databaseName);
  const usage = db.collection<UsageCounter>('gemini_usage_v1');
  return {
    db, usage,
    async connect() {
      await client.connect();
      await createAuthIndexes(db);
      await db.collection('users').createIndex({'emailTokens.reset.hash':1},{sparse:true});
      await db.collection('users').createIndex({'emailTokens.verify.hash':1},{sparse:true});
      await createUsageIndexes(db);
      await db.command({ ping: 1 }, { timeoutMS: 3000 });
      await usage.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
    },
    async isConnected() {
      try { await db.command({ ping: 1 }, { timeoutMS: 3000 }); return true; }
      catch { return false; }
    },
    close: () => client.close(),
  };
}
