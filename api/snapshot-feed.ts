import { list } from '@vercel/blob';

export const config = { runtime: 'nodejs18.x', maxDuration: 10 } as const;

export default async function handler(req: any, res: any) {
  try {
    const token = process.env.BLOB_READ_WRITE_TOKEN || '';
    const l = await list({ prefix: '', token });
    const blobs = (l.blobs || []).sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime());
    const top2 = blobs.slice(0, 2).map(b => b.url);
    res.json({ ok: true, urls: top2 });
  } catch (e: any) {
    res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
}
