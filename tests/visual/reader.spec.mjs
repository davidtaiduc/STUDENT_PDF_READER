import {createPdf} from '../../scripts/make-stress-pdfs.mjs';
import {test,expect} from '@playwright/test';
import {mkdir,writeFile,access} from 'node:fs/promises';
import {resolve} from 'node:path';
const dir=resolve('docs/ui-redesign-2026-11-24',process.env.UI_BROWSER||'.');
let pdf=resolve(process.env.UI_TEST_PDF||'Kiểm thử/Test Case 9.pdf');
async function fixture(){try{await access(pdf);}catch{await mkdir('tmp',{recursive:true});pdf=resolve('tmp/visual-fixture.pdf');const stream='BT /F1 22 Tf 60 740 Td (StudyPDF Reader) Tj 0 -50 Td /F1 14 Tf (Recall our proof techniques so far.) Tj 0 -40 Td (A function receives input and returns output.) Tj ET';const objects=['<< /Type /Catalog /Pages 2 0 R >>','<< /Type /Pages /Kids [3 0 R] /Count 1 >>','<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>','<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',`<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`];let body='%PDF-1.4\n';const offsets=[0];for(let i=0;i<objects.length;i++){offsets.push(Buffer.byteLength(body));body+=`${i+1} 0 obj\n${objects[i]}\nendobj\n`;}const start=Buffer.byteLength(body);body+='xref\n0 6\n0000000000 65535 f \n'+offsets.slice(1).map(n=>String(n).padStart(10,'0')+' 00000 n \n').join('')+`trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${start}\n%%EOF\n`;await writeFile(pdf,body);}}
async function openPdf(page){await expect(page.locator('.study-entry,.app')).toBeVisible();if(await page.locator('.study-entry').count()){await page.getByRole('button',{name:'Đăng nhập',exact:true}).click();await page.getByRole('textbox',{name:'Email',exact:true}).fill('reader-fixture@example.test');await page.getByRole('textbox',{name:'Mật khẩu',exact:true}).fill('fake-reader-password');await page.getByRole('button',{name:'Đăng nhập',exact:true}).last().click();await expect(page.locator('.viewer')).toBeVisible();}const toggle=page.getByRole('button',{name:'Bật/tắt danh sách tài liệu',exact:true});if(await toggle.getAttribute('aria-expanded')!=='true')await toggle.click();const choosing=page.waitForEvent('filechooser');await page.getByRole('button',{name:'＋ Mở PDF mới',exact:true}).click();await (await choosing).setFiles(pdf);await expect(page.getByRole('textbox',{name:'Số trang',exact:true})).toBeEnabled();await expect(page.locator('.textLayer')).toBeVisible();}
async function shot(page,name,width){await page.evaluate(()=>document.fonts.ready);const bytes=await page.screenshot({path:resolve(dir,name+'.png'),fullPage:true,animations:'disabled'});expect(bytes.readUInt32BE(16)).toBe(width);}
async function geometry(page,width){const sizes=await page.evaluate(()=>({width:innerWidth,body:document.body.scrollWidth}));expect(sizes.width).toBe(width);expect(sizes.body).toBeLessThanOrEqual(width);}
async function typography(page){const values=await page.locator('p,small,summary,label,button,a,strong,h1,h2,h3').evaluateAll(elements=>elements.filter(e=>e.getClientRects().length&&getComputedStyle(e).visibility==='visible'&&!e.closest('.textLayer,.katex,[disabled]')).map(e=>{let bg=e;while(bg.parentElement&&getComputedStyle(bg).backgroundColor==='rgba(0, 0, 0, 0)')bg=bg.parentElement;return {text:e.textContent.trim().slice(0,50),size:parseFloat(getComputedStyle(e).fontSize),color:getComputedStyle(e).color,bg:getComputedStyle(bg).backgroundColor};}).filter(e=>e.text));const rgb=s=>(s.match(/[\d.]+/g)||[]).map(Number),lum=c=>{const v=c.slice(0,3).map(n=>{n/=255;return n<=.04045?n/12.92:((n+.055)/1.055)**2.4;});return .2126*v[0]+.7152*v[1]+.0722*v[2];};for(const x of values){expect(x.size,x.text).toBeGreaterThanOrEqual(13);const a=lum(rgb(x.color)),b=lum(rgb(x.bg)),ratio=(Math.max(a,b)+.05)/(Math.min(a,b)+.05);expect(ratio,x.text).toBeGreaterThanOrEqual(x.size>=24?3:4.5);}}
test.beforeAll(async()=>{await mkdir(dir,{recursive:true});await fixture();});
for(const width of [1920,1280,390]){
 test(`reader before/after ${width}px`,async({browser})=>{const context=await browser.newContext({viewport:{width,height:width===390?844:1080},deviceScaleFactor:1,reducedMotion:'reduce'});const page=await context.newPage();await page.goto('http://127.0.0.1:5182');await openPdf(page);if(width===390)await page.getByRole('button',{name:'Đóng danh sách tài liệu',exact:true}).click();await geometry(page,width);await shot(page,`before-${width}`,width);await page.goto('http://127.0.0.1:5181');await openPdf(page);if(width===390)await page.getByRole('button',{name:'Đóng danh sách tài liệu',exact:true}).click();await expect(page.getByRole('heading',{name:'Tô đen một đoạn trong PDF để hỏi AI',exact:true})).toBeVisible();await geometry(page,width);await typography(page);await page.evaluate(()=>document.fonts.ready);expect(await page.locator('.chat-messages').evaluate(e=>e.scrollHeight<=e.clientHeight+1)).toBe(true);await shot(page,`after-${width}`,width);await context.close();});
 test(`introduction ${width}px`,async({page})=>{await page.setViewportSize({width,height:width===390?844:1080});await page.goto('http://127.0.0.1:5181/gioi-thieu.html');await expect(page.getByRole('heading',{name:'Đọc sâu hơn. Hiểu xa hơn.',exact:true})).toBeVisible();await geometry(page,width);await typography(page);await shot(page,`introduction-${width}`,width);await page.getByRole('link',{name:'Bắt đầu đọc PDF',exact:true}).click();await expect(page).toHaveURL('http://127.0.0.1:5181/?start=1');await expect(page.getByRole('heading',{name:'Một trang sách. Một khởi đầu mới.'})).toBeVisible();});
}
test('keyboard focus, native menu and dialog',async({page})=>{await page.setViewportSize({width:1280,height:1000});await page.goto('http://127.0.0.1:5181');await openPdf(page);await page.keyboard.press('Tab');for(const e of await page.locator('button,a,summary,input,textarea,select,[tabindex="0"]').all()){if(!await e.isVisible()||await e.isDisabled())continue;await e.focus();const outline=await e.evaluate(e=>({style:getComputedStyle(e).outlineStyle,width:parseFloat(getComputedStyle(e).outlineWidth)}));expect(outline.style).not.toBe('none');expect(outline.width).toBeGreaterThanOrEqual(2);}
 const trigger=page.getByRole('button',{name:'Mở menu tài khoản và trợ giúp',exact:true});await trigger.focus();await page.keyboard.press('Enter');await expect(page.getByRole('button',{name:'Kiểm tra kết nối máy chủ',exact:true})).toHaveCount(0);await expect(page.getByRole('link',{name:'Hướng dẫn',exact:true})).toBeVisible();await expect(page.getByText('reader-fixture@example.test',{exact:true})).toBeVisible();await trigger.focus();await page.keyboard.press('Escape');await expect(page.locator('#reader-account-menu')).not.toBeVisible();});
test('selection yellow, account menu and AI response in a fake-only session',async({page})=>{await page.setViewportSize({width:1920,height:1080});await page.goto('http://127.0.0.1:5181');await page.getByRole('button',{name:'Đăng ký',exact:true}).click();await page.getByRole('textbox',{name:'Tên hiển thị',exact:true}).fill('Kiểm thử giao diện');await page.getByRole('textbox',{name:'Email',exact:true}).fill('visual-playwright@example.test');await page.getByRole('textbox',{name:'Mật khẩu',exact:true}).fill('fake-visual-test-password');await page.getByRole('textbox',{name:'Xác nhận mật khẩu',exact:true}).fill('fake-visual-test-password');await page.getByRole('button',{name:'Tạo tài khoản',exact:true}).click();await page.getByRole('button',{name:'Mở menu tài khoản và trợ giúp',exact:true}).click();await expect(page.getByText('visual-playwright@example.test',{exact:true})).toBeVisible();await typography(page);await shot(page,'account-menu-1920',1920);await page.keyboard.press('Escape');await openPdf(page);await page.locator('.textLayer').getByText('Recall',{exact:false}).dblclick();await expect(page.getByTestId('chat-excerpt-preview')).toBeVisible();await page.getByRole('textbox',{name:'Câu hỏi của bạn',exact:true}).fill('Giải thích đoạn đã chọn.');const send=page.getByRole('button',{name:'Gửi câu hỏi',exact:true});await expect(send).toBeEnabled();await expect(send).toHaveCSS('background-color','rgb(255, 216, 77)');await page.locator('.composer-context > summary').click();await expect(page.getByRole('combobox',{name:'Phạm vi gửi AI',exact:true})).toHaveCSS('background-color','rgb(255, 216, 77)');await page.locator('.composer-context > summary').click();await shot(page,'selection-1920',1920);await send.click();await expect(page.getByText('Đã hoàn tất.',{exact:true})).toBeVisible();await expect(page.getByTestId('ai-answer')).toContainText('phản hồi giả');await typography(page);await shot(page,'chat-1920',1920);
await page.setViewportSize({width:1280,height:720});
await page.locator('.composer-context > summary').click();
await page.getByRole('combobox',{name:'Phạm vi gửi AI',exact:true}).selectOption('pages');
await expect(page.getByRole('button',{name:'Đọc nội dung các trang',exact:true})).toBeVisible();
await page.locator('.composer-context > summary').click();
await expect(page.getByRole('button',{name:'Đọc nội dung các trang',exact:true})).not.toBeVisible();
const sizes=await page.evaluate(()=>({chat:document.querySelector('.ask-chat').clientHeight,messages:document.querySelector('.chat-messages').clientHeight,composer:document.querySelector('.chat-composer').getBoundingClientRect().height}));
expect(sizes.messages).toBeGreaterThan(sizes.chat*.5);
expect(sizes.composer).toBeLessThan(170);
await page.locator('.chat-messages').evaluate(e=>e.scrollTop=e.scrollHeight);
await page.screenshot({path:'tmp/compact-composer-1280.png'});
});

test('PDF stays painted while resizing and toggling the AI panel', async ({page}) => {
  await page.setViewportSize({width:1920,height:1080});
  await page.goto('http://127.0.0.1:5181');
  await openPdf(page);
  await expect(page.locator('.pdf-page-surface canvas')).toBeVisible();
  const surface=await page.locator('.pdf-page-surface').elementHandle();await page.evaluate(()=>window.dispatchEvent(new Event('focus')));await expect(page.locator('.viewer')).toBeVisible();expect(await surface.evaluate(e=>e.isConnected)).toBe(true);
  await page.evaluate(() => {
    const root = document.querySelector('.pdf-page');
    window.resizePaintAudit = {blank:0, swaps:0};
    const observer = new MutationObserver(records => {
      for (const record of records) if (record.type === 'childList' && record.target === root) window.resizePaintAudit.swaps++;
      const canvas = root.querySelector('canvas');
      if (!canvas || !canvas.width || !canvas.height) window.resizePaintAudit.blank++;
    });
    observer.observe(root, {childList:true,subtree:true});
    window.resizePaintObserver = observer;
  });
  const handle = page.getByRole('separator',{name:'Điều chỉnh chiều rộng PDF và AI'});
  const box = await handle.boundingBox();
  await page.mouse.move(box.x+box.width/2,box.y+box.height/2);
  await page.mouse.down();
  for (let i=0;i<24;i++) {
    await page.mouse.move(box.x+180*Math.sin(i/8),box.y+box.height/2);
    await expect(page.locator('.pdf-page-surface canvas')).toBeVisible();
  }
  await page.mouse.up();
  await expect.poll(() => page.locator('.pdf-page-surface').evaluate(e=>getComputedStyle(e).transform)).toBe('none');
  await page.getByRole('button',{name:'Thu gọn Hỏi AI',exact:true}).click();
  await expect(page.locator('.pdf-page-surface canvas')).toBeVisible();
  await expect.poll(() => page.locator('.pdf-page-surface').evaluate(e=>getComputedStyle(e).transform)).toBe('none');
  await page.getByRole('button',{name:'Mở lại Hỏi AI',exact:true}).click();
  await expect.poll(() => page.locator('.pdf-page-surface').evaluate(e=>getComputedStyle(e).transform)).toBe('none');
  const audit = await page.evaluate(() => {window.resizePaintObserver.disconnect();return window.resizePaintAudit;});
  expect(audit.blank).toBe(0);
  expect(audit.swaps).toBeLessThan(12);
  await page.locator('.textLayer').getByText('Recall',{exact:false}).dblclick();
  await expect(page.getByTestId('chat-excerpt-preview')).toBeVisible();
});


test('introduction requires an account before entering the reader', async ({page}) => {
  await page.setViewportSize({width:1280,height:900});
  await page.goto('http://127.0.0.1:5181/gioi-thieu.html');
  await page.getByRole('link',{name:'Bắt đầu đọc PDF',exact:true}).click();
  await expect(page.locator('.viewer')).toHaveCount(0);
  await page.getByRole('button',{name:'Đăng nhập',exact:true}).click();
  await expect(page.getByRole('dialog',{name:'Đăng nhập',exact:true})).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('.viewer')).toHaveCount(0);
  await page.getByRole('button',{name:'Đăng ký',exact:true}).click();
  await page.getByRole('textbox',{name:'Tên hiển thị',exact:true}).fill('Bạn đọc mới');
  await page.getByRole('textbox',{name:'Email',exact:true}).fill('entry-preview@example.test');
  await page.getByRole('textbox',{name:'Mật khẩu',exact:true}).fill('fake-entry-password');
  await page.getByRole('textbox',{name:'Xác nhận mật khẩu',exact:true}).fill('fake-entry-password');
  await page.getByRole('button',{name:'Tạo tài khoản',exact:true}).click();
  await expect(page.locator('.viewer')).toBeVisible();
  await page.reload();
  await expect(page.locator('.viewer')).toBeVisible();
});


test('300-page reader can jump to last page and replace it with an image-only PDF',async({page})=>{
 await page.setViewportSize({width:1280,height:900});await page.goto('http://127.0.0.1:5181');await openPdf(page);
 let choosing=page.waitForEvent('filechooser');await page.getByRole('button',{name:'＋ Mở PDF mới',exact:true}).click();await(await choosing).setFiles({name:'300-pages.pdf',mimeType:'application/pdf',buffer:createPdf()});
 const input=page.getByRole('textbox',{name:'Số trang',exact:true});await expect(input).toHaveValue('1');await input.fill('300');await input.press('Enter');await expect(page.locator('.pdf-page')).toHaveAttribute('data-page-number','300');await expect(page.locator('.textLayer')).toContainText('StudyPDF page 300');
 choosing=page.waitForEvent('filechooser');await page.getByRole('button',{name:'＋ Mở PDF mới',exact:true}).click();await(await choosing).setFiles({name:'scan.pdf',mimeType:'application/pdf',buffer:createPdf(2,true)});
 await expect(page.locator('.pdf-page')).toHaveAttribute('data-page-number','1');await expect(page.locator('.pdf-page canvas')).toBeVisible();await expect(page.locator('.textLayer span')).toHaveCount(0);
});

test('account deletion UI returns to sign-in and removes its local library',async({page})=>{
 await page.goto('http://127.0.0.1:5181');await page.getByRole('button',{name:'Đăng ký',exact:true}).click();
 await page.getByRole('textbox',{name:'Tên hiển thị',exact:true}).fill('Tài khoản xóa thử');await page.getByRole('textbox',{name:'Email',exact:true}).fill('delete-ui@example.test');await page.getByRole('textbox',{name:'Mật khẩu',exact:true}).fill('fake-delete-password');await page.getByRole('textbox',{name:'Xác nhận mật khẩu',exact:true}).fill('fake-delete-password');await page.getByRole('button',{name:'Tạo tài khoản',exact:true}).click();await expect(page.locator('.viewer')).toBeVisible();await openPdf(page);
 await page.getByRole('button',{name:'Mở menu tài khoản và trợ giúp',exact:true}).click();await page.getByRole('button',{name:'Quản lý tài khoản',exact:true}).click();
 await page.getByText('Tôi muốn xóa tài khoản',{exact:true}).click();await page.getByRole('textbox',{name:'Mật khẩu để xóa tài khoản',exact:true}).fill('fake-delete-password');await page.getByRole('textbox',{name:'Nhập XÓA TÀI KHOẢN',exact:true}).fill('XÓA TÀI KHOẢN');await page.getByRole('button',{name:'Xóa vĩnh viễn tài khoản',exact:true}).click();
 await expect(page.locator('.study-entry')).toBeVisible();await expect(page.locator('.viewer')).toHaveCount(0);
 const count=await page.evaluate(async()=>{const {readSnapshot}=await import('/src/services/library/store.ts');const open=indexedDB.open('studypdf-library',1);const db=await new Promise(r=>open.onsuccess=()=>r(open.result));const tx=db.transaction('documents'),req=tx.objectStore('documents').count();const n=await new Promise(r=>req.onsuccess=()=>r(req.result));db.close();void readSnapshot;return n;});expect(count).toBe(0);
});

test('two browser contexts synchronize archives and keep local data on conflict',async({browser})=>{
 let snapshot=null,revision=0,conflict=false;
 const contexts=await Promise.all([browser.newContext(),browser.newContext()]);
 try{
  for(const context of contexts)await context.route('**/api/library/archive',async route=>{
   const req=route.request();if(req.method()==='HEAD')return route.fulfill({status:snapshot?200:404,headers:{etag:`"${revision}"`},body:''});if(req.method()==='GET'){if(!snapshot)return route.fulfill({status:404,body:''});return route.fulfill({status:200,headers:{etag:`"${revision}"`,'content-type':'application/octet-stream'},body:snapshot});}
   if(conflict||req.headers()['if-match']!==`"${revision}"`)return route.fulfill({status:409,json:{error:'Thư viện đã thay đổi trên thiết bị khác. Hãy đồng bộ lại.'}});
   snapshot=req.postDataBuffer();if(!snapshot){const data=await req.frame().evaluate(async()=>{const {exportLibrary}=await import('/src/services/library/archive.ts');return Array.from(new Uint8Array(await(await exportLibrary('user:eeeeeeeeeeeeeeeeeeeeeeee')).arrayBuffer()));});snapshot=Buffer.from(data);}revision++;return route.fulfill({status:200,json:{revision},headers:{etag:`"${revision}"`}});
  });
  const [a,b]=await Promise.all(contexts.map(c=>c.newPage()));
  await a.goto('http://127.0.0.1:5181');await openPdf(a);await expect.poll(()=>revision,{timeout:15000}).toBeGreaterThan(0);await expect(a.getByText('Sao lưu và đồng bộ',{exact:true})).toHaveCount(0);
  await b.goto('http://127.0.0.1:5181');await openPdf(b);const choosing=b.waitForEvent('filechooser');await b.getByRole('button',{name:'＋ Mở PDF mới',exact:true}).click();await(await choosing).setFiles({name:'second-device.pdf',mimeType:'application/pdf',buffer:createPdf(1)});await expect(b.locator('.textLayer')).toContainText('StudyPDF page 1');
  await expect.poll(()=>snapshot?.includes(Buffer.from('second-device.pdf')),{timeout:15000}).toBe(true);
  await a.evaluate(()=>window.dispatchEvent(new Event('focus')));await expect(a.getByRole('button',{name:'📁 second-device.pdf',exact:true})).toBeVisible();
  conflict=true;await a.getByRole('button',{name:'Đổi tên PDF second-device.pdf',exact:true}).click();await a.getByRole('textbox',{name:'Tên PDF',exact:true}).fill('second-device-edited.pdf');await a.getByRole('button',{name:'Lưu tên PDF',exact:true}).click();await expect(a.locator('.cloud-library-status')).toContainText('Chưa lưu được thay đổi');await expect(a.getByRole('button',{name:'📁 second-device-edited.pdf',exact:true})).toBeVisible();
 }finally{await Promise.all(contexts.map(c=>c.close()));}
});

test('chat accepts general questions without PDF and keeps explicit page preparation',async({page})=>{
 await page.goto('http://127.0.0.1:5181');await page.getByRole('button',{name:'Đăng nhập',exact:true}).click();await page.getByRole('textbox',{name:'Email',exact:true}).fill('reader-fixture@example.test');await page.getByRole('textbox',{name:'Mật khẩu',exact:true}).fill('fake-reader-password');await page.getByRole('button',{name:'Đăng nhập',exact:true}).last().click();await expect(page.locator('.viewer')).toBeVisible();
 let payload;await page.route('**/api/ai',async route=>{payload=route.request().postDataJSON();await route.fulfill({status:200,contentType:'text/event-stream',body:'data: {"type":"meta","model":"fake"}\n\ndata: {"type":"text","text":"x = 2"}\n\ndata: {"type":"done"}\n\n'});});
 const input=page.getByRole('textbox',{name:'Câu hỏi của bạn',exact:true});await input.fill('Giải 2x + 3 = 7.');await page.getByRole('button',{name:'Gửi câu hỏi',exact:true}).click();await expect(page.getByTestId('ai-answer')).toHaveText('x = 2');await expect(page.getByTestId('ai-answer')).not.toHaveAttribute('data-ai-selection-page');expect(payload.action).toBe('ask');expect(payload.selectedText).toBe('');await expect(page.getByText('Không kèm đoạn PDF',{exact:true})).toBeVisible();
 await input.fill('Kiểm tra lại kết quả.');await page.getByRole('button',{name:'Gửi câu hỏi',exact:true}).click();await expect(page.getByTestId('ai-answer')).toHaveCount(2);expect(payload.history[0].question).toBe('Giải 2x + 3 = 7.');
 await openPdf(page);await page.locator('.composer-context > summary').click();await page.getByRole('combobox',{name:'Phạm vi gửi AI',exact:true}).selectOption('pages');await input.fill('Giải bài trong trang này.');await expect(page.getByRole('button',{name:'Gửi câu hỏi',exact:true})).toBeDisabled();await page.getByRole('combobox',{name:'Phạm vi gửi AI',exact:true}).selectOption('none');await expect(page.getByRole('button',{name:'Gửi câu hỏi',exact:true})).toBeEnabled();
});


test('general chat survives reload and PDF switching, can be renamed and deleted',async({page})=>{
 await page.goto('http://127.0.0.1:5181');await page.getByRole('button',{name:'Đăng nhập',exact:true}).click();await page.getByRole('textbox',{name:'Email',exact:true}).fill('reader-fixture@example.test');await page.getByRole('textbox',{name:'Mật khẩu',exact:true}).fill('fake-reader-password');await page.getByRole('button',{name:'Đăng nhập',exact:true}).last().click();await expect(page.locator('.viewer')).toBeVisible();
 await page.route('**/api/ai',async r=>r.fulfill({status:200,contentType:'text/event-stream',body:'data: {"type":"meta","model":"fake"}\n\ndata: {"type":"text","text":"Câu trả lời được lưu."}\n\ndata: {"type":"done"}\n\n'}));
 await page.getByRole('textbox',{name:'Câu hỏi của bạn',exact:true}).fill('Nhớ câu hỏi này.');await page.getByRole('button',{name:'Gửi câu hỏi',exact:true}).click();await expect(page.getByTestId('ai-answer')).toContainText('Câu trả lời được lưu.');
 const toggle=page.getByRole('button',{name:'Bật/tắt danh sách tài liệu',exact:true});if(await toggle.getAttribute('aria-expanded')!=='true')await toggle.click();
 await expect(page.getByRole('status').filter({hasText:'Đã hoàn tất.'})).toBeVisible();
 const nav=page.getByRole('region',{name:'Chat không gắn PDF',exact:true});await expect(nav.getByRole('button',{name:'Đoạn chat 1',exact:true})).toBeVisible();
 await page.reload();await expect(page.locator('.viewer')).toBeVisible();await page.getByRole('region',{name:'Chat không gắn PDF',exact:true}).getByRole('button',{name:'Đoạn chat 1',exact:true}).click();await expect(page.getByText('Nhớ câu hỏi này.',{exact:true})).toBeVisible();await expect(page.getByTestId('ai-answer')).toContainText('Câu trả lời được lưu.');
 await openPdf(page);await page.getByRole('region',{name:'Chat không gắn PDF',exact:true}).getByRole('button',{name:'Đoạn chat 1',exact:true}).click();await expect(page.locator('.pdf-page')).toHaveCount(0);await expect(page.getByTestId('ai-answer')).toContainText('Câu trả lời được lưu.');
 await page.getByRole('button',{name:'Đổi tên chat Đoạn chat 1',exact:true}).click();await page.getByRole('textbox',{name:'Tên chat không gắn PDF',exact:true}).fill('Ôn tập không PDF');await page.getByRole('button',{name:'Lưu tên chat',exact:true}).click();await expect(nav.getByRole('button',{name:'Ôn tập không PDF',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Xóa chat Ôn tập không PDF',exact:true}).click();await page.getByRole('button',{name:'Xác nhận xóa chat',exact:true}).click();await expect(nav.getByRole('button',{name:'Ôn tập không PDF',exact:true})).toHaveCount(0);await expect(page.getByTestId('ai-answer')).toHaveCount(0);
});


test('background session checks preserve the PDF and draft through delay and failure, confirmed expiry locks the reader',async({page})=>{
 await page.goto('http://127.0.0.1:5181');await openPdf(page);
 const draft=page.getByRole('textbox',{name:'Câu hỏi của bạn',exact:true});await draft.fill('Câu hỏi đang viết dở');
 const surface=await page.locator('.pdf-page-surface').elementHandle();
 let release;const gate=new Promise(resolve=>{release=resolve;});let seen=0;
 await page.route('**/api/auth/me',async route=>{seen++;await gate;await route.fulfill({status:503,contentType:'text/plain',body:'Temporarily unavailable'});});
 await page.evaluate(()=>window.dispatchEvent(new Event('focus')));await expect.poll(()=>seen).toBeGreaterThan(0);
 await expect(draft).toBeVisible();await expect(draft).toHaveValue('Câu hỏi đang viết dở');expect(await surface.evaluate(e=>e.isConnected)).toBe(true);
 release();await expect.poll(async()=>page.locator('.assistant-session:not([hidden])').count()).toBe(1);
 await page.unroute('**/api/auth/me');
 await page.route('**/api/auth/me',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({authenticated:false,user:null})}));
 await page.evaluate(()=>window.dispatchEvent(new Event('focus')));
 await expect(page.locator('.study-entry')).toBeVisible();await expect(page.locator('.viewer')).toHaveCount(0);
});
