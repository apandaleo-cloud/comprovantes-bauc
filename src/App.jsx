import { useState, useRef, useCallback } from "react";

const CATEGORIES = ["Alimentação","Transporte","Estacionamento","Hospedagem","Material de escritório","Reunião","Treinamento","Saúde","Tecnologia","Outros"];
const MONTHS_PT = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];

const formatCurrency = (val) => {
  if (!val && val !== 0) return "";
  const num = parseFloat(String(val).replace(",", "."));
  if (isNaN(num)) return val;
  return num.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
};

const formatDate = (val) => {
  if (!val) return "";
  const m = val.match(/(\d{2})[\/-]([A-Za-z]{3}|\d{2})[\/-](\d{4})/);
  if (m) {
    const months = { JAN:1,FEV:2,MAR:3,ABR:4,MAI:5,JUN:6,JUL:7,AGO:8,SET:9,OUT:10,NOV:11,DEZ:12,FEB:2,APR:4,MAY:5,AUG:8,SEP:9,OCT:10,DEC:12 };
    const month = isNaN(m[2]) ? String(months[m[2].toUpperCase()]).padStart(2,"0") : m[2];
    return `${m[1]}/${month}/${m[3]}`;
  }
  return val;
};

const parseDate = (str) => {
  if (!str) return null;
  const p = str.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!p) return null;
  return new Date(parseInt(p[3]), parseInt(p[2]) - 1, parseInt(p[1]), 12, 0, 0);
};

async function extractReceiptData(imageBase64, mediaType) {
  const response = await fetch("/api/extract", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 1000,
      messages: [{ role: "user", content: [
        { type: "image", source: { type: "base64", media_type: mediaType, data: imageBase64 } },
        { type: "text", text: "Analise este comprovante fiscal brasileiro e extraia APENAS os seguintes dados em formato JSON puro (sem markdown):\n{\"valor\": \"35.00\", \"data\": \"DD/MM/YYYY\", \"cnpj\": \"00.000.000/0000-00\", \"empresa\": \"nome\"}\nSe algum campo nao for encontrado, deixe como string vazia. Responda SOMENTE com o JSON." }
      ]}]
    })
  });
  const data = await response.json();
  const text = data.content?.find(b => b.type === "text")?.text || "{}";
  return JSON.parse(text.replace(/```json|```/g, "").trim());
}

function Field({ label, value, onChange, placeholder, mono, style }) {
  return (
    <div style={style}>
      <label style={{ fontSize:11, fontWeight:700, color:"#888", textTransform:"uppercase", letterSpacing:"0.08em", display:"block", marginBottom:6 }}>{label}</label>
      <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        style={{ width:"100%", border:"1.5px solid #EBEBEB", borderRadius:8, padding:"10px 12px", fontSize:14, background:"#F7F7F5", outline:"none", fontFamily:mono?"monospace":"inherit", boxSizing:"border-box" }} />
    </div>
  );
}

export default function App() {
  const now = new Date();
  const [expenses, setExpenses] = useState([
    { id:1, empresa:"HC Estacionamentos LTDA", cnpj:"06.201.722/0001-90", data:"25/06/2026", valor:"35.00", motivo:"Reunião EHTS", imageUrl:null }
  ]);
  const [modal, setModal] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({ empresa:"", cnpj:"", data:"", valor:"", motivo:"", imageUrl:null });
  const [loading, setLoading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [filterMotivo, setFilterMotivo] = useState("");
  const [periodMode, setPeriodMode] = useState("thisMonth");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const fileRef = useRef();

  const applyPeriodFilter = (list) => {
    if (periodMode === "all") return list;
    if (periodMode === "thisMonth") return list.filter(e => { const d = parseDate(e.data); return d && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear(); });
    if (periodMode === "lastMonth") { const lm = new Date(now.getFullYear(), now.getMonth()-1, 1); return list.filter(e => { const d = parseDate(e.data); return d && d.getMonth() === lm.getMonth() && d.getFullYear() === lm.getFullYear(); }); }
    if (periodMode === "custom") {
      const from = customFrom ? new Date(customFrom + "T00:00:00") : null;
      const to = customTo ? new Date(customTo + "T23:59:59") : null;
      return list.filter(e => { const d = parseDate(e.data); if (!d) return false; if (from && d < from) return false; if (to && d > to) return false; return true; });
    }
    return list;
  };

  const baseList = filterMotivo ? expenses.filter(e => e.motivo?.toLowerCase().includes(filterMotivo.toLowerCase())) : expenses;
  const filtered = applyPeriodFilter(baseList);
  const total = filtered.reduce((s, e) => s + parseFloat(e.valor || 0), 0);
  const totalAll = expenses.reduce((s, e) => s + parseFloat(e.valor || 0), 0);

  const periodLabel = () => {
    if (periodMode === "all") return "Todos os períodos";
    if (periodMode === "thisMonth") return MONTHS_PT[now.getMonth()] + " " + now.getFullYear();
    if (periodMode === "lastMonth") { const lm = new Date(now.getFullYear(), now.getMonth()-1, 1); return MONTHS_PT[lm.getMonth()] + " " + lm.getFullYear(); }
    if (periodMode === "custom" && customFrom && customTo) return customFrom.split("-").reverse().join("/") + " → " + customTo.split("-").reverse().join("/");
    return "Período personalizado";
  };

  const openAdd = () => { setForm({ empresa:"", cnpj:"", data:"", valor:"", motivo:"", imageUrl:null }); setEditingId(null); setModal("add"); };
  const openEdit = (exp) => { setForm({ ...exp }); setEditingId(exp.id); setModal("edit"); };
  const closeModal = () => { setModal(null); setEditingId(null); };

  const handleFile = useCallback(async (file) => {
    if (!file || !file.type.startsWith("image/")) return;
    setLoading(true);
    const reader = new FileReader();
    reader.onload = async (e) => {
      const dataUrl = e.target.result;
      try {
        const extracted = await extractReceiptData(dataUrl.split(",")[1], file.type);
        setForm(f => ({ ...f, empresa: extracted.empresa||f.empresa, cnpj: extracted.cnpj||f.cnpj, data: formatDate(extracted.data)||f.data, valor: extracted.valor||f.valor, imageUrl: dataUrl }));
      } catch { setForm(f => ({ ...f, imageUrl: dataUrl })); }
      setLoading(false);
    };
    reader.readAsDataURL(file);
  }, []);

  const Pill = ({ mode, label }) => (
    <button onClick={() => setPeriodMode(mode)} style={{ padding:"6px 14px", borderRadius:20, fontSize:12, fontWeight:600, cursor:"pointer", border:"none", background: periodMode===mode ? "#1A1A1A" : "#EBEBEB", color: periodMode===mode ? "#C8F135" : "#555" }}>{label}</button>
  );

  return (
    <div style={{ minHeight:"100vh", background:"#F7F7F5", fontFamily:"'Inter', system-ui, sans-serif", color:"#1A1A1A" }}>
      <header style={{ background:"#1A1A1A", padding:"20px 24px", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
        <div>
          <div style={{ color:"#C8F135", fontSize:11, fontWeight:700, letterSpacing:"0.15em", textTransform:"uppercase", marginBottom:2 }}>Gestão de Despesas</div>
          <div style={{ color:"#fff", fontSize:22, fontWeight:700, letterSpacing:"-0.02em" }}>Comprovantes Fiscais</div>
        </div>
        <button onClick={openAdd} style={{ background:"#C8F135", color:"#1A1A1A", border:"none", borderRadius:10, padding:"10px 18px", fontWeight:700, fontSize:14, cursor:"pointer" }}>+ Novo</button>
      </header>

      <div style={{ background:"#fff", borderBottom:"1px solid #EBEBEB", padding:"16px 24px" }}>
        <div style={{ display:"flex", gap:8, flexWrap:"wrap", marginBottom:14, alignItems:"center" }}>
          <span style={{ fontSize:11, fontWeight:700, color:"#888", textTransform:"uppercase", letterSpacing:"0.08em", marginRight:4 }}>Período:</span>
          <Pill mode="thisMonth" label="Este mês" />
          <Pill mode="lastMonth" label="Mês anterior" />
          <Pill mode="all" label="Todos" />
          <Pill mode="custom" label="Personalizado" />
        </div>
        {periodMode === "custom" && (
          <div style={{ display:"flex", gap:12, alignItems:"center", marginBottom:14, flexWrap:"wrap" }}>
            <div style={{ display:"flex", alignItems:"center", gap:8 }}>
              <label style={{ fontSize:12, color:"#888", fontWeight:600 }}>De:</label>
              <input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)} style={{ border:"1.5px solid #EBEBEB", borderRadius:8, padding:"6px 10px", fontSize:13, outline:"none", background:"#F7F7F5" }} />
            </div>
            <div style={{ display:"flex", alignItems:"center", gap:8 }}>
              <label style={{ fontSize:12, color:"#888", fontWeight:600 }}>Até:</label>
              <input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)} style={{ border:"1.5px solid #EBEBEB", borderRadius:8, padding:"6px 10px", fontSize:13, outline:"none", background:"#F7F7F5" }} />
            </div>
          </div>
        )}
        <div style={{ display:"flex", gap:32, alignItems:"center", flexWrap:"wrap" }}>
          <div>
            <div style={{ fontSize:11, color:"#888", fontWeight:600, textTransform:"uppercase", letterSpacing:"0.1em" }}>Total — {periodLabel()}</div>
            <div style={{ fontSize:26, fontWeight:800, letterSpacing:"-0.02em" }}>{formatCurrency(total)}</div>
          </div>
          {periodMode !== "all" && <><div style={{ width:1, height:36, background:"#EBEBEB" }} /><div>
            <div style={{ fontSize:11, color:"#888", fontWeight:600, textTransform:"uppercase", letterSpacing:"0.1em" }}>Total geral</div>
            <div style={{ fontSize:26, fontWeight:800, color:"#aaa" }}>{formatCurrency(totalAll)}</div>
          </div></>}
          <div style={{ width:1, height:36, background:"#EBEBEB" }} />
          <div>
            <div style={{ fontSize:11, color:"#888", fontWeight:600, textTransform:"uppercase", letterSpacing:"0.1em" }}>Comprovantes</div>
            <div style={{ fontSize:26, fontWeight:800 }}>{filtered.length}</div>
          </div>
          <div style={{ marginLeft:"auto" }}>
            <input placeholder="Filtrar por motivo..." value={filterMotivo} onChange={e => setFilterMotivo(e.target.value)}
              style={{ border:"1.5px solid #EBEBEB", borderRadius:8, padding:"8px 14px", fontSize:13, outline:"none", width:200, background:"#F7F7F5" }} />
          </div>
        </div>
      </div>

      <div style={{ padding:"24px", overflowX:"auto" }}>
        {filtered.length === 0 ? (
          <div style={{ textAlign:"center", padding:"60px 0", color:"#aaa" }}>
            <div style={{ fontSize:40, marginBottom:12 }}>🧾</div>
            <div style={{ fontWeight:600 }}>Nenhum comprovante neste período</div>
            <div style={{ fontSize:13, marginTop:4 }}>Tente outro filtro ou clique em "+ Novo"</div>
          </div>
        ) : (
          <table style={{ width:"100%", borderCollapse:"separate", borderSpacing:"0 8px" }}>
            <thead><tr style={{ fontSize:11, color:"#888", textTransform:"uppercase", letterSpacing:"0.08em" }}>
              {["Empresa","CNPJ","Data","Valor","Motivo","Ações"].map((h,i) => <th key={h} style={{ textAlign:i===3?"right":i===5?"center":"left", padding:"0 16px 8px", fontWeight:600 }}>{h}</th>)}
            </tr></thead>
            <tbody>{filtered.map(exp => (
              <tr key={exp.id} style={{ background:"#fff", boxShadow:"0 1px 3px rgba(0,0,0,0.06)" }}>
                <td style={{ padding:"14px 16px", borderRadius:"12px 0 0 12px", fontWeight:600, fontSize:14 }}>
                  <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                    {exp.imageUrl && <img src={exp.imageUrl} alt="" style={{ width:32, height:32, borderRadius:6, objectFit:"cover", border:"1px solid #EBEBEB" }}/>}
                    {exp.empresa || <span style={{ color:"#ccc" }}>—</span>}
                  </div>
                </td>
                <td style={{ padding:"14px 16px", fontSize:13, color:"#555", fontFamily:"monospace" }}>{exp.cnpj||"—"}</td>
                <td style={{ padding:"14px 16px", fontSize:13, color:"#555" }}>{exp.data||"—"}</td>
                <td style={{ padding:"14px 16px", fontSize:15, fontWeight:700, textAlign:"right" }}>{formatCurrency(exp.valor)}</td>
                <td style={{ padding:"14px 16px" }}>{exp.motivo ? <span style={{ background:"#C8F135", color:"#1A1A1A", borderRadius:6, padding:"3px 10px", fontSize:12, fontWeight:600 }}>{exp.motivo}</span> : <span style={{ color:"#ccc", fontSize:12 }}>Sem motivo</span>}</td>
                <td style={{ padding:"14px 16px", borderRadius:"0 12px 12px 0", textAlign:"center" }}>
                  <button onClick={() => openEdit(exp)} style={{ background:"none", border:"none", cursor:"pointer", fontSize:16, padding:"4px 8px" }}>✏️</button>
                  <button onClick={() => setExpenses(es => es.filter(e => e.id !== exp.id))} style={{ background:"none", border:"none", cursor:"pointer", fontSize:16, padding:"4px 8px" }}>🗑️</button>
                </td>
              </tr>
            ))}</tbody>
          </table>
        )}
      </div>

      {modal && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.5)", zIndex:100, display:"flex", alignItems:"center", justifyContent:"center", padding:16 }}>
          <div style={{ background:"#fff", borderRadius:18, width:"100%", maxWidth:480, maxHeight:"90vh", overflowY:"auto", boxShadow:"0 20px 60px rgba(0,0,0,0.25)" }}>
            <div style={{ padding:"24px 24px 0" }}>
              <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:20 }}>
                <div style={{ fontWeight:700, fontSize:18 }}>{modal==="edit"?"Editar Comprovante":"Novo Comprovante"}</div>
                <button onClick={closeModal} style={{ background:"none", border:"none", fontSize:20, cursor:"pointer", color:"#888" }}>×</button>
              </div>
              <div onDragOver={e=>{e.preventDefault();setDragOver(true);}} onDragLeave={()=>setDragOver(false)}
                onDrop={e=>{e.preventDefault();setDragOver(false);handleFile(e.dataTransfer.files[0]);}}
                onClick={()=>fileRef.current.click()}
                style={{ border:"2px dashed "+(dragOver?"#C8F135":"#DDD"), borderRadius:12, padding:"24px", textAlign:"center", cursor:"pointer", background:dragOver?"#F9FFE6":"#FAFAFA", marginBottom:20 }}>
                {loading ? <div><div style={{fontSize:28,marginBottom:8}}>⏳</div><div style={{fontWeight:600,color:"#555"}}>Extraindo dados com IA...</div></div>
                : form.imageUrl ? <div><img src={form.imageUrl} alt="" style={{maxHeight:140,borderRadius:8,marginBottom:8}}/><div style={{fontSize:12,color:"#888"}}>Clique para trocar</div></div>
                : <div><div style={{fontSize:32,marginBottom:8}}>📷</div><div style={{fontWeight:600,color:"#555",marginBottom:4}}>Enviar foto do comprovante</div><div style={{fontSize:12,color:"#aaa"}}>Arraste ou clique • IA extrai os dados automaticamente</div></div>}
                <input ref={fileRef} type="file" accept="image/*" style={{display:"none"}} onChange={e=>handleFile(e.target.files[0])}/>
              </div>
              <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
                <Field label="Empresa" value={form.empresa} onChange={v=>setForm(f=>({...f,empresa:v}))} placeholder="Nome do estabelecimento"/>
                <Field label="CNPJ" value={form.cnpj} onChange={v=>setForm(f=>({...f,cnpj:v}))} placeholder="00.000.000/0000-00" mono/>
                <div style={{display:"flex",gap:12}}>
                  <Field label="Data" value={form.data} onChange={v=>setForm(f=>({...f,data:v}))} placeholder="DD/MM/AAAA" style={{flex:1}}/>
                  <Field label="Valor (R$)" value={form.valor} onChange={v=>setForm(f=>({...f,valor:v}))} placeholder="0,00" style={{flex:1}}/>
                </div>
                <div>
                  <label style={{fontSize:11,fontWeight:700,color:"#888",textTransform:"uppercase",letterSpacing:"0.08em",display:"block",marginBottom:6}}>Motivo do Gasto</label>
                  <select value={form.motivo} onChange={e=>setForm(f=>({...f,motivo:e.target.value}))}
                    style={{width:"100%",border:"1.5px solid #EBEBEB",borderRadius:8,padding:"10px 12px",fontSize:14,background:"#F7F7F5",outline:"none"}}>
                    <option value="">Selecione o motivo...</option>
                    {CATEGORIES.map(c=><option key={c} value={c}>{c}</option>)}
                  </select>
                  <input value={form.motivo} onChange={e=>setForm(f=>({...f,motivo:e.target.value}))}
                    placeholder="Ou digite livremente: ex. Reunião EHTS"
                    style={{width:"100%",border:"1.5px solid #EBEBEB",borderRadius:8,padding:"10px 12px",fontSize:14,background:"#fff",outline:"none",marginTop:8,boxSizing:"border-box"}}/>
                </div>
              </div>
            </div>
            <div style={{ padding:"20px 24px 24px", display:"flex", gap:10, justifyContent:"flex-end" }}>
              <button onClick={closeModal} style={{background:"#F0F0F0",border:"none",borderRadius:10,padding:"10px 20px",fontWeight:600,cursor:"pointer",fontSize:14}}>Cancelar</button>
              <button onClick={()=>{if(!form.empresa&&!form.valor)return;if(modal==="edit")setExpenses(es=>es.map(e=>e.id===editingId?{...form,id:editingId}:e));else setExpenses(es=>[...es,{...form,id:Date.now()}]);closeModal();}}
                style={{background:"#1A1A1A",color:"#C8F135",border:"none",borderRadius:10,padding:"10px 24px",fontWeight:700,cursor:"pointer",fontSize:14}}>
                {modal==="edit"?"Salvar alterações":"Adicionar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
