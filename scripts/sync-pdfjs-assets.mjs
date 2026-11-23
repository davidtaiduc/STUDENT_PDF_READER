import { cp, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const projectRoot = new URL('../', import.meta.url);
for (const directory of ['cmaps', 'standard_fonts', 'wasm']) {
  const source = new URL(`node_modules/pdfjs-dist/${directory}/`, projectRoot);
  const destination = new URL(`public/pdfjs/${directory}/`, projectRoot);
  await mkdir(destination, { recursive: true });
  await cp(fileURLToPath(source), fileURLToPath(destination), { recursive: true });
}

// Bundle OCR assets locally; no page image is sent to a CDN.
const {readdir,copyFile}=await import('node:fs/promises');
const ocr=new URL('public/ocr/',projectRoot);await mkdir(new URL('core/',ocr),{recursive:true});await mkdir(new URL('lang/',ocr),{recursive:true});
await copyFile(new URL('node_modules/tesseract.js/dist/worker.min.js',projectRoot),new URL('worker.min.js',ocr));
for(const name of await readdir(new URL('node_modules/tesseract.js-core/',projectRoot))){if(name.includes('lstm')&&(name.endsWith('.wasm.js')||name.endsWith('.wasm')))await copyFile(new URL(`node_modules/tesseract.js-core/${name}`,projectRoot),new URL(`core/${name}`,ocr));}
for(const language of ['eng','vie'])await copyFile(new URL(`node_modules/@tesseract.js-data/${language}/4.0.0_best_int/${language}.traineddata.gz`,projectRoot),new URL(`lang/${language}.traineddata.gz`,ocr));

await copyFile(new URL('node_modules/tesseract.js/LICENSE.md',projectRoot),new URL('TESSERACT_JS_LICENSE.md',ocr));
await copyFile(new URL('node_modules/tesseract.js-core/LICENSE',projectRoot),new URL('TESSERACT_CORE_LICENSE.txt',ocr));
