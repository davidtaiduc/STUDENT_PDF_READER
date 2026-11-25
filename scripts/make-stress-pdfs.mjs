import {mkdir,writeFile} from 'node:fs/promises';
export function createPdf(pageCount=300,imageOnly=false){
 const objects=['<< /Type /Catalog /Pages 2 0 R >>',''];
 const kids=[];
 for(let i=1;i<=pageCount;i++){
  const page=objects.length+1,contents=page+1;kids.push(`${page} 0 R`);
  const stream=imageOnly?'q 400 0 0 600 80 100 cm /Scan Do Q':`BT /F1 18 Tf 60 760 Td (StudyPDF page ${i}) Tj 0 -30 Td /F1 12 Tf (A function receives input and returns output.) Tj ET`;
  objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources ${imageOnly?'<< /XObject << /Scan '+(3+pageCount*2)+' 0 R >> >>':'<< /Font << /F1 '+(3+pageCount*2)+' 0 R >> >>'} /Contents ${contents} 0 R >>`,`<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`);
 }
 objects[1]=`<< /Type /Pages /Kids [${kids.join(' ')}] /Count ${pageCount} >>`;
 objects.push(imageOnly?'<< /Type /XObject /Subtype /Image /Width 1 /Height 1 /ColorSpace /DeviceRGB /BitsPerComponent 8 /Length 3 >>\nstream\nABC\nendstream':'<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');
 let body='%PDF-1.4\n',offsets=[0];for(let i=0;i<objects.length;i++){offsets.push(Buffer.byteLength(body));body+=`${i+1} 0 obj\n${objects[i]}\nendobj\n`;}
 const start=Buffer.byteLength(body);body+=`xref\n0 ${objects.length+1}\n0000000000 65535 f \n`+offsets.slice(1).map(n=>String(n).padStart(10,'0')+' 00000 n \n').join('')+`trailer\n<< /Size ${objects.length+1} /Root 1 0 R >>\nstartxref\n${start}\n%%EOF\n`;return Buffer.from(body);
}
if(process.argv[1]?.endsWith('make-stress-pdfs.mjs')){await mkdir('tmp',{recursive:true});await writeFile('tmp/stress-300.pdf',createPdf());await writeFile('tmp/scan-image-only.pdf',createPdf(2,true));console.log('Created synthetic 300-page and image-only PDF fixtures in tmp.');}
