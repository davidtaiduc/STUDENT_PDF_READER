# StudyPDF AI / Student PDF Reader

Ứng dụng web giúp sinh viên đọc PDF, bôi đen đoạn cần hiểu, dịch sang tiếng Việt, giải thích và đặt câu hỏi bằng Gemini. Giao diện đặt PDF bên trái, trợ lý và lịch sử học tập bên phải. PDF được mở tại trình duyệt; các tác vụ AI đi qua backend Node.js để giữ kín Gemini API key.

README này là điểm bắt đầu cho lập trình viên và AI tiếp quản dự án. **Trạng thái đối chiếu với mã nguồn: 02/11/2026.** Khi tiếp tục phát triển, đọc [AGENTS.md](AGENTS.md), kiểm tra mã và cập nhật README nếu thay đổi kiến trúc hoặc cách chạy. Các kế hoạch `docs/DAY_*.md` phản ánh lịch sử, có thể chứa cấu hình Ollama và đường dẫn trước khi tổ chức lại thư mục.

## Mục lục

- [Trạng thái hiện tại](#trạng-thái-hiện-tại)
- [Chạy local từ bản clone](#chạy-local-từ-bản-clone)
- [Cấu hình môi trường](#cấu-hình-môi-trường)
- [Các lệnh npm](#các-lệnh-npm)
- [Cấu trúc mã nguồn](#cấu-trúc-mã-nguồn)
- [Kiến trúc và ranh giới dữ liệu](#kiến-trúc-và-ranh-giới-dữ-liệu)
- [Luồng đọc PDF và chọn văn bản](#luồng-đọc-pdf-và-chọn-văn-bản)
- [Luồng AI và hợp đồng API](#luồng-ai-và-hợp-đồng-api)
- [Ghi chú, lịch sử và nhận diện tài liệu](#ghi-chú-lịch-sử-và-nhận-diện-tài-liệu)
- [Hạn mức và xử lý lỗi](#hạn-mức-và-xử-lý-lỗi)
- [Kiểm thử và CI](#kiểm-thử-và-ci)
- [Chẩn đoán lỗi thường gặp](#chẩn-đoán-lỗi-thường-gặp)
- [Git, Preview và triển khai](#git-preview-và-triển-khai)
- [Hướng dẫn cho AI tiếp quản](#hướng-dẫn-cho-ai-tiếp-quản)
- [Việc phát triển tiếp theo](#việc-phát-triển-tiếp-theo)
- [Tài liệu liên quan](#tài-liệu-liên-quan)

## Trạng thái hiện tại

### Đã có trong mã nguồn

| Nhóm | Chức năng |
|---|---|
| Đọc PDF | Mở file local, vẽ một trang mỗi lần, chuyển trước/sau, sửa trực tiếp số trang để nhảy nhanh, zoom, vừa chiều rộng |
| Chọn văn bản | Lớp chữ PDF.js, sắp xếp đoạn trích, chuẩn hóa khoảng trắng/nối từ ngắt dòng, lấy ngữ cảnh lân cận |
| AI | Dịch, giải thích và hỏi về đoạn chọn; stream kết quả từ Gemini qua backend; dừng và thử lại |
| Trải nghiệm | Đổi trang/zoom giữ nguyên bài giải và ghi chú đang soạn; lỗi AI có thông báo theo nguyên nhân và đếm ngược khi cần chờ |
| Học tập | Lưu ghi chú/kết quả, xem lịch sử, sửa ghi chú, sao chép, xóa có xác nhận, quay về trang nguồn |
| Lưu trữ local | IndexedDB, phân biệt tài liệu bằng SHA-256 thay vì tên file |
| Backend | Node.js HTTP API, xác thực nội bộ, CORS allowlist, MongoDB, chính sách hạn mức và lỗi có cấu trúc |
| Chất lượng | Bộ test Node.js, fake IndexedDB, lint, build/typecheck; workflow kiểm tra GitHub đã được chuẩn bị |

### Chưa triển khai hoặc chưa hoàn tất

- Đăng ký/đăng nhập, tài khoản người dùng, phiên đăng nhập, phân quyền và hạn mức theo user.
- Đồng bộ ghi chú/lịch sử lên MongoDB hoặc giữa thiết bị.
- OCR cho PDF scan/ảnh không có lớp chữ.
- Dịch toàn bộ PDF hoặc hỏi đáp dựa trên toàn bộ tài liệu/RAG.
- Hiển thị Markdown/LaTeX; kết quả hiện là văn bản thuần.
- Xuất/nhập bản sao lưu ghi chú.
- Triển khai đầy đủ frontend + backend lên hosting; CI chưa có bước deploy.
- Kiểm thử tải để khẳng định số người dùng đồng thời.

**Hướng làm việc đang được chọn:** tiếp tục phát triển trên local, đưa mã lên Git và chọn hosting sau. Một bản Preview tĩnh từng được đưa lên OneSite; không coi nó là bản mới nhất hoặc bằng chứng rằng backend đang chạy online.

## Chạy local từ bản clone

### Yêu cầu

- Node.js **>=22.18.0**, npm và Git. Xem phiên bản dependency thực tế trong [package.json](package.json) và [package-lock.json](package-lock.json).
- MongoDB có thể truy cập từ máy chạy backend. Có thể dùng database đã có; không bắt buộc cài thêm MongoDB local. MongoDB Compass là công cụ quản trị, không thay thế database server.
- Gemini API key để dùng tác vụ AI. Thiếu key vẫn có thể chạy backend nếu các cấu hình bắt buộc khác hợp lệ, nhưng tác vụ AI trả lỗi cấu hình.
- Trình duyệt hiện đại hỗ trợ PDF.js, IndexedDB, Web Crypto, fetch streaming và AbortController; nên kiểm thử bằng Chrome/Edge desktop.

### Bước 1: cài dependency

Chạy tại **thư mục gốc repository**, nơi có `package.json`:

```sh
npm ci
```

Trên PowerShell, nếu `npm.ps1` bị chặn bởi execution policy, dùng `npm.cmd` thay cho `npm`. Không cần thay chính sách bảo mật Windows chỉ để chạy dự án.

`npm ci` chạy postinstall để đồng bộ CMaps, font và WASM của PDF.js vào `public/pdfjs/`. Giữ lại license đi kèm các tài nguyên này.

### Bước 2: tạo/cấu hình `.env`

**Cấu hình thật của ứng dụng đặt ở `.env` tại gốc repository. `.env.example` chỉ là mẫu, không được dùng làm cấu hình chạy.** Backend đọc `.env` qua cờ Node `--env-file-if-exists=.env`; biến môi trường của tiến trình/hosting được ưu tiên hơn file.

Chỉ khi `.env` chưa tồn tại, có thể sao chép **một bản `.env.example` đã được làm sạch** rồi tự điền giá trị thật. Không ghi đè `.env` đang dùng. Không chép nội dung `.env` vào README, issue, chat, ảnh công khai hoặc Git.

```dotenv
# Ví dụ tên biến; tự điền giá trị thật trong .env.
GEMINI_API_KEY=
GEMINI_MODEL=gemini-3.5-flash-lite
MONGODB_URI=
MONGODB_DB=student_pdf_reader
AI_ACCESS_TOKEN=
ALLOWED_ORIGINS=http://127.0.0.1:5173,http://localhost:5173
HOST=127.0.0.1
PORT=3001
DAILY_REQUEST_LIMIT=100
MINUTE_REQUEST_LIMIT=10
MAX_CONCURRENT_REQUESTS=3
# Tùy chọn nếu DNS hệ thống không tra được MongoDB SRV:
# MONGODB_DNS_SERVERS=1.1.1.1,8.8.8.8
```

`AI_ACCESS_TOKEN` cần chuỗi ngẫu nhiên ít nhất 32 ký tự. Đây là credential **nội bộ giữa máy chủ web và backend**, không phải mã mà người dùng phải nhập mỗi lần dịch. Có thể tự tạo tại terminal:

```sh
node -e "console.log(require('node:crypto').randomBytes(32).toString('base64url'))"
```

### Bước 3: chạy hai tiến trình

Terminal thứ nhất, từ thư mục gốc:

```sh
npm run dev:backend
```

Đợi thông báo backend sẵn sàng và MongoDB đã kết nối. Cổng mặc định là `http://127.0.0.1:3001`.

Terminal thứ hai, cũng từ thư mục gốc:

```sh
npm run dev:frontend -- --host 127.0.0.1 --port 5173 --strictPort
```

Mở **http://127.0.0.1:5173**. Giữ cả hai terminal chạy; Ctrl+C dừng tiến trình tương ứng.

**`npm run dev` chỉ chạy frontend. Nó không tự khởi động backend hoặc database.** `npm run server` là alias cho backend dev. Đừng khởi động nhiều tiến trình cùng cổng; cũng đừng tự dừng tiến trình của người khác để lấy cổng.

### Bước 4: kiểm tra kết nối

```sh
npm run check:backend
```

Lệnh kiểm tra MongoDB, API health và credential nội bộ; không gọi Gemini và không tốn lượt Google. Trạng thái `geminiConfigured: true` chỉ xác nhận server đã nhận key, không khẳng định key/model/quota Google còn dùng được.

Trong trình duyệt: mở PDF, bôi đen một đoạn rồi bấm Dịch/Giải thích. Hỏi AI cần nhập câu hỏi và bấm Gửi. Không nhập Gemini API key vào giao diện.

## Cấu hình môi trường

| Biến | Được đọc ở đâu | Ý nghĩa |
|---|---|---|
| `GEMINI_API_KEY` | Backend | Bí mật gọi Google; không dùng tiền tố `VITE_` |
| `GEMINI_MODEL` | Backend | Model mặc định trong mã: `gemini-3.5-flash-lite`; kiểm tra model có quyền dùng trên tài khoản thực tế |
| `MONGODB_URI` | Backend/check kết nối | Chuỗi `mongodb://` hoặc `mongodb+srv://` của database đã có |
| `MONGODB_DB` | Backend | Tên database, mặc định `student_pdf_reader`; mã chủ động chọn tên này, không chỉ dựa vào path trong URI |
| `AI_ACCESS_TOKEN` | Backend và phía Node của Vite proxy | Xác thực nội bộ, tối thiểu 32 ký tự; không đưa xuống browser |
| `ALLOWED_ORIGINS` | Backend | Các origin chính xác, phân cách dấu phẩy; không thêm dấu `/` cuối hoặc wildcard |
| `HOST` | Backend | Mặc định `127.0.0.1`; dev không giới hạn lượt chỉ cho loopback |
| `PORT` | Backend và proxy local | Cổng API, mặc định `3001`; frontend vẫn dùng cổng Vite riêng |
| `DAILY_REQUEST_LIMIT` | Chính sách backend | Mặc định 100/ngày UTC; chỉ được áp dụng khi chạy có quota |
| `MINUTE_REQUEST_LIMIT` | Chính sách backend | Mặc định 10/phút khi bật quota |
| `MAX_CONCURRENT_REQUESTS` | Backend | Mặc định tối đa 3 yêu cầu đang xử lý mỗi tiến trình, kể cả dev |
| `MONGODB_DNS_SERVERS` | Backend/check kết nối | Danh sách IP DNS tùy chọn; chỉ đổi resolver của tiến trình, không đổi DNS Windows |
| `NODE_ENV` | Backend | `production` không được chạy chế độ `--development` bỏ quota |
| `VITE_AI_API_URL` | Frontend build | URL đích cho `/api/*` khi build; local để trống để dùng proxy cùng origin; **không phải API key** |

Sửa `.env` thì khởi động lại backend và máy chủ web để cả hai nhận cấu hình nhất quán. `.env.example` phải để trống các trường bí mật; `check:secrets` có đọc file mẫu để kiểm tra an toàn Git, nhưng không dùng nó làm cấu hình runtime.

`vite.config.ts` tắt cơ chế tự đọc env theo mode/local của Vite, dùng `backend/src/config/environment.ts` để chỉ đọc `.env` và biến tiến trình. Chỉ `VITE_AI_API_URL` được đưa rõ ràng vào mã frontend; không truyền toàn bộ object env vào `define`. Backend vẫn dùng bộ nạp `.env` của Node. Các file `.env.example`, `.env.local`, `.env.production` không thay thế `.env` trong quy ước runtime này.

## Các lệnh npm

Tất cả lệnh chạy từ thư mục gốc. `backend/` hiện không có package npm/lockfile riêng.

| Lệnh | Công việc |
|---|---|
| `npm run dev:frontend` | Chạy Vite; pre-hook đồng bộ PDF.js assets |
| `npm run dev` | Alias frontend theo cách dùng cũ |
| `npm run dev:backend` | Chạy Node backend với `.env` và `--development` |
| `npm run server` | Alias cho `dev:backend` |
| `npm run server:production` | Chạy API có quota; không tự build hoặc phục vụ frontend |
| `npm run check:backend` | Kiểm tra MongoDB + API + xác thực nội bộ |
| `npm run check:secrets` | Kiểm tra các trường bí mật trong file mẫu và file môi trường bị Git theo dõi |
| `npm test` | Chạy bộ test Node.js, không gọi Google/database live |
| `npm run lint` | ESLint cho TypeScript/React/backend |
| `npm run build` | Typecheck frontend/Vite/backend và build frontend vào `dist/` |
| `npm run preview` | Xem frontend đã build bằng Vite preview; vẫn cần backend riêng |
| `npm run build:static` | Đọc `.env`, build base tương đối cho host tĩnh; yêu cầu URL HTTPS `VITE_AI_API_URL` trong `.env` hoặc biến tiến trình |
| `npm run check:pdf` | Kiểm tra PDF thật trong `Kiểm thử/`, cần có file local |

Backend chạy TypeScript trực tiếp bằng Node với `--experimental-strip-types`; `backend/tsconfig.json` hiện kiểm tra kiểu và không emit ra JavaScript. Không mặc định tìm `backend/dist/index.js` sau build.

## Cấu trúc mã nguồn

```text
student-pdf-reader/
├── src/                              # Frontend React
│   ├── main.tsx                      # React StrictMode
│   ├── App.tsx                       # Khung trang và trạng thái backend
│   ├── components/
│   │   ├── PdfViewer/                # Load file, canvas/text layer, toolbar
│   │   ├── SelectionToolbar/         # Chọn Dịch/Giải thích/Hỏi
│   │   ├── AiPanel/                  # Giữ đoạn trích, gọi AI, hiển thị kết quả
│   │   ├── Study/                    # Lưu, lịch sử, sửa/xóa ghi chú
│   │   └── BackendStatus.tsx         # Kiểm tra trạng thái máy chủ
│   ├── hooks/usePdfSelection.ts      # Đọc native selection của PDF
│   ├── utils/                        # Thứ tự chữ, cleanup và ngữ cảnh
│   ├── services/ai/gemini.ts         # Client gọi API của ứng dụng
│   ├── services/storage/             # SHA-256 và IndexedDB
│   ├── services/backend.ts           # Client health
│   ├── types/                        # Kiểu UI/selection/study
│   └── lib/pdf.ts                    # PDF worker và đường dẫn assets
├── backend/
│   ├── src/index.ts                  # Bootstrap/env/database/shutdown
│   ├── src/app.ts                    # HTTP routes và dependency injection
│   ├── src/auth/                     # App token và policy proxy local
│   ├── src/config/                   # DNS override và quy ước đọc .env
│   ├── src/database/mongo.ts         # Một MongoDB pool mỗi tiến trình
│   ├── src/services/ai/              # Gemini adapter, prompts, lỗi provider
│   ├── src/services/usage/           # Atomic counters và quota policy
│   ├── scripts/check-connection.mjs  # Kiểm tra kết nối thực tế
│   └── tsconfig.json
├── shared/
│   ├── types/                        # AiAction, AiExcerpt, BackendHealth
│   └── ai/                           # SSE parser và lỗi có cấu trúc
├── public/                           # Help, feedback và tài nguyên PDF.js
├── scripts/                          # Build, sync assets, secret preflight
├── tests/                            # Unit và integration tests
├── docs/                             # Hướng dẫn và trạng thái/lịch sử
├── .github/workflows/ci.yml           # Lint/test/build, chưa có deploy
├── vite.config.ts                    # Proxy local /api và React plugin
├── package.json / package-lock.json  # Dependency chung cho toàn dự án
├── .env                              # Riêng từng máy, không commit
└── .env.example                      # Mẫu an toàn để commit
```

Phân lớp: frontend không gọi MongoDB/Google trực tiếp; backend không import UI từ `src/`; `shared/` không chứa secret, React component hoặc kết nối database. Không tạo bản sao thứ hai của cùng một kiểu/protocol ở hai phía.

## Kiến trúc và ranh giới dữ liệu

```text
PDF trên máy người dùng
  → PDF.js trong trình duyệt → canvas + text layer
  → đoạn chọn đã cleanup + ngữ cảnh + câu hỏi
  → POST /api/ai trên cùng origin Vite
  → proxy Node của Vite thêm credential nội bộ
  → backend Node.js kiểm tra quyền, input và policy
  → Google Gemini Interactions API
  → backend chuẩn hóa SSE → browser hiển thị văn bản dần

Lưu ghi chú/kết quả do người dùng bấm lưu → IndexedDB trong browser
Hạn mức khi bật quota → MongoDB, chỉ lưu bộ đếm theo thời gian
```

### Những dữ liệu được gửi đi

- Google nhận đoạn chọn, tối đa 650 ký tự ngữ cảnh mỗi phía, câu hỏi nếu có và system prompt do backend tạo.
- Ứng dụng không upload nguyên PDF để gọi Gemini. Bản dịch/giải thích không có toàn bộ tài liệu làm ngữ cảnh.
- Backend không ghi PDF, prompt, câu hỏi hoặc kết quả vào MongoDB theo luồng hiện tại.
- `store:false` trong lời gọi Interactions yêu cầu luồng không dùng trạng thái hội thoại lưu trên provider; không được diễn giải thành lời hứa về toàn bộ chính sách lưu dữ liệu của Google.
- Phiếu `public/feedback.html` tạo nội dung để người dùng sao chép/tải xuống; chưa tự gửi phản hồi tới một server.

### Xác thực hiện tại

Người dùng không cần mã mỗi lần dịch. Vite thêm `Authorization: Bearer ...` ở phía server dựa vào `AI_ACCESS_TOKEN`. Policy chỉ cấp credential cho kết nối loopback, Host local hợp lệ và Origin cùng host hoặc vắng Origin; không đưa token vào JavaScript frontend.

Gọi API backend trực tiếp mà thiếu credential sẽ nhận 401. `authenticated:true` ở `/api/access` chỉ xác nhận credential ứng dụng; **không có nghĩa là user đã đăng nhập**. `accountsEnabled:false` phản ánh tài khoản chưa được triển khai.

Proxy này chỉ được thiết kế cho local. Khi triển khai online phải thiết kế lớp web/API production, xác thực và chống lạm dụng phù hợp; không bỏ xác thực backend hoặc đưa credential nội bộ vào bundle để làm cho website chạy tạm.

## Luồng đọc PDF và chọn văn bản

1. `PdfViewer` nhận File, tăng request/document version, hủy loading task cũ. Các bước async kiểm tra request mới nhất trước khi cập nhật state.
2. Đọc ArrayBuffer và tính SHA-256 trước khi đưa bytes cho PDF.js; buffer có thể được chuyển quyền sở hữu sang worker.
3. Load PDF bằng worker module của `pdfjs-dist`, dùng CMaps/font/WASM local. Trang đầu tự vừa chiều rộng, giới hạn scale mở ban đầu.
4. `PdfPage` render một canvas HiDPI và text layer chính thức của PDF.js; hủy render cũ khi page/scale đổi. Không rasterize toàn bộ PDF cùng lúc.
5. `readPdfSelection` chỉ nhận một range có hai đầu nằm trong cùng text layer của viewer. Đo text-node fragments để tránh bounding box toàn trang.
6. `orderSelectionText`, `normalizePdfSelection`, `extractSelectionContext` tạo đoạn hiển thị và ngữ cảnh; không để ngữ cảnh ở cột khác làm nhiễu đoạn chọn.
7. `SelectionAssistant` giữ bản chụp đoạn chọn khi native highlight mất do người dùng focus sang panel, đổi trang hoặc zoom.

### Quy tắc giữ trạng thái trợ lý

- `selectionScope` của hook bao gồm document/page/scale để highlight DOM cũ không lọt sang trang khác.
- `StudySidebar` được reset theo `documentVersion` khi mở PDF; **không key `SelectionAssistant` theo trang, zoom hoặc selectionScope**.
- Chuyển trang, zoom, Fit Width giữ phản hồi đang stream, kết quả hoàn tất, câu hỏi và ghi chú đang soạn; không tự gọi lại Gemini.
- Chọn đoạn mới hoặc đổi tác vụ có thể tạo ngữ cảnh AI mới và hủy phản hồi cũ. Mở PDF khác bắt đầu phiên trợ lý mới.
- Số trang trong “Trang N / tổng” chỉnh trực tiếp: Enter hoặc blur xác nhận số nguyên hợp lệ, Escape khôi phục số hiện tại. Không nhập được ngoài phạm vi 1..totalPages.
- Zoom giới hạn 50%–300%; Fit Width tính theo chiều rộng vùng PDF. Trình bày trên mobile xếp lại theo breakpoint CSS.

## Luồng AI và hợp đồng API

### Backend HTTP

Routes nằm trong [backend/src/app.ts](backend/src/app.ts). `createApi` nhận dependency xác thực, health, quota và generate để test bằng mock mà không gọi dịch vụ thật.

| Route | Quyền và kết quả |
|---|---|
| `GET /api/health` | Không cần token; vẫn kiểm tra Origin nếu có. 200 khi MongoDB ping được, 503 khi chưa sẵn sàng |
| `GET /api/access` | Cần credential nội bộ; trả trạng thái xác thực ứng dụng |
| `POST /api/ai` | Cần credential, Content-Type JSON, input hợp lệ; trả SSE khi bắt đầu xử lý AI |
| `OPTIONS` | CORS preflight, cho header Authorization/Content-Type và method GET/POST/OPTIONS |

Mẫu health:

```json
{
  "service": "student-pdf-reader-api",
  "database": "connected",
  "ai": { "configured": true },
  "accounts": { "enabled": false },
  "requestLimits": "development-unlimited"
}
```

Mẫu body từ browser tới `/api/ai`:

```json
{
  "action": "translate",
  "selectedText": "Text selected by the user",
  "before": "Nearby text before the selection",
  "after": "Nearby text after the selection",
  "question": ""
}
```

`action` là `translate`, `explain` hoặc `ask`. Các trường text đều là string; `ask` cần câu hỏi không rỗng. Client không được quyết định API key, model tùy ý, upstream URL hoặc system prompt.

### SSE giữa ứng dụng và browser

Mỗi event là `data: <JSON>` kết thúc bằng dòng trống:

```text
data: {"type":"meta","model":"configured-model"}

data: {"type":"text","text":"Một phần phản hồi"}

data: {"type":"done"}

```

Lỗi sau khi đã mở stream được gửi dưới dạng:

```text
data: {"type":"error","error":"Lời giải thích cho người dùng","code":"provider_rate_limit","retryable":true,"retryAfterSeconds":12}

```

Lỗi trước stream trả HTTP 4xx/5xx và JSON có trường `error`, có thể kèm metadata tương tự. Vì vậy HTTP 200 chưa đủ để kết luận yêu cầu AI thành công; cần đọc đến `done`, hoặc xử lý `error`/stream bị ngắt.

`shared/ai/sse.ts` hỗ trợ chunk UTF-8 bị chia, CRLF, nhiều dòng data, giới hạn kích thước event, hủy reader và kết thúc sớm. Không thay parser bằng giả định mỗi chunk mạng là một JSON hoàn chỉnh.

### Adapter Gemini và prompt

- [gemini.ts](backend/src/services/ai/gemini.ts) gọi Interactions REST `https://generativelanguage.googleapis.com/v1beta/interactions?alt=sse` bằng native fetch, header `x-goog-api-key`, `stream:true`, `store:false`, `generation_config.max_output_tokens:2048`.
- Chỉ chuyển text delta của step `model_output` xuống browser; không hiển thị thought/reasoning. Chỉ đánh dấu hoàn tất khi có terminal event hợp lệ và có nội dung.
- [prompts.ts](backend/src/services/ai/prompts.ts) tạo system instruction theo tác vụ; dữ liệu PDF được đóng gói như tài liệu trích dẫn, không phải lệnh để thay vai trò model.
- Dịch chỉ selectedText; giải thích tập trung đoạn chọn, tối đa 5 câu và 1–2 câu cho một từ; hỏi đáp phải nói rõ khi thiếu dữ kiện. Giữ nguyên công thức/ký hiệu/code thay vì tự bịa phần bị cắt.
- Model và bí mật thuộc backend. Giá trị mặc định trong mã không đảm bảo model vẫn khả dụng cho mọi tài khoản; kiểm tra cấu hình thực tế khi đổi model/API.
- Dừng, đổi đoạn hoặc unmount hủy request. Đổi page/zoom PDF không được unmount phiên AI đang đọc.

## Ghi chú, lịch sử và nhận diện tài liệu

Hai nơi lưu trữ có mục đích riêng:

| Nơi | Dữ liệu hiện lưu | Không có trong luồng hiện tại |
|---|---|---|
| IndexedDB của browser | Metadata PDF và các mục người dùng chủ động lưu | Toàn bộ bytes PDF, tài khoản đồng bộ |
| MongoDB | Bộ đếm hạn mức AI khi quota bật | Ghi chú, file PDF, prompt, kết quả và bảng user/session |

### IndexedDB

Database `student-pdf-reader`, version `1`:

- Store `documents`: key `hash`; record gồm `hash`, `name`, `size`, `pageCount`, `lastOpenedAt`.
- Store `entries`: key `id`, index `documentHash`.
- Mỗi entry có `id`, `documentHash`, `pageNumber`, `selectedText`, `action`, `result`, `note`, `timestamp`; có thể thêm `question`, `model`.
- `action` nhận `note`, `translate`, `explain`, `ask`. ID dùng randomUUID; thời gian lưu dạng epoch milliseconds, UI hiển thị UTC+7.

SHA-256 dựa trên bytes: đổi tên cùng file giữ lịch sử; hai nội dung khác nhau dù trùng tên được tách riêng. Sau refresh, cần tự mở lại file PDF để truy cập lịch sử tương ứng.

Chỉ công bố lưu thành công sau khi transaction commit. Request IndexedDB success rồi transaction abort vẫn là thất bại. CRUD phải kiểm tra documentHash; không sửa/xóa entry thuộc tài liệu khác. Lịch sử sắp mới nhất trước; sửa ghi chú giữ nguyên kết quả/model/câu hỏi đã lưu.

Lịch sử thuộc **origin + browser profile**. `localhost:5173`, `127.0.0.1:5173`, port khác và domain Preview có các vùng lưu riêng. Xóa website data/đổi profile có thể làm mất ghi chú; hiện chưa có sao lưu hoặc cloud sync. Không nâng schema/xóa dữ liệu cũ mà thiếu kế hoạch migration.

### MongoDB

`createDatabase` duy trì một connection pool. Startup cần ping và tạo TTL index thành công. Collection `gemini_usage_v1` chứa `_id`, `count`, `expiresAt`; TTL index `expiresAt` với `expireAfterSeconds:0`.

Counter tăng có điều kiện nguyên tử với upsert; duplicate-key khi đã chạm cap được xem là hết quota. Khóa bucket phút/ngày xác định theo thời gian UTC; TTL dọn counter cũ, không phải tín hiệu reset hạn mức. Quota hiện là toàn ứng dụng, chưa theo user. Production MongoDB lỗi thì từ chối gọi AI thay vì bỏ qua quota.

## Hạn mức và xử lý lỗi

### Dev và production

- `dev:backend` / `server` thêm `--development`: chỉ cho host loopback và ngoài `NODE_ENV=production`; bỏ giới hạn lượt phút/ngày và không tăng counter cũ để kiểm thử liên tục.
- `server:production` không thêm cờ đó: quota mặc định 100/ngày UTC và 10/phút, hoặc giá trị trong môi trường.
- Dev vẫn cần MongoDB để startup/health. Dừng quota trong dev không làm database trở thành tùy chọn.
- Quota được tính sau validation và trước khi gọi provider, kể cả sau đó người dùng hủy hoặc provider lỗi. Giới hạn số lượt không phải trần chi phí tuyệt đối.
- Giới hạn của Google vẫn có thể xuất hiện ở mọi chế độ; ứng dụng không thể tắt chúng.

### Giới hạn dữ liệu và tài nguyên vẫn áp dụng

| Nội dung | Mức hiện có |
|---|---|
| Đoạn chọn | Tối đa 12.000 ký tự |
| Ngữ cảnh | Tối đa 650 ký tự mỗi phía |
| Câu hỏi | Tối đa 2.000 ký tự |
| Ghi chú đã lưu | Tối đa 10.000 ký tự |
| Kết quả AI/entry | Tối đa 50.000 ký tự |
| JSON body API | Tối đa 65.536 bytes |
| Yêu cầu đồng thời | Mặc định 3 mỗi tiến trình |
| Timeout AI backend/client | 180 / 185 giây |

Không đánh đồng giới hạn số lượt với độ dài đoạn chọn hoặc số yêu cầu đồng thời.

### Thông báo dễ hiểu

[geminiErrors.ts](backend/src/services/ai/geminiErrors.ts) phân loại mã lỗi và metadata chính thức; không đưa raw provider message hoặc secret xuống UI. `AiRequestError` được truyền qua JSON/SSE.

| Mã ứng dụng | Ý nghĩa và cách UI xử lý |
|---|---|
| `provider_rate_limit` | Biết là giới hạn tốc độ ngắn hạn; giải thích cần chờ, khóa Retry khi đếm ngược |
| `provider_limit` | Google giới hạn nhưng chưa đủ thông tin để kết luận hết quota ngày; lời giải thích trung lập |
| `provider_quota` | Xác nhận quota ngày; không khuyến khích thử lại ngay |
| `provider_unavailable` | Provider tạm chưa phản hồi, cho thử lại sau khoảng nghỉ |
| `app_busy` | Backend đạt mức đồng thời; khác với hết quota Google |
| `app_quota` | Chạm quota ứng dụng khi bật policy |
| `configuration` / `payment` | Cần kiểm tra cấu hình/số dư; không hiện nút thử lại ngay |
| `unknown` | Lỗi chưa phân loại; vẫn cho biết yêu cầu chưa hoàn tất |

Thời gian chờ lấy từ Retry-After/RetryInfo; fallback cho lỗi provider có thể thử lại là khoảng nghỉ đề xuất tối thiểu 5 giây. Đây không phải lời đảm bảo lần kế tiếp chắc chắn thành công. UI dùng deadline theo đồng hồ để đếm ngược, giữ phần text đã nhận, cho sao chép nhưng chỉ cho lưu kết quả khi hoàn tất. Không có retry AI tự động.

## Kiểm thử và CI

### Kiểm tra trước khi bàn giao

```sh
npm run check:secrets
npm run lint
npm test
npm run build
```

Mốc tổ chức lại backend đã có 52 test local qua và smoke-test MongoDB/proxy thành công. Lượt cập nhật README và quy ước `.env` bổ sung 3 test cấu hình: **55 test local qua**. Đây không phải lời khẳng định các dịch vụ đang chạy ở mọi lần clone hoặc test Gemini live sẽ luôn thành công. Thay đổi test về sau phải cập nhật số liệu.

Các nhóm test hiện có:

- Thứ tự chữ, chuẩn hóa đoạn chọn, ngữ cảnh/cột và ký hiệu.
- Hash tài liệu, validation, IndexedDB CRUD/transaction/quota lỗi với fake-indexeddb RAM-only.
- SSE/UTF-8, abort, stream bị cắt, adapter Gemini và không rò raw error.
- HTTP API, xác thực/CORS, health, database failure, payload validation, concurrency, quota.
- Dev vượt 100 lượt giả lập không bị quota ứng dụng; production vẫn tôn trọng quota; dev không được bind public.
- Policy cấp credential cho web local; DNS tùy chọn; phân loại lỗi/cooldown và preflight file bí mật.
- Cấu hình chỉ lấy `.env`, không lấy file mẫu/local/mode; biến tiến trình được ưu tiên và không fallback sang sample khi thiếu `.env`.

Tests provider/database sử dụng mock, không cần API key hoặc MongoDB live. Không thêm test gọi dịch vụ trả phí vào `npm test`.

### PDF thật và manual QA

PDF riêng nằm trong `Kiểm thử/` và bị Git ignore. Bản clone có thể không chứa thư mục/file này. Test nhận diện PDF thật sẽ skip khi fixture không có; `check:pdf` là kiểm tra local tùy chọn, cần file thật, không phải bước bắt buộc của CI.

Trong lượt QA trước đã dùng Test Case 1–8; Case 8 có 441 trang và có lớp chữ, đã thử nhảy 221/441. Chưa có fixture scan thuần không text để khẳng định kiểm thử OCR. Luôn kiểm kê file thực tế; không tự tạo PDF giả thay bộ PDF người dùng đã cung cấp hoặc sửa file gốc.

Manual regression quan trọng: đổi trang/zoom khi AI đang stream không tăng số AI call hoặc hủy stream; kết quả/ghi chú chưa lưu giữ nguyên; nhảy trang hợp lệ, từ chối 0 và ngoài tổng trang; đổi PDF reset đúng ngữ cảnh. Các bài UI lỗi/stream trước dùng server fixture loopback riêng, không ép Google trả lỗi bằng cách spam API.

### GitHub Actions

[ci.yml](.github/workflows/ci.yml) được chuẩn bị cho push `main`, pull request và chạy tay: kiểm tra file môi trường → `npm ci` → lint → test → build. Token chỉ có quyền đọc contents; không yêu cầu secret Gemini/MongoDB và chưa có bước publish/deploy.

Có workflow trong mã không chứng minh nó đã chạy trên GitHub. Phải xem đúng commit và kết quả Actions sau khi push. CI basic preflight không thay thế secret scanning toàn bộ lịch sử Git.

## Chẩn đoán lỗi thường gặp

| Triệu chứng | Kiểm tra và hành động |
|---|---|
| PDF đọc được nhưng AI không chạy | `npm run dev` chỉ chạy UI; cần terminal backend còn sống |
| Frontend 502 / ECONNREFUSED | Kiểm tra backend thực sự listen đúng PORT, không chỉ terminal có dòng lệnh khởi chạy; đợi thông báo ready |
| Header báo chưa kết nối | Chạy `check:backend`, bấm Kiểm tra hoặc tải lại sau khi backend sẵn sàng |
| Backend dừng ngay khi khởi động | Đọc lỗi cấu hình/MongoDB trong terminal; không in cả `.env` để tìm lỗi |
| MongoDB authentication lỗi | Dùng database user và đúng database; mật khẩu trong URI phải được điền thật, không giữ `<...>`; tự mã hóa ký tự đặc biệt trong URI nếu cần |
| MongoDB SRV `ECONNREFUSED` | Xác minh DNS; có thể dùng `MONGODB_DNS_SERVERS` trong `.env`, không tự đổi DNS hệ điều hành |
| Atlas không kết nối được | Kiểm tra URI, database user, trạng thái cluster và quyền truy cập IP của máy backend |
| 401 qua web | Backend và Vite phải dùng cùng AI_ACCESS_TOKEN từ `.env`; restart cả hai sau thay đổi; mở bằng địa chỉ loopback |
| 401 khi gọi thẳng API | Có thể là đúng thiết kế vì request không có credential nội bộ |
| 403 Origin | ALLOWED_ORIGINS phải có đúng scheme/host/port, không có `/` cuối; proxy local không cấp credential cho origin ngoài |
| Google báo giới hạn rồi Retry lại được | Có thể là giới hạn tốc độ ngắn hạn; đọc mã lỗi/thời gian chờ, không kết luận đã hết lượt cả ngày |
| Lịch sử biến mất sau đổi URL | Browser storage tách theo origin/profile; mở lại đúng địa chỉ và đúng PDF |
| Không bôi đen được chữ | Kiểm tra PDF có text layer; scan chưa có OCR |
| Font/CMaps/WASM hoặc worker lỗi | Đồng bộ assets, kiểm tra BASE_URL/đường dẫn triển khai và license; không hardcode đường dẫn theo trang worker |
| Cổng 5173 bận | Dùng lại đúng tiến trình của dự án hoặc tự chọn cổng và cập nhật origin phù hợp; không tự kill mọi tiến trình node |
| Trang Preview giống bản cũ | Build/deploy chưa cập nhật; local, Git và Preview là ba trạng thái riêng |
| check:secrets thất bại | Làm sạch file mẫu/file môi trường bị Git theo dõi; không bypass để push bí mật |

## Git, Preview và triển khai

Repository local đã được cấu hình remote `https://github.com/davidtaiduc/STUDENT_PDF_READER.git` trong lượt làm việc này. Khi clone/tiếp quản, tự kiểm tra `git remote -v`, nhánh và `git status`; không coi file local hoặc một lời báo trước đây là bằng chứng đã commit/push/deploy.

### Git và bí mật

- `.env`, `.env.*` bị ignore, riêng `.env.example` được phép theo dõi để làm mẫu. Vì vậy **không điền giá trị thật vào file mẫu**.
- `node_modules/`, `dist/`, `tmp/`, `release/`, PDF cá nhân và log không phải nguồn để commit.
- `SESSION_HANDOFF.md` là ghi chú local bị ignore; AI chỉ đọc từ Git không thể dựa vào file này. Các quyết định quan trọng phải nằm trong README/docs được đưa lên Git.
- `public/pdfjs/` được sinh từ dependency và hiện có tài nguyên đang được Git theo dõi; không mặc định toàn bộ thư mục bị ignore. Không sửa tay hoặc xóa license; kiểm tra diff khi nâng PDF.js.
- `check:secrets` chỉ kiểm tra các trường chỉ định trong `.env.example` và file môi trường được Git track. Nếu bí mật từng bị push, xóa file ở commit mới chưa xóa nó khỏi lịch sử; cần xử lý/đổi credential riêng.
- Không đăng ký hosting, thanh toán, commit, push hoặc publish chỉ vì đọc README. Làm theo yêu cầu/ủy quyền cụ thể trong phiên đang làm việc.

### OneSite / OnePortal

Đã quan sát trong OneSite: tab Git URL nhập **repository công khai có tệp tĩnh sẵn**, không chạy build; tải ZIP cũng chỉ phục vụ frontend. Dán repository Vite chưa build không tự chạy TypeScript/Node. Liên kết Git không đồng nghĩa đã có pipeline deploy theo mỗi push.

OnePortal là nơi quản lý dịch vụ; có tài khoản OnePortal/Preview OneSite không tự cung cấp tiến trình backend chạy liên tục. Trong phiên làm việc này, người dùng đã chọn tiếp tục local và cân nhắc hosting iNET về sau; chưa có bản triển khai full-stack mới.

### Trạng thái deploy cần hiểu đúng

- `npm run build` sinh frontend `dist/`; nó không khởi động API.
- `server:production` chỉ chạy backend API; hiện không phục vụ `dist/` như một web server full-stack.
- Proxy tự thêm credential nằm trong Vite, chỉ local; không có trong ZIP `dist/`.
- `build:static` kiểm tra URL HTTPS và build base tương đối. URL đó phải là lớp truy cập API production đã được thiết kế phù hợp; trỏ thẳng browser tới API nội bộ đang yêu cầu token chưa giải quyết được quyền truy cập.
- Muốn online đầy đủ cần Node runtime, web server/gateway production, HTTPS/domain, secret của hosting, quyền truy cập MongoDB, quy trình build/start/restart và cơ chế kiểm soát truy cập/hạn mức phù hợp.
- Chỉ sau khi chọn môi trường thật mới cấu hình bước deploy Git/CI và kiểm thử end-to-end. Chưa có Dockerfile/compose hoặc tự động SSH deploy trong repository ở thời điểm ghi nhận.

## Hướng dẫn cho AI tiếp quản

### Trình tự đọc và làm việc

1. Đọc README và `AGENTS.md`; xác định yêu cầu mới nhất của người dùng, `git status`, thư mục đang làm việc và thay đổi chưa commit. Không ghi đè thay đổi có sẵn.
2. Dùng jCodeMunch trước để tìm symbol/reference/context nếu công cụ có sẵn. Index có thể cũ sau refactor; cập nhật khi cần. Không đọc cả repository chỉ để tìm một chức năng; đọc đầy đủ file khi thực sự sửa hoặc cần chính xác ngữ cảnh.
3. Với UI PDF: bắt đầu ở `PdfViewer`, `PdfToolbar`, `PdfPage`, `usePdfSelection`, `SelectionAssistant`, `StudySidebar`.
4. Với AI: đọc client `src/services/ai/gemini.ts`, `backend/src/app.ts`, provider/prompts và `shared/ai/`.
5. Với lưu trữ: đọc `src/types/study.ts`, `hashPdf`, `studyStore`; MongoDB hiện chỉ là usage counters.
6. Với startup: đọc `package.json`, `vite.config.ts`, `backend/src/index.ts`; phân biệt config runtime thật với template/guard CI.
7. Thay đổi có phạm vi rõ, chạy kiểm tra liên quan và báo đúng loại bằng chứng: unit/mock, browser fixture, dịch vụ live hay CI remote.
8. Cập nhật README/docs nếu đổi hợp đồng dữ liệu, lệnh chạy, môi trường, lưu trữ hoặc trạng thái triển khai. Không chỉ ghi vào handoff bị Git ignore.

### Các bất biến cần giữ

- Giữ Gemini key, MongoDB URI có mật khẩu và credential nội bộ ở server; không dùng biến VITE cho secret, không log hoặc chép vào tài liệu.
- Không chuyển người dùng về bước nhập mã mỗi lần dịch. Cũng không bỏ toàn bộ xác thực backend để né việc thiết kế triển khai production.
- Page/zoom chỉ đổi viewport/highlight, không reset phiên trợ lý. Chỉ thay tài liệu hoặc tác vụ/đoạn thực sự cần đổi mới thay phiên phù hợp.
- Hủy đúng task/render/stream và chặn kết quả async cũ; giữ tương thích React StrictMode.
- Chỉ text output được stream xuống UI; không hiển thị reasoning hoặc dùng raw provider error làm lời giải thích cho người dùng.
- Không đánh dấu response thành công khi chưa có done hoặc lưu thành công khi transaction chưa commit.
- Không xóa dữ liệu IndexedDB thật hoặc fixture PDF người dùng khi kiểm thử.
- Backend không import frontend; shared không phụ thuộc React, secret hoặc database.
- Không tự thêm tài khoản/cloud sync/OCR như tính năng đã xong. Đây là các nhánh phát triển còn thiếu.

### Cách phối hợp đã thống nhất

Người dùng muốn tự duyệt lựa chọn và tự điền các thông tin cơ bản như tài khoản, secret hoặc gói hosting. AI hướng dẫn rõ tên file/trường cần điền; tập trung sửa mã và kiểm thử. Không âm thầm thay giá trị `.env` người dùng đang nhập, tự mua dịch vụ hoặc tự push/publish khi chưa được yêu cầu.

## Việc phát triển tiếp theo

Các mục dưới là đề xuất/kế hoạch, **không phải chức năng đã tồn tại**:

1. **Tài khoản:** xác định kiểu đăng nhập; thiết kế users/sessions, lưu credential an toàn, lifecycle phiên, kiểm thử truy cập trái quyền. `Principal` hiện là điểm mở rộng, chưa phải một hệ thống tài khoản.
2. **Lịch sử theo user:** thiết kế API và ownership, kế hoạch nhập dữ liệu IndexedDB local có sự lựa chọn của người dùng; không tự upload toàn bộ lịch sử cũ.
3. **Hạn mức theo tài khoản:** thêm sau khi có danh tính user và yêu cầu sản phẩm; giữ luồng kiểm thử local có chủ đích và kiểm soát production riêng.
4. **Triển khai:** chọn hosting Node/VPS khi người dùng sẵn sàng; hoàn thiện web/gateway production, Git deploy, secret management, health và rollback.
5. **QA/hiệu năng:** browser regression tự động, kiểm thử tải có đo đạc, PDF scan thật, PDF nhiều cột/font đặc biệt và thiết bị di động.
6. **Tính năng học tập:** cân nhắc xuất/nhập ghi chú, Markdown/LaTeX, OCR hoặc tìm kiếm tài liệu theo ưu tiên mới được người dùng xác nhận.

## Tài liệu liên quan

| Tài liệu | Vai trò |
|---|---|
| [AGENTS.md](AGENTS.md) | Quy tắc làm việc và tra cứu mã |
| [Backend README](backend/README.md) | Cấu trúc backend, lệnh chạy và ranh giới |
| [Shared README](shared/README.md) | Quy tắc cho mô-đun dùng chung |
| [docs/README.md](docs/README.md) | Bản đồ tài liệu hiện tại/lịch sử |
| [GEMINI_SETUP.md](docs/GEMINI_SETUP.md) | Thiết lập Gemini, MongoDB và môi trường |
| [STUDY_STORAGE.md](docs/STUDY_STORAGE.md) | Hướng dẫn ghi chú/lịch sử |
| [PDF_NAVIGATION_FIX.md](docs/PDF_NAVIGATION_FIX.md) | Nguyên nhân và kiểm tra lỗi reset khi thao tác PDF |
| [GEMINI_MIGRATION_STATUS.md](docs/GEMINI_MIGRATION_STATUS.md) | Nhật ký chuyển đổi AI và những cập nhật kế tiếp |
| [GIT_HOSTING.md](docs/GIT_HOSTING.md) | Git, CI và giới hạn triển khai OneSite |
| [TEST_PDF_SUITE.md](docs/TEST_PDF_SUITE.md) | Quy tắc dùng fixture PDF thật; kiểm kê lại file thực tế |
| [TEST_CASES.md](TEST_CASES.md) | Các tình huống kiểm thử PDF |
| `docs/DAY_*.md`, `DAY_*_STATUS.md` | Kế hoạch/trạng thái lịch sử; không mặc định là cấu hình hiện tại |

Tài liệu chính thức tham khảo khi thay đổi tích hợp: [Gemini Interactions](https://ai.google.dev/gemini-api/docs/interactions-overview), [Gemini API errors](https://ai.google.dev/gemini-api/docs/api-errors), [MongoDB Node driver](https://www.mongodb.com/docs/drivers/node/current/). Kiểm tra lại tài liệu mới trước khi nâng version hoặc đổi API; không tự suy diễn model/provider đã đổi chỉ từ tài liệu Day cũ.
