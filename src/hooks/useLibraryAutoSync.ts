import {useCallback,useEffect,useRef,useState} from 'react';
import type {OwnerScope} from '../services/ownerScope';
import {subscribeLibrary} from '../services/library/store';
import {syncLibrary} from '../services/library/cloud';
import {createAutoSync,type AutoSyncState} from '../services/library/autoSyncController';
export function useLibraryAutoSync(owner:OwnerScope,canRun:()=>boolean){
 const [state,setState]=useState<AutoSyncState>({phase:'waiting',message:'Đang chuẩn bị đồng bộ MongoDB…'});
 const retryRef=useRef<()=>void>(()=>{});
 useEffect(()=>{
  if(owner==='guest')return;
  const controller=createAutoSync({run:(signal,onProgress)=>syncLibrary(owner,onProgress,{signal,canCommit:canRun}),canRun:()=>navigator.onLine&&canRun(),onState:setState});
  retryRef.current=controller.retry;
  const unsubscribe=subscribeLibrary(controller.change);
  const resume=()=>{if(document.visibilityState==='visible')controller.retry();};
  window.addEventListener('online',resume);window.addEventListener('focus',resume);document.addEventListener('visibilitychange',resume);
  const poll=setInterval(resume,60000);controller.retry();
  return()=>{retryRef.current=()=>{};controller.stop();unsubscribe();clearInterval(poll);window.removeEventListener('online',resume);window.removeEventListener('focus',resume);document.removeEventListener('visibilitychange',resume);};
 },[owner,canRun]);
 const retry=useCallback(()=>retryRef.current(),[]);
 return {state,retry};
}
