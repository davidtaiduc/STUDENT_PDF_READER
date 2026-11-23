import { useEffect, useState } from 'react';
import AccountMenu from './components/Auth/AccountMenu';
import PdfViewer from "./components/PdfViewer/PdfViewer";
import BackendStatus from "./components/BackendStatus";

export default function App() {
  const [documentsOpen,setDocumentsOpen]=useState(()=>window.matchMedia('(min-width:1100px)').matches);
  const [documentName,setDocumentName]=useState('');
  useEffect(()=>{const media=window.matchMedia('(min-width:1100px)');const update=()=>{if(!media.matches)setDocumentsOpen(false);};media.addEventListener('change',update);return()=>media.removeEventListener('change',update);},[]);
  return (
    <div className="app">
      <header className="app-header">
        <div className="app-brand"><span className="brand-symbol" aria-hidden="true">S</span><span>StudyPDF <b>AI</b></span><button className="navigation-toggle" aria-label="Bật/tắt danh sách tài liệu" aria-expanded={documentsOpen} onClick={()=>setDocumentsOpen(value=>!value)}>☰</button></div>
        <div className="current-document-title" title={documentName}>{documentName || "Không gian đọc PDF"}</div>
        <nav aria-label="Trợ giúp">
          <BackendStatus /><AccountMenu />
          <a href={`${import.meta.env.BASE_URL}guide.html`} target="_blank" rel="noreferrer">Hướng dẫn</a>
          <a href={`${import.meta.env.BASE_URL}feedback.html`} target="_blank" rel="noreferrer">Góp ý</a>
        </nav>
      </header>

      <main className="app-main">
        <PdfViewer documentsOpen={documentsOpen} onToggleDocuments={()=>setDocumentsOpen(value=>!value)} onDocumentChange={setDocumentName} />
      </main>

    </div>
  );
}
