import PdfViewer from "./components/PdfViewer/PdfViewer";

export default function App() {
  return (
    <div className="app">
      <header className="app-header">StudyPDF AI</header>

      <main className="app-main">
        <PdfViewer />
      </main>

      <section className="ai-panel">
        <strong>AI Assistant</strong>
        <p>Chọn một đoạn văn để bắt đầu.</p>
      </section>
    </div>
  );
}
