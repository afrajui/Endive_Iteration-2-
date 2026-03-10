import { useState, useRef, useEffect } from "react";

// ── Constants ──────────────────────────────────────────────────────────────────
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
  {id:"timeblocking",label:"Time Blocking",      desc:"Schedule every hour intentionally"},
  {id:"pomodoro",    label:"Pomodoro",            desc:"25 min focus, 5 min break cycles"},
  {id:"eat_frog",    label:"Eat the Frog",        desc:"Hardest task first every morning"},
  {id:"gtd",         label:"Getting Things Done", desc:"Capture, clarify, organize, reflect"},
  {id:"flowing",     label:"Go with the Flow",    desc:"Flexible, respond to how you feel"},
];

const STRESS_OPTS=["Classes & studying","Work or internship","Social life","Family responsibilities","Finances","Health & sleep","Extracurriculars","All of the above"];
const GOAL_OPTS=["Reduce stress & burnout","Stay on top of deadlines","Build better habits","Balance school & personal life","Improve focus & productivity","Feel more in control"];
const YEAR_OPTS=["Freshman","Sophomore","Junior","Senior","Grad Student","Other"];

// ── Helpers ────────────────────────────────────────────────────────────────────
function getDIM(y,m){return new Date(y,m+1,0).getDate();}
function getFirst(y,m){return new Date(y,m,1).getDay();}
function todayStr(){const d=new Date();return`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;}
function localISO(d=new Date()){return`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}T${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}:00`;}
function addDays(n){const d=new Date();d.setDate(d.getDate()+n);return`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;}
function pad(n){return String(n).padStart(2,"0");}
function dkey(y,m,d){return `${y}-${pad(m+1)}-${pad(d)}`;}
function fmtH(h){return h===0?"12am":h<12?`${h}am`:h===12?"12pm":`${h-12}pm`;}
function fmtTime(iso){
  // Parse directly from string to avoid any UTC/local timezone shift
  if(!iso)return"";
  const t=iso.split("T")[1];
  if(!t)return"";
  const[hStr,mStr]=t.split(":");
  const h=parseInt(hStr),m=parseInt(mStr);
  const ampm=h<12?"AM":"PM";
  const h12=h===0?12:h>12?h-12:h;
  return`${h12}:${String(m).padStart(2,"0")} ${ampm}`;
}

// Parse display date from ISO string without UTC shift
function isoDate(iso){
  if(!iso)return"";
  const[y,m,d]=iso.split("T")[0].split("-");
  return new Date(parseInt(y),parseInt(m)-1,parseInt(d));
}
function autoQ(t){
  const urg=t.date&&t.date<=addDays(3);
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
  const{title,sh,eh,category,date,recur,recurDays,recurWeeks}=ev;
  if(!date||recur==="none")return[{id:Date.now()+Math.random(),title,start:`${date}T${pad(sh)}:00:00`,end:`${date}T${pad(eh)}:00:00`,category,description:"",isRecurring:false}];
  const insts=[];
  const s=new Date(date+"T12:00:00"),tw=parseInt(recurWeeks)||4;
  const end=new Date(s);end.setDate(end.getDate()+tw*7);
  const rid=title+"-"+date;
  if(recur==="daily"){
    const c=new Date(s);
    while(c<=end){
      const d=`${c.getFullYear()}-${pad(c.getMonth()+1)}-${pad(c.getDate())}`;
      insts.push({id:Date.now()+Math.random(),title,start:`${d}T${pad(sh)}:00:00`,end:`${d}T${pad(eh)}:00:00`,category,description:"",recurId:rid,isRecurring:true});
      c.setDate(c.getDate()+1);
    }
  } else {
    const days=(recurDays&&recurDays.length>0)?recurDays:[s.getDay()];
    const c=new Date(s);c.setDate(c.getDate()-c.getDay());
    let week=0;
    while(c<=end){
      if(recur==="biweekly"&&week%2!==0){c.setDate(c.getDate()+7);week++;continue;}
      for(const day of days){
        const dd=new Date(c);dd.setDate(dd.getDate()+day);
        if(dd>=s&&dd<=end){
          const ds=`${dd.getFullYear()}-${pad(dd.getMonth()+1)}-${pad(dd.getDate())}`;
          insts.push({id:Date.now()+Math.random(),title,start:`${ds}T${pad(sh)}:00:00`,end:`${ds}T${pad(eh)}:00:00`,category,description:"",recurId:rid,isRecurring:true});
        }
      }
      c.setDate(c.getDate()+7);week++;
    }
  }
  return insts;
}

// Parse commitments text into recurring events starting today
function parseCommitmentsToEvents(text){
  if(!text||!text.trim())return[];
  const events=[];
  const today=new Date();
  const lines=text.split("\n").filter(l=>l.trim());
  const dayMap={su:0,sun:0,sunday:0,mo:1,mon:1,monday:1,tu:2,tue:2,tuesday:2,we:3,wed:3,wednesday:3,th:4,thu:4,thursday:4,fr:5,fri:5,friday:5,sa:6,sat:6,saturday:6};
  const mwf=[1,3,5],tth=[2,4],mw=[1,3],wf=[3,5];

  lines.forEach(line=>{
    const low=line.toLowerCase();
    let recurDays=[];
    if(low.includes("mwf"))recurDays=mwf;
    else if(low.includes("t/th")||low.includes("tth")||low.includes("tue/thu")||low.includes("tu/th"))recurDays=tth;
    else if(low.includes("mw"))recurDays=mw;
    else if(low.includes("wf"))recurDays=wf;
    else{
      const words=low.split(/[\s,/]+/);
      words.forEach(w=>{if(dayMap[w]!==undefined&&!recurDays.includes(dayMap[w]))recurDays.push(dayMap[w]);});
    }
    if(recurDays.length===0)recurDays=[today.getDay()];

    // Try to extract time
    const timeMatch=line.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i);
    let sh=9,eh=10;
    if(timeMatch){
      let hr=parseInt(timeMatch[1]);
      const min=timeMatch[2]?parseInt(timeMatch[2]):0;
      const ampm=timeMatch[3]?.toLowerCase();
      if(ampm==="pm"&&hr<12)hr+=12;
      if(ampm==="am"&&hr===12)hr=0;
      sh=hr;
      // look for end time
      const endMatch=line.match(/[-–]\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i);
      if(endMatch){
        let ehr=parseInt(endMatch[1]);
        const eampm=endMatch[3]?.toLowerCase()||(ehr<sh?"pm":ampm)||"am";
        if(eampm==="pm"&&ehr<12)ehr+=12;
        if(eampm==="am"&&ehr===12)ehr=0;
        eh=ehr;
      } else {
        eh=sh+1;
      }
    }

    // Detect category
    let category="personal";
    if(/class|lecture|lab|seminar|bio|chem|math|eng|hist|psych|cs|econ/i.test(line))category="class";
    else if(/work|shift|job|intern/i.test(line))category="work";
    else if(/gym|workout|run|yoga|exercise/i.test(line))category="personal";
    else if(/study|review|homework/i.test(line))category="study";

    // Title = first meaningful part
    const title=line.replace(/(\d{1,2}(?::\d{2})?\s*(?:am|pm)?[\s\-–]*\d{0,2}(?::\d{2})?\s*(?:am|pm)?)/gi,"").replace(/\b(mwf|tth|mw|wf|mon|tue|wed|thu|fri|sat|sun|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/gi,"").replace(/[,/]+/g,"").trim()||line.trim();

    const startDate=new Date(today);
    // Move to next occurrence of first recurDay
    const firstDay=Math.min(...recurDays);
    const diff=(firstDay-startDate.getDay()+7)%7;
    startDate.setDate(startDate.getDate()+(diff===0?0:diff));
    const dateStr=`${startDate.getFullYear()}-${pad(startDate.getMonth()+1)}-${pad(startDate.getDate())}`;

    const instances=genRecurring({title,sh,eh,category,date:dateStr,recur:"weekly",recurDays,recurWeeks:16});
    events.push(...instances);
  });
  return events;
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

// ── Shared styles ──────────────────────────────────────────────────────────────
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

// ── Modal ──────────────────────────────────────────────────────────────────────
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

// ── Now Banner — shows current/next event live ─────────────────────────────────
function NowBanner({events,tasks,cats}){
  const [now,setNow]=useState(new Date());
  useEffect(()=>{const t=setInterval(()=>setNow(new Date()),30000);return()=>clearInterval(t);},[]);

  const todayS=todayStr();
  const nowLocal=localISO(now);

  const allBlocks=[
    ...events,
    ...(tasks||[]).filter(t=>!t.done&&t.date).map(taskBlock).filter(Boolean)
  ].filter(e=>e.start&&e.start.startsWith(todayS));

  // Currently happening
  const current=allBlocks.find(e=>e.end&&e.start<=nowLocal&&e.end>=nowLocal);

  // Next upcoming today
  const next=!current&&allBlocks
    .filter(e=>e.start>nowLocal)
    .sort((a,b)=>a.start>b.start?1:-1)[0];

  const ev=current||next;
  if(!ev)return null;

  const cat=cats.find(c=>c.id===ev.category)||cats[3];
  return(
    <div style={{background:cat.bg,border:`1.5px solid ${cat.color}`,borderRadius:12,padding:"10px 14px",display:"flex",alignItems:"center",gap:10}}>
      <div style={{width:8,height:8,borderRadius:"50%",background:cat.color,flexShrink:0,animation:current?"pulse 2s infinite":"none"}}/>
      <div style={{flex:1}}>
        <div style={{fontSize:11,fontWeight:700,color:cat.color,textTransform:"uppercase",letterSpacing:"0.05em"}}>{current?"Now":"Up next"}</div>
        <div style={{fontSize:13,fontWeight:600,color:"#1a3028"}}>{cat.emoji} {ev.title}</div>
        <div style={{fontSize:11,color:"#8aaa9a"}}>{fmtTime(ev.start)}{ev.end&&` – ${fmtTime(ev.end)}`}</div>
      </div>
    </div>
  );
}

// ── Onboarding styles (module-level to avoid hoisting crash) ───────────────────
const OL_HD={fontFamily:"'Lora',serif",fontSize:20,fontWeight:600,color:"#1a3028",marginBottom:6};
const OL_SB={fontSize:13,color:"#6a9a7a",marginBottom:12,lineHeight:1.6};

// ── Onboarding ─────────────────────────────────────────────────────────────────
function Onboarding({onDone}){
  const [step,setStep]=useState(0);
  const [fade,setFade]=useState(true);
  const [d,setD]=useState({name:"",year:"",stressors:[],commitments:"",sleepH:22,wakeH:7,goals:[],timeStyle:""});

  const go=(dir)=>{setFade(false);setTimeout(()=>{setStep(s=>s+dir);setFade(true);},200);};
  const tog=(f,v)=>setD(p=>({...p,[f]:p[f].includes(v)?p[f].filter(x=>x!==v):[...p[f],v]}));

  const canNext=[d.name.trim().length>0,d.year!=="",d.stressors.length>0,true,true,d.goals.length>0,d.timeStyle!=="",true];

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
      <p style={OL_SB}>Classes, work shifts, gym, clubs... Endive will schedule around these every week.</p>
      <textarea value={d.commitments} onChange={e=>setD(p=>({...p,commitments:e.target.value}))} placeholder={"e.g. BIO 101 MWF 10-11am\nWork Tue/Thu 3-6pm\nGym Mon/Wed 7am"} style={{...S.input,height:100,resize:"none",lineHeight:1.6}}/>
      <p style={{fontSize:11,color:"#8aaa9a",marginTop:5}}>Optional — you can always add more later.</p>
    </div>,

    <div key="4">
      <div style={{fontSize:40,marginBottom:10}}>😴</div>
      <h2 style={OL_HD}>Your sleep schedule</h2>
      <p style={OL_SB}>Endive will never schedule anything during your sleep.</p>
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
      <h2 style={OL_HD}>What do you want from Endive?</h2>
      <div style={{display:"flex",flexWrap:"wrap",gap:8,marginTop:6}}>
        {GOAL_OPTS.map(g=>{const sel=d.goals.includes(g);return<button key={g} onClick={()=>tog("goals",g)} style={{...S.chip,background:sel?"#7c6fcd":"#f0f7f2",color:sel?"#fff":"#3a6a4a",border:`1.5px solid ${sel?"#7c6fcd":"#c2dece"}`}}>{g}</button>;})}
      </div>
    </div>,

    <div key="6">
      <div style={{fontSize:40,marginBottom:10}}>⏱️</div>
      <h2 style={OL_HD}>How do you like to work?</h2>
      <p style={OL_SB}>Endive plans around your style.</p>
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
      <h2 style={{...OL_HD,textAlign:"center"}}>All set, {d.name}!</h2>
      <p style={{...OL_SB,textAlign:"center"}}>Endive knows what matters to you. Let's build something sustainable.</p>
      <div style={{background:"#e8f5ef",borderRadius:12,padding:"12px 16px",marginTop:14,textAlign:"left"}}>
        {[`${d.year}`,`Style: ${TIME_STYLES.find(t=>t.id===d.timeStyle)?.label||"flexible"}`,`Sleep: ${fmtH(d.sleepH)} – ${fmtH(d.wakeH)}`,d.commitments?`${d.commitments.split("\n").filter(Boolean).length} recurring commitment(s) added to calendar`:null].filter(Boolean).map((item,i)=>(
          <div key={i} style={{fontSize:12,color:"#2a5a3a",padding:"2px 0",display:"flex",gap:6}}><span style={{color:"#4a9e7a"}}>✓</span>{item}</div>
        ))}
      </div>
    </div>,
  ];

  const isLast=step===steps.length-1;

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

// ── Insight strip ──────────────────────────────────────────────────────────────
function getInsights(tasks,events){
  const todayS=todayStr();
  const in3=addDays(3);
  const in7=addDays(7);
  const pending=tasks.filter(t=>!t.done);
  const ins=[];
  const hasRestToday=events.some(e=>e.category==="rest"&&e.start.startsWith(todayS));
  if(!hasRestToday&&new Date().getHours()<18)ins.push({type:"rest",msg:"No rest block today. Want Endive to add one?",action:"Add a rest block for me today"});
  const dayCounts={};
  events.forEach(e=>{const dd=e.start.split("T")[0];if(dd>=todayS&&dd<=in7)dayCounts[dd]=(dayCounts[dd]||0)+1;});
  const heavy=Object.entries(dayCounts).filter(([,c])=>c>=4)[0];
  if(heavy){const label=new Date(heavy[0]+"T12:00:00").toLocaleDateString("en-US",{weekday:"long"});ins.push({type:"heavy",msg:`${label} looks packed. Want me to rebalance?`,action:`Rebalance my ${label}`});}
  const urgent=pending.filter(t=>t.date&&t.date<=in3);
  if(urgent.length>=3)ins.push({type:"urgent",msg:`${urgent.length} things due in 3 days. Make a plan?`,action:"Make a plan for my urgent tasks"});
  return ins.slice(0,2);
}
const INS_ST={rest:{bg:"#f3eaf8",border:"#b07db8",color:"#7a4a8a",icon:"😴"},heavy:{bg:"#fceee8",border:"#e07b5a",color:"#a04a2a",icon:"⚡"},urgent:{bg:"#fdf3e0",border:"#e8a838",color:"#8a5a10",icon:"🔥"}};
function InsightStrip({tasks,events,onAction}){
  const ins=getInsights(tasks,events);
  if(!ins.length)return null;
  return(
    <div style={{marginBottom:12}}>
      {ins.map((x,i)=>{const st=INS_ST[x.type]||INS_ST.rest;return(
        <div key={i} style={{background:st.bg,border:`1px solid ${st.border}`,borderRadius:10,padding:"8px 11px",marginBottom:5,display:"flex",alignItems:"center",gap:8}}>
          <span style={{fontSize:15}}>{st.icon}</span>
          <span style={{flex:1,fontSize:12,color:st.color,lineHeight:1.4}}>{x.msg}</span>
          <button onClick={()=>onAction(x.action)} style={{fontSize:11,fontWeight:600,color:st.color,background:"#fff",border:`1px solid ${st.border}`,borderRadius:6,padding:"4px 8px",cursor:"pointer",flexShrink:0,fontFamily:"'DM Sans',sans-serif"}}>Ask Endive</button>
        </div>
      );})}
    </div>
  );
}

// ── Calendar tab ───────────────────────────────────────────────────────────────
function CalendarTab({events,setEvents,cats,setCats,tasks,setTasks,onAction}){
  const today=new Date();
  const [view,setView]=useState("month");
  const [cur,setCur]=useState({y:today.getFullYear(),m:today.getMonth(),d:today.getDate()});
  const [showAdd,setShowAdd]=useState(false);
  const [showCat,setShowCat]=useState(false);
  const [editT,setEditT]=useState(null);
  const [nEv,setNEv]=useState({title:"",date:todayStr(),sh:9,eh:10,category:"personal",recur:"none",recurDays:[],recurWeeks:4});
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
    setShowAdd(false);
    setNEv({title:"",date:todayStr(),sh:9,eh:10,category:"personal",recur:"none",recurDays:[],recurWeeks:4});
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
    return<div style={{fontSize:9,padding:"1px 4px",borderRadius:3,background:cat.color,color:"#fff",marginBottom:1,overflow:"hidden",whiteSpace:"nowrap",textOverflow:"ellipsis"}}>{ev.isRecurring?"🔁 ":ev.isTask?"📌 ":""}{ev.title}</div>;
  };

  return(
    <div>
      <InsightStrip tasks={tasks||[]} events={events} onAction={onAction||(() => {})}/>

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

      <div style={{display:"flex",flexWrap:"wrap",gap:5,marginBottom:10}}>
        {cats.map(c=><span key={c.id} style={{fontSize:10,padding:"2px 7px",borderRadius:20,background:c.bg,color:c.color,fontWeight:600}}>{c.emoji} {c.label}</span>)}
      </div>

      {/* Year */}
      {view==="year"&&(
        <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8}}>
          {Array.from({length:12},(_,mi)=>{
            const cells=[];
            for(let i=0;i<getFirst(cur.y,mi);i++)cells.push(null);
            for(let dd=1;dd<=getDIM(cur.y,mi);dd++)cells.push(dd);
            return(
              <div key={mi} onClick={()=>{setCur(c=>({...c,m:mi}));setView("month");}} style={{background:"#f8fbf9",borderRadius:9,padding:7,cursor:"pointer"}}>
                <div style={{fontSize:10,fontWeight:700,color:"#4a9e7a",marginBottom:3}}>{MONTHS_S[mi]}</div>
                <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:1}}>
                  {cells.map((dd,i)=>{const isT=dd&&cur.y===today.getFullYear()&&mi===today.getMonth()&&dd===today.getDate();const has=dd&&evDay(dkey(cur.y,mi,dd)).length>0;return<div key={i} style={{aspectRatio:"1",display:"flex",alignItems:"center",justifyContent:"center",borderRadius:2,background:isT?"#4a9e7a":has?"#c2dece":"transparent",fontSize:7,color:isT?"#fff":"#2a4a3a"}}>{dd}</div>;})}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Month */}
      {view==="month"&&(
        <div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",marginBottom:3}}>
            {DAYS_S.map(d=><div key={d} style={{textAlign:"center",fontSize:10,color:"#8aaa9a",fontWeight:600,padding:"2px 0"}}>{d}</div>)}
          </div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:3}}>
            {(()=>{
              const cells=[];
              for(let i=0;i<getFirst(cur.y,cur.m);i++)cells.push(null);
              for(let dd=1;dd<=getDIM(cur.y,cur.m);dd++)cells.push(dd);
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

      {/* Week */}
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

      {/* Day */}
      {view==="day"&&(
        <div style={{maxHeight:450,overflowY:"auto",position:"relative"}}>
          {/* Hour grid rows */}
          {HOURS.map(h=>(
            <div key={h} style={{display:"flex",gap:8,height:56,borderTop:"1px solid #f0f5f2",paddingTop:3}}>
              <div style={{width:40,fontSize:10,color:"#bbb",flexShrink:0,textAlign:"right"}}>{fmtH(h)}</div>
              <div style={{flex:1}}/>
            </div>
          ))}
          {/* Overlay events spanning their full duration */}
          {(()=>{
            const dk2=dkey(cur.y,cur.m,cur.d);
            const dayEvs=allBlocks.filter(e=>e.start.startsWith(dk2));
            return dayEvs.map(ev=>{
              const cat=cats.find(c=>c.id===ev.category)||cats[3];
              const sh=parseInt(ev.start.split("T")[1]||"0");
              const eh=ev.end?parseInt(ev.end.split("T")[1]||String(sh+1)):sh+1;
              const duration=Math.max(eh-sh,1);
              const topOffset=HOURS.indexOf(sh)*56+4;
              const blockHeight=duration*56-6;
              if(HOURS.indexOf(sh)<0)return null;
              return(
                <div key={ev.id}
                  onClick={ev.isTask?()=>setEditT({tid:ev.taskId,sh,eh}):undefined}
                  style={{position:"absolute",left:52,right:8,top:topOffset,height:blockHeight,padding:"5px 9px",borderRadius:8,background:cat.bg,borderLeft:`3px solid ${cat.color}`,fontSize:12,color:"#1a3028",cursor:ev.isTask?"pointer":"default",overflow:"hidden",zIndex:1}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
                    <span style={{fontWeight:600,flex:1}}>{ev.isTask?"📌 ":ev.isRecurring?"🔁 ":""}{ev.title}</span>
                    {!ev.isTask&&<button onClick={e=>{e.stopPropagation();ev.recurId?setEvents(p=>p.filter(x=>x.recurId!==ev.recurId)):setEvents(p=>p.filter(x=>x.id!==ev.id));}} style={{background:"none",border:"none",color:"#ccc",cursor:"pointer",fontSize:14,lineHeight:1,padding:0}}>×</button>}
                  </div>
                  <div style={{fontSize:10,color:cat.color,marginTop:1}}>{fmtTime(ev.start)}{ev.end&&` – ${fmtTime(ev.end)}`}</div>
                </div>
              );
            });
          })()}
        </div>
      )}

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
            <option value="weekly">Weekly</option>
            <option value="biweekly">Biweekly</option>
          </select>
          {(nEv.recur==="weekly"||nEv.recur==="biweekly")&&(
            <div style={{display:"flex",gap:5,marginBottom:9,flexWrap:"wrap"}}>
              {["Su","Mo","Tu","We","Th","Fr","Sa"].map((dd,i)=>{const sel=nEv.recurDays.includes(i);return<button key={i} onClick={()=>setNEv(p=>({...p,recurDays:sel?p.recurDays.filter(x=>x!==i):[...p.recurDays,i]}))} style={{width:34,height:34,borderRadius:"50%",border:`2px solid ${sel?"#4a9e7a":"#e0ece6"}`,background:sel?"#4a9e7a":"#fff",color:sel?"#fff":"#5a8a6a",fontSize:11,fontWeight:600,cursor:"pointer",fontFamily:"'DM Sans',sans-serif"}}>{dd}</button>;})}
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

// ── Tasks tab ──────────────────────────────────────────────────────────────────
function TaskItem({t,cats,toggle,remove}){
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
}

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
  const getQ=t=>{
    if(t.quadrant)return t.quadrant;
    const urg=t.date&&t.date<=addDays(3);
    const imp=["class","study","work"].includes(t.category);
    if(urg&&imp)return"do"; if(!urg&&imp)return"schedule"; if(urg&&!imp)return"delegate"; return"eliminate";
  };

  const todayS=todayStr();
  const pending=tasks.filter(t=>!t.done);

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
          {pending.filter(t=>!t.date||t.date===todayS).length>0&&<><div style={S.sec}>Current</div>{pending.filter(t=>!t.date||t.date===todayS).map(t=><TaskItem key={t.id} t={t} cats={cats} toggle={toggle} remove={remove}/>)}</>}
          {pending.filter(t=>t.date&&t.date<todayS).length>0&&<><div style={{...S.sec,marginTop:12,color:"#e07b5a"}}>Overdue</div>{pending.filter(t=>t.date&&t.date<todayS).sort((a,b)=>a.date>b.date?1:-1).map(t=><TaskItem key={t.id} t={t} cats={cats} toggle={toggle} remove={remove}/>)}</>}
          {pending.filter(t=>t.date&&t.date>todayS).length>0&&<><div style={{...S.sec,marginTop:12}}>Upcoming</div>{pending.filter(t=>t.date&&t.date>todayS).sort((a,b)=>a.date>b.date?1:-1).map(t=><TaskItem key={t.id} t={t} cats={cats} toggle={toggle} remove={remove}/>)}</>}
          {tasks.filter(t=>t.done).length>0&&<><div style={{...S.sec,marginTop:12,opacity:0.5}}>Done</div>{tasks.filter(t=>t.done).map(t=><TaskItem key={t.id} t={t} cats={cats} toggle={toggle} remove={remove}/>)}</>}
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

// ── System prompt ──────────────────────────────────────────────────────────────
const SYS=`You are Endive, a warm and caring personal assistant for college students focused on preventing burnout.

RESPONSE LENGTH: 2-4 sentences max unless building a full day plan. Be warm, direct, human. No long bullet lists.

TIME: You will receive the user's current local time in context. If you do NOT have their time yet, ask: "Quick question — what time is it for you right now? I want to make sure I plan around your actual day." Do not ask again once you have it.

TASK TRACKING RULES (critical — follow every single time):
- ANY time the user mentions a task, assignment, project, deadline, or "due" date — you MUST output a TASK_JSON for it at the end of your reply, no exceptions.
- If the user says "TikTok project due tonight", output a TASK_JSON. If they say "I have an essay due Friday", output a TASK_JSON. Always.
- After adding a task, say: "I've added that to your Task tab — you can track it and update it there anytime."
- Occasionally (not every message) remind users: "Your Task tab is the best place to see everything on your plate and how it fits in your week."
- Use quadrant "do" for anything due within 2 days, "schedule" for 3-7 days, "delegate" for low importance, "eliminate" for optional/low value.

PLANNING RULES (follow every time you build a schedule):
- Never schedule anything during the user's stated sleep hours
- Always include: at least one meal break (30-60 min), short breaks every 90 min (10-15 min), a wind-down block before bed
- No focused work after 9pm unless user insists
- Schedule around their recurring commitments — treat those as immovable
- If the day looks too full, say so and redistribute
- Check in emotionally before diving into planning — a quick "how are you feeling?" first

TIME FORMAT RULES (critical — follow exactly):
- Use the TODAY'S DATE FOR JSON value provided in context for today's date in all EVENT_JSON fields.
- Times must match what the user says in LOCAL time. "1PM" = T13:00:00. "9AM" = T09:00:00. "10PM" = T22:00:00.
- NEVER add or subtract hours from what the user states. If they say 1PM, write T13:00:00. Do not convert to UTC.
- "Due by 12AM tonight" = deadline is 11:59PM tonight. Schedule a work block BEFORE it (e.g. 9PM-11PM), not AT midnight.
- "Class 1-2PM Monday" → find next Monday's date, output start: "YYYY-MM-DDT13:00:00", end: "YYYY-MM-DDT14:00:00".
- Never use T00:00:00 as an event start unless user explicitly says "starting at midnight".

DUPLICATE PREVENTION: Never add an event or task that already exists in the user's context. Check the existing tasks and calendar blocks before outputting any JSON.

To add a calendar event (at END of reply, one per line):
EVENT_JSON:{"title":"title","start":"YYYY-MM-DDTHH:MM:00","end":"YYYY-MM-DDTHH:MM:00","category":"rest","description":""}

To add a task (at END of reply, one per line):
TASK_JSON:{"text":"task name","date":"YYYY-MM-DD","category":"personal","quadrant":"do"}

Categories: class, study, work, personal, errands, rest
Quadrants: do (due ≤2 days), schedule (3-7 days), delegate (low importance), eliminate (optional)

BREAKS to always include in plans:
- ☕ Short break: 10-15 min (category: rest)
- 🚶 Walk: 15-20 min (category: rest)
- 🍽️ Meal: 30-60 min (category: rest)
- 😴 Wind-down: 20-30 min before bed (category: rest)

If user seems overwhelmed, validate feelings before planning. Celebrate small wins. Redirect gently if off-topic.`;

function parseBlocks(text){
  const events=[],tasks=[];
  const eRe=/EVENT_JSON:(\{[^\n]+\})/g;
  const tRe=/TASK_JSON:(\{[^\n]+\})/g;
  let m;
  while((m=eRe.exec(text))!==null){try{events.push(JSON.parse(m[1]));}catch(e){}}
  while((m=tRe.exec(text))!==null){try{tasks.push(JSON.parse(m[1]));}catch(e){}}
  return{events,tasks};
}
function cleanText(t){return t.replace(/EVENT_JSON:\{[^\n]+\}/g,"").replace(/TASK_JSON:\{[^\n]+\}/g,"").trim();}
function renderMd(text){
  return text.split(/(\*\*[^*]+\*\*)/).map((p,i)=>p.startsWith("**")&&p.endsWith("**")?<strong key={i}>{p.slice(2,-2)}</strong>:p);
}

// ── Chat tab ───────────────────────────────────────────────────────────────────
function ChatTab({tasks,setTasks,events,setEvents,cats,profile,pendingAction,clearPending}){
  const [msgs,setMsgs]=useState([]);
  const [input,setInput]=useState("");
  const [loading,setLoading]=useState(false);
  const [listening,setListening]=useState(false);
  const ref=useRef(null);
  const recRef=useRef(null);
  const startedRef=useRef(false); // ref so effects don't re-run on state change
  const pendingFiredRef=useRef(false);

  useEffect(()=>{ref.current?.scrollIntoView({behavior:"smooth"});},[msgs,loading]);

  // Fire pendingAction once after greeting loaded
  useEffect(()=>{
    if(pendingAction&&!pendingFiredRef.current&&!loading&&msgs.length>0){
      pendingFiredRef.current=true;
      clearPending?.();
      sendMsg(pendingAction);
    }
  },[pendingAction,loading,msgs.length]);

  const startListening=()=>{
    const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
    if(!SR){alert("Voice input needs Safari or Chrome.");return;}
    const r=new SR();r.continuous=false;r.interimResults=false;r.lang="en-US";
    r.onstart=()=>setListening(true);
    r.onend=()=>setListening(false);
    r.onerror=()=>setListening(false);
    r.onresult=(e)=>{
      const t=e.results[0][0].transcript;
      setInput(t);
      setTimeout(()=>sendMsg(t),200);
    };
    recRef.current=r;r.start();
  };
  const stopListening=()=>{recRef.current?.stop();setListening(false);};

  const ctx=()=>{
    const tz=Intl.DateTimeFormat().resolvedOptions().timeZone;
    const now=new Date();
    const nowStr=now.toLocaleString("en-US",{weekday:"long",month:"long",day:"numeric",year:"numeric",hour:"numeric",minute:"2-digit",hour12:true});
    // Explicit local date for AI to use in EVENT_JSON — avoids UTC confusion
    const localDate=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}-${String(now.getDate()).padStart(2,"0")}`;
    const localHour=now.getHours();
    const recurEvents=events.filter(e=>e.isRecurring).slice(0,10).map(e=>`- ${e.title} [${e.category}] ${e.start}`).join("\n");
    const taskList=tasks.length>0?tasks.map(t=>`- [${t.done?"✓":"○"}] ${t.text}${t.date?` due:${t.date}`:""} [${t.category}]`).join("\n"):"No tasks.";
    const evList=events.filter(e=>!e.isRecurring).slice(-5).map(e=>`- ${e.title} ${e.start.split("T")[0]} [${e.category}]`).join("\n");
    const p=profile?`Student: ${profile.name}, ${profile.year}. Stressors: ${profile.stressors?.join(", ")}. Style: ${TIME_STYLES.find(ts=>ts.id===profile.timeStyle)?.label||"flexible"}. Bedtime: ${fmtH(profile.sleepH||22)}, Wake: ${fmtH(profile.wakeH||7)}.`:"";
    return[
      `Current local time: ${nowStr} (timezone: ${tz})`,
      `TODAY'S DATE FOR JSON: ${localDate} — use this exact date string in EVENT_JSON start/end fields for today's events. Current local hour: ${localHour} (24h). All times in EVENT_JSON must be LOCAL time, not UTC.`,
      p,
      recurEvents?`Recurring commitments:\n${recurEvents}`:"",
      `Tasks:\n${taskList}`,
      evList?`Recent calendar blocks:\n${evList}`:"",
    ].filter(Boolean).join("\n");
  };

  const call=async(m)=>{
    const res=await fetch("/api/chat",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({model:"claude-sonnet-4-20250514",max_tokens:450,system:SYS+"\n\n"+ctx(),messages:m.map(x=>({role:x.role,content:x.content}))})});
    return res.json();
  };

  useEffect(()=>{
    if(startedRef.current)return;
    startedRef.current=true;
    setLoading(true);
    const greet=profile
      ? `Greet ${profile.name} warmly by name (${profile.year}). Their time is already in your context. Ask how they're feeling today. 2 sentences max.`
      : `Start with a warm greeting and ask how they're feeling.`;
    call([{role:"user",content:greet}])
      .then(data=>{
        const raw=data.content?.map(b=>b.text||"").join("")||`Hi${profile?` ${profile.name}`:""}! 🌿 I'm Endive. How are you feeling today?`;
        const txt=cleanText(raw);
        setMsgs([{role:"assistant",content:txt}]);
      })
      .catch(()=>setMsgs([{role:"assistant",content:`Hi${profile?` ${profile.name}`:""}! 🌿 I'm Endive. How are you feeling today?`}]))
      .finally(()=>setLoading(false));
  },[]);

  const sendMsg=async(text)=>{
    const u=(text||input).trim();if(!u||loading)return;
    setInput("");
    const nm=[...msgs,{role:"user",content:u}];
    setMsgs(nm);
    setLoading(true);
    try{
      const data=await call(nm);
      const raw=data.content?.map(b=>b.text||"").join("")||"Sorry, something went wrong.";
      let ne=[],nt=[];
      try{const parsed=parseBlocks(raw);ne=parsed.events;nt=parsed.tasks;}catch(e){}
      const txt=cleanText(raw);
      // Update events — deduplicate by title + date
      if(ne.length>0){
        setEvents(p=>{
          const existing=new Set(p.map(x=>(x.title+"_"+(x.start||"").slice(0,10)).toLowerCase()));
          const fresh=ne
            .filter(e=>!existing.has((e.title+"_"+(e.start||"").slice(0,10)).toLowerCase()))
            .map(e=>({...e,id:Date.now()+Math.random()}));
          return fresh.length>0?[...p,...fresh]:p;
        });
      }
      // Update tasks — deduplicate by text
      if(nt.length>0){
        setTasks(p=>{
          const existing=new Set(p.map(x=>x.text.toLowerCase().trim()));
          const fresh=nt
            .filter(t=>!existing.has(t.text.toLowerCase().trim()))
            .map(t=>({...t,id:Date.now()+Math.random(),done:false,quadrant:t.quadrant||autoQ({date:t.date,category:t.category})}));
          return fresh.length>0?[...p,...fresh]:p;
        });
      }
      // Update messages last
      setMsgs(p=>[...p,{role:"assistant",content:txt,addedEvs:ne,addedTsks:nt}]);
    }catch{
      setMsgs(p=>[...p,{role:"assistant",content:"Something went wrong. Please try again."}]);
    }
    setLoading(false);
  };

  const quick=["I'm feeling overwhelmed 😔","Help me plan my day","I have assignments due soon","What should I focus on now?"];

  return(
    <div style={{display:"flex",flexDirection:"column",height:"100%"}}>
      <div style={{flex:1,overflowY:"auto",paddingRight:2,marginBottom:8}}>
        {msgs.length===0&&loading&&(
          <div style={{display:"flex",alignItems:"center",gap:8,color:"#6a9a7a",fontSize:13,marginTop:10}}>
            <span>Endive is getting ready</span><Dots/>
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
              {m.addedEvs?.length>0&&(
                <div style={{marginTop:6,padding:"8px 11px",background:"#e8f5ef",border:"1px solid #9ad4bc",borderRadius:10,fontSize:12,color:"#2a6a4a"}}>
                  <div style={{fontWeight:600,marginBottom:4}}>📅 Added to your Endive calendar:</div>
                  {m.addedEvs.map((ev,j)=>{
                    const cat=cats.find(c=>c.id===ev.category)||cats[3];
                    const d=isoDate(ev.start);
                    return(
                      <div key={j} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"3px 0",borderTop:j>0?"1px solid #c2dece40":"none"}}>
                        <span>{cat.emoji} {ev.title} · {d.toLocaleDateString("en-US",{weekday:"short",month:"short",day:"numeric"})} {fmtTime(ev.start)}</span>
                        <button onClick={()=>{}} style={{fontSize:10,color:"#4a9e7a",background:"none",border:"none",cursor:"pointer",fontFamily:"'DM Sans',sans-serif",textDecoration:"underline"}}>export?</button>
                      </div>
                    );
                  })}
                </div>
              )}
              {m.addedTsks?.length>0&&(
                <div style={{marginTop:5,padding:"6px 11px",background:"#e8f5ef",borderRadius:8,fontSize:12,color:"#3a7a5a"}}>
                  ✅ Added {m.addedTsks.length} task{m.addedTsks.length>1?"s":""} to My Plan + Matrix
                </div>
              )}
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

      {/* Input bar */}
      <div style={{display:"flex",gap:6,alignItems:"center"}}>
        <input value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>e.key==="Enter"&&sendMsg()} placeholder={listening?"Listening...":"Message Endive..."} style={{...S.input,flex:1,background:listening?"#e8f5ef":"#f8fbf9",transition:"background 0.2s"}}/>
        <button
          onClick={listening?stopListening:startListening}
          title="Tap to speak"
          style={{width:40,height:40,borderRadius:10,background:listening?"#e8f5ef":"transparent",border:`1.5px solid ${listening?"#4a9e7a":"#c8dcd4"}`,display:"flex",alignItems:"center",justifyContent:"center",gap:2,cursor:"pointer",flexShrink:0,transition:"all 0.2s",padding:"0 8px"}}>
          {[3,5,8,5,3].map((h,i)=>(
            <span key={i} style={{width:3,height:h,borderRadius:2,background:listening?"#4a9e7a":"#a0bcb4",display:"block",flexShrink:0,transformOrigin:"center",animation:listening?"wave 0.7s ease-in-out infinite":"none",animationDelay:`${i*0.12}s`}}/>
          ))}
        </button>
        <button onClick={()=>sendMsg()} disabled={loading} style={{...S.iconBtn,background:loading?"#b2d2be":"#4a9e7a",fontSize:17}}>→</button>
      </div>
    </div>
  );
}

function Dots(){return<div style={{display:"flex",gap:3}}>{[0,1,2].map(i=><span key={i} style={{width:5,height:5,borderRadius:"50%",background:"#4a9e7a",animation:"pulse 1.2s infinite",animationDelay:`${i*0.2}s`,display:"block"}}/>)}</div>;}

// ── App ────────────────────────────────────────────────────────────────────────
const TABS=["🌿 Endive","My Plan","My Calendar"];

export default function App(){
  const load=(key,fallback)=>{try{const v=localStorage.getItem(key);return v?JSON.parse(v):fallback;}catch{return fallback;}};

  const [profile,setProfile]=useState(()=>load("endive_profile",null));
  const [tasks,setTasks]=useState(()=>load("endive_tasks",[]));
  const [events,setEvents]=useState(()=>load("endive_events",[]));
  const [cats,setCats]=useState(()=>load("endive_cats",CATS));
  const [tab,setTab]=useState("🌿 Endive");
  const [pending,setPending]=useState(null);

  // Persist to localStorage whenever state changes
  useEffect(()=>{try{localStorage.setItem("endive_tasks",JSON.stringify(tasks));}catch{}},[tasks]);
  useEffect(()=>{try{localStorage.setItem("endive_events",JSON.stringify(events));}catch{}},[events]);
  useEffect(()=>{try{localStorage.setItem("endive_cats",JSON.stringify(cats));}catch{}},[cats]);
  useEffect(()=>{try{if(profile)localStorage.setItem("endive_profile",JSON.stringify(profile));}catch{}},[profile]);

  const onDone=(p)=>{
    setProfile(p);
    // Parse recurring commitments → calendar events immediately
    if(p.commitments&&p.commitments.trim()){
      const recurEvs=parseCommitmentsToEvents(p.commitments);
      if(recurEvs.length>0)setEvents(recurEvs);
    }
    setPending(`I just finished onboarding. My name is ${p.name}, I'm a ${p.year}. Stressors: ${p.stressors.join(", ")}. Goals: ${p.goals.join(", ")}. Time style: ${TIME_STYLES.find(t=>t.id===p.timeStyle)?.label||"flexible"}. Bedtime: ${fmtH(p.sleepH)}, wake: ${fmtH(p.wakeH)}. Commitments: ${p.commitments||"none"}. Greet me warmly by name and confirm you have my info. Keep it to 2 sentences.`);
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
        @keyframes wave{0%,100%{transform:scaleY(1)}50%{transform:scaleY(2.2)}}
        @keyframes voiceIdle{0%,100%{box-shadow:0 0 18px 9px #3a7a5a40,0 0 36px #3a7a5a18}50%{box-shadow:0 0 28px 14px #3a7a5a55,0 0 56px #3a7a5a28}}
        @keyframes voiceListen{0%,100%{transform:scale(1);box-shadow:0 0 40px 20px #6dffb840,0 0 80px #6dffb818}50%{transform:scale(1.06);box-shadow:0 0 55px 28px #6dffb860,0 0 100px #6dffb830}}
        @keyframes voiceSpeak{0%,100%{transform:scale(1);box-shadow:0 0 28px 14px #4a9e7a40,0 0 56px #4a9e7a18}50%{transform:scale(1.04);box-shadow:0 0 42px 20px #4a9e7a60,0 0 80px #4a9e7a30}}
        @keyframes voiceThink{0%,100%{opacity:0.7;transform:scale(0.97)}50%{opacity:1;transform:scale(1.02)}}
        @keyframes ripple{0%{transform:scale(1);opacity:0.5}100%{transform:scale(1.5);opacity:0}}
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
            <div style={{marginTop:10}}><NowBanner events={events} tasks={tasks} cats={cats}/></div>
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
