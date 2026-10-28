# DAY 05 — AI Integration & Streaming

## Mục tiêu của ngày
Kết nối AI thật để người dùng có thể Dịch / Giải thích / Hỏi AI và thấy kết quả stream dần trong panel.

## Phạm vi cần hoàn thiện
- Hỗ trợ Ollama local.
- Model mặc định gợi ý: `qwen3:8b`.
- Streaming bằng `fetch` + `ReadableStream`.
- Hiển thị text dần khi model trả về.
- Thiết lập `keep_alive` phù hợp.
- Nếu model hỗ trợ, tắt reasoning dài không cần thiết.
- Prompt riêng cho:
  - Dịch
  - Giải thích
  - Hỏi AI
- Context trước/sau chỉ dùng để hiểu.
- Không trả lời lan man ngoài selected text.
- Giữ nguyên công thức, ký hiệu toán học và biến.
- Loading / stop / error state rõ ràng.
- Thông báo dễ hiểu nếu không kết nối được Ollama.
- Gợi ý Chrome/Edge cho nhóm test nếu cần.
- BYOK là tùy chọn nếu kịp, không bắt buộc.

## Ollama
Base URL:
```text
http://localhost:11434
```

## Request cần cân nhắc
- `stream: true`
- `keep_alive: "30m"`
- model phù hợp
- prompt ngắn, rõ ràng

## Không làm trong Day 05
- Không backend lớn.
- Không wallet.
- Không payment.
- Không account.
- Không OCR.

## Acceptance Criteria
- [ ] Kết nối được Ollama.
- [ ] Dịch hoạt động.
- [ ] Giải thích hoạt động.
- [ ] Hỏi AI hoạt động.
- [ ] Streaming hiển thị dần.
- [ ] Error khi Ollama tắt được xử lý rõ ràng.
- [ ] Context được gửi hợp lý.
- [ ] Công thức/ký hiệu không bị phá nghiêm trọng.
- [ ] Request mới không làm UI treo.
- [ ] Build pass.
- [ ] Lint pass.

## Manual Test
- Tắt Ollama rồi thử gọi.
- Bật Ollama lại rồi gọi.
- Dịch câu ngắn.
- Giải thích đoạn kỹ thuật.
- Hỏi follow-up về selection.
- Thử đoạn có công thức.
- Thử đoạn tiếng Việt / tiếng Anh.

## Prompt kiểm thử cuối ngày
Hãy đọc `docs/DAY_05.md` và các service AI/Ollama liên quan.

Chạy build + lint.

Kiểm tra:
- endpoint Ollama
- streaming parser
- abort/cancel nếu có
- loading/error
- prompt cho 3 action
- xử lý khi Ollama offline

Không thêm backend/account/payment.
Không commit, không push.

Trả về `DAY 05 STATUS`.
