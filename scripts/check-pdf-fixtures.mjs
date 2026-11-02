import { readdir, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';

// Read-only parser checks on real local PDFs. No fixtures are generated/edited.
const directory = resolve(process.argv[2] || 'Kiểm thử');
const files = (await readdir(directory)).filter(name => /^Test Case \d+\.pdf$/i.test(name))
  .sort((a,b) => a.localeCompare(b,undefined,{numeric:true}));
if (!files.length) throw new Error('No real PDF fixtures found.');
for (const name of files) {
  const started = performance.now();
  const data = new Uint8Array(await readFile(resolve(directory,name)));
  const bytes = data.byteLength;
  const assetPath = path => resolve(path).replaceAll('\\','/') + '/';
  const task = getDocument({ data,
    cMapUrl: assetPath('node_modules/pdfjs-dist/cmaps'), cMapPacked:true,
    standardFontDataUrl: assetPath('node_modules/pdfjs-dist/standard_fonts'),
    wasmUrl: assetPath('node_modules/pdfjs-dist/wasm'),
  });
  try {
    const pdf = await task.promise;
    const probes = [];
    for (const number of [...new Set([1,Math.ceil(pdf.numPages/2),pdf.numPages])]) {
      const page = await pdf.getPage(number);
      const content = await page.getTextContent();
      const operators = await page.getOperatorList();
      probes.push({ page:number, textItems:content.items.filter(item=>'str' in item && item.str.trim()).length,
        operators:operators.fnArray.length });
      page.cleanup();
    }
    console.log(JSON.stringify({file:name,pages:pdf.numPages,bytes,
      probes,elapsedMs:Math.round(performance.now()-started)}));
  } finally { await task.destroy(); }
}
