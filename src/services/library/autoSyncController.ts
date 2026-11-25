export type AutoSyncState={phase:'waiting'|'syncing'|'saved'|'error';message:string;lastSaved?:Date};
export function createAutoSync(options:{run:(signal:AbortSignal,onProgress:(text:string)=>void)=>Promise<Date>;canRun:()=>boolean;onState:(state:AutoSyncState)=>void;debounceMs?:number;retryMs?:number}){
 let stopped=false,running=false,pending=false,timer:ReturnType<typeof setTimeout>|undefined,request:AbortController|undefined,failures=0,lastSaved:Date|undefined;
 const emit=(phase:AutoSyncState['phase'],message:string)=>{if(!stopped)options.onState({phase,message,lastSaved});};
 const schedule=(delay:number)=>{clearTimeout(timer);if(!stopped)timer=setTimeout(()=>{void work();},delay);};
 const work=async()=>{
  if(stopped||running)return;if(!options.canRun()){emit('waiting','Đang chờ lưu lên MongoDB…');schedule(options.retryMs??5000);return;}
  running=true;pending=false;request=new AbortController();emit('syncing','Đang đồng bộ MongoDB…');
  try{lastSaved=await options.run(request.signal,text=>emit('syncing',text));failures=0;if(pending)emit('waiting','Đang chờ lưu thay đổi mới lên MongoDB…');else emit('saved',`Đã đồng bộ MongoDB lúc ${lastSaved.toLocaleTimeString('vi-VN')}.`);}
  catch(error){if(stopped)return;pending=true;const deferred=error instanceof DOMException&&error.name==='InvalidStateError';if(!deferred)failures++;emit(deferred?'waiting':'error',deferred?'Đang chờ hội thoại lưu xong…':error instanceof Error?`${error.message} Sẽ thử lại tự động.`:'Chưa lưu được lên MongoDB. Bản trên máy vẫn được giữ.');}
  finally{running=false;request=undefined;if(pending&&!stopped)schedule(failures?Math.min((options.retryMs??5000)*2**Math.min(failures-1,4),60000):(options.debounceMs??2000));}
 };
 return {change(){if(stopped)return;pending=true;if(!running){emit('waiting','Có thay đổi chưa lên MongoDB…');schedule(options.debounceMs??2000);}},retry(){if(stopped)return;pending=true;if(!running)schedule(0);},stop(){stopped=true;clearTimeout(timer);request?.abort();}};
}
