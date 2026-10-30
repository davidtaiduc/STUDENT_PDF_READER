import { buildMessages } from "./prompts.ts";
import type { AiExcerpt } from "./prompts.ts";
import type { AiAction } from "../../types/ai.ts";

/** Decode NDJSON across arbitrary byte boundaries, including split UTF-8. */
export async function consumeChatStream(
  body: ReadableStream<Uint8Array>, onText: (text: string) => void, signal: AbortSignal,
) {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let done = false;
  const consume = (line: string) => {
    if (!line.trim()) return;
    let data: { error?: string; message?: { content?: string }; done?: boolean };
    try { data = JSON.parse(line); } catch { throw new Error("Phản hồi Ollama không đúng định dạng NDJSON."); }
    if (!data || typeof data !== "object") throw new Error("Phản hồi Ollama không hợp lệ.");
    if (data.error) throw new Error(`Ollama: ${String(data.error).slice(0, 400)}`);
    if (data.message?.content !== undefined && typeof data.message.content !== "string") {
      throw new Error("Nội dung phản hồi Ollama không hợp lệ.");
    }
    if (data.message?.content) onText(data.message.content);
    done = data.done === true;
  };
  const abort = () => { void reader.cancel().catch(() => {}); };
  signal.addEventListener("abort", abort, { once: true });
  try {
    signal.throwIfAborted();
    while (!done) {
      const chunk = await reader.read();
      signal.throwIfAborted();
      buffer += chunk.done ? decoder.decode() : decoder.decode(chunk.value, { stream: true });
      let end: number;
      while (!done && (end = buffer.indexOf("\n")) !== -1) {
        const line = buffer.slice(0, end);
        buffer = buffer.slice(end + 1);
        consume(line);
      }
      if (buffer.length > 1_000_000) throw new Error("Phản hồi Ollama quá lớn hoặc thiếu dấu xuống dòng.");
      if (chunk.done) {
        if (!done && buffer.trim()) consume(buffer);
        if (!done) throw new Error("Kết nối Ollama bị ngắt trước khi hoàn tất. Bạn có thể thử lại.");
        break;
      }
    }
  } finally {
    signal.removeEventListener("abort", abort);
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}

export async function streamOllama({ action, excerpt, question, model, baseUrl = "/ollama", signal, onText }: {
  action: AiAction; excerpt: AiExcerpt; question?: string; model: string;
  baseUrl?: string; signal: AbortSignal; onText: (text: string) => void;
}) {
  const messages = buildMessages(action, excerpt, question);
  if (!model.trim()) throw new Error("Hãy nhập tên model Ollama.");
  const timeout = AbortSignal.timeout(180_000);
  const combined = AbortSignal.any([signal, timeout]);
  try {
    const response = await fetch(`${baseUrl.replace(/\/+$/, "")}/api/chat`, {
      method: "POST", headers: { "Content-Type": "application/json" }, signal: combined,
      body: JSON.stringify({ model: model.trim(), messages, stream: true, keep_alive: "30m", think: false,
        options: { num_predict: 1200, temperature: action === "translate" ? 0.1 : 0.3 } }),
    });
    if (!response.ok) {
      const detail = (await response.text()).slice(0, 400);
      if (response.status === 404) throw new Error(`Không tìm thấy model “${model}”. Kiểm tra tên model bằng ollama list.`);
      if (response.status >= 500) throw new Error("Ollama chưa sẵn sàng. Hãy mở Ollama, kiểm tra model và bộ nhớ rồi thử lại.");
      throw new Error(`Ollama trả lỗi HTTP ${response.status}: ${detail}`);
    }
    if (!response.body) throw new Error("Trình duyệt không hỗ trợ đọc phản hồi stream. Hãy thử Chrome hoặc Edge.");
    let received = false;
    await consumeChatStream(response.body, (text) => { received = true; onText(text); }, combined);
    if (!received) throw new Error("Ollama không trả nội dung. Hãy kiểm tra model rồi thử lại.");
  } catch (error) {
    if (signal.aborted) throw signal.reason;
    if (timeout.aborted) throw new Error("Ollama chưa hoàn tất sau 3 phút. Hãy chọn đoạn ngắn hơn hoặc kiểm tra model.", { cause: error });
    if (error instanceof TypeError) throw new Error("Không kết nối được Ollama. Hãy mở Ollama tại localhost:11434 rồi thử lại. Nếu dùng bản web tĩnh, kiểm tra cấu hình CORS.", { cause: error });
    throw error;
  }
}
