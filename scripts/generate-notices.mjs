import { execFileSync } from 'node:child_process';
import { readFile, readdir, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';

const paths = execFileSync(
  process.execPath,
  [process.env.npm_execpath, 'ls', '--omit=dev', '--parseable', '--all'],
  { encoding: 'utf8', windowsHide: true },
)
  .trim()
  .split(/\r?\n/)
  .slice(1);
const notices = [
  'Weekdeck third-party software notices',
  'Electron and Chromium notices also accompany desktop distributions.',
];
const seen = new Set();
for (const directory of paths) {
  const pkg = JSON.parse(await readFile(path.join(directory, 'package.json'), 'utf8'));
  const name = `${pkg.name}@${pkg.version}`;
  if (seen.has(name)) continue;
  seen.add(name);
  notices.push(
    `\n${'='.repeat(72)}\n${name}\nLicense: ${JSON.stringify(pkg.license ?? 'See package source')}`,
  );
  for (const filename of await readdir(directory)) {
    if (!/^(licen[sc]e|copying|notice|ofl)(\.|$)/i.test(filename)) continue;
    const file = path.join(directory, filename);
    try {
      notices.push(await readFile(file, 'utf8'));
    } catch (error) {
      if (error.code !== 'EISDIR') throw error;
    }
  }
}
await mkdir('public', { recursive: true });
await writeFile('public/THIRD_PARTY_NOTICES.txt', notices.join('\n\n'));
console.log(`Generated notices for ${seen.size} production packages.`);
