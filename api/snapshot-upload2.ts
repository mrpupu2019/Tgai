import type { VercelRequest, VercelResponse } from '@vercel/node';
import { pushQueue } from './_lib/db';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') { res.status(405).json({ ok: false }); return; }
  try {
    const data = req.body || {};
    if (!Array.isArray(data.images) || data.images.length < 2) { res.status(400).json({ ok: false, error: 'INVALID_IMAGES' }); return; }
    await pushQueue({ images: data.images, note: data.note || null, ts: Date.now() });
    res.json({ ok: true });
  } catch (e: any) { res.status(500).json({ ok: false, error: String(e) }); }
}

