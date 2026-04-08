import { useState, useEffect, useRef, useCallback } from "react";

// ─────────────────────────────────────────────────────────────────────────────
//  STOCK RADAR — Vercel Edition
//  מחירים:  Yahoo Finance ישיר (ללא proxy — עובד על Vercel)
//  Pre/After: Finnhub חינמי
//  חדשות:   Yahoo Finance RSS ישיר
//  AI:      Claude API
// ─────────────────────────────────────────────────────────────────────────────

const FINNHUB_KEY = "d794pv9r01qp0fl76bsg";

// ── נתונים ──────────────────────────────────────────────────────────────────

const SECTORS_INIT = {
  "זיכרון ואחסון":             { color:"#a78bfa", icon:"▦", tickers:["MU","SNDK","STX","WDC"] },
  "אופטיקה ורשת":              { color:"#22d3ee", icon:"◈", tickers:["CIEN","VIAV","COHR","AAOI","LITE"] },
  "חשמל וקירור":               { color:"#f59e0b", icon:"⚡", tickers:["VRT","NVT","MOD"] },
  "חומרי גלם ומצעים":          { color:"#34d399", icon:"◉", tickers:["AXTI","TSEM"] },
  "לייזרים ורכיבים אקטיביים": { color:"#f472b6", icon:"✦", tickers:["AAOI","LITE","COHR","VIAV"] },
  "מודולוטרים ואבני בניין":    { color:"#60a5fa", icon:"◧", tickers:["CRDO","ALAB","ONDS"] },
  "סיליקון מיתוג DRS":         { color:"#4ade80", icon:"⬡", tickers:["CRDO","ALAB","AVGO"] },
  "טרנסיברים ומנועים אופטיים":{ color:"#c084fc", icon:"⟡", tickers:["CIEN","VIAV","AAOI","LITE"] },
  "מערכות מיתוג אופטי OCS":   { color:"#38bdf8", icon:"⬢", tickers:["CIEN","COHR"] },
  "אריזה מתקדמת ו-OSAT":      { color:"#fbbf24", icon:"▣", tickers:["TSEM","ALAB"] },
  "ייצור והרכבה מדויקת":       { color:"#a3e635", icon:"⊞", tickers:["MOD","NVT","VRT"] },
  "בדיקות Burn-In ותקינה":     { color:"#fb923c", icon:"◎", tickers:["AEHR"] },
  "בינה מלאכותית ופלטפורמה":  { color:"#818cf8", icon:"◑", tickers:["NVDA","PLTR","META","GOOGL","ORCL","CRWV","NBIS"] },
};

const META_INIT = {
  NVDA:{name:"NVIDIA",adv:"GPU AI מוביל עולמי, CUDA ecosystem"},
  MU:  {name:"Micron",adv:"HBM3E לאנבידיה, DRAM/NAND מגוון"},
  SNDK:{name:"SanDisk",adv:"NAND Flash ואחסון enterprise"},
  STX: {name:"Seagate",adv:"HDD HAMR קיבולת גבוהה לענן"},
  WDC: {name:"Western Digital",adv:"NAND + HDD ניהול נתונים היברידי"},
  AVGO:{name:"Broadcom",adv:"ASICs מותאמים ונטוורקינג"},
  GOOGL:{name:"Alphabet",adv:"TPU, Cloud AI, Hyperscaler"},
  META:{name:"Meta",adv:"Llama, AI infra, Social reach"},
  ORCL:{name:"Oracle",adv:"Cloud DB ו-AI workloads"},
  PLTR:{name:"Palantir",adv:"AI פלטפורמה לממשלה ועסקים"},
  CIEN:{name:"Ciena",adv:"אופטיקה 800G/1.6T, WaveLogic"},
  COHR:{name:"Coherent",adv:"לייזרים ומודולים אופטיים"},
  LITE:{name:"Lumentum",adv:"לייזרי VCSEL ו-3D sensing"},
  AAOI:{name:"AAOI",adv:"טרנסיברים data center"},
  VIAV:{name:"Viavi",adv:"בדיקות רשת OSP"},
  CRDO:{name:"Credo",adv:"AEC cables, low-power SerDes"},
  ALAB:{name:"Astera Labs",adv:"PCIe/CXL connectivity, AI fabric"},
  VRT: {name:"Vertiv",adv:"קירור נוזלי לדאטה סנטר"},
  NVT: {name:"nVent",adv:"תשתיות חשמל ואנקלוז'ר"},
  MOD: {name:"Modine",adv:"מערכות קירור תרמיות"},
  AEHR:{name:"Aehr Test",adv:"Burn-in לוופר WLP"},
  TSEM:{name:"Tower Semi",adv:"Fab analog/mixed-signal"},
  AXTI:{name:"AXT Inc",adv:"סובסטרטים GaAs/InP/Ge"},
  ONDS:{name:"Ondas",adv:"רשתות תעשייתיות IoT/Rail"},
  NBIS:{name:"Nebius",adv:"AI cloud infrastructure EU"},
  CRWV:{name:"CoreWeave",adv:"GPU cloud לAI workloads"},
};

// ── utils ────────────────────────────────────────────────────────────────────
const f   = (n,d=2) => n==null?"—":Number(n).toLocaleString("en-US",{minimumFractionDigits:d,maximumFractionDigits:d});
const fv  = v => !v||v===0?"—":v>=1e9?(v/1e9).toFixed(1)+"B":v>=1e6?(v/1e6).toFixed(1)+"M":(v/1e3).toFixed(0)+"K";
const pClr= v => v==null?"#64748b":v>0?"#34d399":v<0?"#f87171":"#94a3b8";
const todayStr = () => new Date().toISOString().split("T")[0];
const weekAgoStr= ()=>{ const d=new Date(); d.setDate(d.getDate()-7); return d.toISOString().split("T")[0]; };

function getSession(){
  const ny=new Date(new Date().toLocaleString("en-US",{timeZone:"America/New_York"}));
  const d=ny.getDay(), t=ny.getHours()*60+ny.getMinutes();
  if(d===0||d===6) return{label:"שוק סגור — סוף שבוע",color:"#475569",code:"closed"};
  if(t>=240&&t<570)  return{label:"טרום מסחר  04:00–09:30",color:"#fbbf24",code:"pre"};
  if(t>=570&&t<960)  return{label:"שוק פתוח  09:30–16:00",color:"#34d399",code:"open"};
  if(t>=960&&t<1200) return{label:"אחרי מסחר  16:00–20:00",color:"#60a5fa",code:"after"};
  return{label:"שוק סגור",color:"#475569",code:"closed"};
}

// ── API calls (ישירות — ללא proxy כי Vercel מאפשר) ──────────────────────────

// Yahoo Finance — מחיר + H/L + נפח + pre/after
async function fetchYahoo(ticker){
  try{
    const url=`https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?interval=1m&range=1d`;
    const r=await fetch(url,{signal:AbortSignal.timeout(8000)});
    if(!r.ok) throw new Error(`${r.status}`);
    const j=await r.json();
    const m=j?.chart?.result?.[0]?.meta;
    if(!m||!m.regularMarketPrice) throw new Error("no data");
    const price=m.regularMarketPrice;
    const prev =m.chartPreviousClose??m.previousClose??null;
    const chg  =price&&prev?price-prev:null;
    const chgPct=chg&&prev?(chg/prev)*100:null;
    return{
      ticker, ok:true, src:"Yahoo",
      price, prev, chg, chgPct,
      pre:  m.preMarketPrice  ??null,
      after:m.postMarketPrice ??null,
      high: m.regularMarketDayHigh??null,
      low:  m.regularMarketDayLow ??null,
      vol:  m.regularMarketVolume ??null,
      name: m.longName??m.shortName??ticker,
    };
  }catch(e){
    return{ticker,ok:false,src:null};
  }
}

// Finnhub — fallback + pre/after market בזמן אמת
async function fetchFinnhub(ticker){
  try{
    const r=await fetch(`https://finnhub.io/api/v1/quote?symbol=${ticker}&token=${FINNHUB_KEY}`,{signal:AbortSignal.timeout(7000)});
    if(!r.ok) throw new Error(`${r.status}`);
    const d=await r.json();
    if(!d.c||d.c===0) throw new Error("no data");
    return{
      ticker, ok:true, src:"Finnhub",
      price:d.c, prev:d.pc, chg:d.d, chgPct:d.dp,
      high:d.h, low:d.l, vol:null,
      pre:null, after:null,
    };
  }catch(e){
    return{ticker,ok:false,src:null};
  }
}

// מחזיר את הטוב ביותר — Yahoo קודם, אחר כך Finnhub
async function fetchQuote(ticker){
  const y=await fetchYahoo(ticker);
  if(y.ok) return y;
  const fh=await fetchFinnhub(ticker);
  return fh;
}

// חדשות Yahoo Finance RSS
async function fetchNews(tickers){
  try{
    const syms=tickers.slice(0,12).join(",");
    const url=`https://feeds.finance.yahoo.com/rss/2.0/headline?s=${syms}&region=US&lang=en-US`;
    const r=await fetch(url,{signal:AbortSignal.timeout(10000)});
    if(!r.ok) throw new Error(`${r.status}`);
    const text=await r.text();
    const doc=new DOMParser().parseFromString(text,"text/xml");
    const items=[...doc.querySelectorAll("item")].slice(0,40).map(item=>{
      const title=item.querySelector("title")?.textContent??"";
      const link =item.querySelector("link")?.textContent??"#";
      const pub  =item.querySelector("pubDate")?.textContent??"";
      const desc =item.querySelector("description")?.textContent?.replace(/<[^>]*>/g,"")??"";
      const when =pub?new Date(pub):null;
      const diff =when?Math.floor((Date.now()-when.getTime())/60000):0;
      const ago  =diff<60?`${diff}דק'`:diff<1440?`${Math.floor(diff/60)}שע'`:`${Math.floor(diff/1440)}י'`;
      const hits =tickers.filter(t=>title.toUpperCase().includes(t)||desc.toUpperCase().includes(t));
      const sent =/surge|soar|beat|win|gain|jump|rise|bull|record|rally|strong|boost/i.test(title)?"bullish"
                 :/fall|drop|miss|cut|warn|bear|decline|weak|down|loss|slide|disappoint/i.test(title)?"bearish":"neutral";
      return{title,link,ago,desc,tickers:hits,sent};
    });
    return items;
  }catch(e){ return []; }
}

// Finnhub חדשות לפי חברה
async function fetchFinnhubNews(tickers){
  const from=weekAgoStr(), to=todayStr();
  const all=[], seen=new Set();
  for(const sym of tickers.slice(0,8)){
    try{
      const r=await fetch(`https://finnhub.io/api/v1/company-news?symbol=${sym}&from=${from}&to=${to}&token=${FINNHUB_KEY}`,{signal:AbortSignal.timeout(7000)});
      const d=await r.json();
      if(Array.isArray(d)) d.forEach(n=>{
        if(!seen.has(n.id)){
          seen.add(n.id);
          const sent=/surge|soar|beat|win|gain|jump|rise|bull|record|rally|strong/i.test(n.headline)?"bullish"
                    :/fall|drop|miss|cut|warn|bear|decline|weak|down|loss|slide/i.test(n.headline)?"bearish":"neutral";
          all.push({
            title:n.headline, link:n.url, desc:n.summary||"",
            tickers:[sym], sent, ago:agoFrom(n.datetime),
            src:"Finnhub"
          });
        }
      });
    }catch(e){}
    await new Promise(r=>setTimeout(r,220));
  }
  all.sort((a,b)=>b._ts-a._ts);
  return all;
}

function agoFrom(ts){
  const diff=Math.floor((Date.now()-ts*1000)/60000);
  return diff<60?`${diff}דק'`:diff<1440?`${Math.floor(diff/60)}שע'`:`${Math.floor(diff/1440)}י'`;
}

async function claudeCall(system,user,maxT=1000){
  try{
    const r=await fetch("https://api.anthropic.com/v1/messages",{
      method:"POST",headers:{"Content-Type":"application/json"},
      body:JSON.stringify({model:"claude-sonnet-4-20250514",max_tokens:maxT,system,messages:[{role:"user",content:user}]})
    });
    const d=await r.json();
    return d.content?.[0]?.text??"";
  }catch(e){ return ""; }
}

// ── UI atoms ─────────────────────────────────────────────────────────────────
const Spin=({sz=14})=>(
  <span style={{display:"inline-block",animation:"spin .7s linear infinite",fontSize:sz,lineHeight:1}}>◌</span>
);

function Dot({color="#34d399",pulse=false}){
  return(
    <span style={{position:"relative",display:"inline-flex",width:8,height:8,flexShrink:0}}>
      {pulse&&<span style={{position:"absolute",inset:0,borderRadius:"50%",background:color,animation:"rip 1.8s ease-out infinite"}}/>}
      <span style={{position:"absolute",inset:0,borderRadius:"50%",background:color}}/>
    </span>
  );
}

function Pct({v,sm}){
  if(v==null) return <span style={{color:"#334155",fontSize:sm?9:11}}>—</span>;
  return(
    <span style={{
      display:"inline-block",padding:sm?"1px 5px":"2px 7px",borderRadius:4,
      fontWeight:800,fontSize:sm?10:12,fontVariantNumeric:"tabular-nums",
      background:v>0?"rgba(52,211,153,.12)":v<0?"rgba(248,113,113,.12)":"rgba(148,163,184,.08)",
      color:v>0?"#34d399":v<0?"#f87171":"#94a3b8",
      border:`1px solid ${v>0?"rgba(52,211,153,.22)":v<0?"rgba(248,113,113,.22)":"rgba(255,255,255,.07)"}`,
    }}>{v>0?"+":""}{f(v)}%</span>
  );
}

function SentBadge({s}){
  const m={bullish:{c:"#34d399",t:"▲ Bullish"},bearish:{c:"#f87171",t:"▼ Bearish"},neutral:{c:"#64748b",t:"◆ Neutral"}};
  const x=m[s]||m.neutral;
  return <span style={{fontSize:10,fontWeight:700,padding:"1px 6px",borderRadius:3,background:`${x.c}12`,color:x.c,border:`1px solid ${x.c}25`}}>{x.t}</span>;
}

function SessionBadge(){
  const [s,setS]=useState(getSession());
  useEffect(()=>{const id=setInterval(()=>setS(getSession()),15000);return()=>clearInterval(id);},[]);
  return(
    <span style={{display:"inline-flex",alignItems:"center",gap:6,padding:"3px 10px",borderRadius:20,
      background:`${s.color}15`,border:`1px solid ${s.color}28`,fontSize:10,fontWeight:700,color:s.color}}>
      <Dot color={s.color} pulse={s.code==="open"}/>{s.label}
    </span>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// TAB 1 — LIVE PRICES
// ════════════════════════════════════════════════════════════════════════════
function LiveTab({stocks,stockMeta,sectors}){
  const [quotes,setQuotes]=useState({});
  const [loading,setLoading]=useState(false);
  const [prog,setProg]=useState([0,0]);
  const [lastUpd,setLastUpd]=useState(null);
  const [sort,setSort]=useState("ticker");
  const [sel,setSel]=useState(null);
  const [search,setSearch]=useState("");
  const timer=useRef();
  const session=getSession();

  const load=useCallback(async()=>{
    if(loading) return;
    setLoading(true);
    const map={};
    for(let i=0;i<stocks.length;i++){
      const q=await fetchQuote(stocks[i]);
      map[q.ticker]=q;
      setProg([i+1,stocks.length]);
    }
    setQuotes(map);
    setLastUpd(new Date());
    setLoading(false);setProg([0,0]);
  },[stocks.join(",")]);

  useEffect(()=>{
    load();
    timer.current=setInterval(load,30000);
    return()=>clearInterval(timer.current);
  },[load]);

  const rows=stocks
    .filter(t=>!search||t.includes(search.toUpperCase())||(stockMeta[t]?.name||"").toLowerCase().includes(search.toLowerCase()))
    .map(t=>quotes[t]||{ticker:t,ok:false})
    .sort((a,b)=>{
      if(sort==="pct")    return(b.chgPct??-999)-(a.chgPct??-999);
      if(sort==="pctAsc") return(a.chgPct??999)-(b.chgPct??999);
      if(sort==="price")  return(b.price??0)-(a.price??0);
      return a.ticker.localeCompare(b.ticker);
    });

  const gain=rows.filter(q=>q.chgPct>0).length;
  const lose=rows.filter(q=>q.chgPct<0).length;
  const liveN=rows.filter(q=>q.ok).length;

  return(
    <div>
      {/* status */}
      <div style={{display:"flex",gap:8,marginBottom:14,flexWrap:"wrap",alignItems:"center"}}>
        <SessionBadge/>
        {liveN>0&&<>
          <span style={{fontSize:10,padding:"2px 7px",borderRadius:4,background:"rgba(52,211,153,.08)",border:"1px solid rgba(52,211,153,.18)",color:"#34d399",fontWeight:700}}>▲ {gain}</span>
          <span style={{fontSize:10,padding:"2px 7px",borderRadius:4,background:"rgba(248,113,113,.08)",border:"1px solid rgba(248,113,113,.18)",color:"#f87171",fontWeight:700}}>▼ {lose}</span>
          <span style={{fontSize:9,padding:"2px 6px",borderRadius:3,background:"rgba(34,211,238,.07)",border:"1px solid rgba(34,211,238,.15)",color:"#22d3ee"}}>🔴 {liveN}/{stocks.length} LIVE</span>
        </>}
        {loading&&prog[1]>0&&<span style={{fontSize:10,color:"#475569",display:"flex",alignItems:"center",gap:4}}><Spin sz={11}/>{prog[0]}/{prog[1]}</span>}
        <div style={{marginLeft:"auto",display:"flex",gap:7,alignItems:"center"}}>
          {lastUpd&&<span style={{fontSize:9,color:"#1e3a4a"}}>עודכן {lastUpd.toLocaleTimeString("he-IL")} · ↺30s</span>}
          <button onClick={load} disabled={loading}
            style={{padding:"3px 9px",background:"rgba(255,255,255,.04)",border:"1px solid rgba(255,255,255,.09)",borderRadius:4,color:"#475569",cursor:"pointer",fontSize:10,fontWeight:700}}>
            {loading?<Spin sz={11}/>:"↺"}
          </button>
        </div>
      </div>

      {/* controls */}
      <div style={{display:"flex",gap:6,marginBottom:10,flexWrap:"wrap",alignItems:"center"}}>
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="חיפוש..."
          style={{padding:"5px 9px",background:"rgba(255,255,255,.04)",border:"1px solid rgba(255,255,255,.08)",borderRadius:4,color:"#f1f5f9",fontSize:11,width:110}}/>
        {[["ticker","ABC"],["pct","▲ עולים"],["pctAsc","▼ יורדים"],["price","מחיר"]].map(([k,l])=>(
          <button key={k} onClick={()=>setSort(k)} style={{
            padding:"4px 9px",borderRadius:4,cursor:"pointer",fontSize:10,fontWeight:700,
            background:sort===k?"rgba(34,211,238,.1)":"transparent",
            border:`1px solid ${sort===k?"rgba(34,211,238,.28)":"rgba(255,255,255,.07)"}`,
            color:sort===k?"#22d3ee":"#475569",
          }}>{l}</button>
        ))}
      </div>

      {/* col headers */}
      <div style={{display:"grid",gridTemplateColumns:"100px 1fr 95px 82px 74px 58px 62px",gap:6,
        padding:"4px 12px",borderBottom:"1px solid rgba(255,255,255,.05)",marginBottom:2}}>
        {["מניה","סקטורים","מחיר","שינוי $","%","H/L","נפח"].map((h,i)=>(
          <div key={i} style={{fontSize:9,color:"#1e3a4a",fontWeight:700,textAlign:i>=2?"right":"left"}}>{h}</div>
        ))}
      </div>

      {/* rows */}
      <div style={{background:"rgba(255,255,255,.015)",border:"1px solid rgba(255,255,255,.06)",borderRadius:8,overflow:"hidden"}}>
        {!lastUpd&&loading?(
          <div style={{textAlign:"center",padding:60,color:"#334155"}}>
            <div style={{marginBottom:10,fontSize:28}}><Spin sz={28}/></div>
            <div style={{fontSize:12}}>טוען מחירים מ-Yahoo Finance...</div>
            {prog[1]>0&&<div style={{fontSize:10,marginTop:4,color:"#1e3a4a"}}>{prog[0]}/{prog[1]}</div>}
          </div>
        ):rows.map((q,idx)=>{
          const open=sel===q.ticker;
          const secs=Object.entries(sectors).filter(([,v])=>v.tickers.includes(q.ticker));
          const extPrice=session.code==="pre"?q.pre:session.code==="after"?q.after:null;
          const extLabel=session.code==="pre"?"PRE":"AH";
          const extColor=session.code==="pre"?"#fbbf24":"#60a5fa";
          return(
            <div key={q.ticker}>
              <div onClick={()=>setSel(open?null:q.ticker)}
                style={{display:"grid",gridTemplateColumns:"100px 1fr 95px 82px 74px 58px 62px",gap:6,
                  padding:"9px 12px",cursor:"pointer",alignItems:"center",
                  background:open?"rgba(34,211,238,.05)":idx%2?"rgba(255,255,255,.01)":"transparent",
                  borderBottom:"1px solid rgba(255,255,255,.03)",transition:"background .1s"}}
                onMouseEnter={e=>{if(!open)e.currentTarget.style.background="rgba(255,255,255,.04)";}}
                onMouseLeave={e=>{if(!open)e.currentTarget.style.background=idx%2?"rgba(255,255,255,.01)":"transparent";}}>

                {/* ticker + name */}
                <div>
                  <div style={{display:"flex",alignItems:"center",gap:5}}>
                    <span style={{fontSize:13,fontWeight:900,color:open?"#22d3ee":"#f1f5f9",letterSpacing:.8}}>{q.ticker}</span>
                    {q.ok&&<span style={{width:5,height:5,borderRadius:"50%",background:q.src==="Yahoo"?"#34d399":"#22d3ee",display:"inline-block"}} title={q.src}/>}
                  </div>
                  <div style={{fontSize:9,color:"#1e3a4a",marginTop:1,maxWidth:90,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
                    {stockMeta[q.ticker]?.name||q.name||""}
                  </div>
                </div>

                {/* sectors */}
                <div style={{display:"flex",gap:3,flexWrap:"wrap"}}>
                  {secs.slice(0,4).map(([nm,d])=><span key={nm} title={nm} style={{fontSize:11,color:d.color}}>{d.icon}</span>)}
                </div>

                {/* price */}
                <div style={{textAlign:"right"}}>
                  {q.ok?(
                    <>
                      <div style={{fontSize:13,fontWeight:700,color:"#f1f5f9",fontVariantNumeric:"tabular-nums"}}>${f(q.price)}</div>
                      {extPrice!=null&&<div style={{fontSize:9,fontWeight:700,color:extColor}}>{extLabel} ${f(extPrice)}</div>}
                    </>
                  ):<div style={{fontSize:10,color:"#1e3a4a"}}>—</div>}
                </div>

                {/* chg $ */}
                <div style={{textAlign:"right",fontSize:12,fontWeight:700,color:pClr(q.chg),fontVariantNumeric:"tabular-nums"}}>
                  {q.chg!=null?`${q.chg>0?"+":""}${f(q.chg)}`:"—"}
                </div>

                {/* % */}
                <div style={{textAlign:"right"}}><Pct v={q.chgPct}/></div>

                {/* H/L */}
                <div style={{textAlign:"right",fontSize:9,lineHeight:1.5}}>
                  {q.high!=null&&<div style={{color:"rgba(52,211,153,.6)"}}>${f(q.high)}</div>}
                  {q.low !=null&&<div style={{color:"rgba(248,113,113,.6)"}}>${f(q.low)}</div>}
                </div>

                {/* vol */}
                <div style={{textAlign:"right",fontSize:10,color:"#334155"}}>{fv(q.vol)}</div>
              </div>

              {/* expanded */}
              {open&&(
                <div style={{padding:"12px 14px",background:"rgba(34,211,238,.04)",borderBottom:"1px solid rgba(34,211,238,.08)"}}>
                  <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(115px,1fr))",gap:7,marginBottom:8}}>
                    {[
                      ["מחיר נוכחי", q.price!=null?`$${f(q.price)}`:null, "#f1f5f9"],
                      ["שינוי $",    q.chg!=null?`${q.chg>0?"+":""}${f(q.chg)}`:null, pClr(q.chg)],
                      ["% יומי",     q.chgPct!=null?`${q.chgPct>0?"+":""}${f(q.chgPct)}%`:null, pClr(q.chgPct)],
                      ["סגירה קודמת",q.prev!=null?`$${f(q.prev)}`:null, "#94a3b8"],
                      q.high!=null?["יומי גבוה",`$${f(q.high)}`,"rgba(52,211,153,.8)"]:null,
                      q.low !=null?["יומי נמוך", `$${f(q.low)}`, "rgba(248,113,113,.8)"]:null,
                      q.pre !=null?["טרום מסחר", `$${f(q.pre)}`,  "#fbbf24"]:null,
                      q.after!=null?["אחרי מסחר",`$${f(q.after)}`,"#60a5fa"]:null,
                      q.vol!=null?["נפח", fv(q.vol), "#64748b"]:null,
                    ].filter(Boolean).filter(x=>x[1]!=null).map(([lb,val,c])=>(
                      <div key={lb} style={{padding:"7px 9px",background:"rgba(0,0,0,.25)",borderRadius:5}}>
                        <div style={{fontSize:8,color:"#334155",letterSpacing:.5,marginBottom:2}}>{lb}</div>
                        <div style={{fontSize:13,fontWeight:700,color:c,fontVariantNumeric:"tabular-nums"}}>{val}</div>
                      </div>
                    ))}
                  </div>
                  <div style={{display:"flex",gap:8,alignItems:"center",fontSize:9,color:"#334155"}}>
                    <span>מקור: {q.src||"—"}</span>
                  </div>
                  {stockMeta[q.ticker]?.adv&&(
                    <div style={{marginTop:8,fontSize:11,color:"#475569",direction:"rtl",textAlign:"right"}}>💡 {stockMeta[q.ticker].adv}</div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div style={{marginTop:7,fontSize:9,color:"#1e3a4a",textAlign:"center"}}>
        Yahoo Finance + Finnhub · עיכוב עד 15 דק' · מתרענן כל 30 שניות
        · ● ירוק = Yahoo · ● כחול = Finnhub
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// TAB 2 — NEWS
// ════════════════════════════════════════════════════════════════════════════
function NewsTab({stocks}){
  const [news,setNews]=useState([]);
  const [loading,setLoading]=useState(false);
  const [lastUpd,setLastUpd]=useState(null);
  const [src,setSrc]=useState("");
  const [sent,setSent]=useState("all");
  const [tickF,setTickF]=useState("");

  const load=useCallback(async()=>{
    if(loading) return;
    setLoading(true);
    // נסה Yahoo RSS קודם, אחר כך Finnhub
    let items=await fetchNews(stocks);
    let source="Yahoo Finance RSS";
    if(items.length===0){
      items=await fetchFinnhubNews(stocks);
      source="Finnhub Company News";
    }
    if(items.length>0){
      setNews(items);setSrc(source);setLastUpd(new Date());
    }
    setLoading(false);
  },[stocks.join(",")]);

  useEffect(()=>{load();const id=setInterval(load,120000);return()=>clearInterval(id);},[load]);

  const filtered=news.filter(n=>{
    if(sent!=="all"&&n.sent!==sent) return false;
    if(tickF&&!n.tickers.some(t=>t.includes(tickF.toUpperCase()))&&!n.title.toLowerCase().includes(tickF.toLowerCase())) return false;
    return true;
  });

  return(
    <div>
      <div style={{display:"flex",gap:6,marginBottom:14,flexWrap:"wrap",alignItems:"center"}}>
        <div style={{display:"flex",gap:4}}>
          {[["all","הכל"],["bullish","▲ Bullish"],["bearish","▼ Bearish"],["neutral","◆"]].map(([k,l])=>(
            <button key={k} onClick={()=>setSent(k)} style={{
              padding:"4px 9px",borderRadius:4,cursor:"pointer",fontSize:10,fontWeight:700,
              background:sent===k?(k==="bullish"?"rgba(52,211,153,.1)":k==="bearish"?"rgba(248,113,113,.1)":"rgba(255,255,255,.07)"):"transparent",
              border:`1px solid ${sent===k?(k==="bullish"?"rgba(52,211,153,.3)":k==="bearish"?"rgba(248,113,113,.3)":"rgba(255,255,255,.15)"):"rgba(255,255,255,.07)"}`,
              color:sent===k?(k==="bullish"?"#34d399":k==="bearish"?"#f87171":"#f1f5f9"):"#475569",
            }}>{l}</button>
          ))}
        </div>
        <input value={tickF} onChange={e=>setTickF(e.target.value)} placeholder="סנן לפי טיקר/מילה"
          style={{padding:"4px 8px",background:"rgba(255,255,255,.04)",border:"1px solid rgba(255,255,255,.08)",borderRadius:4,color:"#f1f5f9",fontSize:10,width:130}}/>
        <div style={{marginLeft:"auto",display:"flex",gap:7,alignItems:"center"}}>
          {lastUpd&&<span style={{fontSize:9,color:"#1e3a4a"}}>עודכן {lastUpd.toLocaleTimeString("he-IL")}</span>}
          <button onClick={load} disabled={loading}
            style={{padding:"4px 9px",background:"rgba(255,255,255,.04)",border:"1px solid rgba(255,255,255,.08)",borderRadius:4,color:"#475569",cursor:"pointer",fontSize:10,fontWeight:700}}>
            {loading?<Spin sz={11}/>:"↺ רענן"}
          </button>
        </div>
      </div>

      {loading&&news.length===0&&(
        <div style={{textAlign:"center",padding:50,color:"#334155"}}>
          <div style={{marginBottom:8,fontSize:26}}><Spin sz={26}/></div>
          <div style={{fontSize:11}}>שואב חדשות...</div>
        </div>
      )}
      {!loading&&filtered.length===0&&(
        <div style={{textAlign:"center",padding:30,color:"#334155",fontSize:11}}>אין חדשות תואמות</div>
      )}

      {filtered.map((item,i)=>{
        const bc=item.sent==="bullish"?"#34d399":item.sent==="bearish"?"#f87171":"#64748b";
        return(
          <a key={i} href={item.link} target="_blank" rel="noopener noreferrer"
            style={{display:"block",textDecoration:"none",
              background:"rgba(255,255,255,.02)",border:"1px solid rgba(255,255,255,.065)",
              borderLeft:`3px solid ${bc}`,borderRadius:7,padding:"11px 13px",marginBottom:7,transition:"background .12s"}}
            onMouseEnter={e=>e.currentTarget.style.background="rgba(255,255,255,.045)"}
            onMouseLeave={e=>e.currentTarget.style.background="rgba(255,255,255,.02)"}>
            <div style={{fontSize:13,fontWeight:600,color:"#e2e8f0",lineHeight:1.45,marginBottom:6}}>{item.title}</div>
            {item.desc&&<div style={{fontSize:11,color:"#475569",marginBottom:6,lineHeight:1.5,
              display:"-webkit-box",WebkitLineClamp:2,WebkitBoxOrient:"vertical",overflow:"hidden"}}>{item.desc}</div>}
            <div style={{display:"flex",gap:7,flexWrap:"wrap",alignItems:"center",fontSize:10}}>
              <SentBadge s={item.sent}/>
              {item.tickers.map(t=>(
                <span key={t} style={{padding:"1px 6px",borderRadius:3,background:"rgba(255,255,255,.07)",border:"1px solid rgba(255,255,255,.12)",fontWeight:800,color:"#e2e8f0",letterSpacing:.5}}>{t}</span>
              ))}
              <span style={{color:"#334155"}}>{item.src||"Yahoo Finance"}</span>
              <span style={{color:"#1e3a4a"}}>· {item.ago}</span>
              <span style={{marginLeft:"auto",color:"#1e3a4a"}}>↗ קרא</span>
            </div>
          </a>
        );
      })}
      {src&&<div style={{marginTop:7,fontSize:9,color:"#1e3a4a",textAlign:"center"}}>{src} · מתרענן כל 2 דקות</div>}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// TAB 3 — SECTORS
// ════════════════════════════════════════════════════════════════════════════
function SectorsTab({stocks,sectors,setSectors,stockMeta,setStockMeta,setStocks}){
  return(
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(300px,1fr))",gap:10}}>
      {Object.entries(sectors).map(([name,data])=>(
        <SectorCard key={name} name={name} data={data} allStocks={stocks}
          onAdd={(ticker,meta)=>{
            if(!stocks.includes(ticker)) setStocks(p=>[...p,ticker]);
            setStockMeta(p=>({...p,[ticker]:meta}));
            setSectors(p=>({...p,[name]:{...p[name],tickers:[...p[name].tickers.filter(t=>t!==ticker),ticker]}}));
          }}/>
      ))}
    </div>
  );
}

function SectorCard({name,data,allStocks,onAdd}){
  const [disc,setDisc]=useState(false);
  const [found,setFound]=useState([]);
  const present=data.tickers.filter(t=>allStocks.includes(t));

  const discover=async()=>{
    setDisc(true);
    const sys=`Return ONLY valid JSON array no markdown: [{"ticker":"XXXX","name":"Co","adv":"Hebrew adv","reason":"Hebrew reason"}] — 3-5 US stocks, exclude: ${allStocks.join(",")}`;
    const txt=await claudeCall(sys,`Sector: "${name}"`);
    try{const m=txt.match(/\[[\s\S]*\]/);setFound(m?JSON.parse(m[0]):[]);}
    catch(e){setFound([]);}
    setDisc(false);
  };

  return(
    <div style={{background:"rgba(255,255,255,.02)",border:`1px solid ${data.color}18`,borderTop:`2px solid ${data.color}`,borderRadius:8,overflow:"hidden"}}>
      <div style={{padding:"13px 14px"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:9}}>
          <div style={{display:"flex",alignItems:"center",gap:7}}>
            <span style={{color:data.color,fontSize:16}}>{data.icon}</span>
            <span style={{fontSize:11,fontWeight:700,color:"#e2e8f0"}}>{name}</span>
            <span style={{fontSize:9,color:"#1e3a4a"}}>{present.length}</span>
          </div>
          <button onClick={discover} disabled={disc} style={{
            padding:"3px 8px",borderRadius:4,cursor:disc?"wait":"pointer",fontSize:9,fontWeight:700,
            background:disc?"rgba(255,255,255,.03)":`${data.color}12`,
            border:`1px solid ${disc?"rgba(255,255,255,.07)":data.color+"35"}`,
            color:disc?"#334155":data.color,display:"flex",alignItems:"center",gap:4}}>
            {disc?<><Spin sz={9}/> סורק...</>:"◉ גלה עוד"}
          </button>
        </div>
        <div style={{display:"flex",flexWrap:"wrap",gap:5}}>
          {present.map(t=>(
            <span key={t} style={{padding:"2px 7px",borderRadius:3,background:"rgba(255,255,255,.05)",border:"1px solid rgba(255,255,255,.1)",fontSize:10,fontWeight:800,color:"#cbd5e1",letterSpacing:.5}}>{t}</span>
          ))}
        </div>
      </div>
      {found.length>0&&(
        <div style={{borderTop:`1px solid ${data.color}18`,padding:"10px 13px",background:"rgba(0,0,0,.18)"}}>
          <div style={{fontSize:9,color:data.color,fontWeight:700,letterSpacing:.8,marginBottom:8}}>★ נמצאו — לחץ להוספה</div>
          {found.map(item=>(
            <div key={item.ticker} style={{display:"flex",gap:8,alignItems:"flex-start",padding:"7px 9px",background:"rgba(255,255,255,.025)",border:"1px solid rgba(255,255,255,.06)",borderRadius:5,marginBottom:5}}>
              <div style={{flex:1}}>
                <div style={{display:"flex",gap:7,alignItems:"baseline",marginBottom:2}}>
                  <span style={{fontSize:11,fontWeight:900,color:"#34d399",letterSpacing:.8}}>{item.ticker}</span>
                  <span style={{fontSize:9,color:"#475569"}}>{item.name}</span>
                </div>
                <div style={{fontSize:10,color:"#94a3b8",marginBottom:1}}>{item.adv}</div>
                <div style={{fontSize:9,color:"#475569"}}>{item.reason}</div>
              </div>
              <button onClick={()=>{onAdd(item.ticker,{name:item.name,adv:item.adv});setFound(p=>p.filter(f=>f.ticker!==item.ticker));}}
                style={{padding:"3px 8px",background:"rgba(52,211,153,.1)",border:"1px solid rgba(52,211,153,.25)",borderRadius:4,color:"#34d399",cursor:"pointer",fontSize:9,fontWeight:700,whiteSpace:"nowrap"}}>+הוסף</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// TAB 4 — COMPARE
// ════════════════════════════════════════════════════════════════════════════
function CompareTab({stocks,sectors,stockMeta}){
  const [sel,setSel]=useState([]);
  const [res,setRes]=useState(null);
  const [loading,setLoading]=useState(false);
  const toggle=t=>setSel(p=>p.includes(t)?p.filter(x=>x!==t):p.length<4?[...p,t]:p);

  const run=async()=>{
    if(sel.length<2) return;
    setLoading(true);setRes(null);
    const sn=Object.entries(sectors).find(([,v])=>sel.every(t=>v.tickers.includes(t)))?.[0]
           ||Object.entries(sectors).find(([,v])=>sel.some(t=>v.tickers.includes(t)))?.[0]||"General";
    const sys=`Financial analyst. Return ONLY valid JSON: {"items":[{"ticker":"X","strength":"Hebrew","weakness":"Hebrew","bestFor":"Hebrew","score":7}],"verdict":"Hebrew 2 sentences"}`;
    const txt=await claudeCall(sys,`Compare ${sel.join(",")} sector: ${sn}`);
    try{const m=txt.match(/\{[\s\S]*\}/);setRes(m?JSON.parse(m[0]):null);}
    catch(e){setRes(null);}
    setLoading(false);
  };

  if(res) return(
    <div>
      <button onClick={()=>{setRes(null);setSel([]);}} style={{marginBottom:12,padding:"5px 11px",background:"rgba(255,255,255,.04)",border:"1px solid rgba(255,255,255,.09)",borderRadius:4,color:"#64748b",cursor:"pointer",fontSize:10}}>← חזור</button>
      <div style={{display:"grid",gridTemplateColumns:`repeat(${res.items?.length||2},1fr)`,gap:10,marginBottom:12}}>
        {(res.items||[]).map(item=>(
          <div key={item.ticker} style={{padding:"14px 13px",background:"rgba(255,255,255,.025)",border:"1px solid rgba(255,255,255,.07)",borderRadius:8}}>
            <div style={{fontSize:20,fontWeight:900,color:"#f1f5f9",letterSpacing:1.5,marginBottom:4}}>{item.ticker}</div>
            <div style={{display:"flex",gap:2,marginBottom:10}}>
              {Array.from({length:10}).map((_,i)=><div key={i} style={{flex:1,height:3,borderRadius:1,background:i<item.score?"#22d3ee":"rgba(255,255,255,.07)"}}/>)}
            </div>
            {[["STRENGTH","#34d399",item.strength],["WEAKNESS","#f87171",item.weakness],["BEST FOR","#fbbf24",item.bestFor]].map(([lb,c,v])=>(
              <div key={lb} style={{marginBottom:7}}>
                <div style={{fontSize:8,color:c,fontWeight:700,letterSpacing:.8,marginBottom:2}}>{lb}</div>
                <div style={{fontSize:11,color:"#cbd5e1",direction:"rtl",textAlign:"right",lineHeight:1.5}}>{v}</div>
              </div>
            ))}
          </div>
        ))}
      </div>
      <div style={{padding:"12px 14px",background:"rgba(34,211,238,.05)",border:"1px solid rgba(34,211,238,.18)",borderRadius:7,fontSize:12,color:"#94a3b8",direction:"rtl",textAlign:"right",lineHeight:1.7}}>{res.verdict}</div>
    </div>
  );

  return(
    <div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12,flexWrap:"wrap",gap:8}}>
        <span style={{fontSize:10,color:"#334155"}}>בחר 2–4 מניות להשוואה עם AI</span>
        {sel.length>=2&&(
          <button onClick={run} disabled={loading} style={{padding:"6px 15px",background:"#22d3ee",border:"none",borderRadius:5,color:"#000",fontWeight:800,cursor:"pointer",fontSize:11}}>
            {loading?<Spin/>:"השווה ▶"}
          </button>
        )}
      </div>
      {sel.length>0&&(
        <div style={{display:"flex",gap:5,marginBottom:10,flexWrap:"wrap"}}>
          {sel.map(t=>(
            <span key={t} style={{display:"inline-flex",alignItems:"center",gap:5,padding:"3px 8px",background:"rgba(34,211,238,.1)",border:"1px solid rgba(34,211,238,.28)",borderRadius:4,fontSize:11,fontWeight:800,color:"#22d3ee"}}>
              {t}<span onClick={()=>toggle(t)} style={{cursor:"pointer",color:"#475569"}}>✕</span>
            </span>
          ))}
        </div>
      )}
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(105px,1fr))",gap:6}}>
        {stocks.map(t=>{
          const isSel=sel.includes(t);
          const secs=Object.entries(sectors).filter(([,v])=>v.tickers.includes(t));
          return(
            <div key={t} onClick={()=>toggle(t)} style={{padding:"9px 10px",borderRadius:6,cursor:"pointer",
              background:isSel?"rgba(34,211,238,.09)":"rgba(255,255,255,.02)",
              border:`1px solid ${isSel?"rgba(34,211,238,.32)":"rgba(255,255,255,.06)"}`,transition:"all .12s"}}>
              <div style={{fontSize:13,fontWeight:900,color:isSel?"#22d3ee":"#f1f5f9",letterSpacing:.8}}>{t}</div>
              <div style={{fontSize:9,color:"#1e3a4a",marginTop:1}}>{stockMeta[t]?.name||""}</div>
              <div style={{display:"flex",gap:2,marginTop:4}}>{secs.slice(0,3).map(([,d])=><span key={d.icon} style={{fontSize:9,color:d.color}}>{d.icon}</span>)}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// TAB 5 — AI
// ════════════════════════════════════════════════════════════════════════════
function AITab({stocks,sectors}){
  const [input,setInput]=useState("");
  const [history,setHistory]=useState([]);
  const [loading,setLoading]=useState(false);
  const bottomRef=useRef();

  const SUGG=["מה ההבדל בין MU ל-SNDK?","מניות שירוויחו מביקוש ל-AI?","קטליסטים לסקטור אופטיקה?","השווה VRT ו-NVT","supply chain של NVIDIA?"];

  const send=async q=>{
    const question=q||input.trim();
    if(!question) return;
    setInput("");
    setHistory(h=>[...h,{role:"user",text:question}]);
    setLoading(true);
    const sys=`אנליסט פיננסי מומחה. מניות: ${stocks.join(",")}. סקטורים: ${Object.keys(sectors).join(",")}. ענה עברית, נקודות קצרות, טיקרים ב-CAPS.`;
    const txt=await claudeCall(sys,question);
    setHistory(h=>[...h,{role:"ai",text:txt}]);
    setLoading(false);
    setTimeout(()=>bottomRef.current?.scrollIntoView({behavior:"smooth"}),100);
  };

  return(
    <div style={{display:"flex",flexDirection:"column",gap:10}}>
      {history.length===0&&(
        <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
          {SUGG.map((s,i)=>(
            <button key={i} onClick={()=>send(s)} style={{padding:"5px 10px",background:"rgba(129,140,248,.07)",border:"1px solid rgba(129,140,248,.18)",borderRadius:5,color:"#818cf8",cursor:"pointer",fontSize:11,direction:"rtl"}}
              onMouseEnter={e=>e.currentTarget.style.background="rgba(129,140,248,.14)"}
              onMouseLeave={e=>e.currentTarget.style.background="rgba(129,140,248,.07)"}>{s}</button>
          ))}
        </div>
      )}
      <div style={{display:"flex",flexDirection:"column",gap:7,maxHeight:440,overflowY:"auto"}}>
        {history.map((m,i)=>(
          <div key={i} style={{padding:"9px 12px",borderRadius:7,maxWidth:"88%",
            background:m.role==="user"?"rgba(34,211,238,.06)":"rgba(129,140,248,.06)",
            border:`1px solid ${m.role==="user"?"rgba(34,211,238,.14)":"rgba(129,140,248,.14)"}`,
            alignSelf:m.role==="user"?"flex-end":"flex-start"}}>
            <div style={{fontSize:8,color:m.role==="user"?"#22d3ee":"#818cf8",fontWeight:700,marginBottom:3}}>
              {m.role==="user"?"YOU":"AI ANALYST ◑"}
            </div>
            <div style={{fontSize:12,color:"#cbd5e1",lineHeight:1.7,direction:"rtl",textAlign:"right",whiteSpace:"pre-wrap"}}>{m.text}</div>
          </div>
        ))}
        {loading&&(
          <div style={{padding:"9px 12px",borderRadius:7,background:"rgba(129,140,248,.06)",border:"1px solid rgba(129,140,248,.14)",alignSelf:"flex-start"}}>
            <div style={{fontSize:8,color:"#818cf8",fontWeight:700,marginBottom:3}}>AI ANALYST ◑</div>
            <Spin/>
          </div>
        )}
        <div ref={bottomRef}/>
      </div>
      <div style={{display:"flex",gap:7}}>
        <input value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>e.key==="Enter"&&send()}
          placeholder="שאל על מניה, סקטור, קטליסט..."
          style={{flex:1,padding:"8px 11px",background:"rgba(255,255,255,.04)",border:"1px solid rgba(255,255,255,.09)",borderRadius:5,color:"#f1f5f9",fontSize:12,direction:"rtl"}}/>
        <button onClick={()=>send()} disabled={loading||!input.trim()} style={{
          padding:"8px 17px",background:loading||!input.trim()?"rgba(129,140,248,.15)":"#818cf8",
          border:"none",borderRadius:5,color:loading||!input.trim()?"#334155":"#fff",
          fontWeight:800,cursor:loading||!input.trim()?"not-allowed":"pointer",fontSize:11}}>
          {loading?<Spin/>:"שלח"}
        </button>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// TAB 6 — MANAGE
// ════════════════════════════════════════════════════════════════════════════
function ManageTab({stocks,sectors,stockMeta,added,onAdd,onRemove}){
  const [input,setInput]=useState("");
  const [checking,setChecking]=useState(false);
  const [validated,setValidated]=useState(null);
  const [err,setErr]=useState("");

  const check=async()=>{
    const t=input.trim().toUpperCase();
    if(!t){setErr("הכנס טיקר");return;}
    if(stocks.includes(t)){setErr(`${t} כבר קיים`);return;}
    setChecking(true);setErr("");setValidated(null);
    const q=await fetchQuote(t);
    setChecking(false);
    if(q.ok) setValidated(q);
    else setErr(`"${t}" לא נמצא — בדוק את הסימול`);
  };

  const confirm=()=>{
    if(!validated) return;
    onAdd(validated.ticker,validated.name||validated.ticker);
    setInput("");setValidated(null);setErr("");
  };

  return(
    <div>
      <div style={{padding:"16px",background:"rgba(34,211,238,.04)",border:"1px solid rgba(34,211,238,.14)",borderRadius:9,marginBottom:18}}>
        <div style={{fontSize:12,fontWeight:700,color:"#22d3ee",marginBottom:3}}>הוסף טיקר</div>
        <div style={{fontSize:10,color:"#334155",marginBottom:10}}>נבדק ב-Yahoo Finance בזמן אמת</div>
        <div style={{display:"flex",gap:7,flexWrap:"wrap",marginBottom:8}}>
          <input value={input} onChange={e=>{setInput(e.target.value.toUpperCase());setErr("");setValidated(null);}}
            onKeyDown={e=>e.key==="Enter"&&check()}
            placeholder="MRVL, ARM, SMCI..."
            style={{padding:"7px 11px",background:"rgba(255,255,255,.06)",border:"1px solid rgba(255,255,255,.11)",borderRadius:5,color:"#f1f5f9",fontSize:13,fontWeight:800,letterSpacing:1.5,width:155}}/>
          <button onClick={check} disabled={checking||!input.trim()} style={{padding:"7px 14px",background:"#22d3ee",border:"none",borderRadius:5,color:"#000",fontWeight:800,cursor:"pointer",fontSize:11,opacity:!input.trim()?0.4:1}}>
            {checking?<Spin/>:"בדוק ↗"}
          </button>
          {validated&&<button onClick={confirm} style={{padding:"7px 14px",background:"#34d399",border:"none",borderRadius:5,color:"#000",fontWeight:800,cursor:"pointer",fontSize:11}}>✓ הוסף {validated.ticker}</button>}
        </div>
        {err&&<div style={{fontSize:11,color:"#f87171",marginBottom:6}}>{err}</div>}
        {validated&&(
          <div style={{display:"inline-flex",gap:10,padding:"7px 11px",background:"rgba(52,211,153,.08)",border:"1px solid rgba(52,211,153,.2)",borderRadius:5,alignItems:"center"}}>
            <span style={{fontSize:13,fontWeight:900,color:"#34d399",letterSpacing:1}}>{validated.ticker}</span>
            <span style={{fontSize:11,color:"#64748b"}}>{validated.name}</span>
            <span style={{fontSize:12,fontWeight:700,color:"#f1f5f9"}}>${f(validated.price)}</span>
            <Pct v={validated.chgPct} sm/>
          </div>
        )}
      </div>

      {added.length>0&&(
        <div style={{marginBottom:14,padding:"11px 13px",background:"rgba(52,211,153,.04)",border:"1px solid rgba(52,211,153,.13)",borderRadius:7}}>
          <div style={{fontSize:9,color:"#34d399",fontWeight:700,marginBottom:7}}>★ נוספו ע"י המשתמש ({added.length})</div>
          <div style={{display:"flex",gap:5,flexWrap:"wrap"}}>
            {added.map(t=>(
              <span key={t} style={{display:"inline-flex",alignItems:"center",gap:5,padding:"2px 7px",background:"rgba(52,211,153,.1)",border:"1px solid rgba(52,211,153,.22)",borderRadius:4,fontSize:10,fontWeight:800,color:"#34d399"}}>
                {t}<span onClick={()=>onRemove(t)} style={{cursor:"pointer",color:"#475569",fontSize:11}}>✕</span>
              </span>
            ))}
          </div>
        </div>
      )}

      <div style={{fontSize:9,color:"#1e3a4a",marginBottom:8}}>כל המניות ({stocks.length})</div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(105px,1fr))",gap:5}}>
        {stocks.map(t=>{
          const secs=Object.entries(sectors).filter(([,v])=>v.tickers.includes(t));
          const isNew=added.includes(t);
          return(
            <div key={t} style={{padding:"8px 10px",borderRadius:5,
              background:isNew?"rgba(52,211,153,.05)":"rgba(255,255,255,.02)",
              border:`1px solid ${isNew?"rgba(52,211,153,.15)":"rgba(255,255,255,.055)"}`}}>
              <div style={{fontSize:12,fontWeight:900,color:isNew?"#34d399":"#e2e8f0",letterSpacing:.8}}>{t}</div>
              <div style={{fontSize:8,color:"#1e3a4a",marginTop:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{stockMeta[t]?.name||""}</div>
              <div style={{display:"flex",gap:2,marginTop:4}}>{secs.slice(0,3).map(([,d])=><span key={d.icon} style={{fontSize:9,color:d.color}}>{d.icon}</span>)}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// ROOT
// ════════════════════════════════════════════════════════════════════════════
export default function App(){
  const [stocks,setStocks]       = useState(Object.keys(META_INIT));
  const [stockMeta,setStockMeta] = useState({...META_INIT});
  const [sectors,setSectors]     = useState({...SECTORS_INIT});
  const [added,setAdded]         = useState([]);
  const [tab,setTab]             = useState("live");

  const onAdd=(ticker,name)=>{
    if(!stocks.includes(ticker)){
      setStocks(p=>[...p,ticker]);
      setAdded(p=>[...p,ticker]);
      setStockMeta(p=>({...p,[ticker]:{name,adv:""}}));
    }
  };
  const onRemove=t=>{setStocks(p=>p.filter(x=>x!==t));setAdded(p=>p.filter(x=>x!==t));};

  const TABS=[
    {id:"live",    icon:"⚡", label:"לייב"},
    {id:"news",    icon:"📡", label:"חדשות"},
    {id:"sectors", icon:"⬡",  label:"סקטורים"},
    {id:"compare", icon:"⚖️", label:"השוואה"},
    {id:"ai",      icon:"◑",  label:"AI"},
    {id:"manage",  icon:"⚙",  label:"ניהול"},
  ];

  return(
    <div style={{minHeight:"100vh",background:"#060a10",color:"#e2e8f0",fontFamily:"'Courier New','Consolas',monospace"}}>
      <div style={{background:"#080c15",borderBottom:"1px solid rgba(255,255,255,.07)",position:"sticky",top:0,zIndex:60,backdropFilter:"blur(12px)"}}>
        <div style={{maxWidth:1200,margin:"0 auto",padding:"0 16px"}}>
          <div style={{display:"flex",alignItems:"center",height:50,gap:12}}>
            <div style={{display:"flex",alignItems:"center",gap:8}}>
              <div style={{width:28,height:28,borderRadius:6,background:"linear-gradient(135deg,#22d3ee,#818cf8)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,fontWeight:900,color:"#000"}}>R</div>
              <span style={{fontSize:15,fontWeight:900,letterSpacing:3.5,color:"#f1f5f9"}}>RADAR</span>
            </div>
            <SessionBadge/>
            <div style={{marginLeft:"auto",display:"flex",gap:6,alignItems:"center"}}>
              <span style={{fontSize:9,color:"#1e3a4a",padding:"2px 6px",background:"rgba(255,255,255,.03)",border:"1px solid rgba(255,255,255,.06)",borderRadius:3}}>{stocks.length} tickers</span>
              <span style={{fontSize:9,padding:"2px 6px",background:"rgba(34,211,238,.07)",border:"1px solid rgba(34,211,238,.18)",borderRadius:3,color:"#22d3ee",fontWeight:700}}>Yahoo + Finnhub</span>
            </div>
          </div>
          <div style={{display:"flex",gap:0}}>
            {TABS.map(t=>(
              <button key={t.id} onClick={()=>setTab(t.id)} style={{
                display:"flex",alignItems:"center",gap:5,padding:"8px 13px",
                background:"none",border:"none",
                borderBottom:tab===t.id?"2px solid #22d3ee":"2px solid transparent",
                color:tab===t.id?"#22d3ee":"#475569",
                cursor:"pointer",fontSize:11,fontWeight:700,transition:"color .12s"}}>
                <span style={{fontSize:12}}>{t.icon}</span><span>{t.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div style={{maxWidth:1200,margin:"0 auto",padding:"18px 16px"}}>
        {tab==="live"    &&<LiveTab    stocks={stocks} stockMeta={stockMeta} sectors={sectors}/>}
        {tab==="news"    &&<NewsTab    stocks={stocks}/>}
        {tab==="sectors" &&<SectorsTab stocks={stocks} sectors={sectors} setSectors={setSectors} stockMeta={stockMeta} setStockMeta={setStockMeta} setStocks={setStocks}/>}
        {tab==="compare" &&<CompareTab stocks={stocks} sectors={sectors} stockMeta={stockMeta}/>}
        {tab==="ai"      &&<AITab      stocks={stocks} sectors={sectors}/>}
        {tab==="manage"  &&<ManageTab  stocks={stocks} sectors={sectors} stockMeta={stockMeta} added={added} onAdd={onAdd} onRemove={onRemove}/>}
      </div>

      <style>{`
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes rip{0%{transform:scale(1);opacity:.5}100%{transform:scale(2.8);opacity:0}}
        *::-webkit-scrollbar{width:4px;height:4px}
        *::-webkit-scrollbar-track{background:transparent}
        *::-webkit-scrollbar-thumb{background:#1e3a4a;border-radius:2px}
        input::placeholder{color:#1e3a4a}
        input:focus,select:focus{outline:none;border-color:rgba(34,211,238,.3)!important}
        select option{background:#0d1117;color:#e2e8f0}
        a{color:inherit}
      `}</style>
    </div>
  );
}
