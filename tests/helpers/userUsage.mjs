export function fakeUserUsage() {
 const records=new Map();
 return {records,read:async id=>records.has(id)?{...records.get(id)}:null,
  accept:async(userId,day,minute,daily,perMinute,requestId)=>{
   const old=records.get(userId),used=old?.day===day?old.dailyUsed:0,min=old?.minute===minute?old.minuteUsed:0;
   if(used<daily&&min<perMinute){const next={_id:userId,userId,day,dailyUsed:used+1,minute,minuteUsed:min+1,lastAccepted:requestId};records.set(userId,next);return {...next};}
   return {...old};
  }};
}
