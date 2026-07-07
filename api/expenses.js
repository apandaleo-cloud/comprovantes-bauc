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
  if (req.method === 'GET') {
    const raw = await kv('get', 'expenses');
    const expenses = raw ? JSON.parse(raw) : [];
    return res.status(200).json(expenses);
  }

  if (req.method === 'POST') {
    const expenses = req.body;
    await kv('set', 'expenses', JSON.stringify(expenses));
    return res.status(200).json({ ok: true });
  }

  res.status(405).end();
}
