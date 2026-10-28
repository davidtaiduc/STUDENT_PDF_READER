import { cp, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const projectRoot = new URL('../', import.meta.url);
for (const directory of ['cmaps', 'standard_fonts', 'wasm']) {
  const source = new URL(`node_modules/pdfjs-dist/${directory}/`, projectRoot);
  const destination = new URL(`public/pdfjs/${directory}/`, projectRoot);
  await mkdir(destination, { recursive: true });
  await cp(fileURLToPath(source), fileURLToPath(destination), { recursive: true });
}
