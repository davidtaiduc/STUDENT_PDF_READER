export function fakeAuthRepository() {
  const users = [], sessions = [], counters = new Map();
  return {
    users, sessions, counters,
    deleteAccount: async (id,hash,version) => {const u=users.find(u=>u._id.equals(id)&&u.passwordHash===hash&&(u.sessionVersion??0)===version&&!u.deletedAt);if(!u)return false;u.deletedAt=new Date();u.email=id.toHexString()+'@deleted.invalid';u.displayName='Tài khoản đã xóa';u.passwordHash='!deleted';u.sessionVersion=version+1;delete u.emailTokens;delete u.emailVerifiedAt;return true;},
    findUser: async email => { const user=users.find(u => u.email === email&&!u.deletedAt); return user ? {...user} : null; },
    insertUser: async user => { if(users.some(u=>u.email===user.email)) throw Object.assign(new Error('duplicate'),{code:11000}); users.push(user); },
    insertSession: async session => { sessions.push(session); },
    findSession: async (hash,now) => sessions.find(s=>s.tokenHash===hash && s.expiresAt>now) ?? null,
    userById: async id => {const user=users.find(u=>u._id.equals(id));return user?{...user}:null;},
    revoke: async hash => { const i=sessions.findIndex(s=>s.tokenHash===hash); if(i>=0)sessions.splice(i,1); },
    updateName: async (id,name) => { const user=users.find(u=>u._id.equals(id));if(!user)return null;user.displayName=name;user.updatedAt=new Date();return {...user}; },
    changePassword: async (id,hash,version,newHash) => {const user=users.find(u=>u._id.equals(id)&&u.passwordHash===hash&&(u.sessionVersion??0)===version);if(!user)return false;user.passwordHash=newHash;user.sessionVersion=version+1;user.updatedAt=new Date();return true;},
    revokeAll: async (id,hash,version) => {const user=users.find(u=>u._id.equals(id)&&u.passwordHash===hash&&(u.sessionVersion??0)===version);if(!user)return false;user.sessionVersion=version+1;return true;},
    listSessions: async (id,version,now) => sessions.filter(s=>s.userId.equals(id)&&(s.version??0)===version&&s.expiresAt>now).sort((a,b)=>b.createdAt-a.createdAt).slice(0,100),
    revokeSession: async (id,userId) => {const i=sessions.findIndex(s=>s._id.equals(id)&&s.userId.equals(userId));if(i<0)return false;sessions.splice(i,1);return true;},
    revokeOthers: async (userId,currentId) => {for(let i=sessions.length-1;i>=0;i--)if(sessions[i].userId.equals(userId)&&!sessions[i]._id.equals(currentId))sessions.splice(i,1);},
    consume: async (key,limit) => { const n=(counters.get(key)??0)+1;counters.set(key,n);return n<=limit; },
  };
}