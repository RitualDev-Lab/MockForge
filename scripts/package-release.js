import { createWriteStream, readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve, relative, join } from 'node:path';
import { createHash } from 'node:crypto';
import { execSync } from 'node:child_process';

const ROOT_DIR = resolve('.');
const RELEASE_ZIP = resolve(ROOT_DIR, 'release', 'mockforge-v0.1.0.zip');

console.log('[MockForge] Packaging production distribution release archive...');

// Use PowerShell Compress-Archive for zero-dependency native Windows zip
const filesToInclude = [
  'dist',
  'bin',
  'src/ui',
  'samples',
  'package.json',
  'README.md'
];

try {
  const psCmd = `powershell -Command "Compress-Archive -Path ${filesToInclude.map(f => `'${f}'`).join(',')} -DestinationPath '${RELEASE_ZIP}' -Force"`;
  execSync(psCmd, { stdio: 'inherit' });

  const zipBytes = readFileSync(RELEASE_ZIP);
  const sha256 = createHash('sha256').update(zipBytes).digest('hex');
  const sizeKb = (zipBytes.length / 1024).toFixed(2);

  console.log(`✓ Production Archive Created: ${RELEASE_ZIP}`);
  console.log(`  Size: ${sizeKb} KB`);
  console.log(`  SHA-256: ${sha256}`);
} catch (err) {
  console.error('Failed to package archive:', err);
  process.exit(1);
}
