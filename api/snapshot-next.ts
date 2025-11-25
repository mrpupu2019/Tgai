import type { VercelRequest, VercelResponse } from '@vercel/node';
import { shiftQueue } from './_lib/db';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') { res.status(405).json({ ok: false }); return; }
  const item = await shiftQueue();
  res.json({ ok: true, image: item?.image || null, images: item?.images || null });
}

