import {GridFSBucket,type Db} from 'mongodb';
/** Idempotent reaper: tombstones also block delayed uploads from deleted accounts. */
export async function purgeDeletedAccounts(db:Db) {
  const bucket=new GridFSBucket(db,{bucketName:'library_archives_v1'});
  let count=0;
  for await(const user of db.collection('users').find({deletedAt:{$exists:true}},{projection:{_id:1}})){
    const id=user._id.toHexString();
    await db.collection<{_id:string;revision:number;deleted:boolean}>('library_heads_v1').updateOne({_id:id},{$set:{deleted:true},$inc:{revision:1},$unset:{blobId:'',size:'',updatedAt:''}},{upsert:true});
    for await(const file of bucket.find({'metadata.userId':id}))await bucket.delete(file._id);
    await db.collection('sessions').deleteMany({userId:user._id});
    await db.collection<{_id:string}>('ai_user_usage_v1').deleteOne({_id:id});
    await db.collection<{_id:string}>('ai_request_rate_v1').deleteMany({_id:{$regex:`^${id}:`}});
    count++;
  }
  return count;
}
