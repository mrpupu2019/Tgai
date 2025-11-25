import type { VercelRequest, VercelResponse } from '@vercel/node';
import { pushQueue } from './_lib/db';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') { res.status(405).json({ ok: false }); return; }
  try {
    let data: any = (req as any).body;
    if (!data || (typeof data === 'string' && !data.trim())) {
      const chunks: Buffer[] = [];
      for await (const chunk of (req as any)) { chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)); }
      const raw = Buffer.concat(chunks).toString('utf8');
      try { data = JSON.parse(raw); } catch { data = {}; }
    } else if (typeof data === 'string') {
      try { data = JSON.parse(data); } catch { data = {}; }
    }
    const img = data.image;
    if (typeof img !== 'string' || !img.startsWith('data:image')) { res.status(400).json({ ok: false, error: 'INVALID_PAYLOAD' }); return; }
    await pushQueue({ image: img, note: data.note || null, ts: Date.now() });
    res.json({ ok: true });
  } catch (e: any) { res.status(500).json({ ok: false, error: String(e?.message || e) }); }
}
export const config = { maxDuration: 10 } as const;
