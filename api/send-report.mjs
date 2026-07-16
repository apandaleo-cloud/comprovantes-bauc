import nodemailer from 'nodemailer';

const BASE_URL = process.env.KV_REST_API_URL;
const TOKEN = process.env.KV_REST_API_TOKEN;

async function kv(method, ...args) {
  const res = await fetch(`${BASE_URL}/${method}/${args.map(encodeURIComponent).join('/')}`, {
    headers: { Authorization: `Bearer ${TOKEN}` }
  });
  const data = await res.json();
  return data.result;
}

const MONTHS_PT = ["Janeiro","Fevereiro","Marco","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];

const formatCurrency = (val) => {
  if (!val && val !== 0) return "";
  const num = parseFloat(String(val).replace(",", "."));
  if (isNaN(num)) return val;
  return num.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
};

const gerarHTML = (mesNome, ano, resumoLinhas, tabelaLinhas, total) => `<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="UTF-8"/></head>
<body style="font-family:Arial,sans-serif;color:#1A1A1A;max-width:800px;margin:0 auto;padding:32px">
<div style="background:#1A1A1A;padding:24px 32px;border-radius:12px;margin-bottom:24px">
<div style="color:#C8F135;font-size:11px;font-weight:700;text-transform:uppercase;margin-bottom:4px">Gestao de Despesas</div>
<div style="color:#fff;font-size:22px;font-weight:800">Fechamento - ${mesNome} ${ano}</div></div>
<p style="font-size:15px;margin-bottom:24px">Ola Diego, segue o fechamento de reembolsos de <strong>${mesNome} ${ano}</strong>. Por favor, efetue os pagamentos aos socios abaixo.</p>
<h2 style="font-size:13px;font-weight:700;text-transform:uppercase;color:#888;margin-bottom:10px">Totais por responsavel</h2>
<table style="width:100%;border-collapse:collapse;margin-bottom:28px">
<thead><tr style="background:#1A1A1A">
<th style="padding:10px 16px;text-align:left;color:#C8F135;font-size:11px">Responsavel</th>
<th style="padding:10px 16px;text-align:left;color:#C8F135;font-size:11px">Comprovantes</th>
<th style="padding:10px 16px;text-align:right;color:#C8F135;font-size:11px">Total</th>
</tr></thead><tbody>${resumoLinhas}</tbody></table>
<h2 style="font-size:13px;font-weight:700;text-transform:uppercase;color:#888;margin-bottom:10px">Todos os comprovantes</h2>
<table style="width:100%;border-collapse:collapse;margin-bottom:28px">
<thead><tr style="background:#333">
<th style="padding:8px 12px;text-align:left;color:#fff;font-size:11px">Responsavel</th>
<th style="padding:8px 12px;text-align:left;color:#fff;font-size:11px">Empresa</th>
<th style="padding:8px 12px;text-align:left;color:#fff;font-size:11px">CNPJ</th>
<th style="padding:8px 12px;text-align:left;color:#fff;font-size:11px">Data</th>
<th style="padding:8px 12px;text-align:right;color:#fff;font-size:11px">Valor</th>
<th style="padding:8px 12px;text-align:left;color:#fff;font-size:11px">Motivo</th>
</tr></thead><tbody>${tabelaLinhas}</tbody></table>
<div style="background:#1A1A1A;color:#C8F135;padding:16px 24px;border-radius:8px;text-align:right;font-size:18px;font-weight:800">Total geral: ${formatCurrency(total)}</div>
<p style="font-size:12px;color:#aaa;margin-top:24px">Email gerado automaticamente pelo sistema de Comprovantes Fiscais BAUC.</p>
</body></html>`;

export default async function handler(req, res) {
  try {
    const raw = await kv('get', 'expenses');
    const expenses = raw ? JSON.parse(raw) : [];
    const now = new Date();
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const mesNome = MONTHS_PT[lastMonth.getMonth()];
    const ano = lastMonth.getFullYear();
    const doMesPassado = expenses.filter(e => {
      if (!e.data) return false;
      const p1 = e.data.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
      if (p1) return parseInt(p1[2]) - 1 === lastMonth.getMonth() && parseInt(p1[3]) === ano;
      const mo = { JAN:0,FEV:1,MAR:2,ABR:3,MAI:4,JUN:5,JUL:6,AGO:7,SET:8,OUT:9,NOV:10,DEZ:11 };
      const p2 = e.data.match(/^(\d{2})\/([A-Za-z]{3})\/(\d{4})$/);
      if (p2) return mo[p2[2].toUpperCase()] === lastMonth.getMonth() && parseInt(p2[3]) === ano;
      return false;
    });
    if (doMesPassado.length === 0) {
      return res.status(200).json({ ok: true, message: 'Nenhum comprovante no mes anterior.' });
    }
    const total = doMesPassado.reduce((s, e) => s + parseFloat(e.valor || 0), 0);
    const porResp = {};
    doMesPassado.forEach(e => {
      const n = e.responsavel || "Sem responsavel";
      if (!porResp[n]) porResp[n] = { total: 0, count: 0 };
      porResp[n].total += parseFloat(e.valor || 0);
      porResp[n].count++;
    });
    const resumoLinhas = Object.entries(porResp).map(([n, d]) =>
      `<tr><td style="padding:10px 16px;font-weight:600">${n}</td><td style="padding:10px 16px;color:#555">${d.count} comprovante${d.count!==1?"s":""}</td><td style="padding:10px 16px;text-align:right;font-weight:700">${formatCurrency(d.total)}</td></tr>`
    ).join("");
    const tabelaLinhas = doMesPassado.map(e =>
      `<tr><td style="padding:8px 12px">${e.responsavel||"-"}</td><td style="padding:8px 12px">${e.empresa||"-"}</td><td style="padding:8px 12px;font-family:monospace;font-size:11px">${e.cnpj||"-"}</td><td style="padding:8px 12px">${e.data||"-"}</td><td style="padding:8px 12px;text-align:right;font-weight:600">${formatCurrency(e.valor)}</td><td style="padding:8px 12px">${e.motivo||"-"}</td></tr>`
    ).join("");
    const html = gerarHTML(mesNome, ano, resumoLinhas, tabelaLinhas, total);
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT),
      secure: false,
      requireTLS: true,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
    });
    await transporter.sendMail({
      from: `"Comprovantes BAUC" <${process.env.EMAIL_FROM}>`,
      to: process.env.EMAIL_TO,
      cc: process.env.EMAIL_CC,
      subject: `Reembolsos pendentes - ${mesNome} ${ano}`,
      html
    });
    return res.status(200).json({ ok: true, message: `Email enviado para ${process.env.EMAIL_TO}` });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
}
