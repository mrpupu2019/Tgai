import type { VercelRequest, VercelResponse } from '@vercel/node';
import { put, list } from '@vercel/blob';

const TOKEN = process.env.BLOB_READ_WRITE_TOKEN || '';
const BASE = 'data';
type Json = any;

const mem: Record<string, Json> = {};

async function getBlobUrl(key: string): Promise<string | null> {
  try {
    const l = await list({ prefix: `${BASE}/${key}`, token: TOKEN });
    const item = l.blobs?.[0];
    return item?.url || null;
  } catch { return null; }
}

export async function readJson(key: string): Promise<Json | null> {
  if (!TOKEN) return mem[key] ?? null;
  const url = await getBlobUrl(`${key}.json`);
  if (!url) return null;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${TOKEN}` }, cache: 'no-store' as any });
  if (!res.ok) return null;
  try { return await res.json(); } catch { return null; }
}

export async function writeJson(key: string, data: Json): Promise<void> {
  if (!TOKEN) { mem[key] = data; return; }
  await put(`${BASE}/${key}.json`, JSON.stringify(data), { access: 'public', contentType: 'application/json', token: TOKEN, cacheControlMaxAge: 0 });
}

export async function appendHistory(item: any) {
  const hist = (await readJson('history')) || [];
  hist.push(item);
  if (hist.length > 500) hist.splice(0, hist.length - 500);
  await writeJson('history', hist);
}

export async function getHistory() { return (await readJson('history')) || []; }
export async function clearHistory() { await writeJson('history', []); }
export async function getSettings() { return await readJson('settings'); }
export async function setSettings(payload: any) { await writeJson('settings', payload || {}); }
export async function getLastSingle() { return await readJson('lastSingle'); }
export async function setLastSingle(item: any) { await writeJson('lastSingle', item || {}); }
export async function pushQueue(item: any) {
  try {
    const q = (await readJson('queue')) || [];
    q.push(item);
    if (q.length > 500) q.splice(0, q.length - 500);
    await writeJson('queue', q);
  } catch {}
  const latest = item?.images && Array.isArray(item.images)
    ? { images: item.images, image: item.images[0], note: item.note || null, ts: item.ts || Date.now() }
    : { image: item.image || null, images: item.images || null, note: item.note || null, ts: item.ts || Date.now() };
  await writeJson('latest', latest);
}
export async function shiftQueue() {
  const q = (await readJson('queue')) || [];
  const item = q.shift() || null;
  await writeJson('queue', q);
  return item;
}
export async function getLatest() { return await readJson('latest'); }
