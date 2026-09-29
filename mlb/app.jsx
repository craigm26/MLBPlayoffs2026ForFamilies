/* MLB Playoffs 2026 — family hub (TV kiosk + phones), served from pi-nas.local/mlb.
   Data + bracket rules live in mlb-data.js (window.MLB); this file is only the UI. */
const { useState, useEffect, useMemo, useCallback } = React;

const TABS = [
  { id: "home", label: "🏠 Home" },
  { id: "bracket", label: "🏆 Bracket" },
  { id: "games", label: "📅 Games" },
  { id: "teams", label: "🧢 Teams" },
  { id: "map", label: "🗺️ Map" },
  { id: "quiz", label: "🧠 Quiz" },
  { id: "picks", label: "✏️ Family Picks" },
  { id: "learn", label: "🎓 How It Works" },
];

const C = {
  gold: "#f4b740", red: "#e2473b", green: "#34c77b", ink: "#0e1f3d", muted: "#9fb0d8", faint: "#6f82b5",
  card: "rgba(255,255,255,.07)", line: "rgba(255,255,255,.12)", cream: "#fff8ea",
};

function useIsPhone() {
  const [p, setP] = useState(() => window.innerWidth < 760);
  useEffect(() => { const h = () => setP(window.innerWidth < 760); window.addEventListener("resize", h); return () => window.removeEventListener("resize", h); }, []);
  return p;
}

/* ---------- family store (this device) ---------- */
const STORE_KEY = "mlb26";
function loadStore() {
  try { const s = JSON.parse(localStorage.getItem(STORE_KEY)); if (s && s.players) return s; } catch (e) {}
  return { players: [{ id: "family", name: "Family", emoji: "⚾" }], active: "family", picks: {}, fav: null };
}
function useStore() {
  const [s, setS] = useState(loadStore);
  useEffect(() => { try { localStorage.setItem(STORE_KEY, JSON.stringify(s)); } catch (e) {} }, [s]);
  const up = (fn) => setS((cur) => fn(JSON.parse(JSON.stringify(cur))));
  return {
    ...s,
    setActive: (id) => up((d) => { d.active = id; return d; }),
    addPlayer: (name, emoji) => up((d) => { const id = "p" + Date.now().toString(36); d.players.push({ id, name, emoji }); d.active = id; return d; }),
    removePlayer: (id) => up((d) => { d.players = d.players.filter((p) => p.id !== id); delete d.picks[id]; if (d.active === id) d.active = d.players[0] ? d.players[0].id : null; return d; }),
    pick: (pid, sid, team) => up((d) => {
      const mine = d.picks[pid] = d.picks[pid] || {};
      if (mine[sid] === team) delete mine[sid]; else mine[sid] = team;
      // a changed pick can orphan later-round picks that relied on it
      const res = window.MLB.resolve(window.__FEED || null);
      window.MLB.SERIES.forEach((def) => {
        const p = mine[def.id]; if (!p) return;
        const opts = window.MLB.pickOptions(res, def.id, mine);
        if (opts.indexOf(p) < 0) delete mine[def.id];
      });
      return d;
    }),
    setFav: (t) => up((d) => { d.fav = d.fav === t ? null : t; return d; }),
  };
}

/* ---------- small pieces ---------- */
function Logo({ t, res, size = 40, dim, style }) {
  const src = t ? window.MLB.logoUrl(res, t) : null;
  const [bad, setBad] = useState(false);
  useEffect(() => { setBad(false); }, [src]);
  const team = (t && res.teams[t]) || {};
  const base = { width: size, height: size, borderRadius: "50%", flex: "none", display: "grid", placeItems: "center", opacity: dim ? 0.35 : 1, filter: dim ? "grayscale(1)" : "none", ...style };
  if (!t) return <div style={{ ...base, background: "rgba(255,255,255,.08)", border: "2px dashed rgba(255,255,255,.3)", color: C.faint, fontSize: size * 0.45, fontWeight: 700 }}>?</div>;
  if (bad || !src) return <div style={{ ...base, background: team.color || "#345", color: "#fff", fontWeight: 700, fontSize: size * 0.3, border: "2px solid " + (team.alt || "#fff") }}>{t}</div>;
  return <div style={{ ...base, background: "#fff", boxShadow: "0 1px 4px rgba(0,0,0,.35)" }}><img src={src} alt={team.short || t} onError={() => setBad(true)} style={{ width: "78%", height: "78%", objectFit: "contain" }} /></div>;
}

function nameOf(res, t) { return t ? ((res.teams[t] && res.teams[t].short) || t) : "?"; }

/* The "how many wins" dots. Filled = a win, empty = still needed. */
function WinDots({ need, won, color, size = 20, winner }) {
  const dots = [];
  for (let i = 0; i < need; i++) {
    const on = i < won;
    dots.push(<span key={i} title={on ? "won a game" : "still needs this win"} style={{ width: size, height: size, borderRadius: "50%", flex: "none", display: "grid", placeItems: "center", fontSize: size * 0.62, lineHeight: 1,
      background: on ? (color || C.gold) : "transparent", border: on ? "2px solid #fff" : "2px dashed rgba(255,255,255,.45)", boxShadow: on && winner ? "0 0 8px " + C.gold : "none" }}>{on ? "⚾" : ""}</span>);
  }
  return <span style={{ display: "inline-flex", gap: Math.max(3, size * 0.22) }}>{dots}</span>;
}

function LiveDot() { return <span className="live-dot" />; }

function Pill({ children, bg = "rgba(255,255,255,.1)", fg = "#dfe6ff", style }) {
  return <span style={{ display: "inline-flex", alignItems: "center", gap: 6, background: bg, color: fg, borderRadius: 999, padding: "3px 10px", fontSize: 13, fontWeight: 600, whiteSpace: "nowrap", ...style }}>{children}</span>;
}

function bestLabel(R) { return "Best of " + R.best + " · first to " + R.need + " wins"; }

/* ---------- a series card: the heart of the bracket ---------- */
function TeamLine({ s, side, res, big, fav }) {
  const t = s[side];
  const seed = side === "top" ? s.topSeed : s.botSeed;
  const won = t ? (s.wins[t] || 0) : 0;
  const isW = s.winner && s.winner === t, isL = s.loser && s.loser === t;
  const team = (t && res.teams[t]) || {};
  const size = big ? 46 : 34;
  let label;
  if (t) label = nameOf(res, t);
  else {
    const opts = window.MLB.slotOptions(res, s.id, side);
    label = opts.length <= 2 ? opts.map((o) => nameOf(res, o)).join(" or ") : window.MLB.feederLabel(res, s.id, side, (t) => nameOf(res, t));
  }
  return (
    <div style={{ display: "flex", alignItems: "center", gap: big ? 12 : 8, padding: big ? "8px 10px" : "5px 8px", borderRadius: 12,
      background: isW ? "rgba(244,183,64,.2)" : fav && t === fav ? "rgba(52,199,123,.14)" : "transparent", opacity: isL ? 0.5 : 1 }}>
      <Logo t={t} res={res} size={size} dim={isL} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: big ? 22 : 16, fontWeight: 700, color: t ? "#fff" : C.muted, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", textDecoration: isL ? "line-through" : "none" }}>
          {label}{isW ? " ✓" : ""}
        </div>
        <div style={{ fontSize: big ? 13 : 11.5, color: C.muted, whiteSpace: "nowrap" }}>
          {seed ? "#" + seed + " seed" : t ? "" : "waiting…"}{t && res.records[t] ? " · " + res.records[t] : ""}{isL ? " · out 👋" : ""}
        </div>
      </div>
      {t && <WinDots need={s.need} won={won} color={team.color} size={big ? 26 : 18} winner={isW} />}
    </div>
  );
}

function SeriesCard({ s, res, big, fav, showStory = true, onOpen }) {
  const R = s.round;
  const tvGame = s.live || s.next;
  const nm = (t) => nameOf(res, t);
  const accent = s.live ? C.red : s.winner ? C.gold : "rgba(255,255,255,.18)";
  return (
    <div onClick={onOpen} style={{ background: "rgba(10,22,48,.72)", border: "2px solid " + accent, borderRadius: 18, padding: big ? 14 : 10, cursor: onOpen ? "pointer" : "default", boxShadow: s.live ? "0 0 18px rgba(226,71,59,.45)" : "none" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4, flexWrap: "wrap" }}>
        <span style={{ fontSize: big ? 15 : 12.5, fontWeight: 700, color: C.gold }}>{s.rd === "WS" ? "🏆 World Series" : s.lg + " " + R.short}</span>
        <span style={{ fontSize: big ? 13 : 11, color: C.muted, marginLeft: "auto" }}>{bestLabel(R)}</span>
      </div>
      <TeamLine s={s} side="top" res={res} big={big} fav={fav} />
      <TeamLine s={s} side="bot" res={res} big={big} fav={fav} />
      {showStory && <div style={{ fontSize: big ? 16 : 12.5, color: "#e8edff", lineHeight: 1.35, marginTop: 6, padding: "0 4px" }}>{window.MLB.story(s, nm)}</div>}
      {tvGame && !s.winner && (
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 6, fontSize: big ? 14 : 11.5, color: s.live ? "#ffc1bb" : C.muted, padding: "0 4px", flexWrap: "wrap" }}>
          {s.live ? <React.Fragment><LiveDot /> <b>PLAYING NOW</b> · Game {s.live.gn} · {window.MLB.inningText(s.live)}</React.Fragment>
            : <React.Fragment>⏰ Game {tvGame.gn}: {window.MLB.when(tvGame)}{tvGame.tv ? " · 📺 " + tvGame.tv : ""}</React.Fragment>}
        </div>
      )}
    </div>
  );
}

/* A friendly empty slot for the #1/#2 seeds while round one is played. */
function ByeNote({ s, res }) {
  if (s.rd !== "DS" || s.bot) return null;
  return <div style={{ fontSize: 12, color: C.muted, marginTop: 4, padding: "0 6px" }}>😴 The {nameOf(res, s.top)} won so many games they got to skip round 1 and rest!</div>;
}

/* ---------- Road to the World Series (the best-of-N lesson, always on top of the bracket) ---------- */
function RoadStrip({ res, compact }) {
  const M = window.MLB;
  return (
    <div style={{ display: "flex", gap: 8, alignItems: "stretch", flexWrap: compact ? "wrap" : "nowrap", marginBottom: 14 }}>
      {M.ROUND_ORDER.map((id, i) => {
        const R = M.ROUNDS[id];
        const ser = M.SERIES.filter((d) => d.rd === id).map((d) => res.series[d.id]);
        const done = ser.every((s) => s.winner), on = !done && ser.some((s) => s.started);
        return (
          <React.Fragment key={id}>
            <div style={{ flex: compact ? "1 1 45%" : 1, background: on ? "rgba(226,71,59,.16)" : done ? "rgba(52,199,123,.12)" : C.card, border: "2px solid " + (on ? C.red : done ? C.green : "transparent"), borderRadius: 14, padding: "8px 12px" }}>
              <div style={{ fontSize: 12, color: C.muted, fontWeight: 600 }}>Round {i + 1}{on ? " · NOW" : done ? " · done ✓" : ""}</div>
              <div style={{ fontSize: compact ? 16 : 19, fontWeight: 700, color: "#fff" }}>{R.name}</div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4 }}>
                <WinDots need={R.need} won={R.need} color={id === "WS" ? C.gold : "#3f78d8"} size={compact ? 16 : 20} />
                <span style={{ fontSize: compact ? 12.5 : 14, color: "#dfe6ff" }}>win <b>{R.need}</b> of {R.best}</span>
              </div>
            </div>
            {!compact && i < 3 && <div style={{ alignSelf: "center", fontSize: 22, color: C.faint }}>➜</div>}
          </React.Fragment>
        );
      })}
    </div>
  );
}

/* ---------- Bracket tab ---------- */
function BracketTab({ res, fav, isPhone, openSeries }) {
  const S = res.series;
  const col = (title, R, ids, key) => (
    <div key={key} style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
      <div style={{ textAlign: "center", marginBottom: 8 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: "#fff" }}>{title}</div>
        <div style={{ fontSize: 11.5, color: C.muted }}>first to {R.need} wins</div>
      </div>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "space-around", gap: 12 }}>
        {ids.map((id) => <div key={id}><SeriesCard s={S[id]} res={res} fav={fav} onOpen={() => openSeries(id)} /><ByeNote s={S[id]} res={res} /></div>)}
      </div>
    </div>
  );
  const R = window.MLB.ROUNDS;
  const champ = res.champion;
  return (
    <div style={{ height: "100%", overflow: "auto" }}>
      <RoadStrip res={res} compact={isPhone} />
      <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 10, flexWrap: "wrap" }}>
        <div style={{ fontSize: 14, color: C.muted, flex: "1 1 300px" }}>Each ⚾ dot is one win. Fill up all your dots first and you move on. Lose, and your season is over. <b style={{ color: "#dfe6ff" }}>Tap a series to see every game: when, where and what channel.</b></div>
        <a href="print.html" style={{ textDecoration: "none", background: C.gold, color: C.ink, fontWeight: 700, borderRadius: 12, padding: "8px 14px", fontSize: 14 }}>🖨️ Print a bracket</a>
      </div>
      {isPhone ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {[["WC", "Round 1 · Wild Card"], ["DS", "Round 2 · Division Series"], ["CS", "Round 3 · League Championship"], ["WS", "Round 4 · World Series"]].map(([rd, title]) => (
            <div key={rd}>
              <div style={{ fontSize: 17, fontWeight: 700, color: C.gold, margin: "6px 0" }}>{title} <span style={{ fontSize: 12.5, color: C.muted, fontWeight: 500 }}>· first to {R[rd].need} wins</span></div>
              <div style={{ display: "grid", gap: 10 }}>
                {window.MLB.SERIES.filter((d) => d.rd === rd).map((d) => <div key={d.id}><SeriesCard s={S[d.id]} res={res} fav={fav} onOpen={() => openSeries(d.id)} /><ByeNote s={S[d.id]} res={res} /></div>)}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ display: "flex", gap: 10, minHeight: 560, alignItems: "stretch" }}>
          {col("AL Wild Card", R.WC, ["ALWC1", "ALWC2"], "a1")}
          {col("AL Division Series", R.DS, ["ALDS1", "ALDS2"], "a2")}
          {col("AL Championship", R.CS, ["ALCS"], "a3")}
          <div style={{ flex: 1.15, minWidth: 0, display: "flex", flexDirection: "column", justifyContent: "center", gap: 10 }}>
            <div style={{ textAlign: "center", fontSize: champ ? 40 : 54 }}>🏆</div>
            {champ && <div style={{ textAlign: "center" }}><Logo t={champ} res={res} size={84} style={{ margin: "0 auto" }} /><div style={{ fontSize: 22, fontWeight: 700, color: C.gold, marginTop: 6 }}>{nameOf(res, champ)} are the champions!</div></div>}
            <SeriesCard s={S.WS} res={res} fav={fav} big onOpen={() => openSeries("WS")} />
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: C.faint, padding: "0 6px" }}><span>⬅ American League</span><span>National League ➜</span></div>
          </div>
          {col("NL Championship", R.CS, ["NLCS"], "n3")}
          {col("NL Division Series", R.DS, ["NLDS1", "NLDS2"], "n2")}
          {col("NL Wild Card", R.WC, ["NLWC1", "NLWC2"], "n1")}
        </div>
      )}
    </div>
  );
}

/* ---------- live scoreboard ---------- */
function Diamond({ on = [false, false, false], size = 90 }) {
  const b = (x, y, lit) => <rect x={x - 11} y={y - 11} width="22" height="22" transform={`rotate(45 ${x} ${y})`} fill={lit ? C.gold : "rgba(255,255,255,.12)"} stroke="#fff" strokeWidth="2" />;
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} aria-label="bases">
      {b(50, 18, on[1])}{b(82, 50, on[0])}{b(18, 50, on[2])}
      <path d="M50 92 L42 84 L42 76 L58 76 L58 84 Z" fill="#fff" />
    </svg>
  );
}
function CountDots({ label, n, of, color }) {
  const d = [];
  for (let i = 0; i < of; i++) d.push(<span key={i} style={{ width: 14, height: 14, borderRadius: "50%", background: i < (n || 0) ? color : "rgba(255,255,255,.15)", display: "inline-block" }} />);
  return <div style={{ display: "flex", alignItems: "center", gap: 5 }}><span style={{ width: 62, fontSize: 13, color: C.muted, fontWeight: 600 }}>{label}</span>{d}</div>;
}
function Linescore({ g, res }) {
  const n = Math.max(9, (g.als || []).length, (g.hls || []).length);
  const cols = []; for (let i = 0; i < n; i++) cols.push(i);
  const cell = { padding: "3px 6px", textAlign: "center", fontSize: 13 };
  const row = (t, ls, r, h, e) => (
    <tr><td style={{ ...cell, textAlign: "left", fontWeight: 700 }}>{t}</td>
      {cols.map((i) => <td key={i} style={{ ...cell, color: ls && ls[i] != null ? "#fff" : C.faint }}>{ls && ls[i] != null ? ls[i] : "·"}</td>)}
      <td style={{ ...cell, fontWeight: 700, color: C.gold }}>{r ?? ""}</td><td style={cell}>{h ?? ""}</td><td style={cell}>{e ?? ""}</td></tr>
  );
  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ borderCollapse: "collapse", color: "#dfe6ff", width: "100%" }}>
        <thead><tr><th></th>{cols.map((i) => <th key={i} style={{ ...cell, color: C.muted, fontWeight: 500 }}>{i + 1}</th>)}<th style={{ ...cell, color: C.muted }}>R</th><th style={{ ...cell, color: C.muted }}>H</th><th style={{ ...cell, color: C.muted }}>E</th></tr></thead>
        <tbody>{row(g.away, g.als, g.ar, g.ah, g.ae)}{row(g.home, g.hls, g.hr, g.hh, g.he)}</tbody>
      </table>
    </div>
  );
}
function BigScore({ g, res, isPhone }) {
  const side = (t, r, lbl) => (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 6, minWidth: 0 }}>
      <Logo t={t} res={res} size={isPhone ? 60 : 92} />
      <div style={{ fontSize: isPhone ? 18 : 26, fontWeight: 700, textAlign: "center" }}>{nameOf(res, t)}</div>
      <div style={{ fontSize: 12, color: C.muted }}>{lbl}</div>
      <div style={{ fontSize: isPhone ? 54 : 88, fontWeight: 700, lineHeight: 1, color: "#fff" }}>{r ?? 0}</div>
    </div>
  );
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      {side(g.away, g.ar, "visitors")}
      <div style={{ fontSize: 22, color: C.faint }}>at</div>
      {side(g.home, g.hr, "home team")}
    </div>
  );
}
function LiveHero({ g, s, res, isPhone, onBox }) {
  const sit = g.sit || {};
  const st = window.MLB.stakes(s, (t) => nameOf(res, t));
  return (
    <div className="pop" style={{ background: "linear-gradient(160deg, rgba(226,71,59,.28), rgba(10,22,48,.85))", border: "2px solid " + C.red, borderRadius: 22, padding: isPhone ? 14 : 22 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10, flexWrap: "wrap" }}>
        <Pill bg="rgba(226,71,59,.3)" fg="#ffd2cd"><LiveDot /> LIVE</Pill>
        <span style={{ fontSize: isPhone ? 16 : 20, fontWeight: 700 }}>{window.MLB.inningText(g)}</span>
        <span style={{ fontSize: 14, color: C.muted, marginLeft: "auto" }}>{g.note.replace(/ If Necessary/, "")}{g.venue ? " · 📍 " + g.venue : ""}{g.tv ? " · 📺 " + g.tv : ""}</span>
        {onBox && <button onClick={() => onBox(g)} style={{ border: "none", borderRadius: 10, padding: "6px 12px", fontSize: 14, fontWeight: 700, cursor: "pointer", background: C.gold, color: C.ink, fontFamily: "inherit" }}>📊 Box score</button>}
      </div>
      <div style={{ display: "flex", gap: 18, alignItems: "center", flexWrap: isPhone ? "wrap" : "nowrap" }}>
        <div style={{ flex: "2 1 320px" }}><BigScore g={g} res={res} isPhone={isPhone} /></div>
        {g.status === "LIVE" && (
          <div style={{ flex: "1 1 200px", display: "flex", gap: 14, alignItems: "center", justifyContent: "center" }}>
            <Diamond on={sit.on} size={isPhone ? 80 : 110} />
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <CountDots label="Balls" n={sit.b} of={4} color={C.green} />
              <CountDots label="Strikes" n={sit.s} of={3} color={C.gold} />
              <CountDots label="Outs" n={sit.o} of={3} color={C.red} />
            </div>
          </div>
        )}
      </div>
      {(sit.bat || sit.pit) && <div style={{ fontSize: 14, color: "#dfe6ff", marginTop: 10 }}>{sit.bat ? "🏏 Batting: " + sit.bat : ""}{sit.bat && sit.pit ? "  ·  " : ""}{sit.pit ? "🎯 Pitching: " + sit.pit : ""}</div>}
      {sit.last && <div style={{ fontSize: 14, color: C.muted, marginTop: 4 }}>Last play: {sit.last}</div>}
      <div style={{ marginTop: 10 }}><Linescore g={g} res={res} /></div>
      {st && (
        <div style={{ marginTop: 12, background: "rgba(255,255,255,.07)", borderRadius: 14, padding: 12 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: C.gold, marginBottom: 4 }}>WHAT THIS GAME MEANS</div>
          {st.map((x, i) => <div key={i} style={{ fontSize: isPhone ? 15 : 17, color: "#fff", lineHeight: 1.4 }}>{x}</div>)}
        </div>
      )}
    </div>
  );
}

function useNow(ms) { const [n, setN] = useState(Date.now()); useEffect(() => { const i = setInterval(() => setN(Date.now()), ms); return () => clearInterval(i); }, [ms]); return n; }

function Countdown({ iso }) {
  const now = useNow(1000);
  const ms = new Date(iso).getTime() - now;
  if (ms <= 0) return <span>any minute now!</span>;
  const d = Math.floor(ms / 864e5), h = Math.floor(ms / 36e5) % 24, m = Math.floor(ms / 6e4) % 60, s = Math.floor(ms / 1e3) % 60;
  const box = (v, l) => <div style={{ textAlign: "center", background: "rgba(255,255,255,.08)", borderRadius: 12, padding: "6px 10px", minWidth: 60 }}><div style={{ fontSize: 30, fontWeight: 700 }}>{v}</div><div style={{ fontSize: 11, color: C.muted }}>{l}</div></div>;
  return <div style={{ display: "flex", gap: 8 }}>{d > 0 && box(d, "days")}{box(h, "hours")}{box(m, "min")}{d === 0 && box(s, "sec")}</div>;
}

function NextHero({ g, s, res, isPhone }) {
  const st = window.MLB.stakes(s, (t) => nameOf(res, t));
  // An unknown side (a Division Series game before the Wild Card ends) reads "Yankees or Red Sox".
  const sideName = (t) => {
    if (t) return nameOf(res, t);
    const other = s.top && (s.top === g.home || s.top === g.away) ? "bot" : "top";
    return window.MLB.slotOptions(res, s.id, other).map((o) => nameOf(res, o)).join(" or ");
  };
  return (
    <div className="pop" style={{ background: "rgba(10,22,48,.8)", border: "2px solid " + C.gold, borderRadius: 22, padding: isPhone ? 14 : 22 }}>
      <div style={{ fontSize: 14, fontWeight: 700, color: C.gold, marginBottom: 8 }}>⏰ NEXT GAME · {g.note.replace(/ If Necessary/, "")}</div>
      <div style={{ display: "flex", gap: 18, alignItems: "center", flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, flex: "2 1 320px" }}>
          <Logo t={g.away} res={res} size={isPhone ? 54 : 76} />
          <div style={{ fontSize: isPhone ? 20 : 28, fontWeight: 700, textAlign: "center", flex: 1 }}>{sideName(g.away)} <span style={{ color: C.faint, fontSize: "0.7em" }}>at</span> {sideName(g.home)}</div>
          <Logo t={g.home} res={res} size={isPhone ? 54 : 76} />
        </div>
        <div style={{ flex: "1 1 220px" }}>
          {!g.timeTBD ? <Countdown iso={g.date} /> : <div style={{ fontSize: 18 }}>Start time coming soon</div>}
          <div style={{ fontSize: 14, color: C.muted, marginTop: 6 }}>{window.MLB.when(g)}{g.tv ? " · 📺 " + g.tv : ""}</div>
          {g.venue && <div style={{ fontSize: 14, color: C.muted, marginTop: 2 }}>📍 {g.venue}{g.city ? ", " + g.city : ""}</div>}
        </div>
      </div>
      {(g.asp || g.hsp) && <div style={{ fontSize: 14, color: "#dfe6ff", marginTop: 10 }}>🎯 Starting pitchers: {g.asp || "TBA"} vs {g.hsp || "TBA"}</div>}
      {st && (
        <div style={{ marginTop: 12, background: "rgba(255,255,255,.07)", borderRadius: 14, padding: 12 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: C.gold, marginBottom: 4 }}>WHAT THIS GAME MEANS</div>
          {st.map((x, i) => <div key={i} style={{ fontSize: isPhone ? 15 : 17, lineHeight: 1.4 }}>{x}</div>)}
        </div>
      )}
    </div>
  );
}

/* ---------- Home ---------- */
function seriesOfGame(res, g) { return window.MLB.SERIES.map((d) => res.series[d.id]).find((s) => s.games.indexOf(g) >= 0); }

function HomeTab({ res, feed, fav, setFav, isPhone, onBox, openSeries }) {
  const M = window.MLB;
  const live = M.SERIES.map((d) => res.series[d.id]).filter((s) => s.live).map((s) => ({ s, g: s.live }));
  const nexts = M.SERIES.map((d) => res.series[d.id]).filter((s) => s.next).map((s) => ({ s, g: s.next }))
    .sort((a, b) => String(a.g.date).localeCompare(String(b.g.date)));
  const todayKey = M.dayKey({ date: new Date().toISOString() });
  const today = (feed && feed.games ? feed.games : []).filter((g) => M.dayKey(g) === todayKey);
  const favS = fav && M.SERIES.map((d) => res.series[d.id]).filter((s) => s.top === fav || s.bot === fav).pop();
  return (
    <div style={{ height: "100%", overflow: "auto", display: "grid", gap: 16, gridTemplateColumns: isPhone ? "1fr" : "minmax(0,1.6fr) minmax(0,1fr)", alignContent: "start" }}>
      <div style={{ display: "grid", gap: 14, alignContent: "start" }}>
        {res.champion ? (
          <div className="pop" style={{ textAlign: "center", background: "rgba(244,183,64,.16)", border: "3px solid " + C.gold, borderRadius: 22, padding: 26 }}>
            <div style={{ fontSize: 60 }}>🏆</div>
            <Logo t={res.champion} res={res} size={120} style={{ margin: "8px auto" }} />
            <div style={{ fontSize: 34, fontWeight: 700, color: C.gold }}>The {nameOf(res, res.champion)} are the {feed && feed.season} World Series Champions!</div>
          </div>
        ) : live.length ? live.map(({ s, g }) => <LiveHero key={g.id} g={g} s={s} res={res} isPhone={isPhone} onBox={onBox} />)
          : nexts[0] ? <NextHero g={nexts[0].g} s={nexts[0].s} res={res} isPhone={isPhone} /> : null}
        {live.length === 0 && nexts[0] && <SeriesCard s={nexts[0].s} res={res} big fav={fav} onOpen={() => openSeries(nexts[0].s.id)} />}
        {live.length > 0 && live.map(({ s }) => <SeriesCard key={s.id} s={s} res={res} big fav={fav} onOpen={() => openSeries(s.id)} />)}
      </div>
      <div style={{ display: "grid", gap: 14, alignContent: "start" }}>
        <div style={{ background: C.card, borderRadius: 18, padding: 14 }}>
          <div style={{ fontSize: 17, fontWeight: 700, color: C.gold, marginBottom: 6 }}>📅 Today</div>
          {today.length === 0 && <div style={{ color: C.muted, fontSize: 14 }}>No playoff games today. {nexts[0] ? "Next one: " + M.when(nexts[0].g) : ""}</div>}
          {today.map((g) => <GameRow key={g.id} g={g} res={res} s={seriesOfGame(res, g)} compact onBox={onBox} />)}
        </div>
        {favS && <div><div style={{ fontSize: 14, color: C.muted, margin: "0 0 6px 4px" }}>⭐ Your team</div><SeriesCard s={favS} res={res} fav={fav} /></div>}
        <StillIn res={res} fav={fav} setFav={setFav} />
      </div>
    </div>
  );
}

function StillIn({ res, fav, setFav }) {
  const all = res.seeds.AL.concat(res.seeds.NL);
  const n = all.filter((t) => res.alive[t] !== false).length;
  return (
    <div style={{ background: C.card, borderRadius: 18, padding: 14 }}>
      <div style={{ fontSize: 17, fontWeight: 700, color: C.gold, marginBottom: 8 }}>🧢 {n} team{n === 1 ? "" : "s"} still in</div>
      {["AL", "NL"].map((lg) => (
        <div key={lg} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6, flexWrap: "wrap" }}>
          <span style={{ width: 26, fontSize: 12, color: C.muted, fontWeight: 700 }}>{lg}</span>
          {res.seeds[lg].map((t) => (
            <button key={t} onClick={() => setFav(t)} title={"Make the " + nameOf(res, t) + " your team"} style={{ border: "none", background: "transparent", padding: 0, cursor: "pointer", position: "relative" }}>
              <Logo t={t} res={res} size={38} dim={res.alive[t] === false} style={fav === t ? { boxShadow: "0 0 0 3px " + C.gold } : null} />
              {fav === t && <span style={{ position: "absolute", top: -8, right: -6, fontSize: 14 }}>⭐</span>}
            </button>
          ))}
        </div>
      ))}
      <div style={{ fontSize: 12, color: C.faint }}>Gray = lost a series and went home. Tap a team to make it your ⭐ team.</div>
    </div>
  );
}

/* ---------- Games tab ---------- */
function GameRow({ g, res, s, compact, onBox }) {
  const M = window.MLB;
  const notNeeded = s && s.winner && g.status !== "FINAL";
  if (notNeeded && compact) return null;
  const fin = g.status === "FINAL", lv = g.status === "LIVE" || g.status === "DELAY";
  const aw = fin && g.ar > g.hr, hw = fin && g.hr > g.ar;
  const team = (t, slot, won) => (
    <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1, minWidth: 0, opacity: fin && !won ? 0.55 : 1 }}>
      <Logo t={t} res={res} size={28} />
      <span style={{ fontSize: 15, fontWeight: won ? 700 : 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", color: t ? "#fff" : C.muted }}>
        {t ? nameOf(res, t) : s && M.slotOptions(res, s.id, slot).length <= 2 ? M.slotOptions(res, s.id, slot).map((o) => nameOf(res, o)).join("/") : "TBD"}
      </span>
    </div>
  );
  const awaySlot = s && g.away && s.top === g.away ? "top" : "bot";
  if (!g.home && !g.away && !(s && s.top && s.bot)) {
    return (
      <div style={{ padding: "8px 0", borderTop: "1px solid " + C.line }}>
        <div style={{ fontSize: 15, color: C.muted }}>🤔 Teams to be decided</div>
        <div style={{ display: "flex", gap: 8, marginTop: 3, fontSize: 12.5, color: C.muted }}>
          <span>{g.note.replace(/ If Necessary/, "")}{g.ifnec ? " (if needed)" : ""}{s ? " · 📍 " + M.gameHost(res, window.__FEED, s, g).text : ""}</span>
          <span style={{ marginLeft: "auto" }}>{M.when(g).split(" · ")[1]}{g.tv ? " · 📺 " + g.tv : ""}</span>
        </div>
      </div>
    );
  }
  return (
    <div style={{ padding: "8px 0", borderTop: "1px solid " + C.line, opacity: notNeeded ? 0.4 : 1 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        {team(g.away, awaySlot, aw)}
        <span style={{ fontSize: 16, fontWeight: 700, color: lv ? "#ffb3ad" : C.gold, minWidth: 54, textAlign: "center" }}>{fin || lv ? (g.ar ?? 0) + " – " + (g.hr ?? 0) : "at"}</span>
        {team(g.home, awaySlot === "top" ? "bot" : "top", hw)}
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: 3, fontSize: 12.5, color: C.muted, flexWrap: "wrap" }}>
        <span>{g.note.replace(/ If Necessary/, "")}{g.ifnec ? " (if needed)" : ""}{!compact && s ? " · 📍 " + M.gameHost(res, window.__FEED, s, g).text : ""}</span>
        {onBox && (fin || lv) && <button onClick={() => onBox(g)} style={{ border: "none", borderRadius: 8, padding: "1px 8px", fontSize: 12, fontWeight: 700, cursor: "pointer", background: "rgba(244,183,64,.2)", color: C.gold, fontFamily: "inherit" }}>📊 Box score</button>}
        <span style={{ marginLeft: "auto", color: lv ? "#ffb3ad" : C.muted }}>
          {lv ? <React.Fragment><LiveDot /> {M.inningText(g)}</React.Fragment> : fin ? "Final" + (g.inning > 9 ? " (" + g.inning + " inn.)" : "") : notNeeded ? "not needed" : M.when(g).split(" · ")[1]}
          {!fin && g.tv ? " · 📺 " + g.tv : ""}
        </span>
      </div>
      {fin && !compact && g.wp && <div style={{ fontSize: 12, color: C.faint, marginTop: 2 }}>W: {g.wp} · L: {g.lp}{g.sv ? " · SV: " + g.sv : ""}</div>}
    </div>
  );
}

function GamesTab({ res, feed, onBox }) {
  const M = window.MLB;
  const games = (feed && feed.games) || [];
  const byDay = {};
  games.forEach((g) => { (byDay[M.dayKey(g)] = byDay[M.dayKey(g)] || []).push(g); });
  const todayKey = M.dayKey({ date: new Date().toISOString() });
  const days = Object.keys(byDay).sort();
  useEffect(() => { const el = document.getElementById("day-" + todayKey) || document.getElementById("day-" + days.find((d) => d >= todayKey)); if (el) el.scrollIntoView({ block: "start" }); }, []);
  return (
    <div style={{ height: "100%", overflow: "auto" }}>
      <div style={{ fontSize: 14, color: C.muted, marginBottom: 10 }}>Times are in your time zone. "If needed" games only happen when nobody has enough wins yet.</div>
      {days.length === 0 && <div style={{ color: C.muted }}>Loading the schedule…</div>}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(330px, 1fr))", gap: 14 }}>
        {days.map((d) => {
          const dt = new Date(d + "T12:00:00");
          return (
            <div key={d} id={"day-" + d} style={{ background: d === todayKey ? "rgba(244,183,64,.12)" : C.card, border: d === todayKey ? "2px solid " + C.gold : "2px solid transparent", borderRadius: 16, padding: 12, scrollMarginTop: 8 }}>
              <div style={{ fontSize: 17, fontWeight: 700, color: C.gold, marginBottom: 4 }}>{d === todayKey ? "Today · " : ""}{dt.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })}</div>
              {byDay[d].map((g) => <GameRow key={g.id} g={g} res={res} s={seriesOfGame(res, g)} onBox={onBox} />)}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ---------- Family Picks ---------- */
const EMOJI = ["⚾", "🧢", "🦖", "🐶", "🐱", "🦄", "🚀", "🌮", "⭐", "🐻", "🦈", "🍕"];
function PicksTab({ res, store, isPhone }) {
  const M = window.MLB;
  const [name, setName] = useState("");
  const [emo, setEmo] = useState("🧢");
  const pid = store.active;
  const mine = (pid && store.picks[pid]) || {};
  const board = store.players.map((p) => ({ p, sc: M.score(res, store.picks[p.id] || {}), n: Object.keys(store.picks[p.id] || {}).length }))
    .sort((a, b) => b.sc.pts - a.sc.pts || b.sc.maxLeft - a.sc.maxLeft);
  const me = store.players.find((p) => p.id === pid);
  return (
    <div style={{ height: "100%", overflow: "auto", display: "grid", gap: 16, gridTemplateColumns: isPhone ? "1fr" : "320px minmax(0,1fr)", alignContent: "start" }}>
      <div style={{ display: "grid", gap: 14, alignContent: "start" }}>
        <div style={{ background: C.card, borderRadius: 18, padding: 14 }}>
          <div style={{ fontSize: 17, fontWeight: 700, color: C.gold, marginBottom: 8 }}>🏅 Leaderboard</div>
          {board.map(({ p, sc, n }, i) => (
            <div key={p.id} onClick={() => store.setActive(p.id)} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 8px", borderRadius: 12, cursor: "pointer", background: p.id === pid ? "rgba(244,183,64,.18)" : "transparent" }}>
              <span style={{ width: 20, color: C.muted, fontWeight: 700 }}>{i + 1}</span>
              <span style={{ fontSize: 24 }}>{p.emoji}</span>
              <span style={{ flex: 1, fontWeight: 700, fontSize: 17 }}>{p.name}</span>
              <span style={{ textAlign: "right" }}><b style={{ fontSize: 20, color: C.gold }}>{sc.pts}</b><span style={{ fontSize: 11, color: C.muted, display: "block" }}>{n}/11 picked</span></span>
            </div>
          ))}
          <div style={{ fontSize: 12, color: C.faint, marginTop: 6 }}>Points: Wild Card 1 · Division 2 · Championship 4 · World Series 8.</div>
        </div>
        <div style={{ background: C.card, borderRadius: 18, padding: 14 }}>
          <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 8 }}>➕ Add a player</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 8 }}>
            {EMOJI.map((e) => <button key={e} onClick={() => setEmo(e)} style={{ fontSize: 22, border: "none", borderRadius: 10, padding: 4, cursor: "pointer", background: emo === e ? C.gold : "rgba(255,255,255,.08)" }}>{e}</button>)}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" maxLength={16} style={{ flex: 1, minWidth: 0, fontSize: 16, padding: "8px 10px", borderRadius: 10, border: "none", fontFamily: "inherit" }} />
            <button disabled={!name.trim()} onClick={() => { store.addPlayer(name.trim(), emo); setName(""); }} style={{ border: "none", borderRadius: 10, padding: "8px 14px", fontWeight: 700, background: name.trim() ? C.green : "rgba(255,255,255,.1)", color: C.ink, cursor: "pointer" }}>Add</button>
          </div>
          {me && store.players.length > 1 && <button onClick={() => { if (confirm("Remove " + me.name + " and their picks?")) store.removePlayer(me.id); }} style={{ marginTop: 10, border: "none", background: "transparent", color: C.muted, cursor: "pointer", fontSize: 13 }}>Remove {me.name}</button>}
        </div>
      </div>
      <div>
        <div style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>{me ? me.emoji + " " + me.name + "'s picks" : "Pick a player"}</div>
        <div style={{ fontSize: 14, color: C.muted, marginBottom: 12 }}>Tap who you think will win each series. Picks lock when the series starts. Later rounds unlock as you pick earlier ones.</div>
        {me && M.ROUND_ORDER.map((rd) => (
          <div key={rd} style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: C.gold, marginBottom: 6 }}>{M.ROUNDS[rd].name} <span style={{ color: C.muted, fontWeight: 500, fontSize: 13 }}>· first to {M.ROUNDS[rd].need} wins · {M.ROUNDS[rd].pts} pt{M.ROUNDS[rd].pts > 1 ? "s" : ""}</span></div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 10 }}>
              {M.SERIES.filter((d) => d.rd === rd).map((d) => {
                const s = res.series[d.id];
                const opts = M.pickOptions(res, d.id, mine);
                const lock = M.locked(s);
                const p = mine[d.id];
                return (
                  <div key={d.id} style={{ background: "rgba(10,22,48,.6)", borderRadius: 14, padding: 10 }}>
                    <div style={{ fontSize: 12, color: C.muted, marginBottom: 6 }}>{d.lg === "WS" ? "World Series" : d.lg + " " + M.ROUNDS[rd].short}{lock ? " · 🔒 locked" : ""}{s.winner ? (p ? (p === s.winner ? " · ✅ right!" : " · ❌") : "") : ""}</div>
                    <div style={{ display: "flex", gap: 8 }}>
                      {opts.map((t, i) => (
                        <button key={i} disabled={!t || lock} onClick={() => store.pick(pid, d.id, t)} style={{ flex: 1, display: "flex", alignItems: "center", gap: 8, border: p === t && t ? "3px solid " + C.gold : "3px solid transparent", borderRadius: 12, padding: 8, cursor: t && !lock ? "pointer" : "default",
                          background: p === t && t ? "rgba(244,183,64,.22)" : "rgba(255,255,255,.07)", color: "#fff", fontFamily: "inherit", opacity: !t ? 0.5 : lock && p !== t ? 0.55 : 1 }}>
                          <Logo t={t} res={res} size={32} dim={t && res.alive[t] === false} />
                          <span style={{ fontSize: 15, fontWeight: 600, textAlign: "left" }}>{t ? nameOf(res, t) : "pick earlier round"}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------- How It Works (the best-of-N lesson) ---------- */
function PretendSeries() {
  const [best, setBest] = useState(5);
  const [games, setGames] = useState([]);
  const need = (best + 1) / 2;
  const a = games.filter((x) => x === "a").length, b = games.filter((x) => x === "b").length;
  const done = a >= need || b >= need;
  const T = { a: { n: "Puppies", e: "🐶", c: "#3f78d8" }, b: { n: "Kittens", e: "🐱", c: "#d6517d" } };
  const w = a >= need ? "a" : b >= need ? "b" : null;
  let msg;
  if (w) msg = T[w].e + " The " + T[w].n + " got to " + need + " wins first. They WIN the series " + Math.max(a, b) + "–" + Math.min(a, b) + "! (They only needed " + games.length + " of the " + best + " games.)";
  else if (a === need - 1 && b === need - 1) msg = "😱 " + a + " to " + b + "! Whoever wins the next game wins EVERYTHING.";
  else if (a === need - 1 || b === need - 1) { const l = a > b ? "a" : "b"; msg = "⭐ The " + T[l].n + " need just ONE more win!"; }
  else if (!games.length) msg = "Tap who wins Game 1. First team to " + need + " wins takes the series!";
  else msg = "Game " + (games.length + 1) + " is next. Keep going!";
  const row = (k, n) => (
    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 0" }}>
      <span style={{ fontSize: 40 }}>{T[k].e}</span>
      <span style={{ fontSize: 22, fontWeight: 700, width: 110 }}>{T[k].n}</span>
      <WinDots need={need} won={n} color={T[k].c} size={40} winner={w === k} />
      <button disabled={done} onClick={() => setGames(games.concat(k))} style={{ marginLeft: "auto", border: "none", borderRadius: 14, padding: "12px 18px", fontSize: 18, fontWeight: 700, cursor: done ? "default" : "pointer", background: done ? "rgba(255,255,255,.08)" : T[k].c, color: "#fff", fontFamily: "inherit" }}>{T[k].e} won!</button>
    </div>
  );
  return (
    <div style={{ background: "rgba(10,22,48,.75)", border: "2px solid " + C.gold, borderRadius: 22, padding: 18 }}>
      <div style={{ fontSize: 24, fontWeight: 700, color: C.gold }}>🎮 Play a pretend series</div>
      <div style={{ display: "flex", gap: 8, margin: "10px 0", flexWrap: "wrap" }}>
        {[3, 5, 7].map((n) => <button key={n} onClick={() => { setBest(n); setGames([]); }} style={{ border: "none", borderRadius: 12, padding: "10px 16px", fontSize: 17, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", background: best === n ? C.gold : "rgba(255,255,255,.1)", color: best === n ? C.ink : "#fff" }}>Best of {n}</button>)}
        <button onClick={() => setGames([])} style={{ marginLeft: "auto", border: "none", borderRadius: 12, padding: "10px 16px", fontSize: 15, cursor: "pointer", background: "rgba(255,255,255,.1)", color: "#fff", fontFamily: "inherit" }}>↺ Start over</button>
      </div>
      <div style={{ fontSize: 18, color: "#dfe6ff", marginBottom: 6 }}>Best of <b>{best}</b> means they play <b>up to {best}</b> games. The first team to win <b style={{ color: C.gold }}>{need}</b> wins the series!</div>
      {row("a", a)}{row("b", b)}
      <div style={{ display: "flex", gap: 6, margin: "8px 0", flexWrap: "wrap" }}>
        {Array.from({ length: best }).map((_, i) => {
          const g = games[i];
          const skipped = done && i >= games.length;
          return <div key={i} style={{ textAlign: "center", width: 64, borderRadius: 12, padding: "6px 0", background: g ? T[g].c : "rgba(255,255,255,.07)", opacity: skipped ? 0.35 : 1, border: i === games.length && !done ? "2px solid " + C.gold : "2px solid transparent" }}>
            <div style={{ fontSize: 11, color: "#dfe6ff" }}>Game {i + 1}</div>
            <div style={{ fontSize: 22 }}>{g ? T[g].e : skipped ? "🚫" : "·"}</div>
          </div>;
        })}
      </div>
      <div className="pop" key={msg} style={{ fontSize: 21, fontWeight: 700, color: "#fff", marginTop: 6 }}>{msg}</div>
      {done && games.length < best && <div style={{ fontSize: 15, color: C.muted, marginTop: 4 }}>🚫 = games that never get played, because someone already won. That's why the schedule says "if needed"!</div>}
    </div>
  );
}

function LearnTab({ res, isPhone }) {
  const card = (e, t, body) => (
    <div style={{ background: C.card, borderRadius: 18, padding: 16 }}>
      <div style={{ fontSize: 34 }}>{e}</div>
      <div style={{ fontSize: 19, fontWeight: 700, color: C.gold, margin: "4px 0" }}>{t}</div>
      <div style={{ fontSize: 16, lineHeight: 1.45, color: "#e8edff" }}>{body}</div>
    </div>
  );
  return (
    <div style={{ height: "100%", overflow: "auto", display: "grid", gap: 16, alignContent: "start" }}>
      <PretendSeries />
      <RoadStrip res={res} compact={isPhone} />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 14 }}>
        {card("🎟️", "12 teams get in", "6 teams from the American League and 6 from the National League. The ones that won the most games all summer get the best spots.")}
        {card("😴", "The top 2 get a rest", "The #1 and #2 teams in each league skip round 1. They wait to play whoever wins the Wild Card series.")}
        {card("🏆", "Last team standing", "Lose a series and your season is over. The American League champion plays the National League champion in the World Series.")}
        {card("⚾", "9 innings", "Each team bats once per inning. After 9 innings, whoever scored more runs wins. Tied? They keep playing extra innings!")}
        {card("✋", "3 outs", "The batting team keeps hitting until the other team gets 3 outs. Then they switch sides.")}
        {card("💎", "Around the diamond", "Run to 1st, 2nd, 3rd and back home to score a run. A home run means the batter runs all the way around!")}
        {card("🎯", "Strikes and balls", "3 strikes and the batter is out. 4 balls and the batter gets to walk to first base.")}
        {card("🏠", "Home field", "The better team hosts more games. Fans cheering at home can really help!")}
      </div>
    </div>
  );
}

/* ---------- app ---------- */
function App() {
  const params = new URLSearchParams(location.search);
  const [tab, setTab] = useState(TABS.some((t) => t.id === params.get("tab")) ? params.get("tab") : "home");
  const [feed, setFeed] = useState(null);
  const [err, setErr] = useState(false);
  const isPhone = useIsPhone();
  const store = useStore();

  // ?feed=tests/demo-live.json previews a mid-playoffs day (same-folder JSON only).
  const feedUrl = /^[\w\-\/]+\.json$/.test(params.get("feed") || "") ? params.get("feed") : "live.json";
  // The Pi serves live.json (cron updater). Anywhere without one (GitHub Pages), build the
  // same feed in the browser straight from ESPN — see mlb-espn.js.
  const load = useCallback(() => fetch(feedUrl, { cache: "no-store" })
    .then((r) => r.ok ? r.json() : Promise.reject(r.status))
    .catch(() => window.MLBESPN.buildFeed(2026))
    .then((d) => { window.__FEED = d; setFeed(d); setErr(false); }).catch(() => setErr(true)), []);
  const anyLive = feed && feed.games && feed.games.some((g) => g.status === "LIVE");
  useEffect(() => { load(); const i = setInterval(load, anyLive ? 20000 : 60000); return () => clearInterval(i); }, [load, anyLive]);
  useEffect(() => { const h = () => load(); window.addEventListener("online", h); return () => window.removeEventListener("online", h); }, [load]);
  // A kiosk never reloads by itself: pick up new code after 6h with nobody touching it.
  useEffect(() => {
    let t; const arm = () => { clearTimeout(t); t = setTimeout(() => location.reload(), 6 * 3600e3); };
    ["mousemove", "keydown", "touchstart", "click"].forEach((e) => window.addEventListener(e, arm, { passive: true })); arm();
    return () => clearTimeout(t);
  }, []);
  useEffect(() => {
    const h = (e) => {
      if (e.target && /^(INPUT|SELECT|TEXTAREA)$/.test(e.target.tagName)) return;
      const ids = TABS.map((t) => t.id), i = ids.indexOf(tab);
      if (e.key === "ArrowRight") setTab(ids[(i + 1) % ids.length]);
      else if (e.key === "ArrowLeft") setTab(ids[(i - 1 + ids.length) % ids.length]);
      else if (/^[1-8]$/.test(e.key)) setTab(ids[+e.key - 1]);
    };
    window.addEventListener("keydown", h); return () => window.removeEventListener("keydown", h);
  }, [tab]);

  const res = useMemo(() => window.MLB.resolve(feed), [feed]);
  const [box, setBox] = useState(null);
  const [seriesId, setSeriesId] = useState(null);
  const [teamPick, setTeamPick] = useState(params.get("team"));
  const openTeam = (t) => { setTeamPick(t); setTab("teams"); };
  // keep an open box score pointed at the freshest copy of its game
  const boxGame = box && feed && feed.games ? (feed.games.find((g) => g.id === box.id) || box) : box;
  const liveN = feed && feed.games ? feed.games.filter((g) => g.status === "LIVE").length : 0;

  return (
    <div style={{ height: "100vh", display: "flex", flexDirection: "column", color: "#fff" }}>
      <header style={{ display: "flex", alignItems: "center", gap: isPhone ? 8 : 18, padding: isPhone ? "10px 12px" : "14px 24px", borderBottom: "1px solid " + C.line, flexWrap: "wrap" }}>
        <a href="/" title="Family home" style={{ textDecoration: "none", color: "#fff", fontWeight: 700, fontSize: isPhone ? 19 : 25, whiteSpace: "nowrap" }}>⚾ MLB PLAYOFFS <span style={{ color: C.gold }}>{(feed && feed.season) || 2026}</span></a>
        <nav className="tabstrip" style={{ display: "flex", gap: 8, flex: isPhone ? "1 1 100%" : 1, order: isPhone ? 9 : 0, overflowX: "auto" }}>
          {TABS.map((t) => (
            <button key={t.id} onClick={() => setTab(t.id)} style={{ border: "none", cursor: "pointer", borderRadius: 12, padding: isPhone ? "8px 12px" : "10px 16px", fontSize: isPhone ? 15 : 17, fontWeight: 600, whiteSpace: "nowrap", flex: "none", fontFamily: "inherit",
              background: tab === t.id ? C.gold : "rgba(255,255,255,.1)", color: tab === t.id ? C.ink : "#dfe6ff" }}>{t.label}</button>
          ))}
        </nav>
        {liveN > 0 && <Pill bg="rgba(226,71,59,.25)" fg="#ffc1bb" style={{ border: "2px solid " + C.red }}><LiveDot /> {liveN} LIVE</Pill>}
        {err && <Pill bg="rgba(255,255,255,.08)" fg={C.muted}>📴 offline</Pill>}
      </header>
      <main style={{ flex: 1, minHeight: 0, padding: isPhone ? "12px" : "18px 24px" }}>
        {tab === "home" && <HomeTab res={res} feed={feed} fav={store.fav} setFav={store.setFav} isPhone={isPhone} onBox={setBox} openSeries={setSeriesId} />}
        {tab === "bracket" && <BracketTab res={res} fav={store.fav} isPhone={isPhone} openSeries={setSeriesId} />}
        {tab === "games" && <GamesTab res={res} feed={feed} onBox={setBox} />}
        {tab === "teams" && <TeamsTab key={teamPick || "t"} res={res} feed={feed} fav={store.fav} setFav={store.setFav} isPhone={isPhone} initialTeam={teamPick} />}
        {tab === "map" && <MapTab res={res} feed={feed} isPhone={isPhone} openTeam={openTeam} />}
        {tab === "quiz" && <QuizTab isPhone={isPhone} />}
        {tab === "picks" && <PicksTab res={res} store={store} isPhone={isPhone} />}
        {tab === "learn" && <LearnTab res={res} isPhone={isPhone} />}
      </main>
      {seriesId && !boxGame && <SeriesSheet s={res.series[seriesId]} res={res} feed={feed} isPhone={isPhone} onBox={setBox} onClose={() => setSeriesId(null)} />}
      {boxGame && <BoxScore g={boxGame} res={res} isPhone={isPhone} onClose={() => setBox(null)} />}
      <footer style={{ padding: "7px 24px", borderTop: "1px solid " + C.line, fontSize: 12, color: C.faint, display: "flex", gap: 12, justifyContent: "space-between", flexWrap: "wrap" }}>
        {!isPhone && <span>📺 ← → or keys 1–8 switch tabs</span>}
        <span>Scores from ESPN{feed && feed.updated ? " · updated " + new Date(feed.updated).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }) : ""}</span>
        {!isPhone && <span>{location.host + location.pathname.replace(/index\.html$/, "")}</span>}
      </footer>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("app")).render(<App />);
