import { gerarHTML, formatCurrency, MONTHS_PT } from './report-helpers.mjs';

async function kv(method, ...args) {
  const res = await fetch(`${process.env.KV_REST_API_URL}/${method}/${args.map(encodeURIComponent).join('/')}`, {
    headers: { Authorization: `Bearer ${process.env.KV_REST_API_TOKEN}` }
  });
  return (await res.json()).result;
}

export default async function handler(req, res) {
  try {
    const raw = await kv('get', 'expenses');
    const expenses = raw ? JSON.parse(raw) : [];
    const now = new Date();
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const mesNome = MONTHS_PT[lastMonth.getMonth()];
    const ano = lastMonth.getFullYear();
    const doMes = expenses.filter(e => {
      if (!e.data) return false;
      const p1 = e.data.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
      if (p1) return parseInt(p1[2])-1 === lastMonth.getMonth() && parseInt(p1[3]) === ano;
      const mo = {JAN:0,FEV:1,MAR:2,ABR:3,MAI:4,JUN:5,JUL:6,AGO:7,SET:8,OUT:9,NOV:10,DEZ:11};
      const p2 = e.data.match(/^(\d{2})\/([A-Za-z]{3})\/(\d{4})$/);
      if (p2) return mo[p2[2].toUpperCase()] === lastMonth.getMonth() && parseInt(p2[3]) === ano;
      return false;
    });
    if (doMes.length === 0) return res.status(200).json({ ok: true, message: 'Nenhum comprovante.' });
    const total = doMes.reduce((s,e) => s + parseFloat(e.valor||0), 0);
    const porResp = {};
    doMes.forEach(e => {
      const n = e.responsavel || "Sem responsavel";
      if (!porResp[n]) porResp[n] = { total:0, count:0 };
      porResp[n].total += parseFloat(e.valor||0);
      porResp[n].count++;
    });
    const resumo = Object.entries(porResp).map(([n,d]) =>
      `<tr><td style="padding:10px 16px;font-weight:600">${n}</td><td style="padding:10px 16px;color:#555">${d.count} comprovante${d.count!==1?"s":""}</td><td style="padding:10px 16px;text-align:right;font-weight:700">${formatCurrency(d.total)}</td></tr>`
    ).join("");
    const linhas = doMes.map(e =>
      `<tr><td style="padding:8px 12px">${e.responsavel||"-"}</td><td style="padding:8px 12px">${e.empresa||"-"}</td><td style="padding:8px 12px">${e.cnpj||"-"}</td><td style="padding:8px 12px">${e.data||"-"}</td><td style="padding:8px 12px;text-align:right;font-weight:600">${formatCurrency(e.valor)}</td><td style="padding:8px 12px">${e.motivo||"-"}</td></tr>`
    ).join("");
    const html = gerarHTML(mesNome, ano, resumo, linhas, total);
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${process.env.RESEND_API_KEY}` },
      body: JSON.stringify({
        from: 'Comprovantes BAUC <onboarding@resend.dev>',
        to: [process.env.EMAIL_TO],
        cc: process.env.EMAIL_CC ? process.env.EMAIL_CC.split(',') : [],
        subject: `Reembolsos pendentes - ${mesNome} ${ano}`,
        html
      })
    });
    const d = await r.json();
    if (!r.ok) return res.status(500).json({ error: d });
    return res.status(200).json({ ok: true, message: `Email enviado!` });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
