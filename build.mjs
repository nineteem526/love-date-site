import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';

const sourceFiles = [
  ['/', 'index.html', 'text/html; charset=utf-8'],
  ['/index.html', 'index.html', 'text/html; charset=utf-8'],
  ['/styles.css', 'styles.css', 'text/css; charset=utf-8'],
  ['/app.js', 'app.js', 'application/javascript; charset=utf-8']
];

const pages = Object.fromEntries(await Promise.all(sourceFiles.map(async ([path, file, type]) => [path, [await readFile(file, 'utf8'), type]])));
const worker = `
const pages = ${JSON.stringify(pages)};
export default {
  async fetch(request) {
    const pathname = new URL(request.url).pathname;
    const page = pages[pathname];
    if (!page) return new Response('Not found', { status: 404 });
    return new Response(page[0], { headers: { 'content-type': page[1], 'cache-control': 'no-store' } });
  }
};
`;

await rm('dist', { recursive: true, force: true });
await mkdir('dist/server', { recursive: true });
await writeFile('dist/server/index.js', worker.trimStart());
console.log('Deployment bundle created.');
