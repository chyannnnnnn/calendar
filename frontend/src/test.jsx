import { useState, useEffect } from "react";

const USERS = {
  you: { name: "You", color: "#6EE7B7", accent: "#10B981" },
  partner: { name: "Partner", color: "#FCA5A5", accent: "#EF4444" },
};

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];

const initialEvents = [
  { id: 1, owner: "you", title: "Gym", date: "2026-03-11", startTime: "07:00", endTime: "08:30", private: false },
  { id: 2, owner: "you", title: "Team Meeting", date: "2026-03-12", startTime: "10:00", endTime: "12:00", private: false },
  { id: 3, owner: "you", title: "Doctor", date: "2026-03-14", startTime: "14:00", endTime: "15:00", private: true },
  { id: 4, owner: "partner", title: "Yoga Class", date: "2026-03-11", startTime: "09:00", endTime: "10:30", private: false },
  { id: 5, owner: "partner", title: "Lunch w/ Sarah", date: "2026-03-13", startTime: "12:00", endTime: "13:30", private: false },
  { id: 6, owner: "partner", title: "Project Deadline", date: "2026-03-12", startTime: "09:00", endTime: "18:00", private: false },
  { id: 7, owner: "you", title: "Free evening", date: "2026-03-15", startTime: "18:00", endTime: "22:00", private: false },
  { id: 8, owner: "partner", title: "Family dinner", date: "2026-03-15", startTime: "19:00", endTime: "21:00", private: false },
];

function getWeekDates(baseDate) {
  const d = new Date(baseDate);
  const day = d.getDay();
  const start = new Date(d);
  start.setDate(d.getDate() - day);
  return Array.from({ length: 7 }, (_, i) => {
    const nd = new Date(start);
    nd.setDate(start.getDate() + i);
    return nd;
  });
}

function toDateStr(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function timeToMins(t) {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

function findFreeSlots(events, dateStr) {
  const youEvents = events.filter(e => e.owner === "you" && e.date === dateStr);
  const partnerEvents = events.filter(e => e.owner === "partner" && e.date === dateStr);
  const allBusy = [...youEvents, ...partnerEvents].map(e => [timeToMins(e.startTime), timeToMins(e.endTime)]).sort((a,b) => a[0]-b[0]);
  const dayStart = 8 * 60, dayEnd = 22 * 60;
  let free = [[dayStart, dayEnd]];
  for (const [bs, be] of allBusy) {
    free = free.flatMap(([fs, fe]) => {
      if (be <= fs || bs >= fe) return [[fs, fe]];
      const res = [];
      if (bs > fs) res.push([fs, bs]);
      if (be < fe) res.push([be, fe]);
      return res;
    });
  }
  return free.filter(([s, e]) => e - s >= 60);
}

function minsToTime(m) {
  return `${String(Math.floor(m/60)).padStart(2,'0')}:${String(m%60).padStart(2,'0')}`;
}

export default function App() {
  const [activeUser] = useState("you");
  const [today] = useState(new Date("2026-03-10"));
  const [weekBase, setWeekBase] = useState(new Date("2026-03-10"));
  const [events, setEvents] = useState(initialEvents);
  const [view, setView] = useState("week"); // week | free | add
  const [addForm, setAddForm] = useState({ title: "", date: "", startTime: "", endTime: "", private: false });
  const [syncStatus, setSyncStatus] = useState("synced");
  const [selectedDay, setSelectedDay] = useState(null);
  const [showConflict, setShowConflict] = useState(null);

  const weekDates = getWeekDates(weekBase);

  function handleAddEvent() {
    if (!addForm.title || !addForm.date || !addForm.startTime || !addForm.endTime) return;
    const conflict = events.find(e =>
      e.owner === "partner" && e.date === addForm.date &&
      timeToMins(e.startTime) < timeToMins(addForm.endTime) &&
      timeToMins(e.endTime) > timeToMins(addForm.startTime)
    );
    if (conflict) {
      setShowConflict({ newEvent: addForm, clash: conflict });
      return;
    }
    commitAdd();
  }

  function commitAdd() {
    setSyncStatus("syncing");
    const newEv = { ...addForm, id: Date.now(), owner: activeUser };
    setEvents(prev => [...prev, newEv]);
    setTimeout(() => setSyncStatus("synced"), 1200);
    setAddForm({ title: "", date: "", startTime: "", endTime: "", private: false });
    setShowConflict(null);
    setView("week");
  }

  function deleteEvent(id) {
    setSyncStatus("syncing");
    setEvents(prev => prev.filter(e => e.id !== id));
    setTimeout(() => setSyncStatus("synced"), 800);
  }

  const freeDays = weekDates.map(d => {
    const ds = toDateStr(d);
    const slots = findFreeSlots(events, ds);
    return { date: d, dateStr: ds, slots };
  }).filter(d => d.slots.length > 0);

  return (
    <div style={{
      minHeight: "100vh",
      background: "#0F0F13",
      color: "#F0EDE8",
      fontFamily: "'DM Sans', sans-serif",
      display: "flex",
      flexDirection: "column",
    }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&family=Playfair+Display:wght@400;600&display=swap" rel="stylesheet" />

      {/* Header */}
      <header style={{
        padding: "20px 24px 0",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
      }}>
        <div>
          <div style={{ fontFamily: "'Playfair Display'", fontSize: 22, letterSpacing: "-0.5px", color: "#F0EDE8" }}>
            us<span style={{ color: "#6EE7B7" }}>.</span>cal
          </div>
          <div style={{ fontSize: 11, color: "#666", marginTop: 2, letterSpacing: "0.05em" }}>
            {syncStatus === "synced" && <span style={{ color: "#6EE7B7" }}>● synced</span>}
            {syncStatus === "syncing" && <span style={{ color: "#FCA5A5", animation: "pulse 1s infinite" }}>● syncing…</span>}
            {syncStatus === "offline" && <span style={{ color: "#888" }}>○ offline — changes saved locally</span>}
          </div>
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          {["you", "partner"].map(u => (
            <div key={u} style={{
              display: "flex", alignItems: "center", gap: 6,
              background: "#1A1A20", borderRadius: 20, padding: "5px 12px",
              fontSize: 12, color: USERS[u].color,
            }}>
              <div style={{ width: 6, height: 6, borderRadius: "50%", background: USERS[u].color }} />
              {USERS[u].name}
            </div>
          ))}
        </div>
      </header>

      {/* Week Nav */}
      <div style={{ padding: "20px 24px 0", display: "flex", alignItems: "center", gap: 12 }}>
        <button onClick={() => { const d = new Date(weekBase); d.setDate(d.getDate()-7); setWeekBase(d); }}
          style={{ background: "#1A1A20", border: "none", color: "#888", borderRadius: 8, padding: "6px 12px", cursor: "pointer", fontSize: 16 }}>‹</button>
        <span style={{ fontFamily: "'Playfair Display'", fontSize: 16 }}>
          {MONTHS[weekDates[0].getMonth()]} {weekDates[0].getDate()} – {weekDates[6].getDate()}, {weekDates[6].getFullYear()}
        </span>
        <button onClick={() => { const d = new Date(weekBase); d.setDate(d.getDate()+7); setWeekBase(d); }}
          style={{ background: "#1A1A20", border: "none", color: "#888", borderRadius: 8, padding: "6px 12px", cursor: "pointer", fontSize: 16 }}>›</button>
        <button onClick={() => setWeekBase(new Date(today))}
          style={{ background: "#1A1A20", border: "none", color: "#6EE7B7", borderRadius: 8, padding: "6px 12px", cursor: "pointer", fontSize: 12, marginLeft: 4 }}>Today</button>
      </div>

      {/* Nav Tabs */}
      <div style={{ padding: "16px 24px 0", display: "flex", gap: 4 }}>
        {[["week","Week View"], ["free","✦ Free Together"], ["add","+ Add Event"]].map(([v, label]) => (
          <button key={v} onClick={() => setView(v)} style={{
            background: view === v ? "#6EE7B7" : "#1A1A20",
            color: view === v ? "#0F0F13" : "#888",
            border: "none", borderRadius: 20, padding: "8px 16px",
            fontSize: 13, fontWeight: view === v ? 600 : 400,
            cursor: "pointer", transition: "all 0.2s",
          }}>{label}</button>
        ))}
      </div>

      {/* Content */}
      <main style={{ flex: 1, padding: "20px 24px", overflowY: "auto" }}>

        {/* WEEK VIEW */}
        {view === "week" && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 8 }}>
            {weekDates.map((date, i) => {
              const ds = toDateStr(date);
              const isToday = ds === toDateStr(today);
              const dayEvents = events.filter(e => e.date === ds);
              const freeSlots = findFreeSlots(events, ds);
              const isSel = selectedDay === ds;

              return (
                <div key={i} onClick={() => setSelectedDay(isSel ? null : ds)}
                  style={{
                    background: isToday ? "#161620" : "#13131A",
                    border: `1px solid ${isToday ? "#6EE7B7" : isSel ? "#444" : "#1E1E28"}`,
                    borderRadius: 12, padding: "12px 10px",
                    cursor: "pointer", transition: "border 0.2s",
                    minHeight: 120,
                  }}>
                  <div style={{ fontSize: 11, color: "#555", marginBottom: 2, textTransform: "uppercase", letterSpacing: "0.05em" }}>{DAYS[date.getDay()]}</div>
                  <div style={{
                    fontSize: 20, fontFamily: "'Playfair Display'",
                    color: isToday ? "#6EE7B7" : "#F0EDE8", marginBottom: 8,
                  }}>{date.getDate()}</div>

                  {dayEvents.map(ev => (
                    <div key={ev.id} style={{
                      background: USERS[ev.owner].color + "22",
                      borderLeft: `2px solid ${USERS[ev.owner].color}`,
                      borderRadius: 4, padding: "3px 6px", marginBottom: 3,
                      fontSize: 10, color: USERS[ev.owner].color,
                      display: "flex", justifyContent: "space-between", alignItems: "center",
                    }}>
                      <span>{ev.private && ev.owner !== activeUser ? "🔒 Busy" : ev.title}</span>
                      {ev.owner === activeUser && (
                        <span onClick={e => { e.stopPropagation(); deleteEvent(ev.id); }}
                          style={{ cursor: "pointer", opacity: 0.5, marginLeft: 4, fontSize: 9 }}>✕</span>
                      )}
                    </div>
                  ))}

                  {freeSlots.length > 0 && (
                    <div style={{
                      marginTop: 4, fontSize: 9, color: "#6EE7B7",
                      background: "#6EE7B722", borderRadius: 4, padding: "2px 5px",
                    }}>✦ {freeSlots.length} free slot{freeSlots.length > 1 ? "s" : ""}</div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* FREE TOGETHER VIEW */}
        {view === "free" && (
          <div>
            <div style={{ marginBottom: 20, color: "#666", fontSize: 13 }}>
              Days where you're both free for at least 1 hour this week
            </div>
            {freeDays.length === 0 ? (
              <div style={{ textAlign: "center", color: "#444", padding: 40, fontSize: 14 }}>
                No common free slots this week 😔<br />
                <span style={{ fontSize: 12 }}>Try navigating to another week</span>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {freeDays.map(({ date, dateStr, slots }) => (
                  <div key={dateStr} style={{
                    background: "#13131A", border: "1px solid #1E1E28",
                    borderRadius: 14, padding: "16px 18px",
                    display: "flex", justifyContent: "space-between", alignItems: "center",
                  }}>
                    <div>
                      <div style={{ fontFamily: "'Playfair Display'", fontSize: 18, marginBottom: 4 }}>
                        {DAYS[date.getDay()]} {date.getDate()}
                      </div>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                        {slots.map(([s, e], i) => (
                          <span key={i} style={{
                            background: "#6EE7B722", color: "#6EE7B7",
                            borderRadius: 20, padding: "3px 10px", fontSize: 12,
                          }}>{minsToTime(s)} – {minsToTime(e)}</span>
                        ))}
                      </div>
                    </div>
                    <button
                      onClick={() => { setAddForm(f => ({ ...f, date: dateStr })); setView("add"); }}
                      style={{
                        background: "#6EE7B7", color: "#0F0F13", border: "none",
                        borderRadius: 20, padding: "8px 16px", fontSize: 12,
                        fontWeight: 600, cursor: "pointer",
                      }}>Plan this →</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ADD EVENT VIEW */}
        {view === "add" && (
          <div style={{ maxWidth: 400 }}>
            <div style={{ fontFamily: "'Playfair Display'", fontSize: 20, marginBottom: 20 }}>New Event</div>
            {[
              ["Title", "text", "title", "e.g. Dinner date"],
              ["Date", "date", "date", ""],
              ["Start time", "time", "startTime", ""],
              ["End time", "time", "endTime", ""],
            ].map(([label, type, field, ph]) => (
              <div key={field} style={{ marginBottom: 14 }}>
                <label style={{ fontSize: 11, color: "#666", textTransform: "uppercase", letterSpacing: "0.05em", display: "block", marginBottom: 5 }}>{label}</label>
                <input type={type} placeholder={ph} value={addForm[field]}
                  onChange={e => setAddForm(f => ({ ...f, [field]: e.target.value }))}
                  style={{
                    width: "100%", background: "#1A1A20", border: "1px solid #2A2A35",
                    borderRadius: 8, padding: "10px 12px", color: "#F0EDE8",
                    fontSize: 14, outline: "none", boxSizing: "border-box",
                    colorScheme: "dark",
                  }} />
              </div>
            ))}
            <label style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 20, cursor: "pointer", fontSize: 13, color: "#888" }}>
              <input type="checkbox" checked={addForm.private}
                onChange={e => setAddForm(f => ({ ...f, private: e.target.checked }))}
                style={{ accentColor: "#6EE7B7" }} />
              Keep details private (partner sees "Busy" only)
            </label>
            <button onClick={handleAddEvent} style={{
              width: "100%", background: "#6EE7B7", color: "#0F0F13",
              border: "none", borderRadius: 10, padding: "13px",
              fontSize: 15, fontWeight: 600, cursor: "pointer",
            }}>Add Event</button>
          </div>
        )}

        {/* CONFLICT MODAL */}
        {showConflict && (
          <div style={{
            position: "fixed", inset: 0, background: "#0009",
            display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100,
          }}>
            <div style={{
              background: "#1A1A20", border: "1px solid #FCA5A5",
              borderRadius: 16, padding: 28, maxWidth: 340, width: "90%",
            }}>
              <div style={{ fontFamily: "'Playfair Display'", fontSize: 18, marginBottom: 8, color: "#FCA5A5" }}>
                ⚠ Schedule Clash
              </div>
              <p style={{ fontSize: 13, color: "#AAA", lineHeight: 1.6, marginBottom: 16 }}>
                Your "<b style={{ color: "#F0EDE8" }}>{showConflict.newEvent.title}</b>" overlaps with your partner's "<b style={{ color: "#FCA5A5" }}>{showConflict.clash.title}</b>" ({showConflict.clash.startTime}–{showConflict.clash.endTime}).
              </p>
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={commitAdd} style={{
                  flex: 1, background: "#FCA5A522", color: "#FCA5A5",
                  border: "1px solid #FCA5A544", borderRadius: 8,
                  padding: "9px", fontSize: 13, cursor: "pointer",
                }}>Add anyway</button>
                <button onClick={() => setShowConflict(null)} style={{
                  flex: 1, background: "#6EE7B7", color: "#0F0F13",
                  border: "none", borderRadius: 8, padding: "9px",
                  fontSize: 13, fontWeight: 600, cursor: "pointer",
                }}>Go back</button>
              </div>
            </div>
          </div>
        )}
      </main>

      <style>{`
        * { box-sizing: border-box; }
        input[type="date"]::-webkit-calendar-picker-indicator,
        input[type="time"]::-webkit-calendar-picker-indicator { filter: invert(0.5); }
        @keyframes pulse { 0%,100% { opacity:1 } 50% { opacity:0.4 } }
      `}</style>
    </div>
  );
}