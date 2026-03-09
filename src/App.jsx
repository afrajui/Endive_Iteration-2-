import { useState, useRef, useEffect } from "react";

const DAYS_SHORT=["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
const DAYS_FULL=["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
const MONTHS=["January","February","March","April","May","June","July","August","September","October","November","December"];
const MONTHS_SHORT=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const HOURS=Array.from({length:24},(_,i)=>i);

const DEFAULT_CATEGORIES=[
  {id:"class",   label:"Class",   emoji:"🎓",color:"#6c8ebf",bg:"#e8eef8"},
  {id:"study",   label:"Study",   emoji:"📝",color:"#7c6fcd",bg:"#ede8f8"},
  {id:"work",    label:"Work",    emoji:"💼",color:"#e8a838",bg:"#fdf3e0"},
  {id:"personal",label:"Personal",emoji:"🏃",color:"#4a9e7a",bg:"#e8f5ef"},
  {id:"errands", label:"Errands", emoji:"🛒",color:"#e07b5a",bg:"#fceee8"},
  {id:"rest",    label:"Rest",    emoji:"😴",color:"#b07db8",bg:"#f3eaf8"},
];

const QUADRANTS=[
  {id:"do",       label:"Do First",  sub:"Urgent & Important",      color:"#e07b5a",bg:"#fceee8",border:"#f0b49a"},
  {id:"schedule", label:"Schedule",  sub:"Important, Not Urgent",   color:"#4a9e7a",bg:"#e8f5ef",border:"#9ad4bc"},
  {id:"delegate", label:"Delegate",  sub:"Urgent, Not Important",   color:"#e8a838",bg:"#fdf3e0",border:"#f0cc88"},
  {id:"eliminate",label:"Eliminate", sub:"Not Urgent or Important", color:"#b8b8b8",bg:"#f5f5f5",border:"#d8d8d8"},
];

function getDIM(y,m){return new Date(y,m+1,0).getDate();}
function getFirst(y,m){return new Date(y,m,1).getDay();}
function todayStr(){return new Date().toISOString().split("T")[0];}
function pad(n){return String(n).padStart(2,"0");}
function dk(y,m,d){return `${y}-${pad(m+1)}-${pad(d)}`;}
function fmtHour(h){return h===0?"12am":h<12?`${h}am`:h===12?"12pm":`${h-12}pm`;}

// Priority → suggested start hour
const Q_HOURS={do:8,schedule:14,delegate:11,eliminate:16};
function autoQ(t){
  const urgent=t.date&&t.date<=new Date(Date.now()+3*864e5).toISOString().split("T")[0];
  const important=["class","study","work"].includes(t.category);
  if(urgent&&important) return"do";
  if(!urgent&&important) return"schedule";
  if(urgent&&!important) return"delegate";
  return"eliminate";
}
function taskToBlock(t){
  if(!t.date) return null;
  const q=t.quadrant||autoQ(t);
  const sh=t.startHour!=null?t.startHour:(Q_HOURS[q]||9);
  const eh=t.endHour!=null?t.endHour:sh+1;
  return{id:`task-${t.id}`,title:t.text,start:`${t.date}T${pad(sh)}:00:00`,end:`${t.date}T${pad(eh)}:00:00`,category:t.category||"personal",description:"📌 Task",isTask:true,taskId:t.id};
}

function toGCalLink({title,start,end,description="",location=""}){
  const f=d=>new Date(d).toISOString().replace(/[-:]/g,"").split(".")[0]+"Z";
  return`https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(title)}&dates=${f(start)}/${f(end||new Date(new Date(start).getTime()+3600000).toISOString())}&details=${encodeURIComponent(description)}&location=${encodeURIComponent(location)}`;
}
function toICS({title,start,end,description="",location=""}){
  const f=d=>new Date(d).toISOString().replace(/[-:]/g,"").split(".")[0]+"Z";
  return["BEGIN:VCALENDAR","VERSION:2.0","PRODID:-//Endive//EN","BEGIN:VEVENT",
    `DTSTART:${f(start)}`,`DTEND:${f(end||new Date(new Date(start).getTime()+3600000).toISOString())}`,
    `SUMMARY:${title}`,description?`DESCRIPTION:${description}`:"",location?`LOCATION:${location}`:"",
    `UID:${Date.now()}@endive`,"END:VEVENT","END:VCALENDAR"].filter(Boolean).join("\r\n");
}
function dlICS(ev){
  const b=new Blob([toICS(ev)],{type:"text/calendar"});
  const a=document.createElement("a");
  a.href=URL.createObjectURL(b);a.download=`${ev.title.replace(/\s+/g,"_")}.ics`;a.click();
}

function EventCard({event,categories}){
  const d=new Date(event.start);
  const cat=categories.find(c=>c.id===event.category)||categories[3];
  return(
    <div style={{background:cat.bg,border:`1.5px solid ${cat.color}50`,borderRadius:12,padding:"12px 14px",marginTop:10}}>
      <div style={{display:"flex",gap:10,alignItems:"flex-start"}}>
        <div style={{background:cat.color,borderRadius:8,padding:"6px 10px",textAlign:"center",flexShrink:0,minWidth:44}}>
          <div style={{fontSize:9,color:"rgba(255,255,255,0.8)",fontWeight:700,textTransform:"uppercase"}}>{MONTHS_SHORT[d.getMonth()]}</div>
          <div style={{fontSize:17,color:"#fff",fontWeight:700,lineHeight:1.1}}>{d.getDate()}</div>
        </div>
        <div style={{flex:1}}>
          <div style={{fontWeight:600,fontSize:14,color:"#1a3028"}}>{cat.emoji} {event.title}</div>
          <div style={{fontSize:12,color:"#666",marginTop:2}}>{d.toLocaleDateString("en-US",{weekday:"short",month:"short",day:"numeric"})} · {d.toLocaleTimeString("en-US",{hour:"numeric",minute:"2-digit"})}</div>
          {event.description&&<div style={{fontSize:12,color:"#777",marginTop:2}}>{event.description}</div>}
        </div>
      </div>
      <div style={{display:"flex",gap:8,marginTop:10}}>
        <a href={toGCalLink(event)} target="_blank" rel="noreferrer" style={{flex:1,padding:"7px 0",borderRadius:8,background:"#4285f4",color:"#fff",fontSize:12,fontWeight:600,textDecoration:"none",display:"flex",alignItems:"center",justifyContent:"center",gap:5}}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="white"><path d="M19 4h-1V2h-2v2H8V2H6v2H5a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2V6a2 2 0 00-2-2zm0 16H5V9h14v11z"/></svg>
          Google Cal
        </a>
        <button onClick={()=>dlICS(event)} style={{flex:1,padding:"7px 0",borderRadius:8,background:"#fff",border:`1.5px solid ${cat.color}60`,color:cat.color,fontSize:12,fontWeight:600,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:5,fontFamily:"'DM Sans',sans-serif"}}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
          Apple/.ics
        </button>
      </div>
    </div>
  );
}

// ─── CALENDAR TAB ────────────────────────────────────────────────────────────
function CalendarTab({events,setEvents,categories,setCategories,tasks,setTasks}){
  const today=new Date();
  const [view,setView]=useState("month");
  const [cur,setCur]=useState({year:today.getFullYear(),month:today.getMonth(),day:today.getDate()});
  const [showAdd,setShowAdd]=useState(false);
  const [newEv,setNewEv]=useState({title:"",date:todayStr(),sh:9,eh:10,category:"personal",description:""});
  const [showCat,setShowCat]=useState(false);
  const [newCat,setNewCat]=useState({label:"",emoji:"📌",color:"#4a9e7a"});
  const [editTask,setEditTask]=useState(null);
  const taskBlocks=(tasks||[]).filter(t=>!t.done&&t.date).map(taskToBlock).filter(Boolean);
  const allBlocks=[...events,...taskBlocks];
  const saveTaskTime=()=>{if(!editTask)return;setTasks(p=>p.map(t=>t.id===editTask.taskId?{...t,startHour:editTask.sh,endHour:editTask.eh}:t));setEditTask(null);};

  const nav=dir=>setCur(c=>{
    if(view==="year") return{...c,year:c.year+dir};
    if(view==="month"){const d=new Date(c.year,c.month+dir);return{...c,year:d.getFullYear(),month:d.getMonth()};}
    if(view==="week"){const d=new Date(c.year,c.month,c.day+dir*7);return{year:d.getFullYear(),month:d.getMonth(),day:d.getDate()};}
    const d=new Date(c.year,c.month,c.day+dir);return{year:d.getFullYear(),month:d.getMonth(),day:d.getDate()};
  });

  const saveEv=()=>{
    if(!newEv.title.trim()) return;
    setEvents(prev=>[...prev,{id:Date.now(),title:newEv.title.trim(),start:`${newEv.date}T${pad(newEv.sh)}:00:00`,end:`${newEv.date}T${pad(newEv.eh)}:00:00`,category:newEv.category,description:newEv.description}]);
    setShowAdd(false);setNewEv({title:"",date:todayStr(),sh:9,eh:10,category:"personal",description:""});
  };
  const saveCat=()=>{
    if(!newCat.label.trim()) return;
    setCategories(prev=>[...prev,{id:newCat.label.toLowerCase().replace(/\s+/g,"_"),label:newCat.label,emoji:newCat.emoji,color:newCat.color,bg:newCat.color+"22"}]);
    setShowCat(false);setNewCat({label:"",emoji:"📌",color:"#4a9e7a"});
  };

  const evDay=s=>allBlocks.filter(e=>e.start.startsWith(s));
  const headerLabel=()=>{
    if(view==="year") return cur.year;
    if(view==="month") return`${MONTHS[cur.month]} ${cur.year}`;
    if(view==="week"){const a=new Date(cur.year,cur.month,cur.day),b=new Date(cur.year,cur.month,cur.day+6);return`${MONTHS_SHORT[a.getMonth()]} ${a.getDate()} – ${MONTHS_SHORT[b.getMonth()]} ${b.getDate()}`;}
    return`${DAYS_FULL[new Date(cur.year,cur.month,cur.day).getDay()]}, ${MONTHS[cur.month]} ${cur.day}`;
  };

  return(
    <div>
      <div style={{display:"flex",flexWrap:"wrap",gap:8,marginBottom:12,alignItems:"center",justifyContent:"space-between"}}>
        <div style={{display:"flex",gap:4}}>
          {["year","month","week","day"].map(v=>(
            <button key={v} onClick={()=>setView(v)} style={{padding:"5px 10px",borderRadius:6,border:"none",background:view===v?"#4a9e7a":"#f0f7f2",color:view===v?"#fff":"#5a8a6a",fontSize:12,fontWeight:view===v?600:400,cursor:"pointer",textTransform:"capitalize",fontFamily:"'DM Sans',sans-serif"}}>{v}</button>
          ))}
        </div>
        <div style={{display:"flex",alignItems:"center",gap:6}}>
          <button onClick={()=>nav(-1)} style={navBtn}>‹</button>
          <span style={{fontFamily:"'Lora',serif",fontSize:13,fontWeight:600,color:"#1a3028",minWidth:130,textAlign:"center"}}>{headerLabel()}</span>
          <button onClick={()=>nav(1)} style={navBtn}>›</button>
        </div>
        <div style={{display:"flex",gap:6}}>
          <button onClick={()=>setShowCat(true)} style={{...sBtn,background:"#f0f7f2",color:"#4a9e7a"}}>+ Cat</button>
          <button onClick={()=>setShowAdd(true)} style={{...sBtn,background:"#4a9e7a",color:"#fff"}}>+ Block</button>
        </div>
      </div>

      <div style={{display:"flex",flexWrap:"wrap",gap:5,marginBottom:12}}>
        {categories.map(c=><span key={c.id} style={{fontSize:11,padding:"3px 8px",borderRadius:20,background:c.bg,color:c.color,fontWeight:600}}>{c.emoji} {c.label}</span>)}
      </div>

      {/* Year */}
      {view==="year"&&(
        <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10}}>
          {Array.from({length:12},(_,mi)=>{
            const cells=[];
            for(let i=0;i<getFirst(cur.year,mi);i++) cells.push(null);
            for(let d=1;d<=getDIM(cur.year,mi);d++) cells.push(d);
            return(
              <div key={mi} onClick={()=>{setCur(c=>({...c,month:mi}));setView("month");}} style={{background:"#f8fbf9",borderRadius:10,padding:8,cursor:"pointer"}}>
                <div style={{fontSize:11,fontWeight:700,color:"#4a9e7a",marginBottom:3}}>{MONTHS_SHORT[mi]}</div>
                <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:1}}>
                  {cells.map((d,i)=>{
                    const isT=d&&cur.year===today.getFullYear()&&mi===today.getMonth()&&d===today.getDate();
                    const has=d&&evDay(dk(cur.year,mi,d)).length>0;
                    return<div key={i} style={{aspectRatio:"1",display:"flex",alignItems:"center",justifyContent:"center",borderRadius:2,background:isT?"#4a9e7a":has?"#c2dece":"transparent",fontSize:7,color:isT?"#fff":"#2a4a3a"}}>{d}</div>;
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Month */}
      {view==="month"&&(
        <div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",marginBottom:4}}>
            {DAYS_SHORT.map(d=><div key={d} style={{textAlign:"center",fontSize:11,color:"#8aaa9a",fontWeight:600,padding:"3px 0"}}>{d}</div>)}
          </div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:3}}>
            {(()=>{
              const cells=[];
              for(let i=0;i<getFirst(cur.year,cur.month);i++) cells.push(null);
              for(let d=1;d<=getDIM(cur.year,cur.month);d++) cells.push(d);
              return cells.map((day,i)=>{
                const isT=day&&cur.year===today.getFullYear()&&cur.month===today.getMonth()&&day===today.getDate();
                const dKey=day?dk(cur.year,cur.month,day):null;
                const des=dKey?evDay(dKey):[];
                return(
                  <div key={i} onClick={()=>{if(day){setCur(c=>({...c,day}));setView("day");}}} style={{minHeight:58,padding:3,borderRadius:8,background:isT?"#4a9e7a12":"#f8fbf9",border:`1px solid ${isT?"#4a9e7a":"#e8f2ec"}`,cursor:day?"pointer":"default"}}>
                    <div style={{fontSize:12,fontWeight:isT?700:400,color:isT?"#4a9e7a":"#1a3028",marginBottom:2}}>{day}</div>
                    {des.slice(0,2).map(ev=>{const cat=categories.find(c=>c.id===ev.category)||categories[3];return<div key={ev.id} style={{fontSize:9,padding:"1px 3px",borderRadius:3,background:cat.color,color:"#fff",marginBottom:1,overflow:"hidden",whiteSpace:"nowrap",textOverflow:"ellipsis"}}>{cat.emoji} {ev.title}</div>;})}
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
          <div style={{minWidth:480}}>
            <div style={{display:"grid",gridTemplateColumns:"44px repeat(7,1fr)",gap:2,marginBottom:6}}>
              <div/>
              {Array.from({length:7},(_,i)=>{
                const d=new Date(cur.year,cur.month,cur.day+i);
                const isT=d.toDateString()===today.toDateString();
                return<div key={i} style={{textAlign:"center",padding:"4px 2px",borderRadius:6,background:isT?"#4a9e7a":"transparent"}}>
                  <div style={{fontSize:10,color:isT?"#fff":"#8aaa9a",fontWeight:600}}>{DAYS_SHORT[d.getDay()]}</div>
                  <div style={{fontSize:13,fontWeight:700,color:isT?"#fff":"#1a3028"}}>{d.getDate()}</div>
                </div>;
              })}
            </div>
            <div style={{maxHeight:380,overflowY:"auto"}}>
              {HOURS.map(h=>(
                <div key={h} style={{display:"grid",gridTemplateColumns:"44px repeat(7,1fr)",gap:2,minHeight:34}}>
                  <div style={{fontSize:10,color:"#bbb",textAlign:"right",paddingRight:5,paddingTop:2}}>{fmtHour(h)}</div>
                  {Array.from({length:7},(_,di)=>{
                    const d=new Date(cur.year,cur.month,cur.day+di);
                    const dKey=`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
                    const slotEvs=allBlocks.filter(e=>e.start.startsWith(dKey)&&parseInt(e.start.split("T")[1]||"0")===h);
                    return<div key={di} style={{borderTop:"1px solid #f0f5f2",minHeight:34}}>
                      {slotEvs.map(ev=>{const cat=categories.find(c=>c.id===ev.category)||categories[3];return<div key={ev.id} style={{fontSize:9,padding:"2px 3px",borderRadius:3,background:cat.color,color:"#fff",margin:1,overflow:"hidden",whiteSpace:"nowrap",textOverflow:"ellipsis"}}>{cat.emoji} {ev.title}</div>;})}
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
        <div style={{maxHeight:460,overflowY:"auto"}}>
          {HOURS.map(h=>{
            const dKey=dk(cur.year,cur.month,cur.day);
            const slotEvs=allBlocks.filter(e=>e.start.startsWith(dKey)&&parseInt(e.start.split("T")[1]||"0")===h);
            return(
              <div key={h} style={{display:"flex",gap:10,minHeight:46,borderTop:"1px solid #f0f5f2",paddingTop:4}}>
                <div style={{width:42,fontSize:11,color:"#bbb",flexShrink:0,textAlign:"right"}}>{fmtHour(h)}</div>
                <div style={{flex:1,display:"flex",flexWrap:"wrap",gap:4}}>
                  {slotEvs.map(ev=>{
                    const cat=categories.find(c=>c.id===ev.category)||categories[3];
                    const eh=ev.end?parseInt(ev.end.split("T")[1]||String(h+1)):h+1;
                    return<div key={ev.id} onClick={ev.isTask?()=>setEditTask({taskId:ev.taskId,sh:parseInt(ev.start.split("T")[1]||"9"),eh:parseInt(ev.end.split("T")[1]||"10")}):undefined} style={{padding:"5px 10px",borderRadius:8,background:cat.bg,borderLeft:`3px solid ${cat.color}`,border:ev.isTask?`1.5px dashed ${cat.color}`:`none`,borderLeft:`3px solid ${cat.color}`,fontSize:12,color:"#1a3028",flex:1,minWidth:120,cursor:ev.isTask?"pointer":"default"}}>
                      <div style={{fontWeight:600}}>{cat.emoji} {ev.title}{ev.isTask&&<span style={{fontSize:9,marginLeft:4,opacity:0.6}}>📌 tap to edit time</span>}</div>
                      <div style={{fontSize:10,color:cat.color}}>{pad(h)}:00 – {pad(eh)}:00</div>
                      {ev.description&&!ev.isTask&&<div style={{fontSize:10,color:"#666",marginTop:1}}>{ev.description}</div>}
                    </div>;
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modals */}
      {showAdd&&<Modal onClose={()=>setShowAdd(false)} title="Add Time Block">
        <input value={newEv.title} onChange={e=>setNewEv(p=>({...p,title:e.target.value}))} placeholder="Title..." style={{...mInput,marginBottom:10}}/>
        <input type="date" value={newEv.date} onChange={e=>setNewEv(p=>({...p,date:e.target.value}))} style={{...mInput,marginBottom:10}}/>
        <div style={{display:"flex",gap:8,marginBottom:10}}>
          <div style={{flex:1}}><label style={mLabel}>Start</label>
            <select value={newEv.sh} onChange={e=>setNewEv(p=>({...p,sh:+e.target.value}))} style={mInput}>{HOURS.map(h=><option key={h} value={h}>{fmtHour(h)}</option>)}</select>
          </div>
          <div style={{flex:1}}><label style={mLabel}>End</label>
            <select value={newEv.eh} onChange={e=>setNewEv(p=>({...p,eh:+e.target.value}))} style={mInput}>{HOURS.map(h=><option key={h} value={h}>{fmtHour(h)}</option>)}</select>
          </div>
        </div>
        <label style={mLabel}>Category</label>
        <select value={newEv.category} onChange={e=>setNewEv(p=>({...p,category:e.target.value}))} style={{...mInput,marginBottom:10}}>{categories.map(c=><option key={c.id} value={c.id}>{c.emoji} {c.label}</option>)}</select>
        <input value={newEv.description} onChange={e=>setNewEv(p=>({...p,description:e.target.value}))} placeholder="Notes (optional)" style={{...mInput,marginBottom:16}}/>
        <ModalBtns onCancel={()=>setShowAdd(false)} onSave={saveEv} label="Add Block"/>
      </Modal>}

      {editTask&&<Modal onClose={()=>setEditTask(null)} title="Edit Task Time">
        <p style={{fontSize:13,color:"#5a8a6a",marginBottom:12}}>Adjust the time for this task.</p>
        <div style={{display:"flex",gap:8,marginBottom:16}}>
          <div style={{flex:1}}><label style={mLabel}>Start</label>
            <select value={editTask.sh} onChange={e=>setEditTask(p=>({...p,sh:+e.target.value}))} style={mInput}>{HOURS.map(h=><option key={h} value={h}>{fmtHour(h)}</option>)}</select>
          </div>
          <div style={{flex:1}}><label style={mLabel}>End</label>
            <select value={editTask.eh} onChange={e=>setEditTask(p=>({...p,eh:+e.target.value}))} style={mInput}>{HOURS.map(h=><option key={h} value={h}>{fmtHour(h)}</option>)}</select>
          </div>
        </div>
        <ModalBtns onCancel={()=>setEditTask(null)} onSave={saveTaskTime} label="Save Time"/>
      </Modal>}

      {showCat&&<Modal onClose={()=>setShowCat(false)} title="New Category">
        <input value={newCat.label} onChange={e=>setNewCat(p=>({...p,label:e.target.value}))} placeholder="Category name..." style={{...mInput,marginBottom:10}}/>
        <input value={newCat.emoji} onChange={e=>setNewCat(p=>({...p,emoji:e.target.value}))} placeholder="Emoji (e.g. 🏋️)" style={{...mInput,marginBottom:10}}/>
        <label style={mLabel}>Color</label>
        <input type="color" value={newCat.color} onChange={e=>setNewCat(p=>({...p,color:e.target.value}))} style={{width:"100%",height:40,borderRadius:8,border:"1.5px solid #e0ece6",marginBottom:16,cursor:"pointer"}}/>
        <ModalBtns onCancel={()=>setShowCat(false)} onSave={saveCat} label="Add Category"/>
      </Modal>}
    </div>
  );
}

function Modal({children,onClose,title}){
  return(
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.4)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:100,padding:16}}>
      <div style={{background:"#fff",borderRadius:16,padding:24,width:"100%",maxWidth:380,boxShadow:"0 8px 40px rgba(0,0,0,0.15)"}}>
        <h3 style={{fontFamily:"'Lora',serif",fontSize:18,color:"#1a3028",marginBottom:16}}>{title}</h3>
        {children}
      </div>
    </div>
  );
}
function ModalBtns({onCancel,onSave,label}){
  return(
    <div style={{display:"flex",gap:8}}>
      <button onClick={onCancel} style={{flex:1,padding:"10px 0",borderRadius:8,border:"1.5px solid #e0ece6",background:"#fff",color:"#666",cursor:"pointer",fontFamily:"'DM Sans',sans-serif"}}>Cancel</button>
      <button onClick={onSave} style={{flex:1,padding:"10px 0",borderRadius:8,border:"none",background:"#4a9e7a",color:"#fff",fontWeight:600,cursor:"pointer",fontFamily:"'DM Sans',sans-serif"}}>{label}</button>
    </div>
  );
}

// ─── TASKS TAB ───────────────────────────────────────────────────────────────
function TasksTab({tasks,setTasks,categories}){
  const [input,setInput]=useState("");
  const [date,setDate]=useState("");
  const [cat,setCat]=useState("personal");
  const [sub,setSub]=useState("list");

  const add=()=>{
    if(!input.trim()) return;
    setTasks(p=>[...p,{id:Date.now(),text:input.trim(),done:false,date:date||null,category:cat,quadrant:null}]);
    setInput("");setDate("");
  };
  const toggle=id=>setTasks(p=>p.map(t=>t.id===id?{...t,done:!t.done}:t));
  const remove=id=>setTasks(p=>p.filter(t=>t.id!==id));

  const getQ=t=>{
    if(t.quadrant) return t.quadrant;
    const urgent=t.date&&t.date<=new Date(Date.now()+3*864e5).toISOString().split("T")[0];
    const important=["class","study","work"].includes(t.category);
    if(urgent&&important) return"do";
    if(!urgent&&important) return"schedule";
    if(urgent&&!important) return"delegate";
    return"eliminate";
  };

  const pending=tasks.filter(t=>!t.done);
  const todayS=todayStr();

  const Item=({t})=>{
    const c=categories.find(x=>x.id===t.category)||categories[3];
    return(
      <div style={{display:"flex",alignItems:"center",gap:9,padding:"8px 0",borderBottom:"1px solid #e8f2ec",opacity:t.done?0.4:1}}>
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
      <div style={{background:"#f8fbf9",borderRadius:12,padding:12,marginBottom:14}}>
        <div style={{display:"flex",gap:6,marginBottom:8}}>
          <input value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>e.key==="Enter"&&add()} placeholder="Add a task..." style={{...iStyle,flex:1}}/>
          <button onClick={add} style={aBtn}>+</button>
        </div>
        <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
          <input type="date" value={date} onChange={e=>setDate(e.target.value)} style={{...iStyle,flex:1,minWidth:110}}/>
          <select value={cat} onChange={e=>setCat(e.target.value)} style={{...iStyle,flex:1,minWidth:110}}>
            {categories.map(c=><option key={c.id} value={c.id}>{c.emoji} {c.label}</option>)}
          </select>
        </div>
      </div>

      <div style={{display:"flex",gap:4,marginBottom:12}}>
        <button onClick={()=>setSub("list")} style={{...sBtn,background:sub==="list"?"#4a9e7a":"#f0f7f2",color:sub==="list"?"#fff":"#5a8a6a"}}>List</button>
        <button onClick={()=>setSub("matrix")} style={{...sBtn,background:sub==="matrix"?"#4a9e7a":"#f0f7f2",color:sub==="matrix"?"#fff":"#5a8a6a"}}>Eisenhower Matrix</button>
      </div>

      {sub==="list"&&(
        <div>
          {tasks.length===0&&<p style={{color:"#8aaa9a",fontSize:13,textAlign:"center",marginTop:20}}>No tasks yet — add one above!</p>}
          {pending.filter(t=>t.date===todayS||!t.date).length>0&&<><div style={secLbl}>Today</div>{pending.filter(t=>t.date===todayS||!t.date).map(t=><Item key={t.id} t={t}/>)}</>}
          {pending.filter(t=>t.date&&t.date>todayS).length>0&&<><div style={{...secLbl,marginTop:12}}>Upcoming</div>{pending.filter(t=>t.date&&t.date>todayS).sort((a,b)=>a.date>b.date?1:-1).map(t=><Item key={t.id} t={t}/>)}</>}
          {tasks.filter(t=>t.done).length>0&&<><div style={{...secLbl,marginTop:12,opacity:0.5}}>Done</div>{tasks.filter(t=>t.done).map(t=><Item key={t.id} t={t}/>)}</>}
        </div>
      )}

      {sub==="matrix"&&(
        <div>
          <p style={{fontSize:11,color:"#8aaa9a",marginBottom:10}}>Auto-sorted by urgency (due ≤3 days) & category importance.</p>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
            {QUADRANTS.map(q=>{
              const qt=pending.filter(t=>getQ(t)===q.id);
              return(
                <div key={q.id} style={{background:q.bg,border:`1.5px solid ${q.border}`,borderRadius:12,padding:10}}>
                  <div style={{fontWeight:700,fontSize:12,color:q.color}}>{q.label}</div>
                  <div style={{fontSize:10,color:q.color+"99",marginBottom:7}}>{q.sub}</div>
                  {qt.length===0&&<p style={{fontSize:11,color:"#bbb",fontStyle:"italic"}}>None</p>}
                  {qt.map(t=>(
                    <div key={t.id} style={{display:"flex",alignItems:"center",gap:5,padding:"4px 0",borderBottom:`1px solid ${q.border}50`}}>
                      <button onClick={()=>toggle(t.id)} style={{width:13,height:13,borderRadius:3,border:`2px solid ${q.color}`,background:"transparent",flexShrink:0,cursor:"pointer"}}/>
                      <span style={{fontSize:11,color:"#1a3028",flex:1}}>{t.text}</span>
                      {t.date&&<span style={{fontSize:10,color:q.color}}>{t.date.slice(5).replace("-","/")}</span>}
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── ENDIVE SYSTEM PROMPT ────────────────────────────────────────────────────
const SYS=`You are Endive, a warm, nurturing, encouraging personal assistant for college students juggling multiple responsibilities. You deeply understand academic stress, burnout, and the emotional toll of being overwhelmed. You treat mental health as a non-negotiable part of every plan you make.

## Your Role
Understand the student's emotions, tasks, deadlines, goals, and daily responsibilities. Build realistic, humane plans that balance productivity with genuine rest — because burnout prevention is just as important as getting things done.

## Your Characteristics
- Friendly, warm, nurturing, and encouraging — like a caring mentor
- Patient, focused on the user's needs and emotional state
- Concise, simple, easy to digest — never overwhelming
- Genuine, never judgmental or dismissive
- Inclusive, avoids stereotypes

## Workflow
1. Greet and warmly check in — ask how they are feeling emotionally and physically
2. Validate their feelings and challenges with genuine empathy before any planning
3. Gather tasks/deadlines and assess their current stress load honestly
4. Organize using Eisenhower Matrix, but always ask: "Is this realistic without burning out?"
5. Build a plan that includes:
   - Focused work blocks for urgent/important tasks
   - Scheduled breaks (Pomodoro-style: 25 min work / 5 min break, or longer blocks with 15–30 min breaks)
   - At least one meaningful rest or self-care block per day (walk, meal, nap, hobby)
   - Buffer time between tasks — no back-to-back scheduling
   - A hard stop time in the evening (no work after a reasonable hour like 9pm)
6. Present the plan warmly, as if showing it to a friend — not a boss. Check if it feels doable
7. Adjust based on their feedback before committing to the calendar
8. Once approved, generate calendar events including breaks and self-care blocks
9. Ask if there is anything else they need

## Burnout Prevention Rules (always apply these)
- Never schedule more than 3 hours of focused work without a break
- Always include at least one 😴 Rest block per day in any full-day plan
- If the student mentions being tired, stressed, anxious, or overwhelmed — prioritize emotional check-in BEFORE jumping into planning
- If their task list looks unrealistic for one day, say so kindly and help them redistribute across days
- Celebrate small wins — acknowledge completed tasks warmly
- Remind them that rest is productive, not lazy

## Break Block Guidelines
When scheduling breaks, use category "rest" and titles like:
- "☕ Short Break" (5–15 min)
- "🚶 Walk Break" (15–20 min)  
- "🍽️ Lunch Break" (30–60 min)
- "😴 Rest & Recharge" (20–30 min)
- "🎮 Free Time" (open-ended wind-down)

## Adding a Task
When adding a task, embed at END of reply:
\`\`\`task
{"text":"Task name","date":"YYYY-MM-DD or null","category":"personal","quadrant":"do"}
\`\`\`
Quadrant: "do" | "schedule" | "delegate" | "eliminate"
Category: "class" | "study" | "work" | "personal" | "errands" | "rest"

## Adding a Calendar Time Block
When scheduling any block (including breaks), embed at END of reply:
\`\`\`event
{"title":"Block title","start":"YYYY-MM-DDTHH:MM:00","end":"YYYY-MM-DDTHH:MM:00","category":"rest","description":"optional"}
\`\`\`

Always include break and rest blocks alongside work blocks in any plan.
You can include multiple task and event blocks in one reply. Never show raw JSON to the user.
Keep replies concise and warm. If off-topic, gently redirect.`;

function parseB(text,tag){
  return[...text.matchAll(new RegExp("```"+tag+"\\n([\\s\\S]*?)```","g"))].map(m=>{try{return JSON.parse(m[1]);}catch{return null;}}).filter(Boolean);
}
function clean(text){return text.replace(/```(event|task)\n[\s\S]*?```/g,"").trim();}
function md(text){return text.split(/(\*\*[^*]+\*\*)/).map((p,i)=>p.startsWith("**")&&p.endsWith("**")?<strong key={i}>{p.slice(2,-2)}</strong>:p);}

function ChatTab({tasks,setTasks,events,setEvents,categories}){
  const [msgs,setMsgs]=useState([]);
  const [input,setInput]=useState("");
  const [loading,setLoading]=useState(false);
  const [started,setStarted]=useState(false);
  const ref=useRef(null);

  useEffect(()=>{ref.current?.scrollIntoView({behavior:"smooth"});},[msgs,loading]);

  const ctx=()=>{
    const t=tasks.length>0?`Tasks:\n${tasks.map(t=>`- [${t.done?"✓":"○"}] ${t.text}${t.date?` due:${t.date}`:""} [${t.category}]`).join("\n")}`:"No tasks.";
    const e=events.length>0?`Recent blocks:\n${events.slice(-5).map(e=>`- ${e.title} ${e.start.split("T")[0]} ${e.start.split("T")[1]?.slice(0,5)} [${e.category}]`).join("\n")}`:"No blocks.";
    return`${t}\n${e}`;
  };

  const call=async(m)=>{
    const r=await fetch("/api/chat",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({model:"claude-sonnet-4-20250514",max_tokens:1000,system:`${SYS}\n\nToday: ${new Date().toDateString()} (${todayStr()}).\n${ctx()}`,messages:m.map(x=>({role:x.role,content:x.content}))})});
    return r.json();
  };

  useEffect(()=>{
    if(started) return;setStarted(true);setLoading(true);
    call([{role:"user",content:"Start with your greeting."}])
      .then(d=>{const raw=d.content?.map(b=>b.text||"").join("")||"Hi! 🌿 I'm Endive. How are you feeling today?";setMsgs([{role:"assistant",content:clean(raw),evs:parseB(raw,"event"),tsks:parseB(raw,"task")}]);})
      .catch(()=>setMsgs([{role:"assistant",content:"Hi! 🌿 I'm Endive, your personal assistant. How are you feeling today?"}]))
      .finally(()=>setLoading(false));
  },[]);

  const send=async(text)=>{
    const u=(text||input).trim();if(!u||loading) return;
    setInput("");
    const nm=[...msgs,{role:"user",content:u}];
    setMsgs(nm);setLoading(true);
    try{
      const d=await call(nm);
      const raw=d.content?.map(b=>b.text||"").join("")||"Sorry, something went wrong.";
      const ne=parseB(raw,"event"),nt=parseB(raw,"task");
      if(ne.length>0) setEvents(p=>[...p,...ne.map(e=>({...e,id:Date.now()+Math.random()}))]);
      if(nt.length>0) setTasks(p=>[...p,...nt.map(t=>({...t,id:Date.now()+Math.random(),done:false}))]);
      setMsgs(p=>[...p,{role:"assistant",content:clean(raw),evs:ne,tsks:nt}]);
    }catch{setMsgs(p=>[...p,{role:"assistant",content:"Something went wrong. Please try again."}]);}
    setLoading(false);
  };

  const quick=["I have 3 assignments due this week 😅","I'm feeling burnt out 😮","Help me plan my day with breaks","I need a realistic schedule for tomorrow"];

  return(
    <div style={{display:"flex",flexDirection:"column",height:"100%"}}>
      <div style={{flex:1,overflowY:"auto",paddingRight:2,marginBottom:10}}>
        {msgs.length===0&&loading&&(
          <div style={{display:"flex",alignItems:"center",gap:8,color:"#6a9a7a",fontSize:13,marginTop:8}}>
            <span>Endive is getting ready</span>
            <div style={{display:"flex",gap:3}}>{[0,1,2].map(i=><span key={i} style={{width:5,height:5,borderRadius:"50%",background:"#4a9e7a",animation:"pulse 1.2s infinite",animationDelay:`${i*0.2}s`,display:"block"}}/>)}</div>
          </div>
        )}
        {msgs.map((m,i)=>(
          <div key={i} style={{display:"flex",justifyContent:m.role==="user"?"flex-end":"flex-start",marginBottom:10}}>
            <div style={{maxWidth:"88%",width:m.role==="assistant"?"88%":"auto"}}>
              {m.role==="assistant"&&(
                <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:4}}>
                  <div style={{width:22,height:22,borderRadius:"50%",background:"linear-gradient(135deg,#4a9e7a,#2d7a5a)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:12}}>🌿</div>
                  <span style={{fontSize:11,fontWeight:600,color:"#4a9e7a"}}>Endive</span>
                </div>
              )}
              <div style={{padding:"10px 14px",borderRadius:m.role==="user"?"16px 16px 4px 16px":"16px 16px 16px 4px",background:m.role==="user"?"#4a9e7a":"#f0f7f2",color:m.role==="user"?"#fff":"#1a3028",fontSize:14,lineHeight:1.65,whiteSpace:"pre-wrap"}}>{md(m.content)}</div>
              {m.evs?.map((ev,j)=><EventCard key={j} event={ev} categories={categories}/>)}
              {m.tsks?.length>0&&<div style={{marginTop:6,padding:"7px 12px",background:"#e8f5ef",borderRadius:8,fontSize:12,color:"#3a7a5a"}}>✅ Added {m.tsks.length} task{m.tsks.length>1?"s":""} to your list</div>}
            </div>
          </div>
        ))}
        {loading&&msgs.length>0&&(
          <div style={{display:"flex",gap:4,padding:"10px 14px",background:"#f0f7f2",borderRadius:"16px 16px 16px 4px",width:"fit-content"}}>
            {[0,1,2].map(i=><span key={i} style={{width:6,height:6,borderRadius:"50%",background:"#4a9e7a",animation:"pulse 1.2s infinite",animationDelay:`${i*0.2}s`,display:"block"}}/>)}
          </div>
        )}
        <div ref={ref}/>
      </div>
      {msgs.length<=1&&!loading&&(
        <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:10}}>
          {quick.map(p=><button key={p} onClick={()=>send(p)} style={{padding:"6px 11px",borderRadius:20,border:"1.5px solid #c2dece",background:"#f0f7f2",color:"#3a7a5a",fontSize:11,cursor:"pointer",fontFamily:"'DM Sans',sans-serif"}}>{p}</button>)}
        </div>
      )}
      <div style={{display:"flex",gap:8}}>
        <input value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>e.key==="Enter"&&send()} placeholder="Talk to Endive..." style={{...iStyle,flex:1}}/>
        <button onClick={()=>send()} disabled={loading} style={{...aBtn,width:44,fontSize:18,background:loading?"#b2d2be":"#4a9e7a"}}>→</button>
      </div>
    </div>
  );
}

// ─── Shared styles ───────────────────────────────────────────────────────────
const navBtn={background:"none",border:"none",fontSize:20,color:"#8aaa9a",cursor:"pointer",padding:"0 8px",lineHeight:1};
const iStyle={flex:1,padding:"9px 12px",borderRadius:8,border:"1.5px solid #c2dece",background:"#f8fbf9",fontSize:13,color:"#1a3028",outline:"none",fontFamily:"'DM Sans',sans-serif"};
const aBtn={width:38,height:38,borderRadius:8,background:"#4a9e7a",color:"#fff",border:"none",fontSize:20,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0};
const sBtn={padding:"5px 11px",borderRadius:6,border:"none",fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:"'DM Sans',sans-serif"};
const secLbl={fontSize:11,fontWeight:700,letterSpacing:"0.08em",color:"#8aaa9a",textTransform:"uppercase",marginBottom:3};
const mInput={width:"100%",padding:"9px 12px",borderRadius:8,border:"1.5px solid #e0ece6",background:"#f8fbf9",fontSize:13,color:"#1a3028",outline:"none",fontFamily:"'DM Sans',sans-serif",boxSizing:"border-box"};
const mLabel={fontSize:11,fontWeight:600,color:"#8aaa9a",textTransform:"uppercase",letterSpacing:"0.05em",display:"block",marginBottom:4};

const TABS=["Endive","Tasks","Calendar"];

// ─── APP ─────────────────────────────────────────────────────────────────────
export default function App(){
  const [tasks,setTasks]=useState([
    {id:1,text:"Review project proposal",done:false,date:todayStr(),category:"work",quadrant:null},
    {id:2,text:"Book dentist appointment",done:false,date:null,category:"personal",quadrant:null},
  ]);
  const [events,setEvents]=useState([]);
  const [categories,setCategories]=useState(DEFAULT_CATEGORIES);
  const [tab,setTab]=useState("Endive");

  const today=new Date();
  const h=today.getHours();
  const greeting=h<12?"Good morning":h<18?"Good afternoon":"Good evening";
  const pending=tasks.filter(t=>!t.done).length;

  return(
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Lora:wght@400;600&family=DM+Sans:wght@300;400;500&display=swap');
        *{box-sizing:border-box;margin:0;padding:0;}
        body{background:#eef7f2;min-height:100vh;}
        @keyframes pulse{0%,100%{opacity:.3;transform:scale(.8)}50%{opacity:1;transform:scale(1)}}
        @keyframes fadeUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}
        input[type="date"]::-webkit-calendar-picker-indicator{opacity:0.4;cursor:pointer;}
        select{-webkit-appearance:none;}
        ::-webkit-scrollbar{width:4px}::-webkit-scrollbar-thumb{background:#c2dece;border-radius:4px}
      `}</style>
      <div style={{minHeight:"100vh",background:"#eef7f2",fontFamily:"'DM Sans',sans-serif",display:"flex",alignItems:"flex-start",justifyContent:"center",padding:"24px 14px"}}>
        <div style={{width:"100%",maxWidth:520,animation:"fadeUp 0.5s ease-out"}}>
          <div style={{marginBottom:18}}>
            <p style={{fontSize:12,color:"#8aaa9a",marginBottom:4}}>{today.toLocaleDateString("en-US",{weekday:"long",month:"long",day:"numeric"})}</p>
            <div style={{display:"flex",alignItems:"center",gap:10}}>
              <div style={{width:34,height:34,borderRadius:"50%",background:"linear-gradient(135deg,#4a9e7a,#2d7a5a)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:17,flexShrink:0}}>🌿</div>
              <div>
                <h1 style={{fontFamily:"'Lora',serif",fontSize:21,fontWeight:600,color:"#1a3028",lineHeight:1.2}}>{greeting}</h1>
                <p style={{fontSize:11,color:"#6a9a7a"}}>Endive is here for you</p>
              </div>
            </div>
            {pending>0&&(
              <div style={{marginTop:10,padding:"6px 12px",background:"#fff",borderRadius:10,border:"1px solid #c2dece",display:"inline-flex",alignItems:"center",gap:6}}>
                <span style={{width:7,height:7,borderRadius:"50%",background:"#4a9e7a",display:"inline-block"}}/>
                <span style={{fontSize:12,color:"#3a6a4a"}}><strong>{pending}</strong> task{pending!==1?"s":""} pending</span>
              </div>
            )}
          </div>

          <div style={{background:"#fff",borderRadius:20,boxShadow:"0 2px 28px rgba(26,48,40,0.08)",overflow:"hidden"}}>
            <div style={{display:"flex",borderBottom:"1px solid #e8f2ec"}}>
              {TABS.map(t=>(
                <button key={t} onClick={()=>setTab(t)} style={{flex:1,padding:"13px 0",border:"none",background:"transparent",fontFamily:"'DM Sans',sans-serif",fontSize:13,fontWeight:tab===t?600:400,color:tab===t?"#4a9e7a":"#8aaa9a",cursor:"pointer",borderBottom:tab===t?"2px solid #4a9e7a":"2px solid transparent",transition:"all 0.15s"}}>
                  {t==="Endive"?"🌿 Endive":t}
                </button>
              ))}
            </div>
            <div style={{padding:18,minHeight:tab==="Endive"?500:"auto",display:"flex",flexDirection:"column"}}>
              {tab==="Tasks"&&<TasksTab tasks={tasks} setTasks={setTasks} categories={categories}/>}
              {tab==="Calendar"&&<CalendarTab events={events} setEvents={setEvents} categories={categories} setCategories={setCategories} tasks={tasks} setTasks={setTasks}/>}
              {tab==="Endive"&&<ChatTab tasks={tasks} setTasks={setTasks} events={events} setEvents={setEvents} categories={categories}/>}
            </div>
          </div>
          <p style={{textAlign:"center",fontSize:11,color:"#aacaba",marginTop:16}}>Endive · your personal assistant 🌿</p>
        </div>
      </div>
    </>
  );
}
