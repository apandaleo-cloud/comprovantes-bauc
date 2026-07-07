const BASE_URL = process.env.KV_REST_API_URL;
const TOKEN = process.env.KV_REST_API_TOKEN;

async function kv(method, ...args) {
  const res = await fetch(`${BASE_URL}/${method}/${args.map(encodeURIComponent).join('/')}`, {
    headers: { Authorization: `Bearer ${TOKEN}` }
  });
  const data = await res.json();
  return data.result;
}

export default async function handler(req, res) {
  const { type } = req.query;

  if (type === 'users') {
    if (req.method === 'GET') {
      const raw = await kv('get', 'users');
      return res.status(200).json(raw ? JSON.parse(raw) : []);
    }
    if (req.method === 'POST') {
      await kv('set', 'users', JSON.stringify(req.body));
      return res.status(200).json({ ok: true });
    }
  }

  if (req.method === 'GET') {
    const raw = await kv('get', 'expenses');
    return res.status(200).json(raw ? JSON.parse(raw) : []);
  }
  if (req.method === 'POST') {
    await kv('set', 'expenses', JSON.stringify(req.body));
    return res.status(200).json({ ok: true });
  }

  res.status(405).end();
}
