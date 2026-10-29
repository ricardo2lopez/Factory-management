import { getStore } from '@netlify/blobs';
const CODE = /^RACK-[A-Z0-9]{5}$/;
const MAX = 6 * 1024 * 1024;
const json = (obj, status) => new Response(JSON.stringify(obj), { status: status || 200, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });
export async function handle(req, store) {
  const url = new URL(req.url);
  if (url.searchParams.get('ping')) return json({ ok: true });
  const code = String(url.searchParams.get('code') || '').toUpperCase().trim();
  if (!CODE.test(code)) return json({ error: 'bad-code' }, 400);
  if (req.method === 'GET') {
    const data = await store.get(code, { type: 'json' });
    if (!data) return json({ error: 'not-found' }, 404);
    return json(data);
  }
  if (req.method === 'PUT' || req.method === 'POST') {
    const text = await req.text();
    if (text.length > MAX) return json({ error: 'too-big' }, 413);
    let data; try { data = JSON.parse(text); } catch (e) { return json({ error: 'bad-json' }, 400); }
    if (!data || !data.st || data.st.v !== 1 || typeof data.savedAt !== 'number') return json({ error: 'bad-save' }, 400);
    const prev = await store.get(code, { type: 'json' });
    if (prev && (data.base || 0) !== (prev.rev || 0) && !url.searchParams.get('force')) return json({ error: 'stale', rev: prev.rev || 0 }, 409);
    data.rev = (prev && prev.rev || 0) + 1;
    await store.setJSON(code, data);
    return json({ ok: true, rev: data.rev });
  }
  return json({ error: 'method' }, 405);
}
export default async (req) => handle(req, getStore({ name: 'rackforge-saves', consistency: 'strong' }));
export const config = { path: '/api/save' };
