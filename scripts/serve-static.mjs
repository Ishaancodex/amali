/**
 * A minimal static server for the exported build (`out/` or a custom
 * `distDir`) with gzip and long-lived caching for hashed assets — what any
 * real host does, so local Lighthouse runs and the local preview measure
 * something realistic (Python's http.server sends everything uncompressed).
 *
 *   node scripts/serve-static.mjs <dir> [port]
 */
import { createServer } from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { extname, join, normalize, resolve } from 'node:path';
import { createGzip } from 'node:zlib';

const root = resolve(process.argv[2] ?? 'out');
const port = Number(process.argv[3] ?? 4173);
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.txt': 'text/plain; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.jpg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2',
  '.ico': 'image/x-icon',
};
const COMPRESSIBLE = new Set(['.html', '.js', '.css', '.json', '.txt', '.svg']);

createServer((req, res) => {
  const path = decodeURIComponent(new URL(req.url ?? '/', 'http://x').pathname);
  let file = normalize(join(root, path));
  if (!file.startsWith(root)) return void res.writeHead(403).end();
  if (existsSync(file) && statSync(file).isDirectory()) file = join(file, 'index.html');
  if (!existsSync(file)) {
    file = join(root, '404.html');
    res.statusCode = 404;
  }
  const ext = extname(file);
  res.setHeader('Content-Type', TYPES[ext] ?? 'application/octet-stream');
  res.setHeader(
    'Cache-Control',
    path.startsWith('/_next/static/') ? 'public, max-age=31536000, immutable' : 'no-cache',
  );
  const stream = createReadStream(file);
  if (COMPRESSIBLE.has(ext) && /\bgzip\b/.test(req.headers['accept-encoding'] ?? '')) {
    res.setHeader('Content-Encoding', 'gzip');
    stream.pipe(createGzip()).pipe(res);
  } else stream.pipe(res);
}).listen(port, '127.0.0.1', () => console.log(`Serving ${root} on http://127.0.0.1:${port}`));
