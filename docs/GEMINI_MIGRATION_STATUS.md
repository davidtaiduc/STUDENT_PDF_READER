# Chuyển AI sang Gemini — 02/11/2026

## Cập nhật: thông báo lỗi và thời gian chờ dễ hiểu

Phân biệt Gemini giới hạn tốc độ, quota ngày, hạn mức ứng dụng và ứng dụng bận bằng mã lỗi/metadata thay vì gộp HTTP 429 thành hết hạn mức. Giữ lời giải thích trung lập khi nhà cung cấp không cho biết loại giới hạn. Retry-After/RetryInfo được truyền an toàn qua SSE/JSON, UI đếm ngược và khóa nút Thử lại; lỗi quota ngày/cấu hình/số dư không khuyến khích thử lại ngay. Không có retry tự động hoặc thay đổi `.env`.

51 tests qua, lint/build qua. Browser kiểm thử trên fixture loopback 5174: thông báo Gemini cần khoảng nghỉ và nút disabled 15 giây, sau đó nút mở lại và yêu cầu giả lập hoàn tất. Không gọi Google hoặc ghi MongoDB trong bài UI lỗi. Ảnh: AI_WAIT_PREVIEW.png. Backend thật được khởi động lại ở chế độ development-unlimited; OneSite chưa cập nhật.

## Cập nhật: kiểm thử local không giới hạn số lượt

`npm run server` bật chế độ phát triển chỉ trên loopback, bỏ hạn mức số lượt theo phút/ngày và không tăng bộ đếm MongoDB. Backend đã khởi động lại ở chế độ này; `.env` giữ nguyên. `npm run server:production` vẫn áp dụng quota. Không đổi giới hạn phía Google, độ dài dữ liệu, timeout, concurrency hay xác thực nội bộ. Thêm kiểm thử 105 yêu cầu HTTP hợp lệ liên tiếp với provider giả lập; 45 tests, lint và typecheck backend qua.

## Cập nhật: không nhập mã trên giao diện

Người dùng chọn đoạn và chạy Dịch/Giải thích ngay; Hỏi AI chỉ cần câu hỏi. Đã xóa ô nhập mã và Authorization khỏi trình duyệt. Vite web server local thêm credential nội bộ khi proxy sang backend, chỉ cho kết nối loopback, host local và origin phù hợp. API trực tiếp vẫn cần xác thực; quota MongoDB, concurrency và giới hạn payload giữ nguyên. Tài khoản sẽ làm sau; chưa công bố API không xác thực.

Xác nhận thật: MongoDB của người dùng kết nối thành công; frontend 5173 gọi /api/access không kèm mã nhận 200 qua proxy, API trực tiếp nhận 401, origin ngoài nhận 403. Trình duyệt mở Test Case 5, chọn AI và Dịch: Gemini stream hoàn tất mà không hỏi mã. 42 tests, lint, build và kiểm tra secrets không xuất hiện trong bundle đều qua. Bản OneSite vẫn là bản cũ; proxy mới chỉ áp dụng local.

Các ghi nhận triển khai ban đầu bên dưới phản ánh thời điểm trước cập nhật này.

Đã bỏ adapter và proxy Ollama khỏi runtime. Ba tác vụ Dịch/Giải thích/Hỏi dùng Node.js API `/api/ai` và Gemini Interactions (stream, store:false). Model do server cấu hình. Có hủy yêu cầu khi Dừng, đổi đoạn hoặc đóng panel; ghi nhận model khi lưu kết quả. Lịch sử IndexedDB cũ giữ nguyên.

Gemini API key chỉ ở backend. Mã truy cập ứng dụng dùng chung được kiểm tra ở backend và giữ trong sessionStorage khi nhập trên UI. CORS allowlist, giới hạn payload/ngữ cảnh, timeout, concurrency và bộ đếm MongoDB nguyên tử hạn chế lượt gọi. MongoDB không lưu nội dung PDF/prompt/kết quả. Database lỗi thì API từ chối xử lý thay vì bỏ qua hạn mức.

Backend hiện đọc `.env` (ignored), đã giữ lại Gemini key và mã truy cập, chờ người dùng điền URI database đã có. Đã dừng MongoDB local thử nghiệm theo yêu cầu người dùng; không cài Windows service hay mở cổng mạng. Không ghi bí mật vào tài liệu này. Chưa xác nhận kết nối database của người dùng hay Gemini thật.

Kiểm tra: 39 test qua (thêm health, key tùy chọn, access/principal, lỗi xác thực, phản hồi sai từ proxy; cùng provider mock, HTTP backend loopback, quota mock, SSE UTF8, CORS/auth/validation/DB fail-closed, concurrency và abort, hồi quy selection/IndexedDB). Lint và kiểm tra kiểu backend qua; npm audit runtime ở lượt trước: 0 lỗ hổng. Browser lượt trước mở PDF thật và hiển thị panel Gemini/mã truy cập đúng. Test provider không gọi Google và không tốn quota. `npm run check:backend` dùng để xác nhận kết nối thật sau khi điền URI.

Đã tách pool MongoDB và bộ xác thực thành module riêng; route nhận principal, chuẩn bị cho repository users/sessions sau này. Chưa triển khai tài khoản người dùng hoặc đồng bộ ghi chú.

Preview OneSite và ZIP trong release vẫn là phiên bản Ollama đã xuất trước đó. Chưa upload bản mới: cần backend HTTPS thật và VITE_AI_API_URL để build tĩnh. Local MongoDB không phải hosting Node.js. Hướng dẫn vận hành: GEMINI_SETUP.md.
