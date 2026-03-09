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
const OL_HD={fontFamily:"'Lora',serif",fontSize:20,fontWeight:600,color:"#1a3028",marginBottom:6};
const OL_SB={fontSize:13,color:"#6a9a7a",marginBottom:12,lineHeight:1.6};

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
      <h2 style={OL_HD}>Hi! I'm Endive.</h2>
      <p style={OL_SB}>Your personal burnout-prevention assistant. Quick setup — 2 minutes.</p>
      <label style={S.label}>What's your name?</label>
      <input autoFocus value={d.name} onChange={e=>setD(p=>({...p,name:e.target.value}))} onKeyDown={e=>e.key==="Enter"&&canNext[0]&&go(1)} placeholder="Your first name..." style={S.input}/>
    </div>,

    <div key="1">
      <div style={{fontSize:40,marginBottom:10}}>🎓</div>
      <h2 style={OL_HD}>Hey {d.name}! What year are you?</h2>
      <div style={{display:"flex",flexWrap:"wrap",gap:8,marginTop:6}}>
        {YEAR_OPTS.map(y=><button key={y} onClick={()=>setD(p=>({...p,year:y}))} style={{...S.chip,background:d.year===y?"#4a9e7a":"#f0f7f2",color:d.year===y?"#fff":"#3a6a4a",border:`1.5px solid ${d.year===y?"#4a9e7a":"#c2dece"}`}}>{y}</button>)}
      </div>
    </div>,

    <div key="2">
      <div style={{fontSize:40,marginBottom:10}}>💭</div>
      <h2 style={OL_HD}>What weighs on you most?</h2>
      <p style={OL_SB}>No judgment — select all that apply.</p>
      <div style={{display:"flex",flexWrap:"wrap",gap:8}}>
        {STRESS_OPTS.map(s=>{const sel=d.stressors.includes(s);return<button key={s} onClick={()=>tog("stressors",s)} style={{...S.chip,background:sel?"#e07b5a":"#f0f7f2",color:sel?"#fff":"#3a6a4a",border:`1.5px solid ${sel?"#e07b5a":"#c2dece"}`}}>{s}</button>;})}
      </div>
    </div>,

    <div key="3">
      <div style={{fontSize:40,marginBottom:10}}>🗓️</div>
      <h2 style={OL_HD}>Recurring commitments</h2>
      <p style={OL_SB}>Classes, work shifts, gym, clubs... Endive will always schedule around these.</p>
      <textarea value={d.commitments} onChange={e=>setD(p=>({...p,commitments:e.target.value}))} placeholder={"e.g. BIO 101 MWF 10-11am\nWork Tue/Thu 3-6pm\nGym Mon/Wed 7am
