export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { image, mediaType } = req.body;

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 1000,
      messages: [{ role: 'user', content: [
        { type: 'image', source: { type: 'base64', media_type: mediaType, data: image } },
        { type: 'text', text: 'Analise este comprovante fiscal brasileiro e extraia APENAS os seguintes dados em formato JSON puro (sem markdown):\n{"valor":"35.00","data":"DD/MM/YYYY","cnpj":"00.000.000/0000-00","empresa":"nome"}\nSe algum campo nao for encontrado, deixe como string vazia. Responda SOMENTE com o JSON.' }
      ]}]
    })
  });

  const data = await response.json();
  const text = data.content?.find(b => b.type === 'text')?.text || '{}';
  try {
    res.status(200).json(JSON.parse(text.replace(/```json|```/g, '').trim()));
  } catch {
    res.status(200).json({});
  }
}
