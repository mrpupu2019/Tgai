import { getSettings, setSettings } from './_lib/db';

export default async function handler(req: any, res: any) {
  if (req.method === 'GET') { res.json({ ok: true, ...(await getSettings()) }); return; }
  if (req.method === 'POST') {
    let raw = '';
    await new Promise<void>((resolve) => {
      req.on('data', (chunk: any) => { raw += chunk.toString(); });
      req.on('end', () => resolve());
      req.on('error', () => resolve());
    });
    try {
      const body = raw ? JSON.parse(raw) : (req.body || {});
      await setSettings(body || {});
      res.json({ ok: true });
    } catch (e: any) { res.status(400).json({ ok: false, error: String(e) }); }
    return;
  }
  res.status(405).json({ ok: false });
}
export const config = { runtime: 'nodejs18.x', maxDuration: 10 } as const;
