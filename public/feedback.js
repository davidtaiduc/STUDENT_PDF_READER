const form = document.getElementById('feedback-form');
const report = document.getElementById('report');
const status = document.getElementById('report-status');
form.addEventListener('submit', event => {
  event.preventDefault();
  const data = new FormData(form);
  const rows = [
    ['Tác vụ dùng nhiều nhất','preferred'],['Thanh tác vụ dễ dùng','toolbar'],
    ['Selection lấy sai chữ','selection'],['Độ trễ AI','speed'],['Ghi chú/lịch sử','notes'],
    ['Cần OCR/chọn ảnh','ocr'],['Cần bản desktop','desktop'],['Hài lòng','overall'],['Chi tiết','details'],
  ];
  report.textContent = ['STUDYPDF AI — FEEDBACK DAY 7',
    `Thời gian: ${new Date().toLocaleString('vi-VN',{timeZone:'Asia/Bangkok'})}`,
    `Website: ${location.origin}`, ...rows.map(([label,key])=>`${label}: ${data.get(key) || '(không có)'}`)].join('\n\n');
  document.getElementById('report-section').hidden = false;
  status.textContent = '';
});
document.getElementById('copy-report').addEventListener('click',async()=>{
  try { await navigator.clipboard.writeText(report.textContent); status.textContent='Đã sao chép. Bạn có thể gửi cho người mời dùng thử.'; }
  catch { status.textContent='Không sao chép được. Hãy chọn văn bản phía trên hoặc tải tệp.'; }
});
document.getElementById('download-report').addEventListener('click',()=>{
  const url = URL.createObjectURL(new Blob([report.textContent],{type:'text/plain;charset=utf-8'}));
  const link = document.createElement('a'); link.href=url; link.download='studypdf-feedback.txt'; link.click();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
});
