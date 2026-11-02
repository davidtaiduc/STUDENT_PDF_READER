import { useEffect, useState } from 'react';
import { fetchBackendHealth } from '../services/backend';

type Status = 'checking' | 'connected' | 'no-ai' | 'no-database' | 'offline';
const labels: Record<Status, string> = {
  checking: 'Đang kiểm tra máy chủ…', connected: 'Đã kết nối máy chủ',
  'no-ai': 'Đã kết nối · AI chưa cấu hình', 'no-database': 'Máy chủ tạm mất kết nối dữ liệu', offline: 'Chưa kết nối máy chủ',
};

export default function BackendStatus() {
  const [status, setStatus] = useState<Status>('checking');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(6000)]);
    void fetchBackendHealth(import.meta.env.VITE_AI_API_URL || '', signal).then(health => {
      if (controller.signal.aborted) return;
      setStatus(health.database !== 'connected' ? 'no-database' : health.ai.configured ? 'connected' : 'no-ai');
    }).catch(() => { if (!controller.signal.aborted) setStatus('offline'); });
    return () => controller.abort();
  }, [attempt]);
  return <div className="backend-status" data-state={status}>
    <span role="status">{labels[status]}</span>
    <button disabled={status === 'checking'} onClick={() => { setStatus('checking'); setAttempt(n => n + 1); }} aria-label="Kiểm tra kết nối máy chủ">Kiểm tra</button>
  </div>;
}
