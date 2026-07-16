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

const MONTHS_PT = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];

const formatCurrency = (val) => {
  if (!val && val !== 0) return "";
  const num = parseFloat(String(val).replace(",", "."));
  if (isNaN(num)) return val;
  return num.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
};

export default async function handler(req, res) {
  if (req.method !== 'POST' && req.method !== 'GET') return res.status(405).end();

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
      const months = { JAN:0,FEV:1,MAR:2,ABR:3,MAI:4,JUN:5,JUL:6,AGO:7,SET:8,OUT:9,NOV:10,DEZ:11 };
      const p2 = e.data.match(/^(\d{2})\/([A-Za-z]{3})\/(\d{4})$/);
      if (p2) return months[p2[2].toUpperCase()] === lastMonth.getMonth() && parseInt(p2[3]) === ano;
      return false;
    });

    if (doMesPassado.length === 0) {
      return res.status(200).json({ ok: true, message: 'Nenhum comprovante no mês anterior.' });
    }

    const total = doMesPassado.reduce((s, e) => s + parseFloat(e.valor || 0), 0);

    const porResponsavel = {};
    doMesPassado.forEach(e => {
      const nome = e.responsavel || "Sem responsável";
      if (!porResponsavel[nome]) porResponsavel[nome] = { total: 0, count: 0 };
      porResponsavel[nome].total += parseFloat(e.valor || 0);
      porResponsavel[nome].count++;
    });

    const resumoLinhas = Object.entries(porResponsavel).map(([nome, data]) => `
      <tr>
        <td style="padding:10px 16px;font-weight:600">${nome}</td>
        <td style="padding:10px 16px;color:#555">${data.count} comprovante${data.count !== 1 ? "s" : ""}</td>
        <td style="padding:10px 16px;text-align:right;font-weight:700">${formatCurrency(data.total)}</td>
      </tr>
    `).join("");

    const tabelaLinhas = doMesPassado.map(e => `
      <tr>
        <td style="padding:8px 12px">${e.responsavel || "—"}</td>
        <td style="padding:8px 12px">${e.empresa || "—"}</td>
        <td style="padding:8px 12px;font-family:monospace;font-size:11px">${e.cnpj || "—"}</td>
        <td style="padding:8px 12px">${e.data || "—"}</td>
        <td
