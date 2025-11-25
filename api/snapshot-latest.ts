import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getLatest } from './_lib/db';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') { res.status(405).json({ ok: false }); return; }
  const latest = await getLatest();
  res.json({ ok: true, image: latest?.image || null, images: latest?.images || null });
}

