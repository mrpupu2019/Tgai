import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { captureSnapshot, captureElementSnapshot } from './server/captureSnapshot';
import { createHash, randomBytes } from 'crypto';
import fs from 'fs';
import os from 'os';
const DB_PATH = path.resolve(__dirname, 'server', 'db.json');
type PersistedDB = {
  settings?: any;
  schedule?: any;
  history?: Array<{ id: string; text: string; sender?: 'USER' | 'AI' | 'SYSTEM'; isAnalysis?: boolean; image?: string | null; images?: string[] | null; timestamp?: number }>;
};
function readDb(): PersistedDB {
  try {
    if (fs.existsSync(DB_PATH)) {
      const txt = fs.readFileSync(DB_PATH, 'utf-8');
      return JSON.parse(txt || '{}');
    }
  } catch {}
  return { settings: undefined, schedule: undefined, history: [] };
}
function writeDb(db: PersistedDB) {
  try {
    const dir = path.dirname(DB_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2) + os.EOL);
  } catch (e) { console.error('[db] write error', e); }
}
let dbCache: PersistedDB = readDb();
let snapshotQueue: Array<{ image: string; note?: string }> = [];
let lastSnapshot: { image: string; note?: string } | null = null;
let externalOnly = false;
let lastHash: string | null = null;
const sseClients = new Set<any>();
const sessions: Map<string, number> = new Map();
function getCookie(req: any, name: string): string | null {
  try {
    const h = req.headers['cookie'] || '';
    const parts = h.split(/;\s*/).map((x: string) => x.split('='));
    for (const [k, v] of parts) { if (k === name) return decodeURIComponent(v || ''); }
  } catch {}
  return null;
}
function isAuthed(req: any): boolean {
  const token = getCookie(req, 'session');
  if (!token) return false;
  const exp = sessions.get(token);
  if (!exp) return false;
  if (Date.now() > exp) { sessions.delete(token); return false; }
  return true;
}

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [
        react(),
        {
          name: 'chart-image-proxy',
          configureServer(server) {
            server.middlewares.use(async (req, res, next) => {
              if (!req.url) return next();
              const u = new URL('http://localhost' + req.url);
              const p = u.pathname;
              if (p === '/api/auth/login' && req.method === 'POST') {
                let body = '';
                req.on('data', (chunk) => (body += chunk));
                req.on('end', () => {
                  try {
                    const data = JSON.parse(body || '{}');
                    const pass = (data?.password || '').toString();
                    const required = (env.APP_PASSWORD || '').toString();
                    if (!required) {
                      res.statusCode = 500;
                      res.setHeader('Content-Type', 'application/json');
                      res.end(JSON.stringify({ ok: false, error: 'APP_PASSWORD not set' }));
                      return;
                    }
                    if (pass !== required) {
                      res.statusCode = 401;
                      res.setHeader('Content-Type', 'application/json');
                      res.end(JSON.stringify({ ok: false }));
                      return;
                    }
                    const token = randomBytes(24).toString('hex');
                    sessions.set(token, Date.now() + 7 * 24 * 60 * 60 * 1000);
                    res.setHeader('Set-Cookie', `session=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax`);
                    res.setHeader('Content-Type', 'application/json');
                    res.end(JSON.stringify({ ok: true }));
                  } catch (e: any) {
                    res.statusCode = 400;
                    res.end(JSON.stringify({ ok: false, error: String(e) }));
                  }
                });
                return;
              }
              if (p === '/api/auth/status' && req.method === 'GET') {
                const ok = isAuthed(req);
                res.setHeader('Content-Type', 'application/json');
                if (!ok) { res.statusCode = 401; res.end(JSON.stringify({ ok: false })); } else { res.end(JSON.stringify({ ok: true })); }
                return;
              }
              if (p === '/api/auth/logout' && req.method === 'POST') {
                const token = getCookie(req, 'session');
                if (token) sessions.delete(token);
                res.setHeader('Set-Cookie', `session=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax`);
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ ok: true }));
                return;
              }
              if (p.startsWith('/api/') && !p.startsWith('/api/auth/')) {
                const publicPaths = new Set([
                  '/api/snapshot-upload',
                  '/api/snapshot-upload2',
                  '/api/snapshot-stream',
                  '/api/snapshot-next',
                  '/api/snapshot-latest',
                  '/api/mode',
                  '/api/chart-image',
                  '/api/snapshot',
                  '/api/snapshot-local',
                ]);
                let isPublic = publicPaths.has(p);
                if (p === '/api/settings' && req.method === 'GET') isPublic = true;
                if (p === '/api/history' && (req.method === 'GET' || req.method === 'POST')) isPublic = true;
                if (!isPublic && !isAuthed(req)) {
                  res.statusCode = 401;
                  res.setHeader('Content-Type', 'application/json');
                  res.end(JSON.stringify({ ok: false, error: 'UNAUTHENTICATED' }));
                  return;
                }
              }
              if (p === '/api/snapshot-upload2' && req.method === 'POST') {
                try {
                  let body = '';
                  req.on('data', (chunk) => (body += chunk));
                  req.on('end', () => {
                    try {
                      const data = JSON.parse(body || '{}');
                      if (Array.isArray(data?.images) && data.images.length >= 2) {
                        const item: any = { images: data.images, note: data?.note };
                        snapshotQueue.push(item);
                        lastSnapshot = item;
                        const payload = `data: ${JSON.stringify({ images: item.images })}\n\n`;
                        for (const client of sseClients) { try { client.write(payload); } catch {} }
                        res.setHeader('Content-Type', 'application/json');
                        res.end(JSON.stringify({ ok: true }));
                      } else {
                        res.statusCode = 400;
                        res.end(JSON.stringify({ ok: false, error: 'INVALID_IMAGES' }));
                      }
                    } catch (e: any) {
                      res.statusCode = 400;
                      res.end(JSON.stringify({ ok: false, error: String(e) }));
                    }
                  });
                } catch (e: any) {
                  res.statusCode = 500;
                  res.end(JSON.stringify({ ok: false, error: String(e) }));
                }
                return;
              }
              if (p !== '/api/chart-image') return next();
              const sources = [
                'https://finviz.com/fx_image.ashx?pair=xauusd&tf=h1',
                'https://www.kitco.com/images/live/gold.gif',
              ];
              let lastErr: any;
              for (const url of sources) {
                try {
                  const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
                  if (!r.ok) continue;
                  const ct = r.headers.get('content-type') || 'image/png';
                  const buf = Buffer.from(await r.arrayBuffer());
                  if (buf.length < 3000) continue;
                  const b64 = buf.toString('base64');
                  res.setHeader('Content-Type', 'application/json');
                  res.end(JSON.stringify({ dataUrl: `data:${ct};base64,${b64}`, mimeType: ct }));
                  return;
                } catch (e) {
                  lastErr = e;
                }
              }
              res.statusCode = 502;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ error: 'FETCH_FAILED', detail: String(lastErr || '') }));
            });
            // Ensure upload route does not collide with /api/snapshot
            server.middlewares.use(async (req, res, next) => {
              if (!req.url) return next();
              const u = new URL('http://localhost' + req.url);
              const p = u.pathname;
              if (p !== '/api/snapshot') return next();
              try {
                if (externalOnly) {
                  res.statusCode = 403;
                  res.setHeader('Content-Type', 'application/json');
                  res.end(JSON.stringify({ ok: false, error: 'EXTERNAL_ONLY' }));
                  return;
                }
                const url = u.searchParams.get('url') || 'https://s.tradingview.com/widgetembed/?symbol=XAUUSD&interval=15&timezone=Asia%2FDhaka&theme=dark';
                console.log('[snapshot] url=', url)
                const { dataUrl } = await captureSnapshot({ url });
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ ok: true, image: dataUrl }));
              } catch (e: any) {
                console.error('[snapshot] error', e)
                res.statusCode = 500;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ ok: false, error: String(e) }));
              }
            });
            server.middlewares.use(async (req, res, next) => {
              if (!req.url) return next();
              const u = new URL('http://localhost' + req.url);
              const p = u.pathname;
              if (p !== '/api/snapshot-local') return next();
              try {
                const origin = u.searchParams.get('origin') || `http://localhost:${server.config.server.port || 3000}`;
                const baseUrl = origin.endsWith('/') ? origin : origin + '/';
                console.log('[snapshot-local] origin=', baseUrl)
                const { dataUrl } = await captureElementSnapshot({ url: baseUrl, selector: '#tradingview-widget-container' });
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ ok: true, image: dataUrl }));
              } catch (e: any) {
                console.error('[snapshot-local] error', e)
                res.statusCode = 500;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ ok: false, error: String(e) }));
              }
            });
            server.middlewares.use(async (req, res, next) => {
              if (!req.url) return next();
              const u = new URL('http://localhost' + req.url);
              const p = u.pathname;
              if (p === '/api/snapshot-upload' && req.method === 'POST') {
                try {
                  let body = '';
                  req.on('data', (chunk) => (body += chunk));
                  req.on('end', () => {
                    try {
                      const data = JSON.parse(body || '{}');
                      if (typeof data?.image === 'string' && data.image.startsWith('data:image')) {
                        const hash = createHash('sha256').update(data.image).digest('hex');
                        if (hash === lastHash) {
                          console.log('[upload] duplicate snapshot ignored');
                          res.setHeader('Content-Type', 'application/json');
                          res.end(JSON.stringify({ ok: true, duplicate: true }));
                          return;
                        }
                        lastHash = hash;
                        const item = { image: data.image, note: data?.note };
                        snapshotQueue.push(item);
                        lastSnapshot = item;
                        console.log('[upload] external snapshot received');
                        // Notify SSE clients immediately
                        const payload = `data: ${JSON.stringify({ image: item.image })}\n\n`;
                        for (const client of sseClients) {
                          try { client.write(payload); } catch {}
                        }
                        res.setHeader('Content-Type', 'application/json');
                        res.end(JSON.stringify({ ok: true }));
                      } else {
                        res.statusCode = 400;
                        res.end(JSON.stringify({ ok: false, error: 'INVALID_PAYLOAD' }));
                      }
                    } catch (e: any) {
                      res.statusCode = 400;
                      res.end(JSON.stringify({ ok: false, error: String(e) }));
                    }
                  });
                } catch (e: any) {
                  res.statusCode = 500;
                  res.end(JSON.stringify({ ok: false, error: String(e) }));
                }
                return;
              }
              if (p === '/api/snapshot-next' && req.method === 'GET') {
                const item = snapshotQueue.shift();
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ ok: true, image: (item as any)?.image || null, images: (item as any)?.images || null }));
                return;
              }
              if (p === '/api/snapshot-latest' && req.method === 'GET') {
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ ok: true, image: lastSnapshot?.image || null }));
                return;
              }
              if (p === '/api/snapshot-stream' && req.method === 'GET') {
                res.writeHead(200, {
                  'Content-Type': 'text/event-stream',
                  'Cache-Control': 'no-cache',
                  Connection: 'keep-alive',
                });
                res.write('\n');
                sseClients.add(res);
                req.on('close', () => { try { sseClients.delete(res); } catch {} });
                return;
              }
              if (p === '/api/mode' && req.method === 'POST') {
                let body = '';
                req.on('data', (chunk) => (body += chunk));
                req.on('end', () => {
                  try {
                    const data = JSON.parse(body || '{}');
                    externalOnly = !!data?.externalOnly;
                    res.setHeader('Content-Type', 'application/json');
                    res.end(JSON.stringify({ ok: true }));
                  } catch (e: any) {
                    res.statusCode = 400;
                    res.end(JSON.stringify({ ok: false, error: String(e) }));
                  }
                });
                return;
              }
              if (p === '/api/settings' && req.method === 'GET') {
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ ok: true, settings: dbCache.settings || null, schedule: dbCache.schedule || null }));
                return;
              }
              if (p === '/api/settings' && req.method === 'POST') {
                let body = '';
                req.on('data', (chunk) => (body += chunk));
                req.on('end', () => {
                  try {
                    const data = JSON.parse(body || '{}');
                    dbCache.settings = data?.settings ?? dbCache.settings;
                    dbCache.schedule = data?.schedule ?? dbCache.schedule;
                    writeDb(dbCache);
                    res.setHeader('Content-Type', 'application/json');
                    res.end(JSON.stringify({ ok: true }));
                  } catch (e: any) {
                    res.statusCode = 400;
                    res.end(JSON.stringify({ ok: false, error: String(e) }));
                  }
                });
                return;
              }
              if (p === '/api/history' && req.method === 'GET') {
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ ok: true, items: dbCache.history || [] }));
                return;
              }
              if (p === '/api/history' && req.method === 'POST') {
                let body = '';
                req.on('data', (chunk) => (body += chunk));
                req.on('end', () => {
                  try {
                    const data = JSON.parse(body || '{}');
                    const item = {
                      id: String(data?.id || (Date.now() + Math.random().toString(36).slice(2))),
                      text: String(data?.text || ''),
                      sender: data?.sender || 'AI',
                      isAnalysis: !!data?.isAnalysis,
                      image: data?.image || null,
                      images: data?.images || null,
                      timestamp: Number(data?.timestamp || Date.now()),
                    };
                    dbCache.history = dbCache.history || [];
                    dbCache.history.push(item);
                    if (dbCache.history.length > 500) dbCache.history = dbCache.history.slice(-500);
                    writeDb(dbCache);
                    res.setHeader('Content-Type', 'application/json');
                    res.end(JSON.stringify({ ok: true }));
                  } catch (e: any) {
                    res.statusCode = 400;
                    res.end(JSON.stringify({ ok: false, error: String(e) }));
                  }
                });
                return;
              }
              if (p === '/api/history' && req.method === 'DELETE') {
                try {
                  dbCache.history = [];
                  writeDb(dbCache);
                  res.setHeader('Content-Type', 'application/json');
                  res.end(JSON.stringify({ ok: true }));
                } catch (e: any) {
                  res.statusCode = 500;
                  res.end(JSON.stringify({ ok: false, error: String(e) }));
                }
                return;
              }
              next();
            });
          },
        },
      ],
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.OPENAI_API_KEY': JSON.stringify(env.OPENAI_API_KEY),
        'process.env.APP_PASSWORD': JSON.stringify(env.APP_PASSWORD)
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
