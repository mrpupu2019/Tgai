import type { VercelRequest, VercelResponse } from '@vercel/node';
import { pushQueue } from './_lib/db';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') { res.status(405).json({ ok: false }); return; }
  try {
    let data: any = (req as any).body;
    if (typeof data === 'string') {
      try { data = JSON.parse(data); } catch { data = {}; }
    }
    data = data || {};
    const img = data.image;
    if (typeof img !== 'string' || !img.startsWith('data:image')) { res.status(400).json({ ok: false, error: 'INVALID_PAYLOAD' }); return; }
    await pushQueue({ image: img, note: data.note || null, ts: Date.now() });
    res.json({ ok: true });
  } catch (e: any) { res.status(500).json({ ok: false, error: String(e?.message || e) }); }
}
