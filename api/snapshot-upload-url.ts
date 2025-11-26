import { pushQueue } from './_lib/db.js';

export const config = { runtime: 'nodejs18.x', maxDuration: 10 } as const;

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') { res.status(405).json({ ok: false }); return; }
  let raw = '';
  await new Promise<void>((resolve) => {
    req.on('data', (chunk: any) => { raw += chunk.toString(); });
    req.on('end', () => resolve());
    req.on('error', () => resolve());
  });
  try {
    let body: any = {};
    try { body = raw ? JSON.parse(raw) : (req.body || {}); } catch { body = {}; }
    const url: string | null = (typeof body.url === 'string' && body.url.startsWith('http')) ? body.url : null;
    const arr: string[] | null = Array.isArray(body.urls) ? body.urls.filter((u: any) => typeof u === 'string' && u.startsWith('http')) : null;
    const final = url ? [url] : (arr && arr.length >= 1 ? [arr[0]] : null);
    if (!final) { res.status(400).json({ ok: false, error: 'INVALID_URL' }); return; }
    await pushQueue({ imageUrls: final, ts: Date.now(), note: body.note || null });
    res.json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
}

