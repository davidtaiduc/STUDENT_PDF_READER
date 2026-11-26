import { useEffect, useState } from 'react';
import AccountMenu from './components/Auth/AccountMenu';
import { useAuth } from './components/Auth/context';
import PdfViewer from "./components/PdfViewer/PdfViewer";

export default function App() {
  const [documentsOpen,setDocumentsOpen]=useState(()=>window.matchMedia('(min-width:1100px)').matches);
  const [documentName,setDocumentName]=useState('');
  const { user, status } = useAuth();
  useEffect(()=>{const media=window.matchMedia('(min-width:1100px)');const update=()=>{if(!media.matches)setDocumentsOpen(false);};media.addEventListener('change',update);return()=>media.removeEventListener('change',update);},[]);
  if (!user && status === 'checking') return <main className="study-entry"><section className="entry-sheet" aria-label="Đang mở StudyPDF"><span className="entry-monogram" aria-hidden="true">S</span><h1>Đang mở không gian học tập…</h1><p role="status">Bạn chờ một chút nhé. Lần mở đầu có thể mất khoảng một phút.</p><p className="entry-note">Sau khi mở xong, bạn có thể đọc PDF và tiếp tục các cuộc trò chuyện đã lưu.</p></section></main>;
  if (!user) return (
    <main className="study-entry">
      <a className="entry-back" href={`${import.meta.env.BASE_URL}gioi-thieu.html`}>← Về trang giới thiệu</a>
      <section className="entry-sheet" aria-labelledby="entry-title">
        <span className="entry-monogram" aria-hidden="true">S</span>
        <p className="entry-eyebrow">STUDYPDF AI · KHÔNG GIAN HỌC TẬP</p>
        <h1 id="entry-title">Một trang sách.<br />Một khởi đầu mới.</h1>
        <p>Đăng nhập hoặc tạo tài khoản để bắt đầu đọc PDF và trao đổi với AI.</p>
        <AccountMenu />
        <p className="entry-note">Bạn chọn tài liệu và quyết định nội dung gửi đến AI.</p><p className="entry-note"><a href={`${import.meta.env.BASE_URL}privacy.html`}>Quyền riêng tư</a> · <a href={`${import.meta.env.BASE_URL}terms.html`}>Điều khoản sử dụng</a></p>
      </section>
    </main>
  );
  return (
    <div className="app">
      <a className="reader-skip-link" href="#reader-main">Bỏ qua điều hướng</a>
      <header className="app-header">
        <div className="app-brand"><span className="brand-symbol" aria-hidden="true">S</span><span>StudyPDF <b>AI</b></span><button className="navigation-toggle" aria-label="Bật/tắt danh sách tài liệu" aria-expanded={documentsOpen} onClick={()=>setDocumentsOpen(value=>!value)}>☰</button></div>
        <div className="current-document-title" title={documentName}>{documentName || "Không gian đọc PDF"}</div>
        <nav className="header-actions" aria-label="Tài khoản và trợ giúp">
          <button className="account-menu-trigger" popoverTarget="reader-account-menu" aria-label="Mở menu tài khoản và trợ giúp">Tài khoản <span aria-hidden="true">⌄</span></button>
          <div id="reader-account-menu" className="reader-account-menu" popover="auto" aria-label="Tài khoản và trợ giúp">
            <p className="menu-eyebrow">STUDYPDF AI</p>
            <AccountMenu />
            <div className="account-menu-utilities">
              <a href={`${import.meta.env.BASE_URL}gioi-thieu.html`}>Giới thiệu StudyPDF</a><a href={`${import.meta.env.BASE_URL}privacy.html`}>Quyền riêng tư</a><a href={`${import.meta.env.BASE_URL}terms.html`}>Điều khoản sử dụng</a>
              <a href={`${import.meta.env.BASE_URL}guide.html`} target="_blank" rel="noreferrer">Hướng dẫn <span aria-hidden="true">↗</span></a>
              <a href={`${import.meta.env.BASE_URL}feedback.html`} target="_blank" rel="noreferrer">Góp ý <span aria-hidden="true">↗</span></a>
            </div>
          </div>
        </nav>
      </header>

      <main className="app-main" id="reader-main" tabIndex={-1}>
        <PdfViewer documentsOpen={documentsOpen} onToggleDocuments={()=>setDocumentsOpen(value=>!value)} onDocumentChange={setDocumentName} />
      </main>

    </div>
  );
}
