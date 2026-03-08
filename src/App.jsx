import { useState, useRef, useEffect } from "react";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];

function getDaysInMonth(y, m) { return new Date(y, m + 1, 0).getDate(); }
function getFirstDay(y, m) { return new Date(y, m, 1).getDay(); }

function toGCalLink({ title, start, end, description = "", location = "" }) {
  const fmt = d => new Date(d).toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(title)}&dates=${fmt(start)}/${fmt(end || new Date(new Date(start).getTime() + 3600000).toISOString())}&details=${encodeURIComponent(description)}&location=${encodeURIComponent(location)}`;
}

function toICS({ title, start, end, description = "", location = "" }) {
  const fmt = d => new Date(d).toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
  return ["BEGIN:VCALENDAR","VERSION:2.0","PRODID:-//Endive//EN","BEGIN:VEVENT",
    `DTSTART:${fmt(start)}`,`DTEND:${fmt(end || new Date(new Date(start).getTime()+3600000).toISOString())}`,
    `SUMMARY:${title}`, description?`DESCRIPTION:${description}`:"", location?`LOCATION:${location}`:"",
    `UID:${Date.now()}@endive`,"END:VEVENT","END:VCALENDAR"
  ].filter(Boolean).join("\r\n");
}

function downloadICS(event) {
  const blob = new Blob([toICS(event)], { type: "text/calendar" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `${event.title.replace(/\s+/g,"_")}.ics`;
  a.click();
}

function EventCard({ event }) {
  const d = new Date(event.start);
  return (
    <div style={{ background: "#f0f7f2", border: "1.5px solid #c2dece", borderRadius: 12, padding: "12px 14px", marginTop: 10 }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
        <div style={{ background: "#4a9e7a", borderRadius: 8, padding: "6px 10px", textAlign: "center", flexShrink: 0, minWidth: 46 }}>
          <div style={{ fontSize: 10, color: "rgba(255,255,255,0.8)", fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase" }}>
            {d.toLocaleDateString("en-US", { month: "short" })}
          </div>
          <div style={{ fontSize: 18, color: "#fff", fontWeight: 700, lineHeight: 1.1 }}>{d.getDate()}</div>
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 600, fontSize: 14, color: "#1a3028" }}>{event.title}</div>
          <div style={{ fontSize: 12, color: "#5a7a6a", marginTop: 2 }}>
            {d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })} · {d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
          </div>
          {event.location && <div style={{ fontSize: 12, color: "#7a9a8a", marginTop: 1 }}>📍 {event.location}</div>}
          {event.description && <div style={{ fontSize: 12, color: "#5a7a6a", marginTop: 2 }}>{event.description}</div>}
        </div>
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
        <a href={toGCalLink(event)} target="_blank" rel="noreferrer" style={{
          flex: 1, padding: "8px 0", borderRadius: 8, background: "#4285f4",
          color: "#fff", fontSize: 12, fontWeight: 600, textAlign: "center",
          textDecoration: "none", display: "flex", alignItems: "center", justifyContent: "center", gap: 6
        }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="white"><path d="M19 4h-1V2h-2v2H8V2H6v2H5a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2V6a2 2 0 00-2-2zm0 16H5V9h14v11z"/></svg>
          Add to Google Calendar
        </a>
        <button onClick={() => downloadICS(event)} style={{
          flex: 1, padding: "8px 0", borderRadius: 8, background: "#fff",
          border: "1.5px solid #c2dece", color: "#2a5a40", fontSize: 12,
          fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
          fontFamily: "'DM Sans', sans-serif"
        }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
          Apple / .ics
        </button>
      </div>
    </div>
  );
}

function CalendarView({ tasks }) {
  const today = new Date();
  const [view, setView] = useState({ year: today.getFullYear(), month: today.getMonth() });
  const daysInMonth = getDaysInMonth(view.year, view.month);
  const firstDay = getFirstDay(view.year, view.month);
  const taskDays = new Set(tasks.filter(t => {
    if (!t.date) return false;
    const d = new Date(t.date);
    return d.getFullYear() === view.year && d.getMonth() === view.month;
  }).map(t => new Date(t.date).getDate()));
  const prev = () => setView(v => { const d = new Date(v.year, v.month-1); return { year: d.getFullYear(), month: d.getMonth() }; });
  const next = () => setView(v => { const d = new Date(v.year, v.month+1); return { year: d.getFullYear(), month: d.getMonth() }; });
  const cells = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <button onClick={prev} style={navBtn}>‹</button>
        <span style={{ fontFamily: "'Lora', serif", fontSize: 16, fontWeight: 600, color: "#1a3028" }}>{MONTHS[view.month]} {view.year}</span>
        <button onClick={next} style={navBtn}>›</button>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 2, marginBottom: 4 }}>
        {DAYS.map(d => <div key={d} style={{ textAlign: "center", fontSize: 11, color: "#8aaa9a", fontWeight: 600, letterSpacing: "0.05em", padding: "4px 0" }}>{d}</div>)}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 3 }}>
        {cells.map((day, i) => {
          const isToday = day && view.year === today.getFullYear() && view.month === today.getMonth() && day === today.getDate();
          const hasTask = day && taskDays.has(day);
          return (
            <div key={i} style={{
              aspectRatio: "1", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
              borderRadius: 8, background: isToday ? "#4a9e7a" : "transparent",
              color: isToday ? "#fff" : day ? "#1a3028" : "transparent",
              fontSize: 13, fontWeight: isToday ? 700 : 400, position: "relative", transition: "background 0.15s"
            }}>
              {day}
              {hasTask && !isToday && <span style={{ position: "absolute", bottom: 3, width: 4, height: 4, borderRadius: "50%", background: "#4a9e7a" }} />}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TaskList({ tasks, setTasks }) {
  const [input, setInput] = useState("");
  const [date, setDate] = useState("");
  const add = () => {
    if (!input.trim()) return;
    setTasks(prev => [...prev, { id: Date.now(), text: input.trim(), done: false, date: date || null }]);
    setInput(""); setDate("");
  };
  const toggle = id => setTasks(prev => prev.map(t => t.id === id ? { ...t, done: !t.done } : t));
  const remove = id => setTasks(prev => prev.filter(t => t.id !== id));
  const todayStr = new Date().toISOString().split("T")[0];
  const todayTasks = tasks.filter(t => t.date === todayStr || !t.date);
  const upcoming = tasks.filter(t => t.date && t.date > todayStr);
  const Item = ({ t }) => (
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 0", borderBottom: "1px solid #e8f2ec", opacity: t.done ? 0.45 : 1, transition: "opacity 0.2s" }}>
      <button onClick={() => toggle(t.id)} style={{ width: 18, height: 18, borderRadius: 5, border: `2px solid ${t.done ? "#4a9e7a" : "#b2d2be"}`, background: t.done ? "#4a9e7a" : "transparent", flexShrink: 0, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.15s" }}>
        {t.done && <span style={{ color: "#fff", fontSize: 10, fontWeight: 700 }}>✓</span>}
      </button>
      <span style={{ flex: 1, fontSize: 14, color: "#1a3028", textDecoration: t.done ? "line-through" : "none" }}>{t.text}</span>
      {t.date && <span style={{ fontSize: 11, color: "#8aaa9a" }}>{t.date.slice(5).replace("-", "/")}</span>}
      <button onClick={() => remove(t.id)} style={{ background: "none", border: "none", color: "#b2d2be", cursor: "pointer", fontSize: 16, lineHeight: 1, padding: 0 }}>×</button>
    </div>
  );
  return (
    <div>
      <div style={{ display: "flex", gap: 6, marginBottom: 16 }}>
        <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === "Enter" && add()} placeholder="Add a task..." style={inputStyle} />
        <input type="date" value={date} onChange={e => setDate(e.target.value)} style={{ ...inputStyle, width: 130, flexShrink: 0 }} />
        <button onClick={add} style={addBtnStyle}>+</button>
      </div>
      {todayTasks.length === 0 && upcoming.length === 0 && <p style={{ color: "#8aaa9a", fontSize: 13, textAlign: "center", marginTop: 24 }}>No tasks yet. Add one above.</p>}
      {todayTasks.length > 0 && <><div style={sectionLabel}>Today</div>{todayTasks.map(t => <Item key={t.id} t={t} />)}</>}
      {upcoming.length > 0 && <><div style={{ ...sectionLabel, marginTop: 16 }}>Upcoming</div>{upcoming.sort((a,b) => a.date > b.date ? 1 : -1).map(t => <Item key={t.id} t={t} />)}</>}
    </div>
  );
}

function parseEvents(text) {
  return [...text.matchAll(/```event\n([\s\S]*?)```/g)].map(m => { try { return JSON.parse(m[1]); } catch { return null; } }).filter(Boolean);
}
function cleanText(text) { return text.replace(/```event\n[\s\S]*?```/g, "").trim(); }
function renderMd(text) {
  return text.split(/(\*\*[^*]+\*\*)/).map((p, i) =>
    p.startsWith("**") && p.endsWith("**") ? <strong key={i}>{p.slice(2,-2)}</strong> : p
  );
}

const ENDIVE_SYSTEM = `You are Endive, a warm, nurturing, and encouraging personal assistant designed specifically for college students who are juggling multiple responsibilities. You understand that they are often stressed, so you value efficiency, clarity, and emotional support.

## Your Role
Understand your user's emotions, upcoming tasks, current tasks, deadlines, goals, and daily responsibilities (like grocery shopping). Then create a clear, manageable plan with their schedule in mind — and break down tasks when needed.

## Your Characteristics
- Friendly, warm, nurturing, and encouraging tone
- Patient and focused on the user's needs and current situation
- Advice is to the point, simple, and easy to digest — not too long
- Genuine, never judgmental or dismissive
- Inclusive in examples, avoids stereotypes

## Your Workflow (follow this order naturally across the conversation)
1. **Greet & check in**: Ask how they're feeling — their mood, emotions, or current challenges
2. **Validate**: Acknowledge their feelings and challenges with genuine empathy before moving into planning
3. **Gather & organize**: Understand what they need to work on — deadlines, to-dos — and organize using the Eisenhower Matrix (Urgent+Important first, then Important but not urgent, etc.)
4. **Present a plan**: Lay out a clear, digestible plan as if presenting it to them as their boss. Include scheduled to-dos, step breakdowns for multi-step tasks, and time blocks
5. **Calendar integration**: Once they approve the plan, generate calendar events using the JSON format below
6. **Wrap up**: Ask if there's anything else you can help with

## Calendar Event Format
When scheduling events (only after the user approves a plan), embed JSON at the END of your reply:
\`\`\`event
{"title":"...","start":"YYYY-MM-DDTHH:MM:00","end":"YYYY-MM-DDTHH:MM:00","description":"...","location":""}
\`\`\`
- Use ISO 8601. Default duration: 1 hour. Never show the raw JSON format to the user.
- You can include multiple event blocks in one reply if scheduling several things at once.

## Guardrails
- If the user goes off-topic, gently guide them back
- Keep responses concise — students are busy
- Never be overwhelming; break things into small, approachable steps
- Build trust through patience and genuine care`;

function ChatAssistant({ tasks, setTasks }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [started, setStarted] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, loading]);

  // Auto-start Endive's greeting
  useEffect(() => {
    if (started) return;
    setStarted(true);
    setLoading(true);
    const todayStr = new Date().toISOString().split("T")[0];
    const taskCtx = tasks.length > 0
      ? `Student's current tasks:\n${tasks.map(t => `- [${t.done?"done":"todo"}] ${t.text}${t.date?` (due: ${t.date})`:""}`).join("\n")}`
      : "Student has no tasks listed yet.";

    fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1000,
        system: `${ENDIVE_SYSTEM}\n\nToday is ${new Date().toDateString()} (${todayStr}).\n${taskCtx}`,
        messages: [{ role: "user", content: "Start the conversation with your greeting." }]
      })
    })
    .then(r => r.json())
    .then(data => {
      const raw = data.content?.map(b => b.text || "").join("") || "Hi there! 🌿 I'm Endive. How are you feeling today?";
      setMessages([{ role: "assistant", content: cleanText(raw), events: parseEvents(raw) }]);
    })
    .catch(() => {
      setMessages([{ role: "assistant", content: "Hi there! 🌿 I'm Endive, your personal assistant. How are you feeling today? I'm here to help you tackle whatever's on your plate." }]);
    })
    .finally(() => setLoading(false));
  }, []);

  const send = async (text) => {
    const userMsg = (text || input).trim();
    if (!userMsg || loading) return;
    setInput("");
    const newMsgs = [...messages, { role: "user", content: userMsg }];
    setMessages(newMsgs);
    setLoading(true);

    const todayStr = new Date().toISOString().split("T")[0];
    const taskCtx = tasks.length > 0
      ? `Student's current tasks:\n${tasks.map(t => `- [${t.done?"done":"todo"}] ${t.text}${t.date?` (due: ${t.date})`:""}`).join("\n")}`
      : "Student has no tasks listed yet.";

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1000,
          system: `${ENDIVE_SYSTEM}\n\nToday is ${new Date().toDateString()} (${todayStr}).\n${taskCtx}`,
          messages: newMsgs.map(m => ({ role: m.role, content: m.content }))
        })
      });
      const data = await res.json();
      const raw = data.content?.map(b => b.text || "").join("") || "Sorry, something went wrong.";
      setMessages(prev => [...prev, { role: "assistant", content: cleanText(raw), events: parseEvents(raw) }]);
    } catch {
      setMessages(prev => [...prev, { role: "assistant", content: "Something went wrong. Please try again." }]);
    }
    setLoading(false);
  };

  const quickPrompts = [
    "I have 3 assignments due this week 😅",
    "I'm feeling overwhelmed right now",
    "Help me plan my day",
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div style={{ flex: 1, overflowY: "auto", paddingRight: 2, marginBottom: 12 }}>
        {messages.length === 0 && loading && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#6a9a7a", fontSize: 13, marginTop: 8 }}>
            <span>Endive is getting ready</span>
            <div style={{ display: "flex", gap: 3 }}>
              {[0,1,2].map(i => <span key={i} style={{ width: 5, height: 5, borderRadius: "50%", background: "#4a9e7a", animation: "pulse 1.2s ease-in-out infinite", animationDelay: `${i*0.2}s`, display: "block" }} />)}
            </div>
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} style={{ display: "flex", justifyContent: m.role === "user" ? "flex-end" : "flex-start", marginBottom: 10 }}>
            <div style={{ maxWidth: "88%", width: m.role === "assistant" ? "88%" : "auto" }}>
              {m.role === "assistant" && (
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                  <div style={{ width: 22, height: 22, borderRadius: "50%", background: "linear-gradient(135deg, #4a9e7a, #2d7a5a)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12 }}>🌿</div>
                  <span style={{ fontSize: 11, fontWeight: 600, color: "#4a9e7a", letterSpacing: "0.03em" }}>Endive</span>
                </div>
              )}
              <div style={{
                padding: "10px 14px",
                borderRadius: m.role === "user" ? "16px 16px 4px 16px" : "16px 16px 16px 4px",
                background: m.role === "user" ? "#4a9e7a" : "#f0f7f2",
                color: m.role === "user" ? "#fff" : "#1a3028",
                fontSize: 14, lineHeight: 1.65, whiteSpace: "pre-wrap"
              }}>{renderMd(m.content)}</div>
              {m.events?.map((ev, j) => <EventCard key={j} event={ev} />)}
            </div>
          </div>
        ))}
        {loading && messages.length > 0 && (
          <div style={{ display: "flex", gap: 4, padding: "10px 14px", background: "#f0f7f2", borderRadius: "16px 16px 16px 4px", width: "fit-content" }}>
            {[0,1,2].map(i => <span key={i} style={{ width: 6, height: 6, borderRadius: "50%", background: "#4a9e7a", animation: "pulse 1.2s ease-in-out infinite", animationDelay: `${i*0.2}s`, display: "block" }} />)}
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {messages.length <= 1 && !loading && (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
          {quickPrompts.map(p => (
            <button key={p} onClick={() => send(p)} style={{ padding: "6px 12px", borderRadius: 20, border: "1.5px solid #c2dece", background: "#f0f7f2", color: "#3a7a5a", fontSize: 12, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>{p}</button>
          ))}
        </div>
      )}

      <div style={{ display: "flex", gap: 8 }}>
        <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === "Enter" && send()} placeholder="Talk to Endive..." style={{ ...inputStyle, flex: 1 }} />
        <button onClick={() => send()} disabled={loading} style={{ ...addBtnStyle, width: 44, fontSize: 18, background: loading ? "#b2d2be" : "#4a9e7a" }}>→</button>
      </div>
    </div>
  );
}

const navBtn = { background: "none", border: "none", fontSize: 20, color: "#8aaa9a", cursor: "pointer", padding: "0 8px", lineHeight: 1 };
const inputStyle = { flex: 1, padding: "9px 12px", borderRadius: 8, border: "1.5px solid #c2dece", background: "#f8fbf9", fontSize: 14, color: "#1a3028", outline: "none", fontFamily: "'DM Sans', sans-serif" };
const addBtnStyle = { width: 38, height: 38, borderRadius: 8, background: "#4a9e7a", color: "#fff", border: "none", fontSize: 20, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 };
const sectionLabel = { fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", color: "#8aaa9a", textTransform: "uppercase", marginBottom: 4 };
const TABS = ["Tasks", "Calendar", "Endive"];

export default function App() {
  const [tasks, setTasks] = useState([
    { id: 1, text: "Review project proposal", done: false, date: new Date().toISOString().split("T")[0] },
    { id: 2, text: "Book dentist appointment", done: false, date: null },
  ]);
  const [tab, setTab] = useState("Endive");
  const today = new Date();
  const hour = today.getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const pendingCount = tasks.filter(t => !t.done).length;

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Lora:wght@400;600&family=DM+Sans:wght@300;400;500&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #eef7f2; min-height: 100vh; }
        @keyframes pulse { 0%,100%{opacity:.3;transform:scale(.8)} 50%{opacity:1;transform:scale(1)} }
        @keyframes fadeUp { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:translateY(0)} }
        input[type="date"]::-webkit-calendar-picker-indicator { opacity: 0.4; cursor: pointer; }
        ::-webkit-scrollbar{width:4px} ::-webkit-scrollbar-thumb{background:#c2dece;border-radius:4px}
      `}</style>
      <div style={{ minHeight: "100vh", background: "#eef7f2", fontFamily: "'DM Sans', sans-serif", display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "32px 16px" }}>
        <div style={{ width: "100%", maxWidth: 480, animation: "fadeUp 0.5s ease-out" }}>

          <div style={{ marginBottom: 24 }}>
            <p style={{ fontSize: 13, color: "#8aaa9a", marginBottom: 4 }}>{today.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}</p>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 36, height: 36, borderRadius: "50%", background: "linear-gradient(135deg, #4a9e7a, #2d7a5a)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 }}>🌿</div>
              <div>
                <h1 style={{ fontFamily: "'Lora', serif", fontSize: 22, fontWeight: 600, color: "#1a3028", lineHeight: 1.2 }}>{greeting}</h1>
                <p style={{ fontSize: 12, color: "#6a9a7a" }}>Endive is here for you</p>
              </div>
            </div>
            {pendingCount > 0 && (
              <div style={{ marginTop: 12, padding: "8px 14px", background: "#fff", borderRadius: 10, border: "1px solid #c2dece", display: "inline-flex", alignItems: "center", gap: 6 }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#4a9e7a", display: "inline-block" }} />
                <span style={{ fontSize: 13, color: "#3a6a4a" }}><strong>{pendingCount}</strong> task{pendingCount !== 1 ? "s" : ""} pending</span>
              </div>
            )}
          </div>

          <div style={{ background: "#fff", borderRadius: 20, boxShadow: "0 2px 28px rgba(26,48,40,0.08)", overflow: "hidden" }}>
            <div style={{ display: "flex", borderBottom: "1px solid #e8f2ec" }}>
              {TABS.map(t => (
                <button key={t} onClick={() => setTab(t)} style={{
                  flex: 1, padding: "14px 0", border: "none", background: "transparent",
                  fontFamily: "'DM Sans', sans-serif", fontSize: 13, fontWeight: tab === t ? 600 : 400,
                  color: tab === t ? "#4a9e7a" : "#8aaa9a", cursor: "pointer",
                  borderBottom: tab === t ? "2px solid #4a9e7a" : "2px solid transparent",
                  transition: "all 0.15s"
                }}>
                  {t === "Endive" ? "🌿 Endive" : t}
                </button>
              ))}
            </div>
            <div style={{ padding: 24, minHeight: tab === "Endive" ? 500 : "auto", display: "flex", flexDirection: "column" }}>
              {tab === "Tasks" && <TaskList tasks={tasks} setTasks={setTasks} />}
              {tab === "Calendar" && <CalendarView tasks={tasks} />}
              {tab === "Endive" && <ChatAssistant tasks={tasks} setTasks={setTasks} />}
            </div>
          </div>
          <p style={{ textAlign: "center", fontSize: 11, color: "#aacaba", marginTop: 20 }}>Endive · your personal assistant 🌿</p>
        </div>
      </div>
    </>
  );
}
