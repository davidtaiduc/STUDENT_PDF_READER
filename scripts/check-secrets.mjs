import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { parseEnv } from 'node:util';
import { basename, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export function sampleSecretNames(source) {
  const values = parseEnv(source);
  return ['GEMINI_API_KEY', 'AI_ACCESS_TOKEN', 'MONGODB_URI'].filter(key => values[key]?.trim());
}

export function checkSecrets(root) {
  const names = sampleSecretNames(readFileSync(resolve(root, '.env.example'), 'utf8'));
  const tracked = execFileSync('git', ['ls-files', '-z'], { cwd: root, encoding: 'utf8' }).split('\0').filter(Boolean);
  const privateFiles = tracked.filter(path => {
    const name = basename(path);
    return name !== '.env.example' && (name === '.env' || name.startsWith('.env.'));
  });
  // Output names only, never secret values.
  if (names.length) console.error(`Cần để trống trong .env.example: ${names.join(', ')}. Giữ giá trị thật trong .env hoặc biến môi trường hosting.`);
  if (privateFiles.length) console.error(`Git đang theo dõi file môi trường riêng: ${privateFiles.join(', ')}. Cần gỡ các file này khỏi Git trước khi push.`);
  if (names.length || privateFiles.length) return false;
  console.log('Kiểm tra file môi trường: đạt. Vẫn cần rà soát diff trước khi push.');
  return true;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    if (!checkSecrets(fileURLToPath(new URL('../', import.meta.url)))) process.exitCode = 1;
  } catch {
    console.error('Không kiểm tra được file môi trường. Cần có .env.example và repository Git hợp lệ.');
    process.exitCode = 1;
  }
}
