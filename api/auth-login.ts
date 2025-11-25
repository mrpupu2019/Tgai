export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') { res.status(405).json({ ok: false }); return; }
  const pass = (req.body?.password || '').toString();
  const required = (process.env.APP_PASSWORD || '').toString();
  if (!required) { res.status(500).json({ ok: false, error: 'APP_PASSWORD not set' }); return; }
  if (pass !== required) { res.status(401).json({ ok: false }); return; }
  res.setHeader('Set-Cookie', `session=ok; Path=/; HttpOnly; SameSite=Lax`);
  res.json({ ok: true });
}
export const config = { runtime: 'nodejs18.x', maxDuration: 10 } as const;
