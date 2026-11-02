// Shared bounded SSE reader for the browser and the Gemini proxy.
export async function readSse(body: ReadableStream<Uint8Array>, signal: AbortSignal,
  onData: (data: string) => boolean | void | Promise<boolean | void>) {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let lines: string[] = [];
  const cancel = () => { void reader.cancel().catch(() => {}); };
  signal.addEventListener('abort', cancel, { once: true });
  try {
    signal.throwIfAborted();
    while (true) {
      const { value, done } = await reader.read();
      signal.throwIfAborted();
      buffer += decoder.decode(value, { stream: !done });
      if (buffer.length > 262144) throw new Error('Phản hồi AI vượt giới hạn.');
      let end: number;
      while ((end = buffer.indexOf('\n')) !== -1) {
        const line = buffer.slice(0, end).replace(/\r$/, '');
        buffer = buffer.slice(end + 1);
        if (!line) {
          if (lines.length && await onData(lines.join('\n')) === false) return;
          lines = [];
        } else if (line.startsWith('data:')) {
          lines.push(line.slice(5).replace(/^ /, ''));
          if (lines.reduce((n, l) => n + l.length, 0) > 262144) throw new Error('Phản hồi AI vượt giới hạn.');
        }
      }
      if (done) return; // An event must end with a blank line.
    }
  } finally {
    signal.removeEventListener('abort', cancel);
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}
