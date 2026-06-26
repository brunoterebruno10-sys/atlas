import { useState, useEffect, useRef } from "react";

// ── TEMAS ──────────────────────────────────────────────────────────────────
const DARK = {
  bg:"#0A0E1A", bgSoft:"#0D1220", surface:"#131826", surfaceAlt:"#1B2233",
  text:"#F3F1EA", muted:"#8C93AC", accent:"#D9AE5C", accentStrong:"#F1C879",
  positive:"#7BD9A0", negative:"#E48E8E", border:"rgba(255,255,255,0.07)",
  track:"rgba(255,255,255,0.08)", overlay:"rgba(4,5,10,0.75)",
};
const LIGHT = {
  bg:"#F2F1ED", bgSoft:"#EAE8E2", surface:"#FFFFFF", surfaceAlt:"#F7F3E9",
  text:"#181B2A", muted:"#6B7080", accent:"#A9772E", accentStrong:"#8C5E1F",
  positive:"#2E9A5C", negative:"#C1483F", border:"rgba(20,24,40,0.08)",
  track:"rgba(20,24,40,0.09)", overlay:"rgba(20,20,18,0.55)",
};

// ── STORAGE ─────────────────────────────────────────────────────────────────
const load = (k, fb) => { try { const r = localStorage.getItem(k); return r ? JSON.parse(r) : fb; } catch { return fb; } };
const save = (k, v)  => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };

// ── HELPERS ──────────────────────────────────────────────────────────────────
const uid     = () => Date.now().toString(36) + Math.random().toString(36).slice(2,6);
const fmt     = v  => (v||0).toLocaleString("pt-BR",{style:"currency",currency:"BRL"});
const todayISO= () => new Date().toISOString().slice(0,10);
const monthKey= (d) => { const dt = d ? new Date(d) : new Date(); return `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,"0")}`; };

const ACCOUNT_TYPES  = ["Corrente","Poupança","Carteira","Investimento"];
const RECEITA_CATS   = ["Salário","Freelance","Vendas","Investimentos","Outros"];
const DESPESA_CATS   = ["Moradia","Alimentação","Transporte","Lazer","Saúde","Educação","Assinaturas","Outros"];
const FREQ_OPTS      = ["Única","Diária","Semanal","Quinzenal","Mensal","Anual"];

// ── AUTO-CLASSIFICAÇÃO ────────────────────────────────────────────────────
const AUTO_RULES = [
  { words:["ifood","iFood","rappi","uber eats","delivery","pizza","burger","mcdonald","kfc","subway","restaurante","almoço","lanche","café","padaria"],cat:"Alimentação" },
  { words:["uber","99","cabify","ônibus","metrô","metro","gasolina","combustível","estacionamento","pedágio","táxi"],cat:"Transporte" },
  { words:["netflix","spotify","amazon","prime","hbo","disney","youtube","apple","deezer","crunchyroll","globoplay","paramount"],cat:"Assinaturas" },
  { words:["farmácia","farmacia","remédio","remedio","médico","medico","consulta","exame","plano de saúde","hospital","dentista","psicólogo"],cat:"Saúde" },
  { words:["aluguel","condomínio","condominio","luz","água","agua","gás","gas","internet","telefone","energia"],cat:"Moradia" },
  { words:["faculdade","escola","curso","livro","apostila","udemy","coursera","material escolar"],cat:"Educação" },
  { words:["cinema","teatro","show","parque","viagem","hotel","passeio","festa","bar","balada"],cat:"Lazer" },
  { words:["salário","salario","pagamento","holerite"],cat:"Salário" },
  { words:["freela","freelance","projeto","cliente","serviço"],cat:"Freelance" },
];
function autoCategory(desc, kind) {
  const d = (desc||"").toLowerCase();
  for (const rule of AUTO_RULES) {
    if (rule.words.some(w => d.includes(w.toLowerCase()))) return rule.cat;
  }
  return kind === "receita" ? "Outros" : "Outros";
}

// ── CONQUISTAS ────────────────────────────────────────────────────────────
const ACHIEVEMENTS = [
  { id:"first_account",  icon:"🏦", title:"Primeiro Passo",      desc:"Cadastrou sua primeira conta",            check:(a,t,g)=>a.length>=1 },
  { id:"first_tx",       icon:"✍️", title:"Primeiro Lançamento", desc:"Registrou sua primeira transação",        check:(a,t,g)=>t.length>=1 },
  { id:"first_goal",     icon:"🎯", title:"Sonhador",            desc:"Criou sua primeira meta",                 check:(a,t,g)=>g.length>=1 },
  { id:"goal_50",        icon:"⚡", title:"Na Metade",           desc:"Meta atingiu 50% do objetivo",           check:(a,t,g)=>g.some(x=>x.target>0&&x.saved/x.target>=0.5) },
  { id:"goal_done",      icon:"🏆", title:"Conquistador",        desc:"Completou uma meta!",                    check:(a,t,g)=>g.some(x=>x.target>0&&x.saved>=x.target) },
  { id:"tx_10",          icon:"📊", title:"Consistente",         desc:"10 lançamentos registrados",             check:(a,t,g)=>t.length>=10 },
  { id:"tx_50",          icon:"🌟", title:"Disciplinado",        desc:"50 lançamentos registrados",             check:(a,t,g)=>t.length>=50 },
  { id:"multi_account",  icon:"💼", title:"Diversificado",       desc:"3 ou mais contas cadastradas",           check:(a,t,g)=>a.length>=3 },
  { id:"saver",          icon:"🐷", title:"Pé de Meia",          desc:"Guardou mais do que gastou este mês",    check:(a,t,g)=>{
    const now=new Date(); const mk=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}`;
    const m=t.filter(x=>x.date&&x.date.startsWith(mk));
    const r=m.filter(x=>x.kind==="receita").reduce((s,x)=>s+Number(x.amount),0);
    const d=m.filter(x=>x.kind==="despesa").reduce((s,x)=>s+Number(x.amount),0);
    return r>0&&d<r;
  }},
  { id:"no_spend",       icon:"🧊", title:"Dia Gelado",          desc:"Registrou um dia sem despesas",          check:(a,t,g)=>{
    const today=todayISO();
    return t.some(x=>x.kind==="receita"&&x.date===today) && !t.some(x=>x.kind==="despesa"&&x.date===today);
  }},
];

// ── ÍCONES ────────────────────────────────────────────────────────────────
const Icon = ({ name, size=18, color="currentColor" }) => {
  const p = {
    moon:    <path d="M20 14.5A8 8 0 1 1 9.3 3.8a6.5 6.5 0 0 0 10.7 10.7Z"/>,
    sun:     <><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M2 12h2M20 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></>,
    plus:    <path d="M12 5v14M5 12h14"/>,
    trash:   <path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>,
    wallet:  <><rect x="3" y="6" width="18" height="13" rx="2.5"/><path d="M3 10h18"/><circle cx="16" cy="14.5" r="1.2" fill="currentColor" stroke="none"/></>,
    target:  <><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/></>,
    income:  <path d="M12 19V5M5 12l7-7 7 7"/>,
    expense: <path d="M12 5v14M5 12l7 7 7-7"/>,
    bulb:    <path d="M12 2a6 6 0 0 1 6 6c0 2.5-1.5 4.7-3.5 5.7V16H9.5v-2.3C7.5 12.7 6 10.5 6 8a6 6 0 0 1 6-6zM9.5 18h5M10.5 21h3"/>,
    alert:   <><circle cx="12" cy="12" r="9"/><path d="M12 8v5M12 16h.01"/></>,
    trend:   <><path d="M3 17l6-6 4 4 8-9"/><path d="M16 6h5v5"/></>,
    sparkle: <path d="M12 2l2.2 6.8L21 11l-6.8 2.2L12 20l-2.2-6.8L3 11l6.8-2.2z" fill="currentColor" stroke="none"/>,
    list:    <><line x1="5" y1="7" x2="19" y2="7"/><line x1="5" y1="12" x2="19" y2="12"/><line x1="5" y1="17" x2="13" y2="17"/></>,
    grid:    <><rect x="4" y="4" width="6" height="6" rx="1.5"/><rect x="14" y="4" width="6" height="6" rx="1.5"/><rect x="4" y="14" width="6" height="6" rx="1.5"/><rect x="14" y="14" width="6" height="6" rx="1.5"/></>,
    home:    <><path d="M3 12L12 3l9 9"/><path d="M9 21V12h6v9"/></>,
    calendar:<><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></>,
    chart:   <><path d="M3 3v18h18"/><path d="M7 16l4-4 4 4 4-6"/></>,
    bill:    <><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 9h6M9 13h4"/></>,
    trophy:  <><path d="M8 21h8M12 17v4"/><path d="M17 3H7L5 9c0 3.3 2.7 6 6 6 1 0 2-.3 2.8-.7"/><path d="M17 3l2 6c0 3.3-2.7 6-6 6"/><path d="M5 3H3v3c0 1.7 1 3 2 3.5"/><path d="M19 3h2v3c0 1.7-1 3-2 3.5"/></>,
    check:   <path d="M20 6L9 17l-5-5"/>,
    magic:   <><path d="M15 4V2M15 16v-2M8 9h2M20 9h2M17.8 11.8L19.2 13.2M17.8 6.2L19.2 4.8M3 21l9-9M12.2 6.2L10.8 4.8"/><path d="m2 22 10-10"/></>,
  };
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      {p[name]}
    </svg>
  );
};

// ── GAUGE ARC ─────────────────────────────────────────────────────────────
function describeArc(cx,cy,r,a1,a2){
  const pt=a=>{const rad=a*Math.PI/180;return{x:cx+r*Math.sin(rad),y:cy-r*Math.cos(rad)};};
  const p1=pt(a1),p2=pt(a2),sw=((a2-a1)+360)%360;
  return `M ${p1.x} ${p1.y} A ${r} ${r} 0 ${sw>180?1:0} 1 ${p2.x} ${p2.y}`;
}
const statusFor = v => v>=80?"Excelente":v>=60?"Muito boa":v>=40?"Razoável":v>=1?"Atenção":"—";

// ── MINI COMPONENTES ──────────────────────────────────────────────────────
function Modal({ open, onClose, children, c }) {
  if (!open) return null;
  return (
    <div onClick={e=>e.target===e.currentTarget&&onClose()}
      style={{position:"fixed",inset:0,background:c.overlay,zIndex:50,display:"flex",alignItems:"flex-end"}}>
      <div style={{width:"100%",background:c.surface,borderRadius:"28px 28px 0 0",
        padding:"20px 20px 40px",maxHeight:"88vh",overflowY:"auto"}}>
        {children}
      </div>
    </div>
  );
}

function Segmented({ options, value, onChange, c }) {
  return (
    <div style={{display:"flex",borderRadius:12,overflow:"hidden",border:`1px solid ${c.border}`,marginBottom:14}}>
      {options.map(o=>(
        <button key={o.value} onClick={()=>onChange(o.value)}
          style={{flex:1,padding:"10px 0",border:"none",fontWeight:700,fontSize:13,cursor:"pointer",fontFamily:"inherit",
            background:value===o.value?c.accent:c.bgSoft,color:value===o.value?"#1a1305":c.muted}}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

const inp = c => ({
  width:"100%",padding:"11px 12px",borderRadius:12,border:`1px solid ${c.border}`,
  background:c.bgSoft,color:c.text,fontSize:14,fontFamily:"inherit",outline:"none",boxSizing:"border-box",marginBottom:0,
});
const lbl = c => ({fontSize:11,textTransform:"uppercase",letterSpacing:"0.08em",color:c.muted,marginBottom:6,fontWeight:600,display:"block"});

// ── TOAST ─────────────────────────────────────────────────────────────────
function Toast({ msg, onDone }) {
  useEffect(()=>{ const t=setTimeout(onDone,2800); return()=>clearTimeout(t); },[]);
  return (
    <div style={{position:"fixed",bottom:100,left:"50%",transform:"translateX(-50%)",
      background:"#1B2233",color:"#F3F1EA",borderRadius:16,padding:"10px 20px",
      fontSize:13,fontWeight:600,zIndex:100,whiteSpace:"nowrap",
      boxShadow:"0 8px 24px rgba(0,0,0,0.4)"}}>
      {msg}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════
// MAIN
// ══════════════════════════════════════════════════════════════════════════
export default function Atlas() {
  const [theme,   setTheme]   = useState(()=>load("atlas:theme","dark"));
  const c = theme==="dark" ? DARK : LIGHT;

  const [profile,  setProfile]  = useState(()=>load("atlas:profile",  {name:""}));
  const [accounts, setAccounts] = useState(()=>load("atlas:accounts", []));
  const [txs,      setTxs]      = useState(()=>load("atlas:transactions",[]));
  const [goals,    setGoals]    = useState(()=>load("atlas:goals",    []));
  const [bills,    setBills]    = useState(()=>load("atlas:bills",    []));
  const [unlocked, setUnlocked] = useState(()=>load("atlas:unlocked", []));

  const [view,     setView]     = useState("dashboard");
  const [modal,    setModal]    = useState(null);
  const [form,     setForm]     = useState({});
  const [aporteId, setAporteId] = useState(null);
  const [gaugeVal, setGaugeVal] = useState(0);
  const [toast,    setToast]    = useState(null);
  const [calMonth, setCalMonth] = useState(()=>monthKey());
  const [reportMonth, setReportMonth] = useState(()=>monthKey());

  const setF = k => e => setForm(f=>({...f,[k]:e.target.value}));
  const showToast = msg => setToast(msg);

  // persist
  useEffect(()=>save("atlas:theme",   theme),   [theme]);
  useEffect(()=>save("atlas:profile", profile),  [profile]);
  useEffect(()=>save("atlas:accounts",accounts), [accounts]);
  useEffect(()=>save("atlas:transactions",txs),  [txs]);
  useEffect(()=>save("atlas:goals",   goals),    [goals]);
  useEffect(()=>save("atlas:bills",   bills),    [bills]);
  useEffect(()=>save("atlas:unlocked",unlocked), [unlocked]);

  useEffect(()=>{ if(!profile.name) setTimeout(()=>setModal("name"),400); },[]);

  // check achievements
  useEffect(()=>{
    ACHIEVEMENTS.forEach(ach=>{
      if(!unlocked.includes(ach.id) && ach.check(accounts,txs,goals)) {
        setUnlocked(u=>[...u,ach.id]);
        showToast(`🏆 Conquista: ${ach.title}!`);
      }
    });
  },[accounts,txs,goals]);

  // gauge
  const now = new Date();
  const mk  = monthKey();
  const mTx = txs.filter(t=>t.date&&t.date.startsWith(mk));
  const receitasMes  = mTx.filter(t=>t.kind==="receita").reduce((s,t)=>s+Number(t.amount||0),0);
  const despesasMes  = mTx.filter(t=>t.kind==="despesa").reduce((s,t)=>s+Number(t.amount||0),0);
  const score = receitasMes>0?Math.max(0,Math.min(100,Math.round(((receitasMes-despesasMes)/receitasMes)*100))):0;

  useEffect(()=>{
    if(view!=="dashboard") return;
    let start=null;
    const target=score;
    const step=ts=>{ if(!start)start=ts; const t=Math.min(1,(ts-start)/1000); const e=1-Math.pow(1-t,3); setGaugeVal(Math.round(e*target)); if(t<1)requestAnimationFrame(step); };
    requestAnimationFrame(step);
  },[view,score]);

  const stars = useRef(Array.from({length:26},()=>({left:Math.random()*100,top:Math.random()*70,delay:Math.random()*4,op:(0.2+Math.random()*0.5).toFixed(2)}))).current;

  // métricas globais
  const netWorth  = accounts.reduce((s,a)=>s+Number(a.balance||0),0);
  const available = accounts.filter(a=>a.type!=="Investimento").reduce((s,a)=>s+Number(a.balance||0),0);
  const mainGoal  = goals[0]||null;

  // próximas contas a pagar (7 dias)
  const upcoming = bills.filter(b=>{
    if(b.paid) return false;
    const d=new Date(b.dueDate+"T00:00:00"); const diff=(d-new Date())/(1000*60*60*24);
    return diff<=7&&diff>=-1;
  }).sort((a,b)=>new Date(a.dueDate)-new Date(b.dueDate));

  // insights
  const insights=[];
  if(!accounts.length) insights.push({icon:"wallet",text:"Cadastre sua primeira <b>conta</b> para o Atlas calcular seu patrimônio."});
  if(!txs.length) insights.push({icon:"bulb",text:"Adicione seus primeiros <b>lançamentos</b> para ver seus insights."});
  else {
    if(despesasMes>receitasMes&&receitasMes>0) insights.push({icon:"alert",text:`Atenção: suas despesas (${fmt(despesasMes)}) superaram as receitas este mês.`});
    else if(receitasMes>0) insights.push({icon:"trend",text:`Você guardou <b>${fmt(receitasMes-despesasMes)}</b> este mês. Continue assim!`});
    const cats={};
    mTx.filter(t=>t.kind==="despesa").forEach(t=>{cats[t.category]=(cats[t.category]||0)+Number(t.amount||0);});
    const top=Object.entries(cats).sort((a,b)=>b[1]-a[1])[0];
    if(top) insights.push({icon:"bulb",text:`Maior gasto do mês: <b>${top[0]}</b> com ${fmt(top[1])}.`});
  }
  if(upcoming.length) insights.push({icon:"bill",text:`Você tem <b>${upcoming.length}</b> conta(s) a pagar nos próximos 7 dias.`});
  if(mainGoal&&mainGoal.target>0&&mainGoal.saved/mainGoal.target>=0.9&&mainGoal.saved<mainGoal.target)
    insights.push({icon:"sparkle",text:`Quase lá! <b>${mainGoal.name}</b> está ${Math.round(mainGoal.saved/mainGoal.target*100)}% concluída.`});

  const hour=now.getHours();
  const greet=hour<5?"Boa noite":hour<12?"Bom dia":hour<18?"Boa tarde":"Boa noite";
  const dateTxt=now.toLocaleDateString("pt-BR",{weekday:"long",day:"numeric",month:"long"});

  // ── ESTILOS BASE ─────────────────────────────────────────────────────────
  const card  = {background:c.surface,border:`1px solid ${c.border}`,borderRadius:26,padding:18,boxShadow:"0 8px 24px rgba(0,0,0,0.12)",marginBottom:14};
  const btnP  = {flex:1,display:"inline-flex",alignItems:"center",justifyContent:"center",gap:6,border:"none",borderRadius:14,padding:"11px 18px",fontSize:13.5,fontWeight:700,cursor:"pointer",fontFamily:"inherit",background:`linear-gradient(90deg,${c.accent},${c.accentStrong})`,color:"#1a1305"};
  const btnS  = {...btnP, background:c.surfaceAlt, color:c.text};
  const mhdr  = {fontFamily:"Georgia,serif",fontSize:18,fontWeight:600,margin:"0 0 16px",color:c.text};
  const vtitle= {fontFamily:"Georgia,serif",fontSize:24,fontWeight:600,margin:"0 0 18px",color:c.text};

  // ── SUBMIT HANDLERS ──────────────────────────────────────────────────────
  function submitName(){ const name=(form.name||"").trim(); setProfile({name}); setModal(null); }

  function submitAccount(){
    const name=(form.accName||"").trim(); if(!name) return;
    setAccounts(p=>[...p,{id:uid(),name,type:form.accType||ACCOUNT_TYPES[0],balance:parseFloat(form.accBalance)||0}]);
    setModal(null); showToast("✅ Conta adicionada!");
  }

  function submitTx(){
    const amount=parseFloat(form.txAmount); if(!amount||amount<=0) return;
    const kind=form.txKind||"receita";
    const desc=(form.txDesc||"").trim();
    const cat=form.txCat||autoCategory(desc,kind);
    const accId=form.txAccId||accounts[0]?.id||"";
    setTxs(p=>[...p,{id:uid(),kind,desc,amount,category:cat,accountId:accId,date:form.txDate||todayISO()}]);
    if(accId){
      setAccounts(p=>p.map(a=>a.id===accId?{...a,balance:Number(a.balance||0)+(kind==="receita"?amount:-amount)}:a));
    }
    setModal(null); showToast("✅ Lançamento salvo!");
  }

  function submitGoal(){
    const name=(form.gName||"").trim(); const target=parseFloat(form.gTarget);
    if(!name||!target) return;
    setGoals(p=>[...p,{id:uid(),name,target,saved:parseFloat(form.gSaved)||0}]);
    setModal(null); showToast("🎯 Meta criada!");
  }

  function submitAporte(){
    const valor=parseFloat(form.aporte); if(!valor||valor<=0) return;
    setGoals(p=>p.map(g=>g.id===aporteId?{...g,saved:Number(g.saved||0)+valor}:g));
    setModal(null); showToast("💰 Aporte adicionado!");
  }

  function submitBill(){
    const name=(form.bName||"").trim(); const amount=parseFloat(form.bAmount);
    if(!name||!amount) return;
    setBills(p=>[...p,{id:uid(),name,amount,dueDate:form.bDue||todayISO(),freq:form.bFreq||"Única",paid:false,category:form.bCat||DESPESA_CATS[0]}]);
    setModal(null); showToast("📅 Conta a pagar salva!");
  }

  function markBillPaid(id){
    setBills(p=>p.map(b=>{
      if(b.id!==id) return b;
      // se recorrente, avança a data
      let next={...b,paid:true};
      if(b.freq!=="Única"){
        const d=new Date(b.dueDate+"T00:00:00");
        if(b.freq==="Diária")    d.setDate(d.getDate()+1);
        if(b.freq==="Semanal")   d.setDate(d.getDate()+7);
        if(b.freq==="Quinzenal") d.setDate(d.getDate()+15);
        if(b.freq==="Mensal")    d.setMonth(d.getMonth()+1);
        if(b.freq==="Anual")     d.setFullYear(d.getFullYear()+1);
        next={...b,paid:false,dueDate:d.toISOString().slice(0,10)};
      }
      return next;
    }));
    showToast("✅ Conta marcada como paga!");
  }

  // ── RELATÓRIO ────────────────────────────────────────────────────────────
  const reportTxs = txs.filter(t=>t.date&&t.date.startsWith(reportMonth));
  const reportRec = reportTxs.filter(t=>t.kind==="receita").reduce((s,t)=>s+Number(t.amount),0);
  const reportDesp= reportTxs.filter(t=>t.kind==="despesa").reduce((s,t)=>s+Number(t.amount),0);
  const catTotals = {};
  reportTxs.filter(t=>t.kind==="despesa").forEach(t=>{catTotals[t.category]=(catTotals[t.category]||0)+Number(t.amount);});
  const catList = Object.entries(catTotals).sort((a,b)=>b[1]-a[1]);
  const maxCat  = catList[0]?.[1]||1;

  // meses disponíveis para relatório
  const availableMonths = [...new Set(txs.map(t=>t.date?.slice(0,7)).filter(Boolean))].sort().reverse();

  // ── CALENDÁRIO ───────────────────────────────────────────────────────────
  const calTxs  = txs.filter(t=>t.date&&t.date.startsWith(calMonth));
  const calBills= bills.filter(b=>b.dueDate&&b.dueDate.startsWith(calMonth));
  const [calY, calM] = calMonth.split("-").map(Number);
  const daysInMonth  = new Date(calY,calM,0).getDate();
  const firstDay     = new Date(calY,calM-1,1).getDay();
  const calDays      = Array.from({length:daysInMonth},(_,i)=>{
    const d=String(i+1).padStart(2,"0");
    const full=`${calMonth}-${d}`;
    const dayTxs=calTxs.filter(t=>t.date===full);
    const dayBills=calBills.filter(b=>b.dueDate===full);
    return {day:i+1,full,txs:dayTxs,bills:dayBills};
  });
  function prevMonth(){ const d=new Date(calY,calM-2,1); setCalMonth(monthKey(d)); }
  function nextMonth(){ const d=new Date(calY,calM,1);   setCalMonth(monthKey(d)); }
  const calMonthName = new Date(calY,calM-1,1).toLocaleDateString("pt-BR",{month:"long",year:"numeric"});

  // ── FAB ──────────────────────────────────────────────────────────────────
  const fabActions = {
    lancamentos:()=>{setForm({txKind:"receita"});setModal("tx");},
    contas:     ()=>{setForm({});setModal("account");},
    metas:      ()=>{setForm({});setModal("goal");},
    contas_pagar:()=>{setForm({});setModal("bill");},
  };

  // ══════════════════════════════════════════════════════════════════════════
  // VIEWS
  // ══════════════════════════════════════════════════════════════════════════

  // ── DASHBOARD ────────────────────────────────────────────────────────────
  const Dashboard = () => (
    <>
      {theme==="dark"&&(
        <div style={{position:"absolute",inset:0,pointerEvents:"none",zIndex:0}}>
          {stars.map((s,i)=><div key={i} style={{position:"absolute",width:3,height:3,borderRadius:"50%",background:"#fff",left:`${s.left}%`,top:`${s.top}%`,opacity:s.op,animation:`twinkle 4.5s ${s.delay}s ease-in-out infinite`}}/>)}
        </div>
      )}
      <div style={{position:"relative",zIndex:1}}>
        <div style={{marginBottom:20}}>
          <h1 style={{fontFamily:"Georgia,serif",fontSize:26,fontWeight:600,margin:"0 0 4px",color:c.text}}>{greet}{profile.name?`, ${profile.name}`:""}</h1>
          <p style={{color:c.muted,fontSize:13,margin:0}}>{dateTxt}</p>
        </div>

        <div style={card}>
          <p style={lbl(c)}>Patrimônio total</p>
          <p style={{fontFamily:"Georgia,serif",fontSize:36,fontWeight:600,margin:"0 0 4px",color:c.text}}>{fmt(netWorth)}</p>
          <p style={{color:c.muted,fontSize:13,margin:0}}>{accounts.length} conta(s) · {txs.length} lançamento(s)</p>
        </div>

        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:14}}>
          <div style={{...card,margin:0}}><p style={lbl(c)}>Saldo disponível</p><p style={{fontSize:19,fontWeight:700,margin:0,color:c.text}}>{fmt(available)}</p></div>
          <div style={{...card,margin:0}}><p style={lbl(c)}>Despesas do mês</p><p style={{fontSize:19,fontWeight:700,margin:0,color:c.text}}>{fmt(despesasMes)}</p><p style={{fontSize:12,color:c.muted,margin:"4px 0 0"}}>Receitas: {fmt(receitasMes)}</p></div>
        </div>

        {/* próximas contas */}
        {upcoming.length>0&&(
          <div style={card}>
            <p style={lbl(c)}>⚠️ Contas a pagar em breve</p>
            {upcoming.slice(0,3).map(b=>(
              <div key={b.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"6px 0",borderBottom:`1px solid ${c.border}`}}>
                <div>
                  <p style={{fontSize:13,fontWeight:600,margin:0,color:c.text}}>{b.name}</p>
                  <p style={{fontSize:11,color:c.muted,margin:0}}>{new Date(b.dueDate+"T00:00:00").toLocaleDateString("pt-BR")} · {b.freq}</p>
                </div>
                <span style={{fontSize:13,fontWeight:700,color:c.negative}}>{fmt(b.amount)}</span>
              </div>
            ))}
          </div>
        )}

        {/* meta */}
        {mainGoal?(()=>{
          const pct=mainGoal.target>0?Math.min(100,Math.round(mainGoal.saved/mainGoal.target*100)):0;
          return(
            <div style={card}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
                <p style={lbl(c)}>Meta principal</p>
                <span style={{fontSize:13,fontWeight:700,color:c.accent,background:`color-mix(in srgb,${c.accent} 16%,transparent)`,padding:"3px 10px",borderRadius:20}}>{pct}%</span>
              </div>
              <p style={{fontSize:15,fontWeight:600,margin:"0 0 2px",color:c.text}}>{mainGoal.name}</p>
              <div style={{height:8,borderRadius:6,background:c.track,overflow:"hidden",margin:"12px 0 8px"}}>
                <div style={{height:"100%",width:`${pct}%`,borderRadius:6,background:`linear-gradient(90deg,${c.accent},${c.accentStrong})`,transition:"width 1s"}}/>
              </div>
              <p style={{fontSize:12,color:c.muted,margin:0}}>{fmt(mainGoal.saved)} de {fmt(mainGoal.target)}</p>
            </div>
          );
        })():(
          <div style={card}>
            <p style={lbl(c)}>Meta principal</p>
            <div style={{textAlign:"center",padding:"10px 0"}}>
              <p style={{color:c.muted,fontSize:13,marginBottom:12}}>Nenhuma meta ainda.</p>
              <button style={{...btnP,flex:"none",padding:"8px 16px",fontSize:12.5}} onClick={()=>{setForm({});setModal("goal");}}>+ Criar meta</button>
            </div>
          </div>
        )}

        {/* gauge */}
        <div style={{...card,textAlign:"center"}}>
          <p style={lbl(c)}>Saúde financeira</p>
          <div style={{position:"relative",width:172,height:172,margin:"4px auto 2px"}}>
            <svg viewBox="0 0 200 200" style={{width:"100%",height:"100%"}}>
              <path d={describeArc(100,100,80,225,495)} fill="none" stroke={c.track} strokeWidth="13" strokeLinecap="round"/>
              <path d={describeArc(100,100,80,225,225+270*(gaugeVal/100))} fill="none" stroke={c.accent} strokeWidth="13" strokeLinecap="round"/>
            </svg>
            <div style={{position:"absolute",inset:0,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center"}}>
              <span style={{fontFamily:"Georgia,serif",fontSize:38,fontWeight:600,lineHeight:1,color:c.text}}>{gaugeVal}</span>
              <span style={{fontSize:12,color:c.muted}}>/ 100</span>
              <span style={{fontSize:12.5,fontWeight:600,color:c.accent,marginTop:4}}>{statusFor(gaugeVal)}</span>
            </div>
          </div>
        </div>

        {/* conquistas recentes */}
        {unlocked.length>0&&(
          <div style={card}>
            <p style={lbl(c)}>🏆 Conquistas ({unlocked.length}/{ACHIEVEMENTS.length})</p>
            <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
              {ACHIEVEMENTS.filter(a=>unlocked.includes(a.id)).slice(-4).map(a=>(
                <div key={a.id} title={a.desc} style={{background:c.surfaceAlt,borderRadius:12,padding:"6px 10px",fontSize:12,fontWeight:600,color:c.text}}>
                  {a.icon} {a.title}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* insights */}
        {insights.length>0&&(
          <div>
            <p style={{display:"flex",alignItems:"center",gap:7,fontSize:14,fontWeight:700,margin:"0 0 10px",color:c.text}}>
              <Icon name="sparkle" size={15} color={c.accent}/> Insights da Mona
            </p>
            {insights.slice(0,4).map((ins,i)=>(
              <div key={i} style={{display:"flex",gap:12,background:c.surface,border:`1px solid ${c.border}`,borderRadius:18,padding:14,marginBottom:10}}>
                <div style={{flexShrink:0,width:34,height:34,borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",background:`color-mix(in srgb,${c.accent} 18%,transparent)`}}>
                  <Icon name={ins.icon} size={16} color={c.accent}/>
                </div>
                <p style={{fontSize:13,lineHeight:1.45,margin:0,color:c.text}}
                  dangerouslySetInnerHTML={{__html:ins.text.replace(/<b>/g,`<strong style="color:${c.accent}">`).replace(/<\/b>/g,"</strong>")}}/>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );

  // ── LANÇAMENTOS ───────────────────────────────────────────────────────────
  const [txFilter,setTxFilter]=useState("todos");
  const Lancamentos = () => {
    const list=txs.filter(t=>txFilter==="todos"||t.kind===txFilter).sort((a,b)=>new Date(b.date)-new Date(a.date));
    return(<>
      <h2 style={vtitle}>Lançamentos</h2>
      <div style={{display:"flex",gap:8,marginBottom:14}}>
        {["todos","receita","despesa"].map(f=>(
          <div key={f} onClick={()=>setTxFilter(f)} style={{flex:1,textAlign:"center",padding:"9px 0",borderRadius:14,border:`1px solid ${txFilter===f?c.accent:c.border}`,cursor:"pointer",fontSize:12.5,fontWeight:600,background:txFilter===f?c.accent:c.surface,color:txFilter===f?"#1a1305":c.muted}}>
            {f.charAt(0).toUpperCase()+f.slice(1)}
          </div>
        ))}
      </div>
      {!list.length?(
        <div style={{textAlign:"center",padding:"34px 18px",color:c.muted}}>
          <Icon name="list" size={34} color={c.accent}/>
          <p style={{margin:"10px 0 14px",fontSize:13.5}}>Nenhum lançamento ainda.</p>
          <button style={{...btnP,flex:"none"}} onClick={()=>{setForm({txKind:"receita"});setModal("tx");}}>+ Adicionar</button>
        </div>
      ):list.map(t=>{
        const acc=accounts.find(a=>a.id===t.accountId);
        const dateTxt=new Date(t.date+"T00:00:00").toLocaleDateString("pt-BR",{day:"2-digit",month:"short"});
        return(
          <div key={t.id} style={{display:"flex",alignItems:"center",gap:12,background:c.surface,border:`1px solid ${c.border}`,borderRadius:18,padding:"13px 14px",marginBottom:9}}>
            <div style={{flexShrink:0,width:36,height:36,borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",background:c.surfaceAlt}}>
              <Icon name={t.kind==="receita"?"income":"expense"} size={17} color={t.kind==="receita"?c.positive:c.negative}/>
            </div>
            <div style={{flex:1,minWidth:0}}>
              <p style={{fontSize:14,fontWeight:600,margin:"0 0 2px",color:c.text,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{t.desc||t.category}</p>
              <p style={{fontSize:11.5,color:c.muted,margin:0}}>{t.category} · {dateTxt}{acc?` · ${acc.name}`:""}</p>
            </div>
            <span style={{fontSize:14,fontWeight:700,color:t.kind==="receita"?c.positive:c.negative,flexShrink:0}}>{t.kind==="receita"?"+":"-"} {fmt(t.amount)}</span>
            <button onClick={()=>{setTxs(p=>p.filter(x=>x.id!==t.id));showToast("🗑️ Removido");}} style={{border:"none",background:"none",color:c.muted,cursor:"pointer",padding:4,display:"flex",flexShrink:0}}><Icon name="trash" size={15}/></button>
          </div>
        );
      })}
    </>);
  };

  // ── CONTAS ────────────────────────────────────────────────────────────────
  const Contas = () => (<>
    <h2 style={vtitle}>Contas</h2>
    {!accounts.length?(
      <div style={{textAlign:"center",padding:"34px 18px",color:c.muted}}>
        <Icon name="wallet" size={34} color={c.accent}/>
        <p style={{margin:"10px 0 14px",fontSize:13.5}}>Nenhuma conta cadastrada.</p>
        <button style={{...btnP,flex:"none"}} onClick={()=>{setForm({});setModal("account");}}>+ Adicionar conta</button>
      </div>
    ):accounts.map(a=>(
      <div key={a.id} style={{display:"flex",alignItems:"center",gap:12,background:c.surface,border:`1px solid ${c.border}`,borderRadius:18,padding:"13px 14px",marginBottom:9}}>
        <div style={{flexShrink:0,width:36,height:36,borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",background:c.surfaceAlt}}><Icon name="wallet" size={17} color={c.accent}/></div>
        <div style={{flex:1}}><p style={{fontSize:15,fontWeight:600,margin:"0 0 2px",color:c.text}}>{a.name}</p><p style={{fontSize:11.5,color:c.muted,margin:0}}>{a.type}</p></div>
        <span style={{fontSize:14,fontWeight:700,color:Number(a.balance)>=0?c.positive:c.negative}}>{fmt(a.balance)}</span>
        <button onClick={()=>{setAccounts(p=>p.filter(x=>x.id!==a.id));showToast("🗑️ Removido");}} style={{border:"none",background:"none",color:c.muted,cursor:"pointer",padding:4,display:"flex"}}><Icon name="trash" size={15}/></button>
      </div>
    ))}
  </>);

  // ── METAS ────────────────────────────────────────────────────────────────
  const Metas = () => (<>
    <h2 style={vtitle}>Metas</h2>
    {!goals.length?(
      <div style={{textAlign:"center",padding:"34px 18px",color:c.muted}}>
        <Icon name="target" size={34} color={c.accent}/>
        <p style={{margin:"10px 0 14px",fontSize:13.5}}>Nenhuma meta ainda.</p>
        <button style={{...btnP,flex:"none"}} onClick={()=>{setForm({});setModal("goal");}}>+ Criar meta</button>
      </div>
    ):goals.map(g=>{
      const pct=g.target>0?Math.min(100,Math.round(g.saved/g.target*100)):0;
      const done=g.saved>=g.target;
      return(
        <div key={g.id} style={card}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
            <p style={lbl(c)}>Meta {done?"🏆":""}</p>
            <span style={{fontSize:13,fontWeight:700,color:done?c.positive:c.accent,background:`color-mix(in srgb,${done?c.positive:c.accent} 16%,transparent)`,padding:"3px 10px",borderRadius:20}}>{pct}%</span>
          </div>
          <p style={{fontSize:15,fontWeight:600,margin:"0 0 2px",color:c.text}}>{g.name}</p>
          <div style={{height:8,borderRadius:6,background:c.track,overflow:"hidden",margin:"12px 0 8px"}}>
            <div style={{height:"100%",width:`${pct}%`,borderRadius:6,background:done?`linear-gradient(90deg,${c.positive},#5BC88A)`:`linear-gradient(90deg,${c.accent},${c.accentStrong})`}}/>
          </div>
          <p style={{fontSize:12,color:c.muted,margin:"0 0 12px"}}>{fmt(g.saved)} de {fmt(g.target)}</p>
          <div style={{display:"flex",gap:8}}>
            {!done&&<button style={{...btnP,fontSize:12.5,padding:"8px 12px"}} onClick={()=>{setAporteId(g.id);setForm({});setModal("aporte");}}>+ Aporte</button>}
            <button style={{...btnS,flex:"none",padding:"8px 12px",fontSize:12.5}} onClick={()=>{setGoals(p=>p.filter(x=>x.id!==g.id));showToast("🗑️ Removido");}}><Icon name="trash" size={14}/></button>
          </div>
        </div>
      );
    })}
  </>);

  // ── CONTAS A PAGAR ────────────────────────────────────────────────────────
  const ContasPagar = () => {
    const pendentes=bills.filter(b=>!b.paid).sort((a,b)=>new Date(a.dueDate)-new Date(b.dueDate));
    const pagas=bills.filter(b=>b.paid);
    return(<>
      <h2 style={vtitle}>Contas a Pagar</h2>
      {!bills.length?(
        <div style={{textAlign:"center",padding:"34px 18px",color:c.muted}}>
          <Icon name="bill" size={34} color={c.accent}/>
          <p style={{margin:"10px 0 14px",fontSize:13.5}}>Nenhuma conta cadastrada.</p>
          <button style={{...btnP,flex:"none"}} onClick={()=>{setForm({});setModal("bill");}}>+ Adicionar conta</button>
        </div>
      ):<>
        {pendentes.map(b=>{
          const d=new Date(b.dueDate+"T00:00:00");
          const diff=Math.round((d-new Date())/(1000*60*60*24));
          const late=diff<0; const soon=diff<=3&&diff>=0;
          return(
            <div key={b.id} style={{background:c.surface,border:`1px solid ${late?c.negative:soon?"#F1A94E":c.border}`,borderRadius:18,padding:"13px 14px",marginBottom:9}}>
              <div style={{display:"flex",alignItems:"center",gap:10}}>
                <div style={{flexShrink:0,width:36,height:36,borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",background:c.surfaceAlt}}><Icon name="bill" size={17} color={late?c.negative:c.accent}/></div>
                <div style={{flex:1}}>
                  <p style={{fontSize:14,fontWeight:600,margin:"0 0 2px",color:c.text}}>{b.name}</p>
                  <p style={{fontSize:11.5,color:late?c.negative:soon?"#F1A94E":c.muted,margin:0}}>
                    {d.toLocaleDateString("pt-BR")} · {b.freq} · {late?`${Math.abs(diff)}d atrasada`:diff===0?"Vence hoje":`${diff}d`}
                  </p>
                </div>
                <span style={{fontSize:14,fontWeight:700,color:c.text,flexShrink:0}}>{fmt(b.amount)}</span>
              </div>
              <div style={{display:"flex",gap:8,marginTop:10}}>
                <button style={{...btnP,fontSize:12,padding:"7px 10px"}} onClick={()=>markBillPaid(b.id)}><Icon name="check" size={13} color="#1a1305"/>Pagar</button>
                <button style={{...btnS,flex:"none",padding:"7px 10px",fontSize:12}} onClick={()=>{setBills(p=>p.filter(x=>x.id!==b.id));showToast("🗑️ Removido");}}><Icon name="trash" size={13}/></button>
              </div>
            </div>
          );
        })}
        {pagas.length>0&&<p style={{color:c.muted,fontSize:12,margin:"8px 0 4px"}}>✅ {pagas.length} conta(s) paga(s) este ciclo</p>}
      </>}
    </>);
  };

  // ── RELATÓRIOS ────────────────────────────────────────────────────────────
  const Relatorios = () => (
    <>
      <h2 style={vtitle}>Relatórios</h2>
      <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:14}}>
        <select value={reportMonth} onChange={e=>setReportMonth(e.target.value)} style={{...inp(c),flex:1}}>
          {availableMonths.length?availableMonths.map(m=><option key={m} value={m}>{new Date(m+"-01").toLocaleDateString("pt-BR",{month:"long",year:"numeric"})}</option>):<option value={reportMonth}>{new Date(reportMonth+"-01").toLocaleDateString("pt-BR",{month:"long",year:"numeric"})}</option>}
        </select>
      </div>
      {/* resumo */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:14}}>
        <div style={{...card,margin:0,textAlign:"center"}}>
          <p style={lbl(c)}>Receitas</p>
          <p style={{fontSize:18,fontWeight:700,margin:0,color:c.positive}}>{fmt(reportRec)}</p>
        </div>
        <div style={{...card,margin:0,textAlign:"center"}}>
          <p style={lbl(c)}>Despesas</p>
          <p style={{fontSize:18,fontWeight:700,margin:0,color:c.negative}}>{fmt(reportDesp)}</p>
        </div>
      </div>
      <div style={{...card,textAlign:"center",marginBottom:14}}>
        <p style={lbl(c)}>Saldo do mês</p>
        <p style={{fontFamily:"Georgia,serif",fontSize:28,fontWeight:600,margin:0,color:reportRec-reportDesp>=0?c.positive:c.negative}}>{fmt(reportRec-reportDesp)}</p>
      </div>
      {/* gráfico por categoria */}
      {catList.length>0?(
        <div style={card}>
          <p style={lbl(c)}>Gastos por categoria</p>
          {catList.map(([cat,val])=>(
            <div key={cat} style={{marginBottom:10}}>
              <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
                <span style={{fontSize:13,fontWeight:600,color:c.text}}>{cat}</span>
                <span style={{fontSize:13,fontWeight:700,color:c.accent}}>{fmt(val)}</span>
              </div>
              <div style={{height:7,borderRadius:6,background:c.track,overflow:"hidden"}}>
                <div style={{height:"100%",width:`${(val/maxCat)*100}%`,borderRadius:6,background:`linear-gradient(90deg,${c.accent},${c.accentStrong})`,transition:"width 0.8s"}}/>
              </div>
              <p style={{fontSize:10.5,color:c.muted,margin:"2px 0 0"}}>{reportDesp>0?Math.round((val/reportDesp)*100):0}% das despesas</p>
            </div>
          ))}
        </div>
      ):(
        <div style={{textAlign:"center",padding:"34px 18px",color:c.muted}}>
          <Icon name="chart" size={34} color={c.accent}/>
          <p style={{margin:"10px 0",fontSize:13.5}}>Nenhum dado para este mês ainda.</p>
        </div>
      )}
    </>
  );

  // ── CALENDÁRIO ───────────────────────────────────────────────────────────
  const Calendario = () => (
    <>
      <h2 style={vtitle}>Calendário</h2>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16}}>
        <button onClick={prevMonth} style={{...btnS,flex:"none",padding:"8px 14px"}}>&lt;</button>
        <span style={{fontSize:14,fontWeight:700,color:c.text,textTransform:"capitalize"}}>{calMonthName}</span>
        <button onClick={nextMonth} style={{...btnS,flex:"none",padding:"8px 14px"}}>&gt;</button>
      </div>
      {/* cabeçalho dias */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:3,marginBottom:4}}>
        {["D","S","T","Q","Q","S","S"].map((d,i)=>(
          <div key={i} style={{textAlign:"center",fontSize:11,fontWeight:700,color:c.muted,padding:"4px 0"}}>{d}</div>
        ))}
      </div>
      {/* grade */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:3}}>
        {Array.from({length:firstDay},(_,i)=><div key={`e${i}`}/>)}
        {calDays.map(({day,full,txs:dt,bills:db})=>{
          const today=todayISO()===full;
          const hasR=dt.some(t=>t.kind==="receita");
          const hasD=dt.some(t=>t.kind==="despesa");
          const hasBill=db.length>0;
          return(
            <div key={day} style={{aspectRatio:"1",borderRadius:10,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:2,
              background:today?c.accent:c.surface,border:`1px solid ${today?c.accent:c.border}`,padding:2,position:"relative"}}>
              <span style={{fontSize:12,fontWeight:today?700:500,color:today?"#1a1305":c.text}}>{day}</span>
              <div style={{display:"flex",gap:2}}>
                {hasR&&<div style={{width:5,height:5,borderRadius:"50%",background:c.positive}}/>}
                {hasD&&<div style={{width:5,height:5,borderRadius:"50%",background:c.negative}}/>}
                {hasBill&&<div style={{width:5,height:5,borderRadius:"50%",background:"#F1A94E"}}/>}
              </div>
            </div>
          );
        })}
      </div>
      <div style={{display:"flex",gap:12,margin:"14px 0 0",justifyContent:"center"}}>
        <div style={{display:"flex",alignItems:"center",gap:4,fontSize:11,color:c.muted}}><div style={{width:8,height:8,borderRadius:"50%",background:c.positive}}/> Receita</div>
        <div style={{display:"flex",alignItems:"center",gap:4,fontSize:11,color:c.muted}}><div style={{width:8,height:8,borderRadius:"50%",background:c.negative}}/> Despesa</div>
        <div style={{display:"flex",alignItems:"center",gap:4,fontSize:11,color:c.muted}}><div style={{width:8,height:8,borderRadius:"50%",background:"#F1A94E"}}/> Conta</div>
      </div>
    </>
  );

  // ── CONQUISTAS ────────────────────────────────────────────────────────────
  const Conquistas = () => (
    <>
      <h2 style={vtitle}>Conquistas</h2>
      <p style={{color:c.muted,fontSize:13,margin:"0 0 16px"}}>{unlocked.length} de {ACHIEVEMENTS.length} desbloqueadas</p>
      <div style={{height:8,borderRadius:6,background:c.track,overflow:"hidden",marginBottom:20}}>
        <div style={{height:"100%",width:`${(unlocked.length/ACHIEVEMENTS.length)*100}%`,borderRadius:6,background:`linear-gradient(90deg,${c.accent},${c.accentStrong})`,transition:"width 1s"}}/>
      </div>
      {ACHIEVEMENTS.map(a=>{
        const got=unlocked.includes(a.id);
        return(
          <div key={a.id} style={{display:"flex",gap:12,background:c.surface,border:`1px solid ${got?c.accent:c.border}`,borderRadius:18,padding:14,marginBottom:10,opacity:got?1:0.45}}>
            <div style={{fontSize:26,flexShrink:0,width:44,height:44,display:"flex",alignItems:"center",justifyContent:"center",background:c.surfaceAlt,borderRadius:12}}>{a.icon}</div>
            <div>
              <p style={{fontSize:14,fontWeight:700,margin:"0 0 2px",color:got?c.accent:c.muted}}>{a.title}</p>
              <p style={{fontSize:12.5,color:c.muted,margin:0}}>{a.desc}</p>
            </div>
            {got&&<Icon name="check" size={16} color={c.positive} style={{flexShrink:0,marginLeft:"auto"}}/>}
          </div>
        );
      })}
    </>
  );

  // ── MAIS ─────────────────────────────────────────────────────────────────
  const Mais = () => (
    <>
      <h2 style={vtitle}>Mais</h2>
      {[
        {icon:"calendar", label:"Calendário",     action:()=>setView("calendario")},
        {icon:"chart",    label:"Relatórios",     action:()=>setView("relatorios")},
        {icon:"trophy",   label:"Conquistas",     action:()=>setView("conquistas")},
      ].map(item=>(
        <div key={item.label} onClick={item.action} style={{display:"flex",alignItems:"center",gap:12,background:c.surface,border:`1px solid ${c.border}`,borderRadius:18,padding:"14px",marginBottom:10,cursor:"pointer"}}>
          <div style={{width:40,height:40,borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",background:c.surfaceAlt}}><Icon name={item.icon} size={18} color={c.accent}/></div>
          <p style={{flex:1,margin:0,fontSize:15,fontWeight:600,color:c.text}}>{item.label}</p>
          <span style={{color:c.muted,fontSize:18}}>›</span>
        </div>
      ))}
      <div style={{...card,marginTop:8}}>
        {["Patrimônio detalhado","Investimentos","Clientes","Projetos","IA Mona (chat)","Configurações"].map(m=>(
          <div key={m} style={{display:"flex",alignItems:"center",gap:12,padding:"12px 4px",borderBottom:`1px solid ${c.border}`}}>
            <div style={{width:36,height:36,borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",background:c.surfaceAlt}}><Icon name="sparkle" size={16} color={c.muted}/></div>
            <p style={{flex:1,margin:0,fontSize:14,fontWeight:600,color:c.muted}}>{m}</p>
            <span style={{fontSize:10.5,fontWeight:700,color:c.muted,background:c.surfaceAlt,padding:"4px 9px",borderRadius:20}}>Em breve</span>
          </div>
        ))}
      </div>
      <p style={{marginTop:14,textAlign:"center",color:c.muted,fontSize:12}}>Atlas v0.2 · feito pra você ✨</p>
    </>
  );

  // ── TABBAR TABS ──────────────────────────────────────────────────────────
  const TABS = [
    {v:"dashboard",    icon:"home",    label:"Início"},
    {v:"lancamentos",  icon:"list",    label:"Lançamentos"},
    {v:"contas",       icon:"wallet",  label:"Contas"},
    {v:"metas",        icon:"target",  label:"Metas"},
    {v:"contas_pagar", icon:"bill",    label:"A Pagar"},
    {v:"mais",         icon:"grid",    label:"Mais"},
  ];
  const mainViews = TABS.map(t=>t.v);
  const isMain    = mainViews.includes(view);

  // ══════════════════════════════════════════════════════════════════════════
  // RENDER
  // ══════════════════════════════════════════════════════════════════════════
  return (
    <div style={{minHeight:"100vh",background:"#E7E6E2",display:"flex",alignItems:"center",justifyContent:"center",padding:"40px 16px"}}>
      <style>{`
        @keyframes twinkle{0%,100%{opacity:.15;}50%{opacity:.8;}}
        *{box-sizing:border-box;}
        @media(max-width:480px){
          .phone-shell{width:100vw!important;height:100vh!important;border-radius:0!important;padding:0!important;box-shadow:none!important;background:transparent!important;}
          .phone-screen{border-radius:0!important;padding-top:calc(20px + env(safe-area-inset-top))!important;padding-bottom:calc(90px + env(safe-area-inset-bottom))!important;}
          .phone-tabbar{bottom:calc(14px + env(safe-area-inset-bottom))!important;left:calc(14px + env(safe-area-inset-left))!important;right:calc(14px + env(safe-area-inset-right))!important;}
          .phone-fab{bottom:calc(88px + env(safe-area-inset-bottom))!important;right:calc(18px + env(safe-area-inset-right))!important;}
          .phone-notch{display:none!important;}
        }
      `}</style>

      <div className="phone-shell" style={{position:"relative",width:390,height:844,background:"#06070B",borderRadius:54,padding:14,boxShadow:"0 30px 70px rgba(0,0,0,0.35)"}}>
        <div className="phone-notch" style={{position:"absolute",top:26,left:"50%",transform:"translateX(-50%)",width:110,height:28,background:"#06070B",borderRadius:20,zIndex:6}}/>

        <div className="phone-screen" style={{position:"relative",width:"100%",height:"calc(100% - 78px)",background:c.bg,borderRadius:38,overflowY:"auto",overflowX:"hidden",padding:"54px 18px 100px",color:c.text,scrollbarWidth:"none"}}>

          {/* topbar */}
          <header style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:18,position:"relative",zIndex:1}}>
            <div style={{display:"flex",alignItems:"center",gap:8}}>
              {!isMain&&(
                <button onClick={()=>setView("mais")} style={{border:"none",background:"none",cursor:"pointer",color:c.muted,padding:0,display:"flex",alignItems:"center"}}>
                  <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
                </button>
              )}
              <span style={{fontFamily:"Georgia,serif",fontWeight:600,fontSize:20,letterSpacing:.5,color:c.text}}>Atlas</span>
            </div>
            <button onClick={()=>setTheme(t=>t==="dark"?"light":"dark")} style={{width:38,height:38,borderRadius:"50%",border:`1px solid ${c.border}`,background:c.surface,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",color:c.accent}}>
              <Icon name={theme==="dark"?"sun":"moon"} size={18}/>
            </button>
          </header>

          {/* views */}
          {view==="dashboard"    && <Dashboard/>}
          {view==="lancamentos"  && <Lancamentos/>}
          {view==="contas"       && <Contas/>}
          {view==="metas"        && <Metas/>}
          {view==="contas_pagar" && <ContasPagar/>}
          {view==="relatorios"   && <Relatorios/>}
          {view==="calendario"   && <Calendario/>}
          {view==="conquistas"   && <Conquistas/>}
          {view==="mais"         && <Mais/>}
        </div>

        {/* FAB */}
        {fabActions[view]&&(
          <button className="phone-fab" onClick={fabActions[view]}
            style={{position:"absolute",right:18,bottom:88,width:54,height:54,borderRadius:"50%",background:`linear-gradient(135deg,${c.accent},${c.accentStrong})`,border:"none",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",boxShadow:"0 14px 26px rgba(0,0,0,0.3)",zIndex:4,color:"#1a1305"}}>
            <Icon name="plus" size={24} color="#1a1305"/>
          </button>
        )}

        {/* TABBAR — só 5 itens principais */}
        <nav className="phone-tabbar" style={{position:"absolute",left:14,right:14,bottom:14,height:64,display:"flex",alignItems:"center",justifyContent:"space-around",borderRadius:24,zIndex:3,backdropFilter:"blur(14px)",background:theme==="dark"?"rgba(19,24,38,0.85)":"rgba(255,255,255,0.88)",border:`1px solid ${c.border}`}}>
          {TABS.map(({v,icon,label})=>(
            <button key={v} onClick={()=>setView(v)} style={{display:"flex",flexDirection:"column",alignItems:"center",gap:2,border:"none",background:"none",cursor:"pointer",color:view===v?c.accent:c.muted,fontSize:9,fontWeight:600,fontFamily:"inherit",padding:"0 2px"}}>
              <Icon name={icon} size={19} color={view===v?c.accent:c.muted}/>
              <span style={{fontSize:9}}>{label}</span>
            </button>
          ))}
        </nav>
      </div>

      {/* MODAIS */}
      <Modal open={modal==="name"} onClose={()=>setModal(null)} c={c}>
        <h3 style={mhdr}>Bem-vinda(o) ao Atlas ✨</h3>
        <p style={{color:c.muted,fontSize:13,margin:"0 0 16px"}}>Como posso te chamar?</p>
        <div style={{marginBottom:14}}><input style={inp(c)} placeholder="Seu nome" value={form.name||""} onChange={setF("name")}/></div>
        <div style={{display:"flex",gap:10,marginTop:14}}><button style={btnS} onClick={()=>setModal(null)}>Pular</button><button style={btnP} onClick={submitName}>Continuar</button></div>
      </Modal>

      <Modal open={modal==="account"} onClose={()=>setModal(null)} c={c}>
        <h3 style={mhdr}>Nova conta</h3>
        <div style={{marginBottom:14}}><label style={lbl(c)}>Nome</label><input style={inp(c)} placeholder="Ex: Nubank, Carteira" value={form.accName||""} onChange={setF("accName")}/></div>
        <div style={{marginBottom:14}}><label style={lbl(c)}>Tipo</label><select style={inp(c)} value={form.accType||ACCOUNT_TYPES[0]} onChange={setF("accType")}>{ACCOUNT_TYPES.map(t=><option key={t}>{t}</option>)}</select></div>
        <div style={{marginBottom:14}}><label style={lbl(c)}>Saldo atual</label><input style={inp(c)} type="number" step="0.01" placeholder="0,00" value={form.accBalance||""} onChange={setF("accBalance")}/></div>
        <div style={{display:"flex",gap:10,marginTop:14}}><button style={btnS} onClick={()=>setModal(null)}>Cancelar</button><button style={btnP} onClick={submitAccount}>Salvar</button></div>
      </Modal>

      <Modal open={modal==="tx"} onClose={()=>setModal(null)} c={c}>
        <h3 style={mhdr}>Novo lançamento</h3>
        <Segmented c={c} value={form.txKind||"receita"} onChange={v=>setForm(f=>({...f,txKind:v,txCat:""}))} options={[{value:"receita",label:"Receita"},{value:"despesa",label:"Despesa"}]}/>
        <div style={{marginBottom:14}}><label style={lbl(c)}>Descrição</label><input style={inp(c)} placeholder='Ex: iFood, Uber, Salário...' value={form.txDesc||""} onChange={e=>{setForm(f=>{const desc=e.target.value;const cat=autoCategory(desc,f.txKind||"receita");return{...f,txDesc:desc,txCat:cat};});}}/></div>
        {form.txDesc&&<p style={{fontSize:11,color:c.accent,margin:"-10px 0 10px",display:"flex",alignItems:"center",gap:4}}><Icon name="magic" size={12} color={c.accent}/> Categoria detectada: <b>{autoCategory(form.txDesc,form.txKind||"receita")}</b></p>}
        <div style={{marginBottom:14}}><label style={lbl(c)}>Valor</label><input style={inp(c)} type="number" step="0.01" placeholder="0,00" value={form.txAmount||""} onChange={setF("txAmount")}/></div>
        <div style={{marginBottom:14}}><label style={lbl(c)}>Categoria</label><select style={inp(c)} value={form.txCat||autoCategory(form.txDesc||"",form.txKind||"receita")} onChange={setF("txCat")}>{(form.txKind==="despesa"?DESPESA_CATS:RECEITA_CATS).map(t=><option key={t}>{t}</option>)}</select></div>
        {accounts.length>0&&<div style={{marginBottom:14}}><label style={lbl(c)}>Conta</label><select style={inp(c)} value={form.txAccId||accounts[0]?.id||""} onChange={setF("txAccId")}>{accounts.map(a=><option key={a.id} value={a.id}>{a.name}</option>)}</select></div>}
        <div style={{marginBottom:14}}><label style={lbl(c)}>Data</label><input style={inp(c)} type="date" value={form.txDate||todayISO()} onChange={setF("txDate")}/></div>
        <div style={{display:"flex",gap:10,marginTop:14}}><button style={btnS} onClick={()=>setModal(null)}>Cancelar</button><button style={btnP} onClick={submitTx}>Salvar</button></div>
      </Modal>

      <Modal open={modal==="goal"} onClose={()=>setModal(null)} c={c}>
        <h3 style={mhdr}>Nova meta</h3>
        <div style={{marginBottom:14}}><label style={lbl(c)}>Nome da meta</label><input style={inp(c)} placeholder="Ex: Viagem para o Japão" value={form.gName||""} onChange={setF("gName")}/></div>
        <div style={{marginBottom:14}}><label style={lbl(c)}>Valor objetivo</label><input style={inp(c)} type="number" step="0.01" placeholder="0,00" value={form.gTarget||""} onChange={setF("gTarget")}/></div>
        <div style={{marginBottom:14}}><label style={lbl(c)}>Já guardado (opcional)</label><input style={inp(c)} type="number" step="0.01" placeholder="0,00" value={form.gSaved||""} onChange={setF("gSaved")}/></div>
        <div style={{display:"flex",gap:10,marginTop:14}}><button style={btnS} onClick={()=>setModal(null)}>Cancelar</button><button style={btnP} onClick={submitGoal}>Salvar</button></div>
      </Modal>

      <Modal open={modal==="aporte"} onClose={()=>setModal(null)} c={c}>
        <h3 style={mhdr}>Adicionar aporte</h3>
        <div style={{marginBottom:14}}><label style={lbl(c)}>Quanto deseja adicionar?</label><input style={inp(c)} type="number" step="0.01" placeholder="0,00" value={form.aporte||""} onChange={setF("aporte")}/></div>
        <div style={{display:"flex",gap:10,marginTop:14}}><button style={btnS} onClick={()=>setModal(null)}>Cancelar</button><button style={btnP} onClick={submitAporte}>Adicionar</button></div>
      </Modal>

      <Modal open={modal==="bill"} onClose={()=>setModal(null)} c={c}>
        <h3 style={mhdr}>Nova conta a pagar</h3>
        <div style={{marginBottom:14}}><label style={lbl(c)}>Nome</label><input style={inp(c)} placeholder="Ex: Aluguel, Netflix..." value={form.bName||""} onChange={setF("bName")}/></div>
        <div style={{marginBottom:14}}><label style={lbl(c)}>Valor</label><input style={inp(c)} type="number" step="0.01" placeholder="0,00" value={form.bAmount||""} onChange={setF("bAmount")}/></div>
        <div style={{marginBottom:14}}><label style={lbl(c)}>Vencimento</label><input style={inp(c)} type="date" value={form.bDue||todayISO()} onChange={setF("bDue")}/></div>
        <div style={{marginBottom:14}}><label style={lbl(c)}>Recorrência</label><select style={inp(c)} value={form.bFreq||"Única"} onChange={setF("bFreq")}>{FREQ_OPTS.map(f=><option key={f}>{f}</option>)}</select></div>
        <div style={{marginBottom:14}}><label style={lbl(c)}>Categoria</label><select style={inp(c)} value={form.bCat||DESPESA_CATS[0]} onChange={setF("bCat")}>{DESPESA_CATS.map(t=><option key={t}>{t}</option>)}</select></div>
        <div style={{display:"flex",gap:10,marginTop:14}}><button style={btnS} onClick={()=>setModal(null)}>Cancelar</button><button style={btnP} onClick={submitBill}>Salvar</button></div>
      </Modal>

      {toast&&<Toast msg={toast} onDone={()=>setToast(null)}/>}
    </div>
  );
}
