import { shiftQueue } from './_lib/db.js';

export default async function handler(req: any, res: any) {
  if (req.method !== 'GET') { res.status(405).json({ ok: false }); return; }
  try {
    const item = await shiftQueue();
    res.json({ ok: true, image: item?.image || null, images: item?.images || null });
  } catch (e: any) {
    res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
}
export const config = { runtime: 'nodejs18.x', maxDuration: 10 } as const;
