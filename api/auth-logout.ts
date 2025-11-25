export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') { res.status(405).json({ ok: false }); return; }
  res.setHeader('Set-Cookie', `session=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax`);
  res.json({ ok: true });
}
export const config = { runtime: 'nodejs18.x', maxDuration: 10 } as const;
