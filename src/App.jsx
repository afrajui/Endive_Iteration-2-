import { useState, useRef, useEffect } from "react";

// ── Constants ─────────────────────────────────────────────────────────────────
const DAYS_S=["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
const MONTHS=["January","February","March","April","May","June","July","August","September","October","November","December"];
const MONTHS_S=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const HOURS=Array.from({length:24},(_,i)=>i);

const CATS=[
  {id:"class",   label:"Class",   emoji:"🎓",color:"#6c8ebf",bg:"#e8eef8"},
  {id:"study",   label:"Study",   emoji:"📝",color:"#7c6fcd",bg:"#ede8f8"},
  {id:"work",    label:"Work",    emoji:"💼",color:"#e8a838",bg:"#fdf3e0"},
  {id:"personal",label:"Personal",emoji:"🏃",color:"#4a9e7a",bg:"#e8f5ef"},
  {id:"errands", label:"Errands", emoji:"🛒",color:"#e07b5a",bg:"#fceee8"},
  {id:"rest",    label:"Rest",    emoji:"😴",color:"#b07db8",bg:"#f3eaf8"},
];

const QUADS=[
  {id:"do",       label:"Do First",  sub:"Urgent & Important",      color:"#e07b5a",bg:"#fceee8",border:"#f0b49a"},
  {id:"schedule", label:"Schedule",  sub:"Important, Not Urgent",   color:"#4a9e7a",bg:"#e8f5ef",border:"#9ad4bc"},
  {id:"delegate", label:"Delegate",  sub:"Urgent, Not Important",   color:"#e8a838",bg:"#fdf3e0",border:"#f0cc88"},
  {id:"eliminate",label:"Eliminate", sub:"Not Urgent or Important", color:"#b8b8b8",bg:"#f5f5f5",border:"#d8d8d8"},
];

const TIME_STYLES=[
  {id:"timeblocking", label:"Time Blocking",       desc:"Schedule every hour intentionally"},
  {id:"pomodoro",     label:"Pomodoro",             desc:"25 min focus, 5 min break cycles"},
  {id:"eat_frog",     label:"Eat the Frog",         desc:"Hardest task first every morning"},
  {id:"gtd",          label:"Getting Things Done",  desc:"Capture, clarify, organize, reflect"},
  {id:"flowing",      label:"Go with the Flow",     desc:"Flexible, respond to how you feel"},
];

const STRESS_OPTS=["Classes & studying","Work or internship","Social life","Family responsibilities","Finances","Health & sleep","Extracurriculars","All of the above"];
const GOAL_OPTS=["Reduce stress & burnout","Stay on top of deadlines","Build better habits","Balance school & personal life","Improve focus & productivity","Feel more in control"];
const YEAR_OPTS=["Freshman","Sophomore","Junior","Senior","Grad Student","Other"];

// ── Helpers ───────────────────────────────────────────────────────────────────
function getDIM(y,m){return new Date(y,m+1,0).getDate();}
function getFirst(y,m){return new Date(y,m,1).getDay();}
function todayStr(){return new Date().toISOString().split("T")[0];}
function pad(n){return String(n).padStart(2,"0");}
function dkey(y,m,d){return `${y}-${pad(m+1)}-${pad(d)}`;}
function fmtH(h){return h===0?"12am":h<12?`${h}am`:h===12?"12pm":`${h-12}pm`;}

const Q_H={do:8,schedule:14,delegate:11,eliminate:16};
function autoQ(t){
  const urg=t.date&&t.date<=new Date(Date.now()+3*864e5).toISOString().split("T")[0];
  const imp=["class","study","work"].includes(t.category);
  if(urg&&imp)return"do"; if(!urg&&imp)return"schedule";
  if(urg&&!imp)return"delegate"; return"eliminate";
}
function taskBlock(t){
  if(!t.date)return null;
  const q=t.quadrant||autoQ(t);
  const sh=t.startHour!=null?t.startHour:(Q_H[q]||9);
  const eh=t.endHour!=null?t.endHour:sh+1;
  return{id:"task-"+t.id,title:t.text,start:`${t.date}T${pad(sh)}:00:00`,end:`${t.date}T${pad(eh)}:00:00`,category:t.category||"personal",isTask:true,taskId:t.id};
}
function genRecurring(ev){
  const{title,sh,eh,category,description,date,recur,recurDays,recurWeeks}=ev;
  if(!date||recur==="none")return[{id:Date.now()+Math.random(),title,start:`${date}T${pad(sh)}:00:00`,end:`${date}T${pad(eh)}:00:00`,category,description:""}];
  const insts=[];
  const s=new Date(date+"T12:00:00"),tw=parseInt(recurWeeks)||4;
  const end=new Date(s);end.setDate(end.getDate()+tw*7);
  if(recur==="daily"){
    const c=new Date(s);
    while(c<=end){const d=`${c.getFullYear()}-${pad(c.getMonth()+1)}-${pad(c.getDate())}`;insts.push({id:Date.now()+Math.random(),title,start:`${d}T${pad(sh)}:00:00`,end:`${d}T${pad(eh)}:00:00`,category,description:"",recurId:title+date});c.setDate(c.getDate()+1);}
  } else {
    const days=(recurDays&&recurDays.length>0)?recurDays:[s.getDay()];
    const c=new Date(s);c.setDate(c.getDate()-c.getDay());
    let week=0;
    while(c<=end){
      if(recur==="biweekly"&&week%2!==0){c.setDate(c.getDate()+7);week++;continue;}
      for(const day of days){const d=new Date(c);d.setDate(d.getDate()+day);if(d>=s&&d<=end){const ds=`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;insts.push({id:Date.now()+Math.random(),title,start:`${ds}T${pad(sh)}:00:00`,end:`${ds}T${pad(eh)}:00:00`,category,description:"",recurId:title+date});}}
      c.setDate(c.getDate()+7);week++;
    }
  }
  return insts;
}

function toGCal({title,start,end,description=""}){
  const f=d=>new Date(d).toISOString().replace(/[-:]/g,"").split(".")[0]+"Z";
  return`https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(title)}&dates=${f(start)}/${f(end||new Date(new Date(start).getTime()+3600000).toISOString())}&details=${encodeURIComponent(description)}`;
}
function toICS(ev){
  const f=d=>new Date(d).toISOString().replace(/[-:]/g,"").split(".")[0]+"Z";
  return["BEGIN:VCALENDAR","VERSION:2.0","BEGIN:VEVENT",`DTSTART:${f(ev.start)}`,`DTEND:${f(ev.end||new Date(new Date(ev.start).getTime()+3600000).toISOString())}`,`SUMMARY:${ev.title}`,`UID:${Date.now()}@endive`,"END:VEVENT","END:VCALENDAR"].join("\r\n");
}
function dlICS(ev){const b=new Blob([toICS(ev)],{type:"text/calendar"});const a=document.createElement("a");a.href=URL.createObjectURL(b);a.download=ev.title.replace(/\s+/g,"_")+".ics";a.click();}

// ── Shared styles ─────────────────────────────────────────────────────────────
const S={
  input:{padding:"9px 12px",borderRadius:8,border:"1.5px solid #c2dece",background:"#f8fbf9",fontSize:13,color:"#1a3028",outline:"none",fontFamily:"'DM Sans',sans-serif",width:"100%",boxSizing:"border-box"},
  btn:{padding:"10px 0",borderRadius:10,border:"none",background:"#4a9e7a",color:"#fff",fontWeight:600,cursor:"pointer",fontFamily:"'DM Sans',sans-serif",fontSize:14,width:"100%"},
  iconBtn:{width:40,height:40,borderRadius:8,border:"none",background:"#4a9e7a",color:"#fff",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0},
  chip:{padding:"7px 14px",borderRadius:20,fontSize:12,fontWeight:500,cursor:"pointer",fontFamily:"'DM Sans',sans-serif",border:"1.5px solid #c2dece",background:"#f0f7f2",color:"#3a6a4a"},
  label:{fontSize:11,fontWeight:600,color:"#8aaa9a",textTransform:"uppercase",letterSpacing:"0.05em",display:"block",marginBottom:5},
  sec:{fontSize:11,fontWeight:700,letterSpacing:"0.08em",color:"#8aaa9a",textTransform:"uppercase",marginBottom:4},
  navBtn:{background:"none",border:"none",fontSize:22,color:"#8aaa9a",cursor:"pointer",padding:"0 8px",lineHeight:1},
  smallBtn:{padding:"5px 11px",borderRadius:6,border:"none",fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:"'DM Sans',sans-serif"},
};

// ── Modal wrapper ─────────────────────────────────────────────────────────────
function Modal({title,onClose,children}){
  return(
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.4)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:200,padding:16}}>
      <div style={{background:"#fff",borderRadius:16,padding:24,width:"100%",maxWidth:390,boxShadow:"0 8px 40px rgba(0,0,0,0.15)",maxHeight:"90vh",overflowY:"auto"}}>
        <h3 style={{fontFamily:"'Lora',serif",fontSize:18,color:"#1a3028",marginBottom:16}}>{title}</h3>
        {children}
      </div>
    </div>
  );
}
function ModalBtns({onCancel,onSave,label}){
  return(
    <div style={{display:"flex",gap:8,marginTop:4}}>
      <button onClick={onCancel} style={{...S.btn,background:"#fff",border:"1.5px solid #e0ece6",color:"#666",flex:1}}>Cancel</button>
      <button onClick={onSave} style={{...S.btn,flex:2}}>{label}</button>
    </div>
  );
}

// ── EventCard (in chat) ───────────────────────────────────────────────────────
function EventCard({ev,cats}){
  const d=new Date(ev.start);
  const cat=cats.find(c=>c.id===ev.category)||cats[3];
  return(
    <div style={{background:cat.bg,border:`1.5px solid ${cat.color}40`,borderRadius:12,padding:"11px 13px",marginTop:8}}>
      <div style={{display:"flex",gap:9,alignItems:"flex-start"}}>
        <div style={{background:cat.color,borderRadius:8,padding:"5px 9px",textAlign:"center",flexShrink:0,minWidth:42}}>
          <div style={{fontSize:9,color:"rgba(255,255,255,0.8)",fontWeight:700,textTransform:"uppercase"}}>{MONTHS_S[d.getMonth()]}</div>
          <div style={{fontSize:16,color:"#fff",fontWeight:700,lineHeight:1.1}}>{d.getDate()}</div>
        </div>
        <div style={{flex:1}}>
          <div style={{fontWeight:600,fontSize:13,color:"#1a3028"}}>{cat.emoji} {ev.title}</div>
          <div style={{fontSize:11,color:"#666",marginTop:2}}>{d.toLocaleDateString("en-US",{weekday:"short",month:"short",day:"numeric"})} · {d.toLocaleTimeString("en-US",{hour:"numeric",minute:"2-digit"})}</div>
        </div>
      </div>
      <div style={{display:"flex",gap:6,marginTop:9}}>
        <a href={toGCal(ev)} target="_blank" rel="noreferrer" style={{flex:1,padding:"6px 0",borderRadius:8,background:"#4285f4",color:"#fff",fontSize:11,fontWeight:600,textAlign:"center",textDecoration:"none"}}>Google Cal</a>
        <button onClick={()=>dlICS(ev)} style={{flex:1,padding:"6px 0",borderRadius:8,background:"#fff",border:`1.5px solid ${cat.color}60`,color:cat.color,fontSize:11,fontWeight:600,cursor:"pointer",fontFamily:"'DM Sans',sans-serif"}}>Apple/.ics</button>
      </div>
    </div>
  );
}

// ── Onboarding ────────────────────────────────────────────────────────────────
function Onboarding({onDone}){
  const [step,setStep]=useState(0);
  const [fade,setFade]=useState(true);
  const [d,setD]=useState({name:"",year:"",stressors:[],commitments:"",sleepH:22,wakeH:7,goals:[],timeStyle:""});

  const go=(dir)=>{setFade(false);setTimeout(()=>{setStep(s=>s+dir);setFade(true);},200);};
  const tog=(f,v)=>setD(p=>({...p,[f]:p[f].includes(v)?p[f].filter(x=>x!==v):[...p[f],v]}));

  const canNext=[
    d.name.trim().length>0,
    d.year!=="",
    d.stressors.length>0,
    true,
    true,
    d.goals.length>0,
    d.timeStyle!=="",
    true,
  ];

  const steps=[
    <div key="0">
      <div style={{fontSize:40,marginBottom:10}}>👋</div>
      <h2 style={hd}>Hi! I'm Endive.</h2>
      <p style={sb}>Your personal burnout-prevention assistant. Quick setup — 2 minutes.</p>
      <label style={S.label}>What's your name?</label>
      <input autoFocus value={d.name} onChange={e=>setD(p=>({...p,name:e.target.value}))} onKeyDown={e=>e.key==="Enter"&&canNext[0]&&go(1)} placeholder="Your first name..." style={S.input}/>
    </div>,

    <div key="1">
      <div style={{fontSize:40,marginBottom:10}}>🎓</div>
      <h2 style={hd}>Hey {d.name}! What year are you?</h2>
      <div style={{display:"flex",flexWrap:"wrap",gap:8,marginTop:6}}>
        {YEAR_OPTS.map(y=><button key={y} onClick={()=>setD(p=>({...p,year:y}))} style={{...S.chip,background:d.year===y?"#4a9e7a":"#f0f7f2",color:d.year===y?"#fff":"#3a6a4a",border:`1.5px solid ${d.year===y?"#4a9e7a":"#c2dece"}`}}>{y}</button>)}
      </div>
    </div>,

    <div key="2">
      <div style={{fontSize:40,marginBottom:10}}>💭</div>
      <h2 style={hd}>What weighs on you most?</h2>
      <p style={sb}>No judgment — select all that apply.</p>
      <div style={{display:"flex",flexWrap:"wrap",gap:8}}>
        {STRESS_OPTS.map(s=>{const sel=d.stressors.includes(s);return<button key={s} onClick={()=>tog("stressors",s)} style={{...S.chip,background:sel?"#e07b5a":"#f0f7f2",color:sel?"#fff":"#3a6a4a",border:`1.5px solid ${sel?"#e07b5a":"#c2dece"}`}}>{s}</button>;})}
      </div>
    </div>,

    <div key="3">
      <div style={{fontSize:40,marginBottom:10}}>🗓️</div>
      <h2 style={hd}>Recurring commitments</h2>
      <p style={sb}>Classes, work shifts, gym, clubs... Endive will always schedule around these.</p>
      <textarea value={d.commitments} onChange={e=>setD(p=>({...p,commitments:e.target.value}))} placeholder={"e.g. BIO 101 MWF 10-11am\nWork Tue/Thu 3-6pm\nGym Mon/Wed 7am"} style={{...S.input,height:96,resize:"none",lineHeight:1.6}}/>
      <p style={{fontSize:11,color:"#8aaa9a",marginTop:5}}>Optional — you can always add more later.</p>
    </div>,

    <div key="4">
      <div style={{fontSize:40,marginBottom:10}}>😴</div>
      <h2 style={hd}>Your sleep schedule</h2>
      <p style={sb}>Endive will never schedule anything during your sleep. Ever.</p>
      <div style={{display:"flex",gap:14,marginTop:4}}>
        <div style={{flex:1}}><label style={S.label}>Bedtime</label>
          <select value={d.sleepH} onChange={e=>setD(p=>({...p,sleepH:+e.target.value}))} style={S.input}>{HOURS.map(h=><option key={h} value={h}>{fmtH(h)}</option>)}</select>
        </div>
        <div style={{flex:1}}><label style={S.label}>Wake up</label>
          <select value={d.wakeH} onChange={e=>setD(p=>({...p,wakeH:+e.target.value}))} style={S.input}>{HOURS.map(h=><option key={h} value={h}>{fmtH(h)}</option>)}</select>
        </div>
      </div>
    </div>,

    <div key="5">
      <div style={{fontSize:40,marginBottom:10}}>🌱</div>
      <h2 style={hd}>What do you want from Endive?</h2>
      <div style={{display:"flex",flexWrap:"wrap",gap:8,marginTop:6}}>
        {GOAL_OPTS.map(g=>{const sel=d.goals.includes(g);return<button key={g} onClick={()=>tog("goals",g)} style={{...S.chip,background:sel?"#7c6fcd":"#f0f7f2",color:sel?"#fff":"#3a6a4a",border:`1.5px solid ${sel?"#7c6fcd":"#c2dece"}`}}>{g}</button>;})}
      </div>
    </div>,

    <div key="6">
      <div style={{fontSize:40,marginBottom:10}}>⏱️</div>
      <h2 style={hd}>How do you like to work?</h2>
      <p style={sb}>Endive plans around your style.</p>
      <div style={{display:"flex",flexDirection:"column",gap:7,marginTop:4}}>
        {TIME_STYLES.map(ts=>{const sel=d.timeStyle===ts.id;return(
          <button key={ts.id} onClick={()=>setD(p=>({...p,timeStyle:ts.id}))} style={{padding:"10px 14px",borderRadius:10,border:`1.5px solid ${sel?"#4a9e7a":"#c2dece"}`,background:sel?"#e8f5ef":"#f8fbf9",textAlign:"left",cursor:"pointer",fontFamily:"'DM Sans',sans-serif"}}>
            <div style={{fontWeight:600,fontSize:13,color:sel?"#2a6a4a":"#1a3028"}}>{ts.label}</div>
            <div style={{fontSize:11,color:"#8aaa9a",marginTop:1}}>{ts.desc}</div>
          </button>
        );})}
      </div>
    </div>,

    <div key="7" style={{textAlign:"center"}}>
      <div style={{fontSize:52,marginBottom:12}}>🌿</div>
      <h2 style={{...hd,textAlign:"center"}}>All set, {d.name}!</h2>
      <p style={{...sb,textAlign:"center"}}>Endive knows what matters to you. Let's build something sustainable.</p>
      <div style={{background:"#e8f5ef",borderRadius:12,padding:"12px 16px",marginTop:14,textAlign:"left"}}>
        {[`${d.year}`,`Style: ${TIME_STYLES.find(t=>t.id===d.timeStyle)?.label||"flexible"}`,`Sleep: ${fmtH(d.sleepH)} – ${fmtH(d.wakeH)}`,d.commitments?`${d.commitments.split("\n").filter(Boolean).length} recurring commitment(s)`:null].filter(Boolean).map((item,i)=>(
          <div key={i} style={{fontSize:12,color:"#2a5a3a",padding:"2px 0",display:"flex",gap:6}}><span style={{color:"#4a9e7a"}}>✓</span>{item}</div>
        ))}
      </div>
    </div>,
  ];

  const isLast=step===steps.length-1;
  const hd={fontFamily:"'Lora',serif",fontSize:20,fontWeight:600,color:"#1a3028",marginBottom:6};
  const sb={fontSize:13,color:"#6a9a7a",marginBottom:12,lineHeight:1.6};

  return(
    <div style={{position:"fixed",inset:0,background:"#eef7f2",display:"flex",alignItems:"center",justifyContent:"center",zIndex:300,padding:16}}>
      <div style={{width:"100%",maxWidth:440,background:"#fff",borderRadius:24,boxShadow:"0 4px 40px rgba(26,48,40,0.12)",padding:28,opacity:fade?1:0,transform:fade?"translateY(0)":"translateY(8px)",transition:"all 0.2s ease"}}>
        <div style={{display:"flex",gap:4,justifyContent:"center",marginBottom:22}}>
          {steps.map((_,i)=><div key={i} style={{width:i===step?20:6,height:6,borderRadius:3,background:i<=step?"#4a9e7a":"#e0ece6",transition:"all 0.3s"}}/>)}
        </div>
        <div style={{minHeight:260}}>{steps[step]}</div>
        <div style={{display:"flex",gap:8,marginTop:22}}>
          {step>0&&<button onClick={()=>go(-1)} style={{...S.btn,flex:1,background:"#fff",border:"1.5px solid #e0ece6",color:"#8aaa9a"}}>← Back</button>}
          <button onClick={isLast?()=>onDone(d):()=>go(1)} disabled={!canNext[step]} style={{...S.btn,flex:2,background:canNext[step]?"#4a9e7a":"#c2dece",cursor:canNext[step]?"pointer":"default"}}>
            {isLast?"Start with Endive 🌿":"Continue →"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Insight strip ─────────────────────────────────────────────────────────────
function getInsights(tasks,events){
  const today=new Date(),todayS=todayStr();
  const in3=new Date(today.getTime()+3*864e5).toISOString().split("T")[0];
  const in7=new Date(today.getTime()+7*864e5).toISOString().split("T")[0];
  const pending=tasks.filter(t=>!t.done);
  const urgent=pending.filter(t=>t.date&&t.date<=in3);
  const ins=[];
  const hasRestToday=events.some(e=>e.category==="rest"&&e.start.startsWith(todayS));
  if(!hasRestToday&&new Date().getHours()<18) ins.push({type:"rest",msg:"No rest block today. Endive can add one.",action:"Add a rest block for me today"});
  const dayCounts={};events.forEach(e=>{const d=e.start.split("T")[0];if(d>=todayS&&d<=in7)dayCounts[d]=(dayCounts[d]||0)+1;});
  const heavy=Object.entries(dayCounts).filter(([,c])=>c>=4)[0];
  if(heavy){const label=new Date(heavy[0]+"T12:00:00").toLocaleDateString("en-US",{weekday:"long"});ins.push({type:"heavy",msg:`${label} looks packed. Want me to rebalance?`,action:`Rebalance my ${label}`});}
  if(urgent.length>=3) ins.push({type:"urgent",msg:`${urgent.length} things due in 3 days. Make a plan?`,action:"Make a plan for my urgent tasks"});
  return ins.slice(0,2);
}
const INS_STYLE={rest:{bg:"#f3eaf8",border:"#b07db8",color:"#7a4a8a",icon:"😴"},heavy:{bg:"#fceee8",border:"#e07b5a",color:"#a04a2a",icon:"⚡"},urgent:{bg:"#fdf3e0",border:"#e8a838",color:"#8a5a10",icon:"🔥"}};
function InsightStrip({tasks,events,onAction}){
  const ins=getInsights(tasks,events);
  if(!ins.length)return null;
  return(
    <div style={{marginBottom:12}}>
      {ins.map((x,i)=>{const st=INS_STYLE[x.type]||INS_STYLE.rest;return(
        <div key={i} style={{background:st.bg,border:`1px solid ${st.border}`,borderRadius:10,padding:"8px 11px",marginBottom:5,display:"flex",alignItems:"center",gap:8}}>
          <span style={{fontSize:15}}>{st.icon}</span>
          <span style={{flex:1,fontSize:12,color:st.color,lineHeight:1.4}}>{x.msg}</span>
          <button onClick={()=>onAction(x.action)} style={{fontSize:11,fontWeight:600,color:st.color,background:"#fff",border:`1px solid ${st.border}`,borderRadius:6,padding:"4px 8px",cursor:"pointer",flexShrink:0,fontFamily:"'DM Sans',sans-serif"}}>Ask Endive</button>
        </div>
      );})}
    </div>
  );
}

// ── Calendar tab ──────────────────────────────────────────────────────────────
function CalendarTab({events,setEvents,cats,setCats,tasks,setTasks,onAction}){
  const today=new Date();
  const [view,setView]=useState("month");
  const [cur,setCur]=useState({y:today.getFullYear(),m:today.getMonth(),d:today.getDate()});
  const [showAdd,setShowAdd]=useState(false);
  const [showCat,setShowCat]=useState(false);
  const [editT,setEditT]=useState(null);
  const [nEv,setNEv]=useState({title:"",date:todayStr(),sh:9,eh:10,category:"personal",description:"",recur:"none",recurDays:[],recurWeeks:4});
  const [nCat,setNCat]=useState({label:"",emoji:"📌",color:"#4a9e7a"});

  const allBlocks=[...events,...(tasks||[]).filter(t=>!t.done&&t.date).map(taskBlock).filter(Boolean)];
  const evDay=s=>allBlocks.filter(e=>e.start.startsWith(s));

  const nav=dir=>setCur(c=>{
    if(view==="year")return{...c,y:c.y+dir};
    if(view==="month"){const nd=new Date(c.y,c.m+dir);return{...c,y:nd.getFullYear(),m:nd.getMonth()};}
    if(view==="week"){const nd=new Date(c.y,c.m,c.d+dir*7);return{y:nd.getFullYear(),m:nd.getMonth(),d:nd.getDate()};}
    const nd=new Date(c.y,c.m,c.d+dir);return{y:nd.getFullYear(),m:nd.getMonth(),d:nd.getDate()};
  });

  const headerLabel=()=>{
    if(view==="year")return cur.y;
    if(view==="month")return`${MONTHS[cur.m]} ${cur.y}`;
    if(view==="week"){const a=new Date(cur.y,cur.m,cur.d),b=new Date(cur.y,cur.m,cur.d+6);return`${MONTHS_S[a.getMonth()]} ${a.getDate()} – ${MONTHS_S[b.getMonth()]} ${b.getDate()}`;}
    return`${DAYS_S[new Date(cur.y,cur.m,cur.d).getDay()]}, ${MONTHS[cur.m]} ${cur.d}`;
  };

  const saveEv=()=>{
    if(!nEv.title.trim())return;
    setEvents(p=>[...p,...genRecurring({...nEv,title:nEv.title.trim()})]);
    setShowAdd(false);setNEv({title:"",date:todayStr(),sh:9,eh:10,category:"personal",description:"",recur:"none",recurDays:[],recurWeeks:4});
  };
  const saveCat=()=>{
    if(!nCat.label.trim())return;
    setCats(p=>[...p,{id:nCat.label.toLowerCase().replace(/\s+/g,"_"),label:nCat.label,emoji:nCat.emoji,color:nCat.color,bg:nCat.color+"22"}]);
    setShowCat(false);setNCat({label:"",emoji:"📌",color:"#4a9e7a"});
  };
  const saveTaskTime=()=>{
    if(!editT)return;
    setTasks(p=>p.map(t=>t.id===editT.tid?{...t,startHour:editT.sh,endHour:editT.eh}:t));
    setEditT(null);
  };

  const Chip=({ev})=>{
    const cat=cats.find(c=>c.id===ev.category)||cats[3];
    return<div style={{fontSize:9,padding:"1px 4px",borderRadius:3,background:cat.color,color:"#fff",marginBottom:1,overflow:"hidden",whiteSpace:"nowrap",textOverflow:"ellipsis"}}>{ev.recurId?"🔁 ":ev.isTask?"📌 ":""}{ev.title}</div>;
  };

  return(
    <div>
      <InsightStrip tasks={tasks||[]} events={events} onAction={onAction||(() => {})}/>

      {/* Controls */}
      <div style={{display:"flex",flexWrap:"wrap",gap:6,marginBottom:10,alignItems:"center",justifyContent:"space-between"}}>
        <div style={{display:"flex",gap:3}}>
          {["year","month","week","day"].map(v=><button key={v} onClick={()=>setView(v)} style={{...S.smallBtn,background:view===v?"#4a9e7a":"#f0f7f2",color:view===v?"#fff":"#5a8a6a",textTransform:"capitalize"}}>{v}</button>)}
        </div>
        <div style={{display:"flex",alignItems:"center",gap:4}}>
          <button onClick={()=>nav(-1)} style={S.navBtn}>‹</button>
          <span style={{fontFamily:"'Lora',serif",fontSize:13,fontWeight:600,color:"#1a3028",minWidth:130,textAlign:"center"}}>{headerLabel()}</span>
          <button onClick={()=>nav(1)} style={S.navBtn}>›</button>
        </div>
        <div style={{display:"flex",gap:5}}>
          <button onClick={()=>setShowCat(true)} style={{...S.smallBtn,background:"#f0f7f2",color:"#4a9e7a"}}>+ Cat</button>
          <button onClick={()=>setShowAdd(true)} style={{...S.smallBtn,background:"#4a9e7a",color:"#fff"}}>+ Block</button>
        </div>
      </div>

      {/* Legend */}
      <div style={{display:"flex",flexWrap:"wrap",gap:5,marginBottom:10}}>
        {cats.map(c=><span key={c.id} style={{fontSize:10,padding:"2px 7px",borderRadius:20,background:c.bg,color:c.color,fontWeight:600}}>{c.emoji} {c.label}</span>)}
      </div>

      {/* Year view */}
      {view==="year"&&(
        <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8}}>
          {Array.from({length:12},(_,mi)=>{
            const cells=[];
            for(let i=0;i<getFirst(cur.y,mi);i++)cells.push(null);
            for(let d=1;d<=getDIM(cur.y,mi);d++)cells.push(d);
            return(
              <div key={mi} onClick={()=>{setCur(c=>({...c,m:mi}));setView("month");}} style={{background:"#f8fbf9",borderRadius:9,padding:7,cursor:"pointer"}}>
                <div style={{fontSize:10,fontWeight:700,color:"#4a9e7a",marginBottom:3}}>{MONTHS_S[mi]}</div>
                <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:1}}>
                  {cells.map((d,i)=>{const isT=d&&cur.y===today.getFullYear()&&mi===today.getMonth()&&d===today.getDate();const has=d&&evDay(dkey(cur.y,mi,d)).length>0;return<div key={i} style={{aspectRatio:"1",display:"flex",alignItems:"center",justifyContent:"center",borderRadius:2,background:isT?"#4a9e7a":has?"#c2dece":"transparent",fontSize:7,color:isT?"#fff":"#2a4a3a"}}>{d}</div>;})}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Month view */}
      {view==="month"&&(
        <div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",marginBottom:3}}>
            {DAYS_S.map(d=><div key={d} style={{textAlign:"center",fontSize:10,color:"#8aaa9a",fontWeight:600,padding:"2px 0"}}>{d}</div>)}
          </div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:3}}>
            {(()=>{
              const cells=[];
              for(let i=0;i<getFirst(cur.y,cur.m);i++)cells.push(null);
              for(let d=1;d<=getDIM(cur.y,cur.m);d++)cells.push(d);
              return cells.map((day,i)=>{
                const isT=day&&cur.y===today.getFullYear()&&cur.m===today.getMonth()&&day===today.getDate();
                const des=day?evDay(dkey(cur.y,cur.m,day)):[];
                return(
                  <div key={i} onClick={()=>{if(day){setCur(c=>({...c,d:day}));setView("day");}}} style={{minHeight:56,padding:3,borderRadius:7,background:isT?"#4a9e7a0f":"#f8fbf9",border:`1px solid ${isT?"#4a9e7a":"#e8f2ec"}`,cursor:day?"pointer":"default"}}>
                    <div style={{fontSize:11,fontWeight:isT?700:400,color:isT?"#4a9e7a":"#1a3028",marginBottom:1}}>{day}</div>
                    {des.slice(0,2).map(ev=><Chip key={ev.id} ev={ev}/>)}
                    {des.length>2&&<div style={{fontSize:9,color:"#8aaa9a"}}>+{des.length-2}</div>}
                  </div>
                );
              });
            })()}
          </div>
        </div>
      )}

      {/* Week view */}
      {view==="week"&&(
        <div style={{overflowX:"auto"}}>
          <div style={{minWidth:460}}>
            <div style={{display:"grid",gridTemplateColumns:"42px repeat(7,1fr)",gap:2,marginBottom:5}}>
              <div/>
              {Array.from({length:7},(_,i)=>{const nd=new Date(cur.y,cur.m,cur.d+i);const isT=nd.toDateString()===today.toDateString();return(
                <div key={i} style={{textAlign:"center",padding:"3px 2px",borderRadius:5,background:isT?"#4a9e7a":"transparent"}}>
                  <div style={{fontSize:10,color:isT?"#fff":"#8aaa9a",fontWeight:600}}>{DAYS_S[nd.getDay()]}</div>
                  <div style={{fontSize:13,fontWeight:700,color:isT?"#fff":"#1a3028"}}>{nd.getDate()}</div>
                </div>
              );})}
            </div>
            <div style={{maxHeight:360,overflowY:"auto"}}>
              {HOURS.map(h=>(
                <div key={h} style={{display:"grid",gridTemplateColumns:"42px repeat(7,1fr)",gap:2,minHeight:32}}>
                  <div style={{fontSize:10,color:"#bbb",textAlign:"right",paddingRight:4,paddingTop:2}}>{fmtH(h)}</div>
                  {Array.from({length:7},(_,di)=>{
                    const nd=new Date(cur.y,cur.m,cur.d+di);
                    const dk2=`${nd.getFullYear()}-${pad(nd.getMonth()+1)}-${pad(nd.getDate())}`;
                    const slotEvs=allBlocks.filter(e=>e.start.startsWith(dk2)&&parseInt(e.start.split("T")[1]||"0")===h);
                    return<div key={di} style={{borderTop:"1px solid #f0f5f2",minHeight:32}}>
                      {slotEvs.map(ev=>{const cat=cats.find(c=>c.id===ev.category)||cats[3];return<div key={ev.id} style={{fontSize:9,padding:"2px 3px",borderRadius:3,background:cat.color,color:"#fff",margin:1,overflow:"hidden",whiteSpace:"nowrap",textOverflow:"ellipsis"}}>{ev.isTask?"📌 ":""}{ev.title}</div>;})}
                    </div>;
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Day view */}
      {view==="day"&&(
        <div style={{maxHeight:450,overflowY:"auto"}}>
          {HOURS.map(h=>{
            const dk2=dkey(cur.y,cur.m,cur.d);
            const slotEvs=allBlocks.filter(e=>e.start.startsWith(dk2)&&parseInt(e.start.split("T")[1]||"0")===h);
            return(
              <div key={h} style={{display:"flex",gap:8,minHeight:44,borderTop:"1px solid #f0f5f2",paddingTop:3}}>
                <div style={{width:40,fontSize:10,color:"#bbb",flexShrink:0,textAlign:"right"}}>{fmtH(h)}</div>
                <div style={{flex:1,display:"flex",flexWrap:"wrap",gap:4}}>
                  {slotEvs.map(ev=>{
                    const cat=cats.find(c=>c.id===ev.category)||cats[3];
                    const eh=ev.end?parseInt(ev.end.split("T")[1]||String(h+1)):h+1;
                    return(
                      <div key={ev.id} onClick={ev.isTask?()=>setEditT({tid:ev.taskId,sh:parseInt(ev.start.split("T")[1]||"9"),eh}):undefined} style={{padding:"5px 9px",borderRadius:8,background:cat.bg,borderLeft:`3px solid ${cat.color}`,fontSize:12,color:"#1a3028",flex:1,minWidth:110,cursor:ev.isTask?"pointer":"default"}}>
                        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
                          <span style={{fontWeight:600,flex:1}}>{ev.isTask?"📌 ":ev.recurId?"🔁 ":""}{ev.title}{ev.isTask&&<span style={{fontSize:9,opacity:0.5,marginLeft:4}}>tap to edit</span>}</span>
                          {!ev.isTask&&<button onClick={e=>{e.stopPropagation();ev.recurId?setEvents(p=>p.filter(x=>x.recurId!==ev.recurId)):setEvents(p=>p.filter(x=>x.id!==ev.id));}} style={{background:"none",border:"none",color:"#ccc",cursor:"pointer",fontSize:14,lineHeight:1,padding:0}}>×</button>}
                        </div>
                        <div style={{fontSize:10,color:cat.color,marginTop:1}}>{pad(h)}:00 – {pad(eh)}:00</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modals */}
      {showAdd&&(
        <Modal title="Add Time Block" onClose={()=>setShowAdd(false)}>
          <input value={nEv.title} onChange={e=>setNEv(p=>({...p,title:e.target.value}))} placeholder="Title..." style={{...S.input,marginBottom:9}}/>
          <input type="date" value={nEv.date} onChange={e=>setNEv(p=>({...p,date:e.target.value}))} style={{...S.input,marginBottom:9}}/>
          <div style={{display:"flex",gap:8,marginBottom:9}}>
            <div style={{flex:1}}><label style={S.label}>Start</label><select value={nEv.sh} onChange={e=>setNEv(p=>({...p,sh:+e.target.value}))} style={S.input}>{HOURS.map(h=><option key={h} value={h}>{fmtH(h)}</option>)}</select></div>
            <div style={{flex:1}}><label style={S.label}>End</label><select value={nEv.eh} onChange={e=>setNEv(p=>({...p,eh:+e.target.value}))} style={S.input}>{HOURS.map(h=><option key={h} value={h}>{fmtH(h)}</option>)}</select></div>
          </div>
          <label style={S.label}>Category</label>
          <select value={nEv.category} onChange={e=>setNEv(p=>({...p,category:e.target.value}))} style={{...S.input,marginBottom:9}}>{cats.map(c=><option key={c.id} value={c.id}>{c.emoji} {c.label}</option>)}</select>
          <label style={S.label}>Repeat</label>
          <select value={nEv.recur} onChange={e=>setNEv(p=>({...p,recur:e.target.value,recurDays:[]}))} style={{...S.input,marginBottom:nEv.recur!=="none"?8:12}}>
            <option value="none">Does not repeat</option>
            <option value="daily">Daily</option>
            <option value="weekly">Weekly (pick days)</option>
            <option value="biweekly">Biweekly</option>
          </select>
          {(nEv.recur==="weekly"||nEv.recur==="biweekly")&&(
            <div style={{display:"flex",gap:5,marginBottom:9,flexWrap:"wrap"}}>
              {["Su","Mo","Tu","We","Th","Fr","Sa"].map((d,i)=>{const sel=nEv.recurDays.includes(i);return<button key={i} onClick={()=>setNEv(p=>({...p,recurDays:sel?p.recurDays.filter(x=>x!==i):[...p.recurDays,i]}))} style={{width:34,height:34,borderRadius:"50%",border:`2px solid ${sel?"#4a9e7a":"#e0ece6"}`,background:sel?"#4a9e7a":"#fff",color:sel?"#fff":"#5a8a6a",fontSize:11,fontWeight:600,cursor:"pointer",fontFamily:"'DM Sans',sans-serif"}}>{d}</button>;})}
            </div>
          )}
          {nEv.recur!=="none"&&(
            <div style={{marginBottom:12}}>
              <label style={S.label}>Repeat for how many weeks?</label>
              <div style={{display:"flex",alignItems:"center",gap:10}}>
                <input type="range" min="1" max="20" value={nEv.recurWeeks} onChange={e=>setNEv(p=>({...p,recurWeeks:+e.target.value}))} style={{flex:1,accentColor:"#4a9e7a"}}/>
                <span style={{fontSize:13,fontWeight:600,color:"#4a9e7a",minWidth:50}}>{nEv.recurWeeks} wks</span>
              </div>
            </div>
          )}
          <ModalBtns onCancel={()=>setShowAdd(false)} onSave={saveEv} label="Add Block"/>
        </Modal>
      )}
      {showCat&&(
        <Modal title="New Category" onClose={()=>setShowCat(false)}>
          <input value={nCat.label} onChange={e=>setNCat(p=>({...p,label:e.target.value}))} placeholder="Category name..." style={{...S.input,marginBottom:9}}/>
          <input value={nCat.emoji} onChange={e=>setNCat(p=>({...p,emoji:e.target.value}))} placeholder="Emoji" style={{...S.input,marginBottom:9}}/>
          <label style={S.label}>Color</label>
          <input type="color" value={nCat.color} onChange={e=>setNCat(p=>({...p,color:e.target.value}))} style={{width:"100%",height:38,borderRadius:8,border:"1.5px solid #e0ece6",marginBottom:14,cursor:"pointer"}}/>
          <ModalBtns onCancel={()=>setShowCat(false)} onSave={saveCat} label="Add Category"/>
        </Modal>
      )}
      {editT&&(
        <Modal title="Edit Task Time" onClose={()=>setEditT(null)}>
          <p style={{fontSize:13,color:"#5a8a6a",marginBottom:12}}>Adjust when this task appears on your calendar.</p>
          <div style={{display:"flex",gap:8,marginBottom:14}}>
            <div style={{flex:1}}><label style={S.label}>Start</label><select value={editT.sh} onChange={e=>setEditT(p=>({...p,sh:+e.target.value}))} style={S.input}>{HOURS.map(h=><option key={h} value={h}>{fmtH(h)}</option>)}</select></div>
            <div style={{flex:1}}><label style={S.label}>End</label><select value={editT.eh} onChange={e=>setEditT(p=>({...p,eh:+e.target.value}))} style={S.input}>{HOURS.map(h=><option key={h} value={h}>{fmtH(h)}</option>)}</select></div>
          </div>
          <ModalBtns onCancel={()=>setEditT(null)} onSave={saveTaskTime} label="Save Time"/>
        </Modal>
      )}
    </div>
  );
}

// ── Tasks tab ─────────────────────────────────────────────────────────────────
function TasksTab({tasks,setTasks,cats,events,onAction}){
  const [input,setInput]=useState("");
  const [date,setDate]=useState("");
  const [cat,setCat]=useState("personal");
  const [sub,setSub]=useState("list");

  const add=()=>{
    if(!input.trim())return;
    setTasks(p=>[...p,{id:Date.now(),text:input.trim(),done:false,date:date||null,category:cat,quadrant:null}]);
    setInput("");setDate("");
  };
  const toggle=id=>setTasks(p=>p.map(t=>t.id===id?{...t,done:!t.done}:t));
  const remove=id=>setTasks(p=>p.filter(t=>t.id!==id));
  const getQ=t=>{if(t.quadrant)return t.quadrant;const urg=t.date&&t.date<=new Date(Date.now()+3*864e5).toISOString().split("T")[0];const imp=["class","study","work"].includes(t.category);if(urg&&imp)return"do";if(!urg&&imp)return"schedule";if(urg&&!imp)return"delegate";return"eliminate";};

  const todayS=todayStr();
  const pending=tasks.filter(t=>!t.done);

  const Item=({t})=>{
    const c=cats.find(x=>x.id===t.category)||cats[3];
    return(
      <div style={{display:"flex",alignItems:"center",gap:8,padding:"8px 0",borderBottom:"1px solid #e8f2ec",opacity:t.done?0.4:1}}>
        <button onClick={()=>toggle(t.id)} style={{width:17,height:17,borderRadius:4,border:`2px solid ${t.done?"#4a9e7a":"#b2d2be"}`,background:t.done?"#4a9e7a":"transparent",flexShrink:0,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>
          {t.done&&<span style={{color:"#fff",fontSize:9,fontWeight:700}}>✓</span>}
        </button>
        <span style={{width:7,height:7,borderRadius:"50%",background:c.color,flexShrink:0}}/>
        <span style={{flex:1,fontSize:13,color:"#1a3028",textDecoration:t.done?"line-through":"none"}}>{t.text}</span>
        {t.date&&<span style={{fontSize:11,color:"#8aaa9a"}}>{t.date.slice(5).replace("-","/")}</span>}
        <button onClick={()=>remove(t.id)} style={{background:"none",border:"none",color:"#c2d8cc",cursor:"pointer",fontSize:15,lineHeight:1,padding:0}}>×</button>
      </div>
    );
  };

  return(
    <div>
      <InsightStrip tasks={tasks} events={events||[]} onAction={onAction||(() => {})}/>
      <div style={{background:"#f8fbf9",borderRadius:12,padding:11,marginBottom:12}}>
        <div style={{display:"flex",gap:6,marginBottom:7}}>
          <input value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>e.key==="Enter"&&add()} placeholder="Add a task..." style={{...S.input,flex:1}}/>
          <button onClick={add} style={{...S.iconBtn,fontSize:20}}>+</button>
        </div>
        <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
          <input type="date" value={date} onChange={e=>setDate(e.target.value)} style={{...S.input,flex:1,minWidth:110}}/>
          <select value={cat} onChange={e=>setCat(e.target.value)} style={{...S.input,flex:1,minWidth:110}}>{cats.map(c=><option key={c.id} value={c.id}>{c.emoji} {c.label}</option>)}</select>
        </div>
      </div>
      <div style={{display:"flex",gap:4,marginBottom:12}}>
        <button onClick={()=>setSub("list")} style={{...S.smallBtn,background:sub==="list"?"#4a9e7a":"#f0f7f2",color:sub==="list"?"#fff":"#5a8a6a"}}>List</button>
        <button onClick={()=>setSub("matrix")} style={{...S.smallBtn,background:sub==="matrix"?"#4a9e7a":"#f0f7f2",color:sub==="matrix"?"#fff":"#5a8a6a"}}>Eisenhower Matrix</button>
      </div>
      {sub==="list"&&(
        <div>
          {tasks.length===0&&<p style={{color:"#8aaa9a",fontSize:13,textAlign:"center",marginTop:20}}>No tasks yet — add one above!</p>}
          {pending.filter(t=>t.date===todayS||!t.date).length>0&&<><div style={S.sec}>Today</div>{pending.filter(t=>t.date===todayS||!t.date).map(t=><Item key={t.id} t={t}/>)}</>}
          {pending.filter(t=>t.date&&t.date>todayS).length>0&&<><div style={{...S.sec,marginTop:12}}>Upcoming</div>{pending.filter(t=>t.date&&t.date>todayS).sort((a,b)=>a.date>b.date?1:-1).map(t=><Item key={t.id} t={t}/>)}</>}
          {tasks.filter(t=>t.done).length>0&&<><div style={{...S.sec,marginTop:12,opacity:0.5}}>Done</div>{tasks.filter(t=>t.done).map(t=><Item key={t.id} t={t}/>)}</>}
        </div>
      )}
      {sub==="matrix"&&(
        <div>
          <p style={{fontSize:11,color:"#8aaa9a",marginBottom:10}}>Auto-sorted by urgency (due ≤3 days) and category.</p>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
            {QUADS.map(q=>{const qt=pending.filter(t=>getQ(t)===q.id);return(
              <div key={q.id} style={{background:q.bg,border:`1.5px solid ${q.border}`,borderRadius:12,padding:10}}>
                <div style={{fontWeight:700,fontSize:12,color:q.color}}>{q.label}</div>
                <div style={{fontSize:10,color:q.color+"99",marginBottom:6}}>{q.sub}</div>
                {qt.length===0&&<p style={{fontSize:11,color:"#bbb",fontStyle:"italic"}}>None</p>}
                {qt.map(t=>(
                  <div key={t.id} style={{display:"flex",alignItems:"center",gap:5,padding:"4px 0",borderBottom:`1px solid ${q.border}50`}}>
                    <button onClick={()=>toggle(t.id)} style={{width:13,height:13,borderRadius:3,border:`2px solid ${q.color}`,background:"transparent",flexShrink:0,cursor:"pointer"}}/>
                    <span style={{fontSize:11,color:"#1a3028",flex:1}}>{t.text}</span>
                    {t.date&&<span style={{fontSize:10,color:q.color}}>{t.date.slice(5).replace("-","/")}</span>}
                  </div>
                ))}
              </div>
            );})}
          </div>
        </div>
      )}
    </div>
  );
}

// ── AI System prompt ──────────────────────────────────────────────────────────
const SYS = `You are Endive, a warm and caring personal assistant for college students. You prevent burnout by balancing productivity with genuine rest.

Keep ALL responses SHORT — 2 to 4 sentences max unless presenting a full day plan. Be warm, direct, and human. Never use long bullet lists.

Workflow (follow naturally):
1. Ask how they feel first — always
2. Validate briefly with genuine empathy
3. Gather tasks and deadlines
4. Build a realistic plan: work blocks + breaks + hard stop time. Never more than 3 hours focus without a break. Always include at least one rest block per day.
5. Show the plan simply. Ask if it feels doable.
6. Once approved, add blocks to calendar. Then ask if anything else is needed.

Breaks to always include: short breaks (5-15 min, category rest), walk breaks (15-20 min), meals (30-60 min), wind-down at end of day. No work after 9pm.

If they seem overwhelmed — check in emotionally first. Redistribute tasks if the load is too heavy. Celebrate small wins.

To add a task (at END of reply only):
TASK_JSON:{"text":"name","date":"YYYY-MM-DD","category":"personal","quadrant":"do"}

To add a calendar block (at END of reply only):
EVENT_JSON:{"title":"title","start":"YYYY-MM-DDTHH:MM:00","end":"YYYY-MM-DDTHH:MM:00","category":"rest","description":""}

Categories: class, study, work, personal, errands, rest
Quadrants: do, schedule, delegate, eliminate
Multiple blocks per reply are fine. Never show raw JSON. Redirect if off-topic.`;

function parseBlocks(text) {
  const events = [];
  const tasks = [];
  const taskRe = /TASK_JSON:(\{[^\n]+\})/g;
  const eventRe = /EVENT_JSON:(\{[^\n]+\})/g;
  let m;
  while ((m = taskRe.exec(text)) !== null) { try { tasks.push(JSON.parse(m[1])); } catch(e) {} }
  while ((m = eventRe.exec(text)) !== null) { try { events.push(JSON.parse(m[1])); } catch(e) {} }
  return { events, tasks };
}
function cleanText(text) {
  return text.replace(/TASK_JSON:\{[^\n]+\}/g, "").replace(/EVENT_JSON:\{[^\n]+\}/g, "").trim();
}
function renderMd(text) {
  return text.split(/(\*\*[^*]+\*\*)/).map((p, i) =>
    p.startsWith("**") && p.endsWith("**") ? <strong key={i}>{p.slice(2,-2)}</strong> : p
  );
}

// ── Chat tab ──────────────────────────────────────────────────────────────────
function ChatTab({tasks,setTasks,events,setEvents,cats,profile,pendingAction,clearPending}){
  const [msgs,setMsgs]=useState([]);
  const [input,setInput]=useState("");
  const [loading,setLoading]=useState(false);
  const [started,setStarted]=useState(false);
  const [voiceMode,setVoiceMode]=useState(false);
  const [listening,setListening]=useState(false);
  const [muted,setMuted]=useState(true);
  const ref=useRef(null);
  const recRef=useRef(null);

  useEffect(()=>{ref.current?.scrollIntoView({behavior:"smooth"});},[msgs,loading]);

  useEffect(()=>{
    if(pendingAction&&started&&!loading){
      clearPending?.();
      sendMsg(pendingAction);
    }
  },[pendingAction,started]);

  const speak=(text)=>{
    if(muted)return;
    window.speechSynthesis.cancel();
    const clean=text.replace(/[*_#]/g,"").replace(/[^\x00-\x7F]/g,"").trim();
    const utt=new SpeechSynthesisUtterance(clean);
    utt.rate=0.88;utt.pitch=1.0;utt.volume=0.95;
    const trySpeak=()=>{
      const voices=window.speechSynthesis.getVoices();
      const pick=voices.find(v=>/^samantha$|^karen$|^moira$|google us english/i.test(v.name))||voices.find(v=>v.lang==="en-US"&&v.localService);
      if(pick)utt.voice=pick;
      window.speechSynthesis.speak(utt);
    };
    if(window.speechSynthesis.getVoices().length>0)trySpeak();
    else window.speechSynthesis.onvoiceschanged=trySpeak;
  };

  const startListening=()=>{
    const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
    if(!SR){alert("Voice input needs Safari (iPhone) or Chrome.");return;}
    const r=new SR();r.continuous=false;r.interimResults=false;r.lang="en-US";
    r.onstart=()=>setListening(true);
    r.onend=()=>setListening(false);
    r.onerror=()=>setListening(false);
    r.onresult=(e)=>{const t=e.results[0][0].transcript;setInput(t);setTimeout(()=>sendMsg(t),300);};
    recRef.current=r;r.start();
  };
  const stopListening=()=>{recRef.current?.stop();setListening(false);};

  const ctx=()=>{
    const t=tasks.length>0?`Tasks:\n${tasks.map(t=>`- [${t.done?"✓":"○"}] ${t.text}${t.date?` due:${t.date}`:""} [${t.category}]`).join("\n")}`:"No tasks.";
    const e=events.length>0?`Blocks:\n${events.slice(-5).map(e=>`- ${e.title} ${e.start.split("T")[0]} [${e.category}]`).join("\n")}`:"";
    const p=profile?`Student: ${profile.name}, ${profile.year}. Stressors: ${profile.stressors?.join(", ")}. Style: ${TIME_STYLES.find(ts=>ts.id===profile.timeStyle)?.label||"flexible"}. Sleep: ${fmtH(profile.sleepH||22)}-${fmtH(profile.wakeH||7)}. Commitments: ${profile.commitments||"none"}.`:"";
    return [p,t,e].filter(Boolean).join("\n");
  };

  const call=async(m)=>{
    const res=await fetch("/api/chat",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({model:"claude-sonnet-4-20250514",max_tokens:400,system:SYS+"\n\nToday: "+new Date().toDateString()+" ("+todayStr()+").\n"+ctx(),messages:m.map(x=>({role:x.role,content:x.content}))})});
    return res.json();
  };

  useEffect(()=>{
    if(started)return;setStarted(true);setLoading(true);
    const greetMsg=profile?`Greet ${profile.name} warmly by name. They are a ${profile.year}. Keep it to 2 sentences.`:"Start with your greeting.";
    call([{role:"user",content:greetMsg}])
      .then(data=>{
        const raw=data.content?.map(b=>b.text||"").join("")||`Hi${profile?` ${profile.name}`:""}! 🌿 I'm Endive. How are you feeling today?`;
        const txt=cleanText(raw);
        setMsgs([{role:"assistant",content:txt}]);
        setTimeout(()=>speak(txt),600);
      })
      .catch(()=>setMsgs([{role:"assistant",content:`Hi${profile?` ${profile.name}`:""}! 🌿 I'm Endive. How are you feeling today?`}]))
      .finally(()=>setLoading(false));
  },[]);

  const sendMsg=async(text)=>{
    const u=(text||input).trim();if(!u||loading)return;
    setInput("");
    const nm=[...msgs,{role:"user",content:u}];
    setMsgs(nm);setLoading(true);
    try{
      const data=await call(nm);
      const raw=data.content?.map(b=>b.text||"").join("")||"Sorry, something went wrong.";
      const {events:ne,tasks:nt}=parseBlocks(raw);
      if(ne.length>0)setEvents(p=>[...p,...ne.map(e=>({...e,id:Date.now()+Math.random()}))]);
      if(nt.length>0)setTasks(p=>[...p,...nt.map(t=>({...t,id:Date.now()+Math.random(),done:false}))]);
      const txt=cleanText(raw);
      setMsgs(p=>[...p,{role:"assistant",content:txt,evs:ne,tsks:nt}]);
      speak(txt);
    }catch{
      setMsgs(p=>[...p,{role:"assistant",content:"Something went wrong. Please try again."}]);
    }
    setLoading(false);
  };

  const quick=["I'm feeling overwhelmed 😔","Help me plan my day with breaks","I have 3 assignments due soon","Remind me to rest today"];

  return(
    <div style={{display:"flex",flexDirection:"column",height:"100%"}}>
      <div style={{flex:1,overflowY:"auto",paddingRight:2,marginBottom:8}}>
        {msgs.length===0&&loading&&(
          <div style={{display:"flex",alignItems:"center",gap:8,color:"#6a9a7a",fontSize:13,marginTop:10}}>
            <span>Endive is getting ready</span>
            <Dots/>
          </div>
        )}
        {msgs.map((m,i)=>(
          <div key={i} style={{display:"flex",justifyContent:m.role==="user"?"flex-end":"flex-start",marginBottom:9}}>
            <div style={{maxWidth:"88%"}}>
              {m.role==="assistant"&&(
                <div style={{display:"flex",alignItems:"center",gap:5,marginBottom:3}}>
                  <div style={{width:21,height:21,borderRadius:"50%",background:"linear-gradient(135deg,#4a9e7a,#2d7a5a)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:11}}>🌿</div>
                  <span style={{fontSize:11,fontWeight:600,color:"#4a9e7a"}}>Endive</span>
                </div>
              )}
              <div style={{padding:"10px 13px",borderRadius:m.role==="user"?"16px 16px 4px 16px":"16px 16px 16px 4px",background:m.role==="user"?"#4a9e7a":"#f0f7f2",color:m.role==="user"?"#fff":"#1a3028",fontSize:13,lineHeight:1.65,whiteSpace:"pre-wrap"}}>{renderMd(m.content)}</div>
              {m.evs?.map((ev,j)=><EventCard key={j} ev={ev} cats={cats}/>)}
              {m.tsks?.length>0&&<div style={{marginTop:5,padding:"6px 11px",background:"#e8f5ef",borderRadius:8,fontSize:12,color:"#3a7a5a"}}>✅ Added {m.tsks.length} task{m.tsks.length>1?"s":""} to My Plan</div>}
            </div>
          </div>
        ))}
        {loading&&msgs.length>0&&<div style={{display:"flex",gap:4,padding:"10px 13px",background:"#f0f7f2",borderRadius:"16px 16px 16px 4px",width:"fit-content"}}><Dots/></div>}
        <div ref={ref}/>
      </div>

      {msgs.length<=1&&!loading&&(
        <div style={{display:"flex",gap:5,flexWrap:"wrap",marginBottom:9}}>
          {quick.map(p=><button key={p} onClick={()=>sendMsg(p)} style={{padding:"5px 11px",borderRadius:20,border:"1.5px solid #c2dece",background:"#f0f7f2",color:"#3a7a5a",fontSize:11,cursor:"pointer",fontFamily:"'DM Sans',sans-serif"}}>{p}</button>)}
        </div>
      )}

      {voiceMode&&(
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",background:"#e8f5ef",border:"1px solid #9ad4bc",borderRadius:9,padding:"6px 11px",marginBottom:7}}>
          <span style={{fontSize:12,color:"#2a6a4a",fontWeight:600}}>🎙️ Voice Mode on — hold mic to speak</span>
          <button onClick={()=>{setVoiceMode(false);setMuted(true);window.speechSynthesis.cancel();}} style={{fontSize:11,color:"#5a8a6a",background:"none",border:"none",cursor:"pointer",fontFamily:"'DM Sans',sans-serif"}}>Turn off</button>
        </div>
      )}

      <div style={{display:"flex",gap:6,alignItems:"center"}}>
        <input value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>e.key==="Enter"&&sendMsg()} placeholder={listening?"Listening...":voiceMode?"Hold mic or type...":"Message Endive..."} style={{...S.input,flex:1,background:listening?"#e8f5ef":"#f8fbf9"}}/>
        {voiceMode?(
          <button onMouseDown={startListening} onMouseUp={stopListening} onTouchStart={e=>{e.preventDefault();startListening();}} onTouchEnd={e=>{e.preventDefault();stopListening();}} style={{...S.iconBtn,background:listening?"#e07b5a":"#4a9e7a",position:"relative"}}>
            {listening?<span style={{fontSize:13}}>⏹</span>:<MicIcon/>}
            {listening&&<span style={{position:"absolute",top:-3,right:-3,width:8,height:8,borderRadius:"50%",background:"#e07b5a",animation:"pulse 1s infinite"}}/>}
          </button>
        ):(
          <button onClick={()=>{setVoiceMode(true);setMuted(false);}} style={{...S.iconBtn,background:"#f0f7f2",border:"1.5px solid #9ad4bc"}} title="Turn on Voice Mode">
            <MicIcon color="#4a9e7a"/>
          </button>
        )}
        <button onClick={()=>sendMsg()} disabled={loading} style={{...S.iconBtn,background:loading?"#b2d2be":"#4a9e7a",fontSize:17}}>→</button>
      </div>
      {!voiceMode&&<p style={{fontSize:11,color:"#aacaba",textAlign:"center",marginTop:5}}>Tap the mic to turn on Voice Mode</p>}
    </div>
  );
}

function Dots(){return<div style={{display:"flex",gap:3}}>{[0,1,2].map(i=><span key={i} style={{width:5,height:5,borderRadius:"50%",background:"#4a9e7a",animation:"pulse 1.2s infinite",animationDelay:`${i*0.2}s`,display:"block"}}/>)}</div>;}
function MicIcon({color="white"}){return<svg width="15" height="15" viewBox="0 0 24 24" fill={color}><path d="M12 1a4 4 0 014 4v7a4 4 0 01-8 0V5a4 4 0 014-4zm0 18.5A7.5 7.5 0 014.5 12a.5.5 0 011 0 6.5 6.5 0 0013 0 .5.5 0 011 0A7.5 7.5 0 0112 19.5zm-1 1.5h2v2h-2z"/></svg>;}

// ── App ───────────────────────────────────────────────────────────────────────
const TABS=["🌿 Endive","My Plan","My Calendar"];

export default function App(){
  const [profile,setProfile]=useState(null);
  const [tasks,setTasks]=useState([]);
  const [events,setEvents]=useState([]);
  const [cats,setCats]=useState(CATS);
  const [tab,setTab]=useState("🌿 Endive");
  const [pending,setPending]=useState(null);

  const onDone=(p)=>{
    setProfile(p);
    setPending(`My name is ${p.name}, I'm a ${p.year}. My stressors: ${p.stressors.join(", ")}. Commitments: ${p.commitments||"none"}. Sleep: ${fmtH(p.sleepH)} to ${fmtH(p.wakeH)}. Goals: ${p.goals.join(", ")}. Time style: ${TIME_STYLES.find(t=>t.id===p.timeStyle)?.label||"flexible"}. Please greet me warmly and let me know you have what you need.`);
  };

  const doAction=(action)=>{setPending(action);setTab("🌿 Endive");};

  const today=new Date();
  const h=today.getHours();
  const greeting=h<12?"Good morning":h<18?"Good afternoon":"Good evening";
  const pendingCount=tasks.filter(t=>!t.done).length;

  return(
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Lora:wght@400;600&family=DM+Sans:wght@300;400;500&display=swap');
        *{box-sizing:border-box;margin:0;padding:0;}
        body{background:#eef7f2;min-height:100vh;}
        @keyframes pulse{0%,100%{opacity:.3;transform:scale(.8)}50%{opacity:1;transform:scale(1)}}
        @keyframes fadeUp{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
        select{-webkit-appearance:none;}
        input[type="date"]::-webkit-calendar-picker-indicator{opacity:0.4;cursor:pointer;}
        ::-webkit-scrollbar{width:4px}::-webkit-scrollbar-thumb{background:#c2dece;border-radius:4px}
      `}</style>

      {!profile&&<Onboarding onDone={onDone}/>}

      <div style={{minHeight:"100vh",background:"#eef7f2",fontFamily:"'DM Sans',sans-serif",display:"flex",alignItems:"flex-start",justifyContent:"center",padding:"22px 14px"}}>
        <div style={{width:"100%",maxWidth:520,animation:"fadeUp 0.5s ease-out"}}>
          <div style={{marginBottom:16}}>
            <p style={{fontSize:12,color:"#8aaa9a",marginBottom:3}}>{today.toLocaleDateString("en-US",{weekday:"long",month:"long",day:"numeric"})}</p>
            <div style={{display:"flex",alignItems:"center",gap:10}}>
              <div style={{width:34,height:34,borderRadius:"50%",background:"linear-gradient(135deg,#4a9e7a,#2d7a5a)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:17,flexShrink:0}}>🌿</div>
              <div>
                <h1 style={{fontFamily:"'Lora',serif",fontSize:20,fontWeight:600,color:"#1a3028",lineHeight:1.2}}>{greeting}{profile?`, ${profile.name}`:""}!</h1>
                <p style={{fontSize:11,color:"#6a9a7a"}}>Endive is here for you</p>
              </div>
            </div>
            {pendingCount>0&&<div style={{marginTop:8,padding:"5px 12px",background:"#fff",borderRadius:10,border:"1px solid #c2dece",display:"inline-flex",alignItems:"center",gap:6}}><span style={{width:7,height:7,borderRadius:"50%",background:"#4a9e7a",display:"inline-block"}}/><span style={{fontSize:12,color:"#3a6a4a"}}><strong>{pendingCount}</strong> task{pendingCount!==1?"s":""} pending</span></div>}
          </div>

          <div style={{background:"#fff",borderRadius:20,boxShadow:"0 2px 28px rgba(26,48,40,0.08)",overflow:"hidden"}}>
            <div style={{display:"flex",borderBottom:"1px solid #e8f2ec"}}>
              {TABS.map(t=>(
                <button key={t} onClick={()=>setTab(t)} style={{flex:1,padding:"12px 0",border:"none",background:"transparent",fontFamily:"'DM Sans',sans-serif",fontSize:12,fontWeight:tab===t?600:400,color:tab===t?"#4a9e7a":"#8aaa9a",cursor:"pointer",borderBottom:tab===t?"2px solid #4a9e7a":"2px solid transparent",transition:"all 0.15s"}}>{t}</button>
              ))}
            </div>
            <div style={{padding:16,minHeight:tab==="🌿 Endive"?480:"auto",display:"flex",flexDirection:"column"}}>
              {tab==="🌿 Endive"&&<ChatTab tasks={tasks} setTasks={setTasks} events={events} setEvents={setEvents} cats={cats} profile={profile} pendingAction={pending} clearPending={()=>setPending(null)}/>}
              {tab==="My Plan"&&<TasksTab tasks={tasks} setTasks={setTasks} cats={cats} events={events} onAction={doAction}/>}
              {tab==="My Calendar"&&<CalendarTab events={events} setEvents={setEvents} cats={cats} setCats={setCats} tasks={tasks} setTasks={setTasks} onAction={doAction}/>}
            </div>
          </div>
          <p style={{textAlign:"center",fontSize:11,color:"#aacaba",marginTop:14}}>Endive · your personal assistant 🌿</p>
        </div>
      </div>
    </>
  );
}
