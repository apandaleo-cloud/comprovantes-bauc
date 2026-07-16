export const MONTHS_PT = ["Janeiro","Fevereiro","Marco","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];

export const formatCurrency = (val) => {
  if (!val && val !== 0) return "";
  const num = parseFloat(String(val).replace(",", "."));
  if (isNaN(num)) return val;
  return num.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
};

export const gerarHTML = (mesNome, ano, resumoLinhas, tabelaLinhas, total) =>
`<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"/></head>
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
