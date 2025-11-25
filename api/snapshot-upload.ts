import { pushQueue, getLastSingle, setLastSingle } from './_lib/db';

export default async function handler(req: any, res: any) {
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
    const now = Date.now();
    try {
      const prev = await getLastSingle();
      if (prev && typeof prev.image === 'string' && (now - (prev.ts || 0)) < 120000) {
        await pushQueue({ images: [prev.image, img], note: data.note || null, ts: now });
        await setLastSingle({});
        res.json({ ok: true, paired: true });
        return;
      } else {
        await setLastSingle({ image: img, ts: now });
        await pushQueue({ image: img, note: data.note || null, ts: now });
      }
    } catch {}
    res.json({ ok: true, paired: false });
  } catch (e: any) { res.status(500).json({ ok: false, error: String(e?.message || e) }); }
}
export const config = { runtime: 'nodejs18.x', maxDuration: 10 } as const;
