import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getSettings, setSettings } from './_lib/db';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'GET') { res.json({ ok: true, ...(await getSettings()) }); return; }
  if (req.method === 'POST') {
    try { await setSettings(req.body || {}); res.json({ ok: true }); }
    catch (e: any) { res.status(400).json({ ok: false, error: String(e) }); }
    return;
  }
  res.status(405).json({ ok: false });
}

