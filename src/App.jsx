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

// Generate all instances of a recurring event
function generateRecurring(ev){
  const{title,sh,eh,category,description,date,recur,recurDays,recurWeeks}=ev;
  if(!date||recur==="none"){
    return[{id:Date.now()+Math.random(),title,start:`${date}T${pad(sh)}:00:00`,end:`${date}T${pad(eh)}:00:00`,category,description}];
  }
  const instances=[];
  const start=new Date(date+"T12:00:00");
  const totalWeeks=parseInt(recurWeeks)||4;
  const endDate=new Date(start);
  endDate.setDate(endDate.getDate()+totalWeeks*7);

  if(recur==="daily"){
    const cur=new Date(start);
    while(cur<=endDate){
      const d=`${cur.getFullYear()}-${pad(cur.getMonth()+1)}-${pad(cur.getDate())}`;
      instances.push({id:Date.now()+Math.random(),title,start:`${d}T${pad(sh)}:00:00`,end:`${d}T${pad(eh)}:00:00`,category,description,recurId:title+date});
      cur.setDate(cur.getDate()+1);
    }
  } else if(recur==="weekly"){
    const days=recurDays.length>0?recurDays:[start.getDay()];
    const cur=new Date(start);
    cur.setDate(cur.getDate()-cur.getDay()); // go to Sunday of start week
    while(cur<=endDate){
      for(const day of days){
        const d=new Date(cur);
        d.setDate(d.getDate()+day);
        if(d>=start&&d<=endDate){
          const ds=`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
          instances.push({id:Date.now()+Math.random(),title,start:`${ds}T${pad(sh)}:00:00`,end:`${ds}T${pad(eh)}:00:00`,category,description,recurId:title+date});
        }
      }
      cur.setDate(cur.getDate()+7);
    }
  } else if(recur==="biweekly"){
    const days=recurDays.length>0?recurDays:[start.getDay()];
    const cur=new Date(start);
    cur.setDate(cur.getDate()-cur.getDay());
    let week=0;
    while(cur<=endDate){
      if(week%2===0){
        for(const day of days){
          const d=new Date(cur);
          d.setDate(d.getDate()+day);
          if(d>=start&&d<=endDate){
            const ds=`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
            instances.push({id:Date.now()+Math.random(),title,start:`${ds}T${pad(sh)}:00:00`,end:`${ds}T${pad(eh)}:00:00`,category,description,recurId:title+date});
          }
        }
      }
      cur.setDate(cur.getDate()+7);
      week++;
    }
  }
  return instances;
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
function CalendarTab({events,setEvents,categories,setCategories,tasks,setTasks,onEndiveAction}){
  const today=new Date();
  const [view,setView]=useState("month");
  const [cur,setCur]=useState({year:today.getFullYear(),month:today.getMonth(),day:today.getDate()});
  const [showAdd,setShowAdd]=useState(false);
  const [newEv,setNewEv]=useState({title:"",date:todayStr(),sh:9,eh:10,category:"personal",description:"",recur:"none",recurDays:[],recurWeeks:4});
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
    const instances=generateRecurring({...newEv,title:newEv.title.trim()});
    setEvents(prev=>[...prev,...instances]);
    setShowAdd(false);
    setNewEv({title:"",date:todayStr(),sh:9,eh:10,category:"personal",description:"",recur:"none",recurDays:[],recurWeeks:4});
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
      <InsightStrip tasks={tasks||[]} events={events} onAction={onEndiveAction||((a)=>{})}/>
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
                    {des.slice(0,2).map(ev=>{const cat=categories.find(c=>c.id===ev.category)||categories[3];return<div key={ev.id} style={{fontSize:9,padding:"1px 3px",borderRadius:3,background:cat.color,color:"#fff",marginBottom:1,overflow:"hidden",whiteSpace:"nowrap",textOverflow:"ellipsis"}}>{ev.recurId?"🔁 ":""}{cat.emoji} {ev.title}</div>;})}
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
                    return<div key={ev.id} onClick={ev.isTask?()=>setEditTask({taskId:ev.taskId,sh:parseInt(ev.start.split("T")[1]||"9"),eh:parseInt(ev.end.split("T")[1]||"10")}):undefined} style={{padding:"5px 10px",borderRadius:8,background:cat.bg,borderLeft:`3px solid ${cat.color}`,border:ev.isTask?`1.5px dashed ${cat.color}`:"none",borderLeft:`3px solid ${cat.color}`,fontSize:12,color:"#1a3028",flex:1,minWidth:120,cursor:ev.isTask?"pointer":"default"}}>
                      <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:4}}>
                        <div style={{fontWeight:600,flex:1}}>{ev.recurId&&<span style={{fontSize:9,background:cat.color+"33",color:cat.color,borderRadius:3,padding:"1px 4px",marginRight:4}}>🔁 series</span>}{cat.emoji} {ev.title}{ev.isTask&&<span style={{fontSize:9,marginLeft:4,opacity:0.6}}>📌 tap to edit</span>}</div>
                        {!ev.isTask&&<button onClick={e=>{e.stopPropagation();ev.recurId?setEvents(p=>p.filter(x=>x.recurId!==ev.recurId)):setEvents(p=>p.filter(x=>x.id!==ev.id));}} style={{background:"none",border:"none",color:"#ccc",cursor:"pointer",fontSize:13,lineHeight:1,padding:0,flexShrink:0}}>×</button>}
                      </div>
                      <div style={{fontSize:10,color:cat.color,marginTop:2}}>{pad(h)}:00 – {pad(eh)}:00</div>
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
        <input value={newEv.description} onChange={e=>setNewEv(p=>({...p,description:e.target.value}))} placeholder="Notes (optional)" style={{...mInput,marginBottom:10}}/>
        <label style={mLabel}>Repeat</label>
        <select value={newEv.recur} onChange={e=>setNewEv(p=>({...p,recur:e.target.value,recurDays:[]}))} style={{...mInput,marginBottom:newEv.recur!=="none"?8:16}}>
          <option value="none">Does not repeat</option>
          <option value="daily">Daily</option>
          <option value="weekly">Weekly (pick days)</option>
          <option value="biweekly">Biweekly (every 2 weeks)</option>
        </select>
        {(newEv.recur==="weekly"||newEv.recur==="biweekly")&&(
          <div style={{display:"flex",gap:5,marginBottom:8,flexWrap:"wrap"}}>
            {["Su","Mo","Tu","We","Th","Fr","Sa"].map((d,i)=>{
              const sel=newEv.recurDays.includes(i);
              return<button key={i} onClick={()=>setNewEv(p=>({...p,recurDays:sel?p.recurDays.filter(x=>x!==i):[...p.recurDays,i]}))} style={{width:34,height:34,borderRadius:"50%",border:`2px solid ${sel?"#4a9e7a":"#e0ece6"}`,background:sel?"#4a9e7a":"#fff",color:sel?"#fff":"#5a8a6a",fontSize:11,fontWeight:600,cursor:"pointer",fontFamily:"'DM Sans',sans-serif"}}>{d}</button>;
            })}
          </div>
        )}
        {newEv.recur!=="none"&&(
          <div style={{marginBottom:16}}>
            <label style={mLabel}>Repeat for how many weeks?</label>
            <div style={{display:"flex",alignItems:"center",gap:10}}>
              <input type="range" min="1" max="20" value={newEv.recurWeeks} onChange={e=>setNewEv(p=>({...p,recurWeeks:+e.target.value}))} style={{flex:1,accentColor:"#4a9e7a"}}/>
              <span style={{fontSize:14,fontWeight:600,color:"#4a9e7a",minWidth:50}}>{newEv.recurWeeks} {newEv.recurWeeks===1?"week":"weeks"}</span>
            </div>
          </div>
        )}
        <ModalBtns onCancel={()=>setShowAdd(false)} onSave={saveEv} label={newEv.recur==="none"?"Add Block":`Add ${generateRecurring({...newEv,title:newEv.title||"x"}).length} Blocks`}/>
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
function TasksTab({tasks,setTasks,categories,events,onEndiveAction}){
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
      <InsightStrip tasks={tasks} events={events||[]} onAction={onEndiveAction||((a)=>{})}/>
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
const SYS=`You are Endive 🌿, a warm and caring personal assistant for college students. You prevent burnout by balancing productivity with real rest.

Keep ALL responses SHORT — 2 to 4 sentences max unless presenting a plan. Never use long bullet lists. Be warm, direct, and human.

Workflow (follow naturally across conversation):
1. Ask how they're feeling first — always
2. Validate briefly with genuine empathy
3. Ask what's on their plate and when things are due
4. Build a realistic plan: work blocks + breaks + a hard stop time. Never more than 3 hours focus without a break. Always include at least one rest block per day.
5. Show the plan simply. Ask if it feels doable. Adjust if needed.
6. Once approved, add to calendar. Then ask if anything else is needed.

Break rules: include short breaks (☕ 5-15min), walk breaks (🚶 15-20min), meals (🍽️ 30-60min), and a wind-down block (🎮) at end of day. Space everything with buffer time. No work after 9pm.

If they seem overwhelmed or burnt out — check in emotionally first. Do NOT jump into planning. Redistribute tasks across days if the load is too heavy. Celebrate wins warmly.

To add a task (embed at END of reply only):
\`\`\`task
{"text":"name","date":"YYYY-MM-DD","category":"personal","quadrant":"do"}
\`\`\`

To add a calendar block (embed at END of reply only):
\`\`\`event
{"title":"title","start":"YYYY-MM-DDTHH:MM:00","end":"YYYY-MM-DDTHH:MM:00","category":"rest","description":""}
\`\`\`

Categories: class, study, work, personal, errands, rest
Quadrants: do, schedule, delegate, eliminate
Multiple blocks per reply are fine. Never show JSON to user. Redirect if off-topic.`

function parseB(text,tag){
  return[...text.matchAll(new RegExp("```"+tag+"\\n([\\s\\S]*?)```","g"))].map(m=>{try{return JSON.parse(m[1]);}catch{return null;}}).filter(Boolean);
}
function clean(text){return text.replace(/```(event|task)\n[\s\S]*?```/g,"").trim();}
function md(text){return text.split(/(\*\*[^*]+\*\*)/).map((p,i)=>p.startsWith("**")&&p.endsWith("**")?<strong key={i}>{p.slice(2,-2)}</strong>:p);}

function ChatTab({tasks,setTasks,events,setEvents,categories,pendingAction,clearPendingAction}){
  const [msgs,setMsgs]=useState([]);
  const [input,setInput]=useState("");
  const [loading,setLoading]=useState(false);
  const [started,setStarted]=useState(false);
  const [listening,setListening]=useState(false);
  const [muted,setMuted]=useState(true);
  const [voiceMode,setVoiceMode]=useState(false);
  const ref=useRef(null);
  const recognitionRef=useRef(null);

  const speak=(text)=>{
    if(muted) return;
    window.speechSynthesis.cancel();
    const cleaned=text.replace(/[*_#]/g,"").replace(/```[\s\S]*?```/g,"").replace(/[\u{1F300}-\u{1F9FF}]/gu,"").trim();
    const utt=new SpeechSynthesisUtterance(cleaned);
    utt.rate=0.88; utt.pitch=1.0; utt.volume=0.95;
    const trySpeak=()=>{
      const voices=window.speechSynthesis.getVoices();
      // Prefer warm natural voices — Samantha (macOS), Karen (AU), Moira (IE), Google US English
      const preferred=voices.find(v=>/^samantha$|^karen$|^moira$|google us english/i.test(v.name));
      const fallback=voices.find(v=>v.lang==="en-US"&&v.localService);
      if(preferred) utt.voice=preferred;
      else if(fallback) utt.voice=fallback;
      window.speechSynthesis.speak(utt);
    };
    // Voices may not be loaded yet
    if(window.speechSynthesis.getVoices().length>0) trySpeak();
    else window.speechSynthesis.onvoiceschanged=trySpeak;
  };

  const startListening=()=>{
    const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
    if(!SR){ alert("Voice input isn't supported on this browser. Try Safari on iPhone or Chrome on Android."); return; }
    const r=new SR();
    r.continuous=false; r.interimResults=false; r.lang="en-US";
    r.onstart=()=>setListening(true);
    r.onend=()=>setListening(false);
    r.onerror=()=>setListening(false);
    r.onresult=(e)=>{
      const transcript=e.results[0][0].transcript;
      setInput(transcript);
      // Auto-send after a short delay
      setTimeout(()=>sendText(transcript),300);
    };
    recognitionRef.current=r;
    r.start();
  };

  const stopListening=()=>{
    recognitionRef.current?.stop();
    setListening(false);
  };

  useEffect(()=>{ref.current?.scrollIntoView({behavior:"smooth"});},[msgs,loading]);

  useEffect(()=>{
    if(pendingAction&&started&&!loading){
      clearPendingAction?.();
      sendText(pendingAction);
    }
  },[pendingAction,started]);

  const ctx=()=>{
    const t=tasks.length>0?`Tasks:\n${tasks.map(t=>`- [${t.done?"✓":"○"}] ${t.text}${t.date?` due:${t.date}`:""} [${t.category}]`).join("\n")}`:"No tasks.";
    const e=events.length>0?`Recent blocks:\n${events.slice(-5).map(e=>`- ${e.title} ${e.start.split("T")[0]} ${e.start.split("T")[1]?.slice(0,5)} [${e.category}]`).join("\n")}`:"No blocks.";
    return`${t}\n${e}`;
  };

  const call=async(m)=>{
    const r=await fetch("/api/chat",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({model:"claude-sonnet-4-20250514",max_tokens:400,system:`${SYS}\n\nToday: ${new Date().toDateString()} (${todayStr()}).\n${ctx()}`,messages:m.map(x=>({role:x.role,content:x.content}))})});
    return r.json();
  };

  useEffect(()=>{
    if(started) return;setStarted(true);setLoading(true);
    call([{role:"user",content:"Start with your greeting."}])
      .then(d=>{const raw=d.content?.map(b=>b.text||"").join("")||"Hi! 🌿 I'm Endive. How are you feeling today?";const g=clean(raw);setMsgs([{role:"assistant",content:g,evs:parseB(raw,"event"),tsks:parseB(raw,"task")}]);setTimeout(()=>speak(g),600);})
      .catch(()=>{const fb="Hi! 🌿 I'm Endive, your personal assistant. How are you feeling today?";setMsgs([{role:"assistant",content:fb}]);setTimeout(()=>speak(fb),600);})
      .finally(()=>setLoading(false));
  },[]);

  const sendText=async(text)=>{
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
      const cleaned=clean(raw);
      setMsgs(p=>[...p,{role:"assistant",content:cleaned,evs:ne,tsks:nt}]);
      speak(cleaned);
    }catch{
      const err="Something went wrong. Please try again.";
      setMsgs(p=>[...p,{role:"assistant",content:err}]);
      speak(err);
    }
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
          {quick.map(p=><button key={p} onClick={()=>sendText(p)} style={{padding:"6px 11px",borderRadius:20,border:"1.5px solid #c2dece",background:"#f0f7f2",color:"#3a7a5a",fontSize:11,cursor:"pointer",fontFamily:"'DM Sans',sans-serif"}}>{p}</button>)}
        </div>
      )}
      {/* Voice mode banner */}
      {voiceMode&&(
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",background:"#e8f5ef",border:"1px solid #9ad4bc",borderRadius:10,padding:"7px 12px",marginBottom:8}}>
          <div style={{display:"flex",alignItems:"center",gap:6}}>
            <span style={{fontSize:13}}>🎙️</span>
            <span style={{fontSize:12,color:"#2a6a4a",fontWeight:600}}>Voice Mode — Endive is listening</span>
          </div>
          <button onClick={()=>{setVoiceMode(false);setMuted(true);window.speechSynthesis.cancel();}} style={{fontSize:11,color:"#5a8a6a",background:"none",border:"none",cursor:"pointer",fontFamily:"'DM Sans',sans-serif"}}>Turn off</button>
        </div>
      )}
      <div style={{display:"flex",gap:6,alignItems:"center"}}>
        <input value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>e.key==="Enter"&&sendText()} placeholder={listening?"Listening...":voiceMode?"Hold 🎙️ or type...":"Message Endive..."} style={{...iStyle,flex:1,background:listening?"#e8f5ef":"#f8fbf9"}}/>
        {voiceMode?(
          <button
            onMouseDown={startListening} onMouseUp={stopListening}
            onTouchStart={e=>{e.preventDefault();startListening();}} onTouchEnd={e=>{e.preventDefault();stopListening();}}
            style={{...aBtn,width:44,background:listening?"#e07b5a":"#4a9e7a",flexShrink:0,position:"relative",fontSize:16}}>
            {listening
              ? <span style={{fontSize:13}}>⏹</span>
              : <svg width="15" height="15" viewBox="0 0 24 24" fill="white"><path d="M12 1a4 4 0 014 4v7a4 4 0 01-8 0V5a4 4 0 014-4zm6.5 10a.5.5 0 011 0A7.5 7.5 0 0112 18.5V21h3a.5.5 0 010 1H9a.5.5 0 010-1h3v-2.5A7.5 7.5 0 014.5 11a.5.5 0 011 0 6.5 6.5 0 0013 0z"/></svg>
            }
            {listening&&<span style={{position:"absolute",top:-3,right:-3,width:8,height:8,borderRadius:"50%",background:"#e07b5a",animation:"pulse 1s infinite"}}/>}
          </button>
        ):(
          <button onClick={()=>{setVoiceMode(true);setMuted(false);}} style={{...aBtn,width:44,background:"#f0f7f2",flexShrink:0,border:"1.5px solid #9ad4bc"}} title="Turn on Voice Mode">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="#4a9e7a"><path d="M12 1a4 4 0 014 4v7a4 4 0 01-8 0V5a4 4 0 014-4zm6.5 10a.5.5 0 011 0A7.5 7.5 0 0112 18.5V21h3a.5.5 0 010 1H9a.5.5 0 010-1h3v-2.5A7.5 7.5 0 014.5 11a.5.5 0 011 0 6.5 6.5 0 0013 0z"/></svg>
          </button>
        )}
        <button onClick={()=>sendText()} disabled={loading} style={{...aBtn,width:44,fontSize:17,background:loading?"#b2d2be":"#4a9e7a",flexShrink:0}}>→</button>
      </div>
      {!voiceMode&&(
        <p style={{fontSize:11,color:"#aacaba",textAlign:"center",marginTop:6}}>Tap 🎙️ to turn on Voice Mode — hear Endive speak back</p>
      )}
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


// ─── ONBOARDING ──────────────────────────────────────────────────────────────
const TIME_STYLES=[
  {id:"timeblocking", label:"Time Blocking", desc:"Schedule every hour intentionally"},
  {id:"pomodoro",     label:"Pomodoro",      desc:"25 min focus, 5 min break cycles"},
  {id:"eat_the_frog", label:"Eat the Frog",  desc:"Hardest task first every morning"},
  {id:"getting_done", label:"Getting Things Done", desc:"Capture, clarify, organize, reflect"},
  {id:"flowing",      label:"Go with the Flow", desc:"Flexible, respond to how you feel"},
];

const YEAR_OPTIONS=["Freshman","Sophomore","Junior","Senior","Grad Student","Other"];
const STRESS_OPTIONS=["Classes & studying","Work or internship","Social life & relationships","Family responsibilities","Finances","Health & sleep","Extracurriculars","All of the above"];
const GOAL_OPTIONS=["Reduce stress & burnout","Stay on top of deadlines","Build better habits","Balance school & personal life","Improve focus & productivity","Feel more in control"];

function OnboardingForm({onComplete}){
  const [step,setStep]=useState(0);
  const [data,setData]=useState({
    name:"", year:"", stressors:[], commitments:"",
    sleepTime:"22", wakeTime:"7", goals:[], timeStyle:""
  });
  const [animating,setAnimating]=useState(false);

  const next=()=>{
    setAnimating(true);
    setTimeout(()=>{setStep(s=>s+1);setAnimating(false);},250);
  };
  const back=()=>{
    setAnimating(true);
    setTimeout(()=>{setStep(s=>s-1);setAnimating(false);},250);
  };

  const toggle=(field,val)=>setData(p=>({
    ...p,[field]:p[field].includes(val)?p[field].filter(x=>x!==val):[...p[field],val]
  }));

  const canNext=()=>{
    if(step===0) return data.name.trim().length>0;
    if(step===1) return data.year!=="";
    if(step===2) return data.stressors.length>0;
    if(step===3) return data.commitments.trim().length>0||true; // optional
    if(step===4) return true;
    if(step===5) return data.goals.length>0;
    if(step===6) return data.timeStyle!=="";
    return true;
  };

  const steps=[
    // 0 - Name
    <div key="name">
      <div style={olEmoji}>👋</div>
      <h2 style={olTitle}>Hi! I'm Endive.</h2>
      <p style={olSub}>Your personal burnout-prevention assistant. Let's get you set up — it takes about 2 minutes.</p>
      <label style={olLabel}>What's your name?</label>
      <input autoFocus value={data.name} onChange={e=>setData(p=>({...p,name:e.target.value}))} onKeyDown={e=>e.key==="Enter"&&canNext()&&next()} placeholder="Your first name..." style={olInput}/>
    </div>,

    // 1 - Year
    <div key="year">
      <div style={olEmoji}>🎓</div>
      <h2 style={olTitle}>Hey, {data.name}!</h2>
      <p style={olSub}>What year are you in?</p>
      <div style={{display:"flex",flexWrap:"wrap",gap:8,marginTop:4}}>
        {YEAR_OPTIONS.map(y=>(
          <button key={y} onClick={()=>setData(p=>({...p,year:y}))} style={{...olChip,background:data.year===y?"#4a9e7a":"#f0f7f2",color:data.year===y?"#fff":"#3a6a4a",border:`1.5px solid ${data.year===y?"#4a9e7a":"#c2dece"}`}}>{y}</button>
        ))}
      </div>
    </div>,

    // 2 - Stressors
    <div key="stress">
      <div style={olEmoji}>💭</div>
      <h2 style={olTitle}>What weighs on you most?</h2>
      <p style={olSub}>Select everything that applies — no judgment here.</p>
      <div style={{display:"flex",flexWrap:"wrap",gap:8,marginTop:4}}>
        {STRESS_OPTIONS.map(s=>{
          const sel=data.stressors.includes(s);
          return<button key={s} onClick={()=>toggle("stressors",s)} style={{...olChip,background:sel?"#e07b5a":"#f0f7f2",color:sel?"#fff":"#3a6a4a",border:`1.5px solid ${sel?"#e07b5a":"#c2dece"}`}}>{s}</button>;
        })}
      </div>
    </div>,

    // 3 - Recurring commitments
    <div key="commitments">
      <div style={olEmoji}>🗓️</div>
      <h2 style={olTitle}>Recurring commitments</h2>
      <p style={olSub}>What repeats every week? Classes, work shifts, gym, clubs... Endive will build around these.</p>
      <textarea value={data.commitments} onChange={e=>setData(p=>({...p,commitments:e.target.value}))} placeholder={"e.g. BIO 101 MWF 10-11am\nWork Tue/Thu 3-6pm\nGym Mon/Wed 7am"} style={{...olInput,height:100,resize:"none",lineHeight:1.6}}/>
      <p style={{fontSize:11,color:"#8aaa9a",marginTop:6}}>Optional — you can always tell Endive later.</p>
    </div>,

    // 4 - Sleep schedule
    <div key="sleep">
      <div style={olEmoji}>😴</div>
      <h2 style={olTitle}>Your sleep schedule</h2>
      <p style={olSub}>Endive won't schedule anything during your sleep. Ever.</p>
      <div style={{display:"flex",gap:16,marginTop:8}}>
        <div style={{flex:1}}>
          <label style={olLabel}>Bedtime</label>
          <select value={data.sleepTime} onChange={e=>setData(p=>({...p,sleepTime:e.target.value}))} style={olInput}>
            {Array.from({length:24},(_,i)=><option key={i} value={i}>{fmtHour(i)}</option>)}
          </select>
        </div>
        <div style={{flex:1}}>
          <label style={olLabel}>Wake up</label>
          <select value={data.wakeTime} onChange={e=>setData(p=>({...p,wakeTime:e.target.value}))} style={olInput}>
            {Array.from({length:24},(_,i)=><option key={i} value={i}>{fmtHour(i)}</option>)}
          </select>
        </div>
      </div>
    </div>,

    // 5 - Goals
    <div key="goals">
      <div style={olEmoji}>🌱</div>
      <h2 style={olTitle}>What do you want from Endive?</h2>
      <p style={olSub}>Pick everything that resonates.</p>
      <div style={{display:"flex",flexWrap:"wrap",gap:8,marginTop:4}}>
        {GOAL_OPTIONS.map(g=>{
          const sel=data.goals.includes(g);
          return<button key={g} onClick={()=>toggle("goals",g)} style={{...olChip,background:sel?"#7c6fcd":"#f0f7f2",color:sel?"#fff":"#3a6a4a",border:`1.5px solid ${sel?"#7c6fcd":"#c2dece"}`}}>{g}</button>;
        })}
      </div>
    </div>,

    // 6 - Time management style
    <div key="style">
      <div style={olEmoji}>⏱️</div>
      <h2 style={olTitle}>How do you like to work?</h2>
      <p style={olSub}>Endive will plan around your style. You can always change this later.</p>
      <div style={{display:"flex",flexDirection:"column",gap:8,marginTop:4}}>
        {TIME_STYLES.map(ts=>{
          const sel=data.timeStyle===ts.id;
          return(
            <button key={ts.id} onClick={()=>setData(p=>({...p,timeStyle:ts.id}))} style={{padding:"10px 14px",borderRadius:10,border:`1.5px solid ${sel?"#4a9e7a":"#c2dece"}`,background:sel?"#e8f5ef":"#f8fbf9",textAlign:"left",cursor:"pointer",fontFamily:"'DM Sans',sans-serif"}}>
              <div style={{fontWeight:600,fontSize:13,color:sel?"#2a6a4a":"#1a3028"}}>{ts.label}</div>
              <div style={{fontSize:11,color:"#8aaa9a",marginTop:2}}>{ts.desc}</div>
            </button>
          );
        })}
      </div>
    </div>,

    // 7 - Done
    <div key="done" style={{textAlign:"center",padding:"10px 0"}}>
      <div style={{fontSize:52,marginBottom:12}}>🌿</div>
      <h2 style={{...olTitle,textAlign:"center"}}>You're all set, {data.name}!</h2>
      <p style={{...olSub,textAlign:"center"}}>Endive knows what matters to you now. Let's build something sustainable together.</p>
      <div style={{background:"#e8f5ef",borderRadius:12,padding:"12px 16px",marginTop:16,textAlign:"left"}}>
        <div style={{fontSize:12,color:"#4a9e7a",fontWeight:600,marginBottom:6}}>Endive will remember:</div>
        {[
          `You're a ${data.year.toLowerCase()}`,
          `Your style: ${TIME_STYLES.find(t=>t.id===data.timeStyle)?.label||"flexible"}`,
          `Bedtime at ${fmtHour(+data.sleepTime)}, up at ${fmtHour(+data.wakeTime)}`,
          data.commitments?`${data.commitments.split("\n").filter(Boolean).length} recurring commitment(s)`:null,
        ].filter(Boolean).map((item,i)=>(
          <div key={i} style={{fontSize:12,color:"#2a5a3a",padding:"3px 0",display:"flex",gap:6}}>
            <span style={{color:"#4a9e7a"}}>✓</span>{item}
          </div>
        ))}
      </div>
    </div>
  ];

  const isLast=step===steps.length-1;

  return(
    <div style={{position:"fixed",inset:0,background:"#eef7f2",display:"flex",alignItems:"center",justifyContent:"center",zIndex:200,padding:16}}>
      <div style={{width:"100%",maxWidth:440,background:"#fff",borderRadius:24,boxShadow:"0 4px 40px rgba(26,48,40,0.12)",padding:28,opacity:animating?0:1,transform:animating?"translateY(8px)":"translateY(0)",transition:"all 0.25s ease"}}>
        {/* Progress dots */}
        <div style={{display:"flex",gap:5,justifyContent:"center",marginBottom:24}}>
          {steps.map((_,i)=>(
            <div key={i} style={{width:i===step?20:6,height:6,borderRadius:3,background:i<=step?"#4a9e7a":"#e0ece6",transition:"all 0.3s ease"}}/>
          ))}
        </div>

        <div style={{minHeight:280}}>{steps[step]}</div>

        <div style={{display:"flex",gap:8,marginTop:24}}>
          {step>0&&<button onClick={back} style={{flex:1,padding:"11px 0",borderRadius:10,border:"1.5px solid #e0ece6",background:"#fff",color:"#8aaa9a",cursor:"pointer",fontFamily:"'DM Sans',sans-serif",fontSize:14}}>← Back</button>}
          <button
            onClick={isLast?()=>onComplete(data):next}
            disabled={!canNext()}
            style={{flex:2,padding:"11px 0",borderRadius:10,border:"none",background:canNext()?"#4a9e7a":"#c2dece",color:"#fff",fontWeight:600,cursor:canNext()?"pointer":"default",fontFamily:"'DM Sans',sans-serif",fontSize:14,transition:"background 0.2s"}}>
            {isLast?"Start with Endive 🌿":"Continue →"}
          </button>
        </div>
      </div>
    </div>
  );
}

// Onboarding styles
const olEmoji={fontSize:36,marginBottom:10};
const olTitle={fontFamily:"'Lora',serif",fontSize:20,fontWeight:600,color:"#1a3028",marginBottom:6};
const olSub={fontSize:13,color:"#6a9a7a",marginBottom:14,lineHeight:1.6};
const olLabel={fontSize:11,fontWeight:600,color:"#8aaa9a",textTransform:"uppercase",letterSpacing:"0.05em",display:"block",marginBottom:6};
const olInput={width:"100%",padding:"10px 12px",borderRadius:8,border:"1.5px solid #c2dece",background:"#f8fbf9",fontSize:13,color:"#1a3028",outline:"none",fontFamily:"'DM Sans',sans-serif",boxSizing:"border-box"};
const olChip={padding:"7px 14px",borderRadius:20,fontSize:12,fontWeight:500,cursor:"pointer",fontFamily:"'DM Sans',sans-serif",transition:"all 0.15s"};

// ─── ENDIVE INSIGHT ENGINE ──────────────────────────────────────────────────
function getInsights(tasks, events, categories){
  const insights=[];
  const today=new Date();
  const todayS=todayStr();
  const in3=new Date(today.getTime()+3*864e5).toISOString().split("T")[0];
  const in7=new Date(today.getTime()+7*864e5).toISOString().split("T")[0];

  const pending=tasks.filter(t=>!t.done);
  const urgent=pending.filter(t=>t.date&&t.date<=in3);
  const thisWeek=pending.filter(t=>t.date&&t.date<=in7);

  // Count events per day this week
  const dayCounts={};
  events.forEach(e=>{
    const d=e.start.split("T")[0];
    if(d>=todayS&&d<=in7) dayCounts[d]=(dayCounts[d]||0)+1;
  });
  const heavyDays=Object.entries(dayCounts).filter(([,c])=>c>=4).map(([d])=>d);

  // Check for rest blocks today or tomorrow
  const tomorrow=new Date(today.getTime()+864e5).toISOString().split("T")[0];
  const hasRestToday=events.some(e=>e.category==="rest"&&e.start.startsWith(todayS));
  const hasRestTomorrow=events.some(e=>e.category==="rest"&&e.start.startsWith(tomorrow));

  // No rest block today
  if(!hasRestToday&&new Date().getHours()<18){
    insights.push({type:"rest",msg:"No rest block scheduled today. Want Endive to add one?",action:"Add a rest block today"});
  }

  // Heavy days coming up
  if(heavyDays.length>0){
    const d=new Date(heavyDays[0]+"T12:00:00");
    const label=d.toLocaleDateString("en-US",{weekday:"long",month:"short",day:"numeric"});
    insights.push({type:"heavy",msg:`${label} looks packed. Want Endive to rebalance?`,action:"Rebalance that day"});
  }

  // Many urgent tasks
  if(urgent.length>=3){
    insights.push({type:"urgent",msg:`${urgent.length} things due in the next 3 days. Want a focused plan?`,action:"Make a plan for this week"});
  }

  // Tasks with no time block on calendar
  const unscheduled=pending.filter(t=>t.date&&!events.some(e=>e.isTask&&e.taskId===t.id)&&t.date>=todayS&&t.date<=in7);
  if(unscheduled.length>0){
    insights.push({type:"unscheduled",msg:`${unscheduled.length} task${unscheduled.length>1?"s are":" is"} due this week with no time blocked.`,action:"Schedule them now"});
  }

  return insights.slice(0,2); // max 2 nudges at a time
}

const INSIGHT_COLORS={
  rest:{bg:"#f3eaf8",border:"#b07db8",color:"#7a4a8a",icon:"😴"},
  heavy:{bg:"#fceee8",border:"#e07b5a",color:"#a04a2a",icon:"⚡"},
  urgent:{bg:"#fdf3e0",border:"#e8a838",color:"#8a5a10",icon:"🔥"},
  unscheduled:{bg:"#e8eef8",border:"#6c8ebf",color:"#2a4a8a",icon:"📅"},
};

function InsightStrip({tasks,events,onAction}){
  const insights=getInsights(tasks,events);
  if(insights.length===0) return null;
  return(
    <div style={{marginBottom:14}}>
      {insights.map((ins,i)=>{
        const style=INSIGHT_COLORS[ins.type]||INSIGHT_COLORS.rest;
        return(
          <div key={i} style={{background:style.bg,border:`1px solid ${style.border}`,borderRadius:10,padding:"9px 12px",marginBottom:6,display:"flex",alignItems:"center",gap:10}}>
            <span style={{fontSize:16,flexShrink:0}}>{style.icon}</span>
            <span style={{flex:1,fontSize:12,color:style.color,lineHeight:1.4}}>{ins.msg}</span>
            <button onClick={()=>onAction(ins.action)} style={{fontSize:11,fontWeight:600,color:style.color,background:"#fff",border:`1px solid ${style.border}`,borderRadius:6,padding:"4px 8px",cursor:"pointer",flexShrink:0,fontFamily:"'DM Sans',sans-serif",whiteSpace:"nowrap"}}>Ask Endive</button>
          </div>
        );
      })}
    </div>
  );
}

const TABS=["Endive","My Plan","My Calendar"];

// ─── APP ─────────────────────────────────────────────────────────────────────
export default function App(){
  const [userProfile,setUserProfile]=useState(null); // null = show onboarding
  const [tasks,setTasks]=useState([]);
  const [events,setEvents]=useState([]);
  const [categories,setCategories]=useState(DEFAULT_CATEGORIES);
  const [tab,setTab]=useState("Endive");
  const [pendingAction,setPendingAction]=useState(null);

  const completeOnboarding=(profile)=>{
    setUserProfile(profile);
    // Pre-fill pending action so Endive greets with context
    setPendingAction(\`My name is \${profile.name}, I'm a \${profile.year}. My main stressors are: \${profile.stressors.join(", ")}. My recurring commitments: \${profile.commitments||"none yet"}. I sleep around \${fmtHour(+profile.sleepTime)} and wake at \${fmtHour(+profile.wakeTime)}. My goals: \${profile.goals.join(", ")}. My preferred time management style is \${TIME_STYLES.find(t=>t.id===profile.timeStyle)?.label||"flexible"}. Please greet me warmly by name and let me know you've got everything you need to help me.\`);
  };

  const handleEndiveAction=(action)=>{
    setPendingAction(action);
    setTab("Endive");
  };

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

          {!userProfile&&<OnboardingForm onComplete={completeOnboarding}/>}
          <div style={{background:"#fff",borderRadius:20,boxShadow:"0 2px 28px rgba(26,48,40,0.08)",overflow:"hidden"}}>
            <div style={{display:"flex",borderBottom:"1px solid #e8f2ec"}}>
              {TABS.map(t=>(
                <button key={t} onClick={()=>setTab(t)} style={{flex:1,padding:"13px 0",border:"none",background:"transparent",fontFamily:"'DM Sans',sans-serif",fontSize:13,fontWeight:tab===t?600:400,color:tab===t?"#4a9e7a":"#8aaa9a",cursor:"pointer",borderBottom:tab===t?"2px solid #4a9e7a":"2px solid transparent",transition:"all 0.15s"}}>
                  {t==="Endive"?"🌿 Endive":t}
                </button>
              ))}
            </div>
            <div style={{padding:18,minHeight:tab==="Endive"?500:"auto",display:"flex",flexDirection:"column"}}>
              {tab==="My Plan"&&<TasksTab tasks={tasks} setTasks={setTasks} categories={categories} events={events} onEndiveAction={handleEndiveAction}/>}
              {tab==="My Calendar"&&<CalendarTab events={events} setEvents={setEvents} categories={categories} setCategories={setCategories} tasks={tasks} setTasks={setTasks} onEndiveAction={handleEndiveAction}/>}
              {tab==="Endive"&&<ChatTab tasks={tasks} setTasks={setTasks} events={events} setEvents={setEvents} categories={categories} pendingAction={pendingAction} clearPendingAction={()=>setPendingAction(null)}/>}
            </div>
          </div>
          <p style={{textAlign:"center",fontSize:11,color:"#aacaba",marginTop:16}}>Endive · your personal assistant 🌿</p>
        </div>
      </div>
    </>
  );
}
