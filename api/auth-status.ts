export default async function handler(req: any, res: any) {
  const cookie = (req.headers['cookie'] || '').toString();
  const ok = /(?:^|;\s*)session=ok/.test(cookie);
  if (!ok) { res.status(401).json({ ok: false }); return; }
  res.json({ ok: true });
}
export const config = { runtime: 'nodejs18.x', maxDuration: 10 } as const;
