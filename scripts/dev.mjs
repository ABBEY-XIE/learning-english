import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
const root = resolve(process.cwd());
try { process.loadEnvFile('.env'); } catch {}
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.webmanifest': 'application/manifest+json' };
const port = Number(process.env.PORT || 4173);
http.createServer(async (req, res) => {
  try {
    const path = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    if (['/api/config', '/api/coach'].includes(path)) {
      let raw = '';
      for await (const chunk of req) { raw += chunk; if (raw.length > 20000) { res.writeHead(413); res.end(); return; } }
      req.body = raw ? JSON.parse(raw) : {};
      res.status = code => { res.statusCode = code; return res; };
      res.json = body => { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(body)); };
      await (await import(`../${path.slice(1)}.js`)).default(req, res); return;
    }
    const base = process.env.SERVE_DIST === '1' ? resolve(root, 'dist') : root;
    let file = resolve(base, '.' + (path === '/' ? '/index.html' : path));
    if (process.env.SERVE_DIST !== '1' && !['/src/', '/index.html', '/'].some(x => path.startsWith(x) && x !== '/')) {
      if (path !== '/') file = resolve(root, 'public', '.' + path);
    }
    if (!file.startsWith(base + sep) || /\/(?:server|api|supabase|tests|scripts)\//.test(file.slice(base.length)) || path.includes('.env')) { res.writeHead(403); res.end(); return; }
    if (!(await stat(file)).isFile()) throw new Error('not file');
    res.setHeader('Content-Type', types[extname(file)] || 'application/octet-stream');
    res.setHeader('Cache-Control', 'no-store');
    res.end(await readFile(file));
  } catch { res.writeHead(404); res.end('Not found'); }
}).listen(port, '0.0.0.0', () => console.log(`Roam local test: http://localhost:${port}`));
