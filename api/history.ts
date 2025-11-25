import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getHistory, appendHistory, clearHistory } from './_lib/db';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'GET') { res.json({ ok: true, items: await getHistory() }); return; }
  if (req.method === 'POST') { try { await appendHistory(req.body || {}); res.json({ ok: true }); } catch (e: any) { res.status(400).json({ ok: false, error: String(e) }); } return; }
  if (req.method === 'DELETE') { try { await clearHistory(); res.json({ ok: true }); } catch (e: any) { res.status(500).json({ ok: false, error: String(e) }); } return; }
  res.status(405).json({ ok: false });
}

