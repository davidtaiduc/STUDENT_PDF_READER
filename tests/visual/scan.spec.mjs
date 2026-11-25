import {test,expect} from '@playwright/test';
import {existsSync} from 'node:fs';
import {resolve} from 'node:path';
const file=resolve('Kiểm thử/Test Case 10.pdf');
test('Test Case 10 is image-only: renders but has no native selectable text',async({page})=>{
 test.skip(!existsSync(file),'Local PDF fixture is not committed.');
 await page.goto('http://127.0.0.1:5181');
 await page.getByRole('button',{name:'Đăng nhập',exact:true}).click();
 await page.getByRole('textbox',{name:'Email',exact:true}).fill('reader-fixture@example.test');
 await page.getByRole('textbox',{name:'Mật khẩu',exact:true}).fill('fake-reader-password');
 await page.getByRole('button',{name:'Đăng nhập',exact:true}).last().click();
 await expect(page.locator('.viewer')).toBeVisible();
 const toggle=page.getByRole('button',{name:'Bật/tắt danh sách tài liệu',exact:true});if(await toggle.getAttribute('aria-expanded')!=='true')await toggle.click();
 const choosing=page.waitForEvent('filechooser');await page.getByRole('button',{name:'＋ Mở PDF mới',exact:true}).click();await(await choosing).setFiles(file);
 await expect(page.locator('.pdf-page canvas')).toBeVisible();await expect(page.locator('.textLayer')).toBeVisible();await expect(page.locator('.textLayer span')).toHaveCount(0);
 const box=await page.locator('.pdf-page canvas').boundingBox();await page.mouse.move(box.x+box.width*.15,box.y+box.height*.3);await page.mouse.down();await page.mouse.move(box.x+box.width*.8,box.y+box.height*.4,{steps:15});await page.mouse.up();expect(await page.evaluate(()=>window.getSelection()?.toString()||'')).toBe('');
 await page.screenshot({path:'tmp/test-case-10-diagnostic.png'});
});
