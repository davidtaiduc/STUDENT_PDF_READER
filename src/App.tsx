import PdfViewer from "./components/PdfViewer/PdfViewer";
import BackendStatus from "./components/BackendStatus";

export default function App() {
  return (
    <div className="app">
      <header className="app-header">
        <div className="app-brand"><span>StudyPDF AI</span><BackendStatus /></div>
        <nav aria-label="Trợ giúp">
          <a href={`${import.meta.env.BASE_URL}guide.html`} target="_blank" rel="noreferrer">Hướng dẫn</a>
          <a href={`${import.meta.env.BASE_URL}feedback.html`} target="_blank" rel="noreferrer">Góp ý</a>
        </nav>
      </header>

      <main className="app-main">
        <PdfViewer />
      </main>

    </div>
  );
}
