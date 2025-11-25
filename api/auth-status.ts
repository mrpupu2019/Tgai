import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const cookie = (req.headers['cookie'] || '').toString();
  const ok = /(?:^|;\s*)session=ok/.test(cookie);
  if (!ok) { res.status(401).json({ ok: false }); return; }
  res.json({ ok: true });
}

