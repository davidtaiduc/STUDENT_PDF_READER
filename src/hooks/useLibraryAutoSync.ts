import {useEffect} from 'react';
import type {OwnerScope} from '../services/ownerScope';
import {subscribeLibrary} from '../services/library/store';
import {syncLibrary} from '../services/library/cloud';
import {createAutoSync} from '../services/library/autoSyncController';
export function useLibraryAutoSync(owner:OwnerScope,canRun:()=>boolean){
 useEffect(()=>{
  if(owner==='guest')return;
  const controller=createAutoSync({run:(signal,onProgress)=>syncLibrary(owner,onProgress,{signal,canCommit:canRun}),canRun:()=>navigator.onLine&&canRun(),onState:()=>{}});
  const unsubscribe=subscribeLibrary(controller.change);
  const resume=()=>{if(document.visibilityState==='visible')controller.retry();};
  window.addEventListener('online',resume);window.addEventListener('focus',resume);document.addEventListener('visibilitychange',resume);
  const poll=setInterval(resume,60000);controller.retry();
  return()=>{controller.stop();unsubscribe();clearInterval(poll);window.removeEventListener('online',resume);window.removeEventListener('focus',resume);document.removeEventListener('visibilitychange',resume);};
 },[owner,canRun]);
}
