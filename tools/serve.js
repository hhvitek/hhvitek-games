#!/usr/bin/env node
// A local web server for testing the games (the Playwright MCP blocks file://, and a service worker needs http).
//   node tools/serve.js [port]      serves the repository root on http://127.0.0.1:<port>/ (default 8765)
// Node only, no dependencies, the same on Linux, macOS and Windows (no python / python3 / py differences).
// Every answer says "no-cache", so a changed file is seen at once; the browser still gets a short 304 when nothing changed.
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const PORT = Number(process.argv[2]) || 8765;
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.ico': 'image/x-icon',
  '.md': 'text/plain; charset=utf-8', '.txt': 'text/plain; charset=utf-8',
};

http.createServer((req, res) => {
  let rel;
  try { rel = decodeURIComponent(new URL(req.url, 'http://x').pathname); } catch (e) { res.writeHead(400).end(); return; }
  let file = path.join(ROOT, path.normalize(rel));
  // never outside the repository (../ in the address)
  if (file !== ROOT && !file.startsWith(ROOT + path.sep)) { res.writeHead(403).end(); return; }
  fs.stat(file, (err, st) => {
    if (!err && st.isDirectory()) {
      if (!rel.endsWith('/')) { res.writeHead(301, { Location: rel + '/' }).end(); return; }
      file = path.join(file, 'index.html');
      try { st = fs.statSync(file); err = null; } catch (e) { err = e; }
    }
    if (err || !st.isFile()) { res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('404 Not Found'); return; }
    const etag = `"${st.size}-${Math.round(st.mtimeMs)}"`;
    const headers = { 'Content-Type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'no-cache', ETag: etag };
    if (req.headers['if-none-match'] === etag) { res.writeHead(304, headers).end(); return; }
    res.writeHead(200, { ...headers, 'Content-Length': st.size });
    if (req.method === 'HEAD') { res.end(); return; }
    fs.createReadStream(file).pipe(res);
  });
}).on('error', e => {
  console.error(e.code === 'EADDRINUSE' ? `port ${PORT} is already in use (another server?): node tools/serve.js <other port>` : e.message);
  process.exit(1);
}).listen(PORT, '127.0.0.1', () => console.log(`serving ${ROOT} on http://127.0.0.1:${PORT}/ (Ctrl+C stops it)`));
