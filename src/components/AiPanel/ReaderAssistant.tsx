import type {LibrarySession} from '../../services/library/store';
import {useAuth} from '../Auth/context';
import type {OwnerScope} from '../../services/ownerScope';
import {useState,type Ref} from 'react';
import type {ReaderContext} from '../../types/reader';
import type {PdfSelection} from '../../types/selection';
import type {ChatActionHandle} from './ChatPanel';
import {useOwnerScope} from '../Auth/useOwnerScope';
import SelectionAssistant from './SelectionAssistant';
import UsageStatus from './UsageStatus';
import {readAiSelection} from '../../utils/readAiSelection';
export default function ReaderAssistant({librarySession,readerContext,actionRef,selection,fileName}:{librarySession?:LibrarySession;readerContext?:ReaderContext;actionRef?:Ref<ChatActionHandle>;selection:PdfSelection|null;fileName:string}){
 const ownerScope=useOwnerScope();
 const {user}=useAuth();
 const sessionScope:OwnerScope=user?`user:${user.id}`:'guest';
 const [selectionOwner,setSelectionOwner]=useState(sessionScope);
 const [aiSelection,setAiSelection]=useState<PdfSelection|null>(null),[previous,setPrevious]=useState(selection);
 if(selectionOwner!==sessionScope){setSelectionOwner(sessionScope);setAiSelection(null);setPrevious(selection);}
 if(selection&&selection!==previous){setPrevious(selection);if(aiSelection)setAiSelection(null);}
 const capture=(root:HTMLElement)=>{const value=readAiSelection(root);if(value)setAiSelection(value);};
 return <aside className="assistant-sidebar" aria-label="Hỏi AI" data-selection-controls onPointerUp={e=>capture(e.currentTarget)} onKeyUp={e=>capture(e.currentTarget)}>
  <header className="assistant-header"><h1>Hỏi tài liệu</h1><details className="reader-usage-details"><summary>Hạn mức AI</summary>{ownerScope&&<UsageStatus ownerScope={ownerScope}/>}</details>{!fileName&&<p>Mở PDF và chọn nội dung để bắt đầu.</p>}</header>
  <div className="assistant-view"><div className="assistant-session" hidden={!ownerScope}><SelectionAssistant librarySession={librarySession?.owner===sessionScope?librarySession:undefined} key={`${sessionScope}:${librarySession?.owner===sessionScope?`${librarySession.chatId}:${librarySession.revision}`:"empty"}`} readerContext={readerContext} actionRef={actionRef} ownerScope={sessionScope} selection={selection} aiSelection={aiSelection} onClearAiSelection={()=>setAiSelection(null)}/></div>{!ownerScope&&<p role="status">Đang xác nhận phiên đăng nhập…</p>}</div>
 </aside>;
}
