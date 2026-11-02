import { spawnSync } from 'node:child_process';

// OneSite serves static files; AI needs a separately hosted HTTPS backend.
const endpoint = process.env.VITE_AI_API_URL;
if (!endpoint) throw new Error('Set VITE_AI_API_URL to your public HTTPS backend before building for static hosting.');
const url = new URL(endpoint);
if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash || url.pathname !== '/') {
  throw new Error('VITE_AI_API_URL must be an HTTPS origin, e.g. https://api.example.com');
}
const env = { ...process.env, VITE_AI_API_URL: url.origin };
for (const args of [
  ['scripts/sync-pdfjs-assets.mjs'],
  ['node_modules/typescript/bin/tsc','-b'],
  ['node_modules/typescript/bin/tsc','-p','backend/tsconfig.json'],
  ['node_modules/vite/bin/vite.js','build','--base=./'],
]) {
  const result = spawnSync(process.execPath,args,{env,stdio:'inherit'});
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}
