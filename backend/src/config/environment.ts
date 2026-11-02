import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseEnv } from 'node:util';

// Match backend's --env-file=.env; never load samples or mode/local overrides.
export function readProjectEnvironment(directory: string, inherited: NodeJS.ProcessEnv = process.env) {
  const file = resolve(directory, '.env');
  const configured = existsSync(file) ? parseEnv(readFileSync(file, 'utf8')) : {};
  return { ...configured, ...inherited };
}
