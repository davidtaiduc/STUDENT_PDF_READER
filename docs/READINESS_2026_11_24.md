# Báo cáo hoàn thiện StudyPDF — 24/11/2026

## Những gì đã thay đổi

- Bắt buộc đăng nhập tại root và đường vào từ trang giới thiệu. Kiểm tra lại phiên với user còn tồn tại không tháo trình đọc; màn hình kiểm tra ban đầu không tiêu thụ fragment email rồi làm mất token khi chuyển layout.
- Xóa tài khoản yêu cầu cookie/Origin, mật khẩu hiện tại, cụm xác nhận, giới hạn thử mật khẩu và compare-and-swap theo hash/generation. Xóa thông tin cá nhân và vô hiệu hóa phiên ngay. Worker dọn GridFS/session/quota khi khởi động và mỗi phút, lặp lại được; head tombstone ngăn commit upload muộn. Không chạy thao tác xóa trên tài khoản thật trong QA.
- Xóa thư viện local của đúng tài khoản; giữ thư viện tài khoản khác. Dữ liệu trên thiết bị khác và file xuất/backup cần xử lý riêng.
- Sửa WebKit IndexedDB không ghi được Blob/File: ghi ArrayBuffer mới, vẫn đọc/export được Blob cũ; nhập snapshot chuyển Blob sang byte trước transaction. Không migrate hay xóa dữ liệu cũ hàng loạt.
- Ngân sách tiếp nhận AI chung mặc định 500/ngày UTC, ngoài quota 30/user/ngày, 5/phút và 3 slot. Guard nằm trước quota user/provider nên khi hết ngân sách không gọi Gemini hoặc trừ lượt user. Đây là giới hạn bảo thủ, không phải trần tiền chính xác; xem deployment/README.md.
- Gateway production phục vụ dist và proxy cùng origin, ghi đè token browser phía server, chặn origin ngoài allowlist, không phục vụ file ẩn/.env, có header bảo mật và stream SSE không buffer. Xác thực proxy IP chỉ từ loopback có credential nội bộ.
- Mẫu Docker, systemd, Nginx; preflight config, healthcheck, hướng dẫn backup/restore/rollback. CI hiện có được giữ lại và thêm browser regression/artifact.
- Trang quyền riêng tư/điều khoản tiếng Việt, liên kết trước/sau đăng nhập; sửa mô tả đồng bộ đã lỗi thời.

## Bằng chứng

| Kiểm tra | Kết quả và giới hạn |
| --- | --- |
| Lint/build | Đạt; Vite vẫn cảnh báo bundle lớn, chưa có phép đo tải staging |
| Unit/API/storage/gateway | 110/110 đạt; auth, email token, quota, xóa tài khoản, không xóa nhầm owner, backward compatibility Blob, proxy, PDF stress |
| Chromium | 13/13 browser tests đạt |
| Firefox | 13/13 browser tests đạt |
| WebKit | 13/13 browser tests đạt; engine này không thay thế Safari trên thiết bị Apple thật |
| Gemini thật | 5/5 mẫu đạt: Nhật, Anh, Việt, công thức và trắc nghiệm; khoảng 0,4–1,8 giây mỗi mẫu trong lần đo này. Không suy rộng thành SLA hoặc tải đồng thời |
| Email thật | MongoDB đọc được tài khoản nhận được cho phép; Resend chấp nhận hai email verify/reset. Không log link/token, không đổi mật khẩu. Chưa xác nhận hộp thư đến bằng người nhận |
| PDF | Mẫu tổng hợp 300 trang: mở, chuyển trang cuối; image-only không có text; PDF lỗi bị từ chối. Không đại diện mọi PDF nặng thực tế |
| Đồng bộ | Hai browser context độc lập, archive transport giả: hợp nhất file và giữ local khi 409; không phải phép thử GridFS trên server thật |
| Mongo integration | 3 test SKIP vì chưa có MONGODB_TEST_URI riêng. Đã bổ sung kiểm tra reaper/idempotence/isolation vào test GridFS chờ cấu hình |
| Production | Gateway được test với API/file tạm. Chưa chạy Docker image hoặc Nginx HTTPS vì môi trường không có Docker/hosting/chứng chỉ. Chưa deploy |

Báo cáo live không chứa credential, token hoặc email nhận: `qa/live-ai-2026-11-24.json`, `qa/live-email-2026-11-24.json`. AI chỉ dùng đoạn tổng hợp, không gửi PDF cá nhân. Email đã được người dùng chỉ định địa chỉ nhận.

## Những bước bên ngoài còn cần

1. Người dùng tự điền MONGODB_TEST_URI của môi trường riêng và MONGODB_TEST_ALLOW_WRITE=isolated-tests; không dùng URI ứng dụng. `npm run test:integration` đọc .env thật và từ chối thiếu opt-in.
2. Người nhận xác nhận hai email có vào inbox/spam và liên kết mở đúng ứng dụng. Không cần gửi token vào chat. Email reset không cần bấm nếu không muốn đổi mật khẩu.
3. Hosting Node.js/HTTPS/domain, DNS tên miền gửi và chính sách backup/kênh liên hệ chính thức phải do người vận hành cấu hình. .env hiện tại vẫn là local, preflight production sẽ không đạt HTTPS. Không tự sửa .env thật.
4. Kiểm tra iPhone/Safari thật và thử tải đồng thời sau khi có môi trường staging. Chưa đưa ra số lượng người dùng server có thể chịu.

Bước thử khởi động production bằng .env thật bị automatic approval review từ chối do worker có thể dọn dữ liệu tài khoản đã đánh dấu xóa trên MongoDB hiện tại. Không thử lách; thay bằng gateway test cô lập. Chưa có phép thử production với DB thật.

## Chạy lại

```powershell
npm run lint
npm test
npm run build
npm run check:secrets
npm run check:readiness
$env:PLAYWRIGHT_BROWSERS_PATH = "$PWD\tmp\playwright-browsers"
npx playwright install chromium firefox webkit
$env:UI_BROWSER = 'chromium' # hoặc firefox, webkit
npm run test:visual
npm run test:integration # SKIP nếu thiếu cấu hình test riêng
```

Các lệnh `check:live-ai` và `check:live-email` gọi dịch vụ thật; không nằm trong CI và không tự gửi lại email. Chỉ chạy email với người nhận được cho phép.
