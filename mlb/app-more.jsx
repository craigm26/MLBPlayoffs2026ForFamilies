/* MLB hub — Teams, Map, Quiz tabs and the Box Score sheet. Loaded before app.jsx; uses its
   shared helpers (C, Logo, nameOf, Pill, LiveDot) at render time. React hooks via React.* here
   because app.jsx already declares the destructured names at top level. */

function useAsync(fn, deps) {
  const [st, setSt] = React.useState({ loading: true, data: null, err: null });
  React.useEffect(() => {
    let live = true;
    setSt((s) => ({ loading: true, data: s.data, err: null }));
    fn().then((d) => live && setSt({ loading: false, data: d, err: null }), (e) => live && setSt({ loading: false, data: null, err: e }));
    return () => { live = false; };
  }, deps); // eslint-disable-line
  return st;
}

function Section({ title, children, right }) {
  return (
    <div style={{ background: C.card, borderRadius: 18, padding: 14 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <div style={{ fontSize: 18, fontWeight: 700, color: C.gold }}>{title}</div>
        {right && <div style={{ marginLeft: "auto" }}>{right}</div>}
      </div>
      {children}
    </div>
  );
}

function milesBetween(a, b) {
  const R = 3958.8, r = Math.PI / 180;
  const dLat = (b.lat - a.lat) * r, dLon = (b.lon - a.lon) * r;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLon / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(h)));
}

/* ---------------- Teams ---------------- */
const STAT_CARDS = [
  ["batting", "homeRuns", "Home runs", "💥", false],
  ["batting", "avg", "Batting average", "🏏", false],
  ["batting", "runs", "Runs scored", "🏃", false],
  ["batting", "stolenBases", "Stolen bases", "💨", false],
  ["pitching", "ERA", "Team ERA", "🎯", true],
  ["pitching", "strikeouts", "Strikeouts by pitchers", "✋", false],
  ["pitching", "saves", "Saves", "🔒", false],
  ["fielding", "errors", "Errors", "🧤", true],
];
const HELP_KEY = { homeRuns: "homeRuns", avg: "avg", runs: "runs", stolenBases: "stolenBases", ERA: "ERA", strikeouts: "strikeouts", saves: "saves", errors: "errors" };

function TeamsTab({ res, feed, fav, setFav, isPhone, initialTeam }) {
  const all = res.seeds.AL.concat(res.seeds.NL);
  const [t, setT] = React.useState(initialTeam && all.indexOf(initialTeam) >= 0 ? initialTeam : (fav && all.indexOf(fav) >= 0 ? fav : all[0]));
  const season = (feed && feed.season) || 2026;
  const one = useAsync(() => window.MLBTEAM.team(t, season), [t, season]);
  const many = useAsync(() => window.MLBTEAM.allStats(all, season), [all.join(), season]);
  const team = res.teams[t] || {};
  const lg = res.seeds.AL.indexOf(t) >= 0 ? "AL" : "NL";
  const facts = (window.MLBFACTS.TEAM[t] || []);
  const park = window.MLBMAP.parks[t];
  const venue = ((feed && feed.games) || []).filter((g) => g.home === t && g.venue).map((g) => g.venue)[0];
  const d = one.data;
  const rankOf = (cat, key, lowGood) => {
    const S = many.data; if (!S) return null;
    const vals = Object.keys(S).map((k) => [k, S[k][cat] && S[k][cat][key] ? S[k][cat][key].v : null]).filter((x) => x[1] != null);
    vals.sort((a, b) => lowGood ? a[1] - b[1] : b[1] - a[1]);
    const i = vals.findIndex((x) => x[0] === t);
    return i < 0 ? null : { rank: i + 1, of: vals.length, best: vals[0], vals };
  };
  const ordinal = window.MLB.ordinal;
  return (
    <div style={{ height: "100%", overflow: "auto", display: "grid", gap: 14, alignContent: "start" }}>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
        {["AL", "NL"].map((L) => (
          <div key={L} style={{ display: "flex", gap: 6, alignItems: "center", marginRight: 12 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: C.muted }}>{L}</span>
            {res.seeds[L].map((x) => (
              <button key={x} onClick={() => setT(x)} title={nameOf(res, x)} style={{ border: "none", background: "transparent", padding: 2, cursor: "pointer", borderRadius: "50%", boxShadow: x === t ? "0 0 0 3px " + C.gold : "none" }}>
                <Logo t={x} res={res} size={isPhone ? 36 : 46} dim={res.alive[x] === false && x !== t} />
              </button>
            ))}
          </div>
        ))}
      </div>

      <div style={{ display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap", background: "linear-gradient(120deg, " + (team.color || "#123") + "cc, rgba(10,22,48,.85))", borderRadius: 20, padding: isPhone ? 14 : 20, border: "2px solid " + (team.alt || "#fff") + "66" }}>
        <Logo t={t} res={res} size={isPhone ? 70 : 104} />
        <div style={{ flex: "1 1 260px" }}>
          <div style={{ fontSize: isPhone ? 26 : 38, fontWeight: 700, lineHeight: 1.1 }}>{team.name || t}</div>
          <div style={{ fontSize: 15, color: "#e8edff", marginTop: 4 }}>
            #{res.seedOf[t]} seed in the {lg === "AL" ? "American" : "National"} League{res.records[t] ? " · " + res.records[t] + " this season" : ""}
          </div>
          <div style={{ fontSize: 14, color: "#cdd9ff", marginTop: 2 }}>📍 {venue ? venue + ", " : ""}{team.city || ""}{d && d.coach ? " · Manager: " + d.coach : ""}</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: "flex-end" }}>
          {res.alive[t] === false ? <Pill bg="rgba(0,0,0,.35)" fg="#ffd2cd">👋 Season over</Pill> : <Pill bg="rgba(52,199,123,.25)" fg="#bdf0d3">✅ Still alive</Pill>}
          <button onClick={() => setFav(t)} style={{ border: "none", borderRadius: 10, padding: "8px 12px", cursor: "pointer", fontFamily: "inherit", fontWeight: 700, background: fav === t ? C.gold : "rgba(255,255,255,.14)", color: fav === t ? C.ink : "#fff" }}>{fav === t ? "⭐ Our team!" : "☆ Make it our team"}</button>
        </div>
      </div>

      <div style={{ display: "grid", gap: 14, gridTemplateColumns: isPhone ? "1fr" : "minmax(0,1fr) minmax(0,1fr)" }}>
        <Section title="🤓 Did you know?">
          {facts.length ? facts.map((f, i) => <div key={i} style={{ fontSize: 16, lineHeight: 1.45, padding: "6px 0", borderTop: i ? "1px solid " + C.line : "none" }}>{f}</div>)
            : <div style={{ color: C.muted }}>No facts yet for this team.</div>}
          {d && Object.keys(d.countries).length > 1 && (
            <div style={{ fontSize: 15, marginTop: 8, color: "#dfe6ff" }}>🌎 Players come from <b>{Object.keys(d.countries).length}</b> places: {Object.entries(d.countries).sort((a, b) => b[1] - a[1]).map(([c, n]) => c + (n > 1 ? " (" + n + ")" : "")).join(", ")}.</div>
          )}
        </Section>

        <Section title="⭐ Stars to know">
          {one.loading && !d && <div style={{ color: C.muted }}>Loading players…</div>}
          {one.err && <div style={{ color: C.muted }}>Couldn't reach ESPN right now. Try again in a minute.</div>}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(190px, 1fr))", gap: 8 }}>
            {d && d.leaders.map((l) => (
              <div key={l.cat} style={{ display: "flex", gap: 8, alignItems: "center", background: "rgba(10,22,48,.5)", borderRadius: 12, padding: 8 }}>
                {l.photo ? <img src={l.photo} alt="" style={{ width: 48, height: 48, borderRadius: "50%", objectFit: "cover", background: "#fff", flex: "none" }} /> : <div style={{ width: 48, height: 48, borderRadius: "50%", background: "rgba(255,255,255,.1)", flex: "none", display: "grid", placeItems: "center", fontSize: 22 }}>{l.e}</div>}
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 11.5, color: C.muted }}>{l.e} {l.label}</div>
                  <div style={{ fontSize: 15, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{l.name || "—"}</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: C.gold }}>{l.value}</div>
                </div>
              </div>
            ))}
          </div>
        </Section>
      </div>

      <Section title="📊 Team stats this season" right={<span style={{ fontSize: 12, color: C.muted }}>rank = among the 12 playoff teams</span>}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(230px, 1fr))", gap: 10 }}>
          {STAT_CARDS.map(([cat, key, label, e, lowGood]) => {
            const v = d && d.stats[cat] && d.stats[cat][key];
            const rk = rankOf(cat, key, lowGood);
            const best = rk && rk.rank === 1;
            return (
              <div key={key} style={{ background: best ? "rgba(244,183,64,.16)" : "rgba(10,22,48,.5)", border: best ? "2px solid " + C.gold : "2px solid transparent", borderRadius: 14, padding: 10 }}>
                <div style={{ fontSize: 13, color: C.muted }}>{e} {label}</div>
                <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                  <span style={{ fontSize: 28, fontWeight: 700 }}>{v ? v.d : "…"}</span>
                  {rk && <span style={{ fontSize: 13, fontWeight: 700, color: best ? C.gold : "#dfe6ff" }}>{best ? "🥇 best!" : ordinal(rk.rank) + " of " + rk.of}</span>}
                </div>
                {rk && (
                  <div style={{ display: "flex", gap: 2, margin: "6px 0 4px", alignItems: "flex-end", height: 22 }} aria-hidden="true">
                    {rk.vals.map(([k, val], i) => <div key={k} title={nameOf(res, k) + ": " + val} style={{ flex: 1, height: (lowGood ? (rk.vals[0][1] / val) : (val / rk.vals[0][1])) * 22, background: k === t ? (team.color && team.color !== "#000000" ? team.alt : C.gold) : "rgba(255,255,255,.22)", borderRadius: 2, minHeight: 2 }} />)}
                  </div>
                )}
                <div style={{ fontSize: 12.5, color: "#cdd9ff", lineHeight: 1.35 }}>{window.MLBFACTS.STAT_HELP[HELP_KEY[key]]}</div>
              </div>
            );
          })}
        </div>
      </Section>

      <Section title="🧢 The roster" right={d && <span style={{ fontSize: 12, color: C.muted }}>{d.groups.reduce((n, g) => n + g.players.length, 0)} players</span>}>
        {d && d.groups.map((g) => (
          <div key={g.name} style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#dfe6ff", margin: "4px 0 6px" }}>{g.name}</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(230px, 1fr))", gap: 6 }}>
              {g.players.map((p) => (
                <div key={p.id} style={{ display: "flex", gap: 8, alignItems: "center", background: "rgba(10,22,48,.45)", borderRadius: 12, padding: "6px 8px" }}>
                  <div style={{ width: 34, textAlign: "center", fontSize: 18, fontWeight: 700, color: C.gold, flex: "none" }}>{p.num || "–"}</div>
                  {p.photo && <img src={p.photo} alt="" loading="lazy" style={{ width: 36, height: 36, borderRadius: "50%", objectFit: "cover", background: "#fff", flex: "none" }} />}
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 14.5, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.name}</div>
                    <div style={{ fontSize: 11.5, color: C.muted, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.pos}{p.age ? " · age " + p.age : ""}{p.from ? " · " + p.from : ""}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </Section>
      <div style={{ fontSize: 12, color: C.faint }}>Player and team stats from ESPN (regular season).</div>
    </div>
  );
}

/* ---------------- Map ---------------- */
function MapTab({ res, feed, isPhone, openTeam }) {
  const M = window.MLBMAP;
  const all = res.seeds.AL.concat(res.seeds.NL);
  const [sel, setSel] = React.useState(null);
  // Series being played now (or next): draw a line between the two ballparks.
  const cur = window.MLB.SERIES.map((d) => res.series[d.id]).filter((s) => s.top && s.bot && !s.winner);
  const curRound = cur.length ? cur[0].rd : null;
  const pairs = cur.filter((s) => s.rd === curRound).map((s) => ({ s, a: s.top, b: s.bot, mi: milesBetween(M.parks[s.top], M.parks[s.bot]) }));
  const others = Object.keys(M.parks).filter((k) => all.indexOf(k) < 0);
  const selT = sel || null;
  const selFacts = selT ? window.MLBFACTS.TEAM[selT] || [] : [];
  const venue = (t) => ((feed && feed.games) || []).filter((g) => g.home === t && g.venue).map((g) => g.venue + ", " + g.city)[0];
  return (
    <div style={{ height: "100%", overflow: "auto", display: "grid", gap: 14, gridTemplateColumns: isPhone ? "1fr" : "minmax(0,2.2fr) minmax(0,1fr)", alignContent: "start" }}>
      <div style={{ background: "rgba(10,22,48,.6)", borderRadius: 20, padding: 10 }}>
        <svg viewBox={"0 0 " + M.W + " " + M.H} style={{ width: "100%", height: "auto", display: "block" }} role="img" aria-label="Map of playoff ballparks">
          <path d={M.neighbors} fill="rgba(255,255,255,.04)" stroke="rgba(255,255,255,.12)" />
          <path d={M.lower48} fill="#1f4a86" stroke="none" />
          <path d={M.borders} fill="none" stroke="rgba(255,255,255,.22)" strokeWidth="0.8" />
          {pairs.map((p, i) => {
            const A = M.parks[p.a], B = M.parks[p.b];
            const mx = (A.x + B.x) / 2, my = (A.y + B.y) / 2 - Math.min(80, Math.hypot(A.x - B.x, A.y - B.y) / 4);
            return (
              <g key={i}>
                <path d={`M${A.x},${A.y} Q${mx},${my} ${B.x},${B.y}`} fill="none" stroke={C.gold} strokeWidth="3" strokeDasharray="8 6" opacity=".9" />
                <text x={mx} y={my + 14} textAnchor="middle" fontSize="16" fontWeight="700" fill="#fff" stroke="#0e1f3d" strokeWidth="4" paintOrder="stroke">✈️ {p.mi.toLocaleString("en-US")} mi</text>
              </g>
            );
          })}
          {others.map((k) => M.parks[k] && <circle key={k} cx={M.parks[k].x} cy={M.parks[k].y} r="4" fill="rgba(255,255,255,.35)"><title>{k}</title></circle>)}
          {all.map((t) => {
            const p = M.parks[t]; if (!p) return null;
            const out = res.alive[t] === false;
            return (
              <g key={t} onClick={() => setSel(t)} style={{ cursor: "pointer" }} opacity={out ? 0.4 : 1}>
                <circle cx={p.x} cy={p.y} r={sel === t ? 26 : 21} fill="#fff" stroke={sel === t ? C.gold : (res.teams[t] || {}).color || "#333"} strokeWidth="4" />
                <image href={window.MLB.logoUrl(res, t)} x={p.x - 15} y={p.y - 15} width="30" height="30" />
              </g>
            );
          })}
        </svg>
        <div style={{ fontSize: 12.5, color: C.muted, padding: "4px 8px" }}>Tap a logo. Gray dots are the other 18 teams' ballparks. Dashed lines = teams playing each other right now.</div>
      </div>
      <div style={{ display: "grid", gap: 14, alignContent: "start" }}>
        {selT ? (
          <Section title={"📍 " + nameOf(res, selT)} right={<button onClick={() => openTeam(selT)} style={{ border: "none", borderRadius: 10, padding: "6px 10px", background: C.gold, color: C.ink, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>Team page ➜</button>}>
            <div style={{ fontSize: 15, color: "#dfe6ff", marginBottom: 6 }}>{venue(selT) || (res.teams[selT] || {}).city}</div>
            {selFacts.map((f, i) => <div key={i} style={{ fontSize: 15, lineHeight: 1.45, padding: "5px 0", borderTop: "1px solid " + C.line }}>{f}</div>)}
          </Section>
        ) : <Section title="🗺️ Where do they play?"><div style={{ fontSize: 15, lineHeight: 1.45 }}>Every playoff team has its own ballpark. Tap a logo on the map to visit! In a series, the higher seed gets more home games.</div></Section>}
        {pairs.length > 0 && (
          <Section title="✈️ How far do they travel?">
            {pairs.sort((a, b) => b.mi - a.mi).map((p, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 0", borderTop: i ? "1px solid " + C.line : "none" }}>
                <Logo t={p.a} res={res} size={28} /><span style={{ fontSize: 13, color: C.muted }}>to</span><Logo t={p.b} res={res} size={28} />
                <span style={{ marginLeft: "auto", fontWeight: 700, color: C.gold }}>{p.mi.toLocaleString("en-US")} miles</span>
              </div>
            ))}
            <div style={{ fontSize: 13, color: C.muted, marginTop: 6 }}>{(() => { const far = pairs.slice().sort((a, b) => b.mi - a.mi)[0]; const hrs = Math.round(far.mi / 60); return "Driving " + far.mi.toLocaleString("en-US") + " miles at 60 mph would take about " + hrs + " hours! Good thing they fly. 🛫"; })()}</div>
          </Section>
        )}
        <Section title="🌎 Map facts">
          {(() => {
            const ps = all.map((t) => [t, M.parks[t]]).filter((x) => x[1]);
            const north = ps.slice().sort((a, b) => b[1].lat - a[1].lat)[0], south = ps.slice().sort((a, b) => a[1].lat - b[1].lat)[0];
            const west = ps.slice().sort((a, b) => a[1].lon - b[1].lon)[0], east = ps.slice().sort((a, b) => b[1].lon - a[1].lon)[0];
            const row = (e, txt) => <div style={{ fontSize: 15, padding: "4px 0" }}>{e} {txt}</div>;
            return (
              <React.Fragment>
                {row("⬆️", "Farthest north: " + nameOf(res, north[0]))}
                {row("⬇️", "Farthest south: " + nameOf(res, south[0]))}
                {row("⬅️", "Farthest west: " + nameOf(res, west[0]))}
                {row("➡️", "Farthest east: " + nameOf(res, east[0]))}
                {row("📏", "From " + nameOf(res, west[0]) + " to " + nameOf(res, east[0]) + " is " + milesBetween(west[1], east[1]).toLocaleString("en-US") + " miles!")}
              </React.Fragment>
            );
          })()}
        </Section>
      </div>
    </div>
  );
}

/* ---------------- Quiz + facts ---------------- */
function shuffle(a, seed) { const r = a.slice(); let s = seed || 1; for (let i = r.length - 1; i > 0; i--) { s = (s * 9301 + 49297) % 233280; const j = Math.floor((s / 233280) * (i + 1)); [r[i], r[j]] = [r[j], r[i]]; } return r; }

function QuizTab({ isPhone }) {
  const F = window.MLBFACTS;
  const [seed, setSeed] = React.useState(() => Date.now() % 1000 + 1);
  const qs = React.useMemo(() => shuffle(F.QUIZ, seed).slice(0, 10), [seed]);
  const [i, setI] = React.useState(0);
  const [picked, setPicked] = React.useState(null);
  const [score, setScore] = React.useState(0);
  const [fact, setFact] = React.useState(() => Math.floor(Math.random() * F.FACTS.length));
  const done = i >= qs.length;
  const q = qs[i];
  const choose = (k) => { if (picked != null) return; setPicked(k); if (k === q.a) setScore(score + 1); };
  const next = () => { setPicked(null); setI(i + 1); };
  const restart = () => { setSeed(seed + 7); setI(0); setPicked(null); setScore(0); };
  const f = F.FACTS[fact];
  return (
    <div style={{ height: "100%", overflow: "auto", display: "grid", gap: 16, gridTemplateColumns: isPhone ? "1fr" : "minmax(0,1.4fr) minmax(0,1fr)", alignContent: "start" }}>
      <div style={{ background: "rgba(10,22,48,.75)", border: "2px solid " + C.gold, borderRadius: 22, padding: isPhone ? 14 : 22 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
          <div style={{ fontSize: 24, fontWeight: 700, color: C.gold }}>🧠 Baseball Quiz</div>
          <Pill style={{ marginLeft: "auto" }}>⭐ {score} / {Math.min(i + (picked != null ? 1 : 0), qs.length)}</Pill>
        </div>
        {!done ? (
          <React.Fragment>
            <div style={{ fontSize: 13, color: C.muted }}>Question {i + 1} of {qs.length}</div>
            <div key={i} className="pop" style={{ fontSize: isPhone ? 22 : 28, fontWeight: 700, margin: "6px 0 14px", lineHeight: 1.25 }}>{q.q}</div>
            <div style={{ display: "grid", gap: 10 }}>
              {q.c.map((c, k) => {
                const right = picked != null && k === q.a, wrong = picked === k && k !== q.a;
                return <button key={k} onClick={() => choose(k)} style={{ textAlign: "left", border: "3px solid " + (right ? C.green : wrong ? C.red : "transparent"), borderRadius: 14, padding: "14px 16px", fontSize: isPhone ? 18 : 21, fontWeight: 600, fontFamily: "inherit", cursor: picked == null ? "pointer" : "default",
                  background: right ? "rgba(52,199,123,.25)" : wrong ? "rgba(226,71,59,.22)" : "rgba(255,255,255,.08)", color: "#fff" }}>{right ? "✅ " : wrong ? "❌ " : ""}{c}</button>;
              })}
            </div>
            {picked != null && (
              <div className="pop" style={{ marginTop: 14, display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
                <div style={{ fontSize: 18, flex: "1 1 240px" }}>{picked === q.a ? "🎉 Yes! " : "Nice try! "}{q.why}</div>
                <button onClick={next} style={{ border: "none", borderRadius: 12, padding: "12px 20px", fontSize: 18, fontWeight: 700, background: C.gold, color: C.ink, cursor: "pointer", fontFamily: "inherit" }}>{i + 1 < qs.length ? "Next ➜" : "See my score"}</button>
              </div>
            )}
          </React.Fragment>
        ) : (
          <div className="pop" style={{ textAlign: "center", padding: 10 }}>
            <div style={{ fontSize: 64 }}>{score >= 9 ? "🏆" : score >= 6 ? "⭐" : "⚾"}</div>
            <div style={{ fontSize: 30, fontWeight: 700 }}>You got {score} out of {qs.length}!</div>
            <div style={{ fontSize: 18, color: "#dfe6ff", margin: "6px 0 14px" }}>{score >= 9 ? "You're an MVP! 🎉" : score >= 6 ? "All-Star work!" : "Keep practicing, you'll be a pro!"}</div>
            <button onClick={restart} style={{ border: "none", borderRadius: 12, padding: "12px 20px", fontSize: 18, fontWeight: 700, background: C.gold, color: C.ink, cursor: "pointer", fontFamily: "inherit" }}>Play again ↺</button>
          </div>
        )}
      </div>
      <div style={{ display: "grid", gap: 14, alignContent: "start" }}>
        <div style={{ background: "rgba(52,199,123,.12)", border: "2px solid rgba(52,199,123,.5)", borderRadius: 20, padding: 18 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: "#bdf0d3" }}>💡 FUN FACT</div>
          <div key={fact} className="pop" style={{ fontSize: 44, margin: "6px 0" }}>{f.e}</div>
          <div key={"t" + fact} className="pop" style={{ fontSize: isPhone ? 19 : 22, lineHeight: 1.4 }}>{f.t}</div>
          <button onClick={() => setFact((fact + 1) % F.FACTS.length)} style={{ marginTop: 12, border: "none", borderRadius: 12, padding: "10px 16px", fontSize: 16, fontWeight: 700, background: C.green, color: C.ink, cursor: "pointer", fontFamily: "inherit" }}>Another fact ➜</button>
        </div>
        <Section title="📚 All the facts">
          {F.FACTS.map((x, k) => <div key={k} style={{ fontSize: 14.5, lineHeight: 1.4, padding: "5px 0", borderTop: k ? "1px solid " + C.line : "none" }}>{x.e} {x.t}</div>)}
        </Section>
      </div>
    </div>
  );
}

/* ---------------- Box score (overlay) ---------------- */
function BoxScore({ g, res, onClose, isPhone }) {
  const fin = g.status === "FINAL";
  const [tick, setTick] = React.useState(0);
  React.useEffect(() => { if (fin) return; const id = setInterval(() => setTick((x) => x + 1), 30000); return () => clearInterval(id); }, [fin]);
  const st = useAsync(() => window.MLBTEAM.box(g.id, fin), [g.id, fin, tick]);
  React.useEffect(() => { const h = (e) => { if (e.key === "Escape") onClose(); }; window.addEventListener("keydown", h); return () => window.removeEventListener("keydown", h); }, [onClose]);
  const b = st.data;
  const cell = { padding: "4px 6px", textAlign: "center", fontSize: 13.5, whiteSpace: "nowrap" };
  const table = (rows, cols, title) => (
    <div style={{ overflowX: "auto", marginBottom: 10 }}>
      <table style={{ borderCollapse: "collapse", width: "100%" }}>
        <thead><tr><th style={{ ...cell, textAlign: "left", color: C.gold }}>{title}</th>{cols.map((c) => <th key={c} style={{ ...cell, color: C.muted, fontWeight: 600 }}>{c}</th>)}</tr></thead>
        <tbody>{rows.map((r, i) => <tr key={i} style={{ borderTop: "1px solid " + C.line }}><td style={{ ...cell, textAlign: "left", paddingLeft: r.sub ? 18 : 6 }}>{r.name} <span style={{ color: C.faint, fontSize: 11.5 }}>{r.pos}</span></td>{cols.map((c) => <td key={c} style={{ ...cell, fontWeight: (c === "HR" || c === "K") && +r[c] > 0 ? 700 : 400, color: c === "HR" && +r[c] > 0 ? C.gold : "#fff" }}>{r[c] ?? ""}</td>)}</tr>)}</tbody>
      </table>
    </div>
  );
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(4,10,24,.78)", zIndex: 50, display: "grid", placeItems: "center", padding: isPhone ? 8 : 30 }}>
      <div onClick={(e) => e.stopPropagation()} className="pop" style={{ background: "#10244a", border: "2px solid " + C.gold, borderRadius: 22, width: "min(1100px, 100%)", maxHeight: "100%", overflow: "auto", padding: isPhone ? 12 : 22 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10, flexWrap: "wrap" }}>
          <div style={{ fontSize: 22, fontWeight: 700 }}>📊 Box score</div>
          <span style={{ color: C.muted, fontSize: 14 }}>{g.note.replace(/ If Necessary/, "")} · {fin ? "Final" : g.status === "LIVE" ? window.MLB.inningText(g) : window.MLB.when(g)}{g.venue ? " · 📍 " + g.venue : ""}</span>
          <button onClick={onClose} style={{ marginLeft: "auto", border: "none", borderRadius: 10, padding: "8px 14px", fontSize: 16, fontWeight: 700, cursor: "pointer", background: "rgba(255,255,255,.12)", color: "#fff", fontFamily: "inherit" }}>✕ Close</button>
        </div>
        {g.status !== "PRE" && <div style={{ marginBottom: 10 }}><BigScore g={g} res={res} isPhone={true} /><div style={{ marginTop: 8 }}><Linescore g={g} res={res} /></div></div>}
        {fin && g.wp && <div style={{ fontSize: 14, color: "#dfe6ff", marginBottom: 10 }}>🏅 Winning pitcher: {g.wp} · 😞 Losing pitcher: {g.lp}{g.sv ? " · 🔒 Save: " + g.sv : ""}</div>}
        {g.status === "PRE" && <div style={{ fontSize: 16, color: C.muted }}>This game hasn't started yet. Starting pitchers: {g.asp || "TBA"} vs {g.hsp || "TBA"}.</div>}
        {st.loading && !b && g.status !== "PRE" && <div style={{ color: C.muted }}>Loading the box score…</div>}
        {st.err && <div style={{ color: C.muted }}>Couldn't load the box score from ESPN right now.</div>}
        {b && b.scoring.length > 0 && (
          <Section title="⚾ How the runs scored">
            {b.scoring.map((p, i) => <div key={i} style={{ fontSize: 14.5, padding: "5px 0", borderTop: i ? "1px solid " + C.line : "none" }}><b style={{ color: C.gold }}>{p.half === "Top" ? "Top" : "Bottom"} {p.inn.replace(" Inning", "")}</b> · {p.text} <span style={{ color: C.muted }}>({g.away} {p.away}, {g.home} {p.home})</span></div>)}
          </Section>
        )}
        {b && b.teams.length > 0 && (
          <div style={{ display: "grid", gap: 14, gridTemplateColumns: isPhone ? "1fr" : "1fr 1fr", marginTop: 12 }}>
            {b.teams.map((t) => (
              <div key={t.abbr}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}><Logo t={t.abbr} res={res} size={30} /><b style={{ fontSize: 18 }}>{nameOf(res, t.abbr)}</b></div>
                {table(t.batting, ["AB", "R", "H", "RBI", "HR", "BB", "K"], "Batters")}
                {table(t.pitching, ["IP", "H", "R", "ER", "BB", "K"], "Pitchers")}
              </div>
            ))}
          </div>
        )}
        <div style={{ fontSize: 12.5, color: C.muted, marginTop: 10, lineHeight: 1.5 }}>
          <b>What the letters mean:</b> AB = times at bat · R = runs · H = hits · RBI = runs batted in · HR = home runs · BB = walks · K = strikeouts · IP = innings pitched · ER = earned runs
        </div>
      </div>
    </div>
  );
}

/* ---------------- One series, every game (tap a series card) ---------------- */
function SeriesSheet({ s, res, feed, onClose, onBox, isPhone }) {
  const M = window.MLB;
  React.useEffect(() => { const h = (e) => { if (e.key === "Escape") onClose(); }; window.addEventListener("keydown", h); return () => window.removeEventListener("keydown", h); }, [onClose]);
  const R = s.round;
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(4,10,24,.78)", zIndex: 50, display: "grid", placeItems: "center", padding: isPhone ? 8 : 30 }}>
      <div onClick={(e) => e.stopPropagation()} className="pop" style={{ background: "#10244a", border: "2px solid " + C.gold, borderRadius: 22, width: "min(900px, 100%)", maxHeight: "100%", overflow: "auto", padding: isPhone ? 12 : 22 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
          <div style={{ fontSize: 22, fontWeight: 700 }}>📅 {s.rd === "WS" ? "World Series" : s.lg + " " + R.name}: every game</div>
          <button onClick={onClose} style={{ marginLeft: "auto", border: "none", borderRadius: 10, padding: "8px 14px", fontSize: 16, fontWeight: 700, cursor: "pointer", background: "rgba(255,255,255,.12)", color: "#fff", fontFamily: "inherit" }}>✕ Close</button>
        </div>
        <SeriesCard s={s} res={res} big />
        <div style={{ fontSize: 14, color: "#dfe6ff", margin: "12px 0 6px" }}>
          Up to <b>{R.best}</b> games. The first team to <b style={{ color: C.gold }}>{R.need} wins</b> moves on, so games marked "if needed" might never be played.
        </div>
        <div style={{ display: "grid", gap: 8 }}>
          {s.games.map((g) => {
            const host = M.gameHost(res, feed, s, g);
            const fin = g.status === "FINAL", lv = g.status === "LIVE" || g.status === "DELAY";
            const skipped = s.winner && !fin;
            const winner = fin ? (g.hr > g.ar ? g.home : g.away) : null;
            return (
              <div key={g.id} style={{ display: "grid", gridTemplateColumns: isPhone ? "64px 1fr" : "84px 1.3fr 1.3fr 1fr auto", gap: 10, alignItems: "center", background: lv ? "rgba(226,71,59,.16)" : "rgba(255,255,255,.06)", borderRadius: 14, padding: "10px 12px", opacity: skipped ? 0.4 : 1 }}>
                <div>
                  <div style={{ fontSize: 17, fontWeight: 700 }}>Game {g.gn}</div>
                  {g.ifnec && <div style={{ fontSize: 11.5, color: C.muted }}>{skipped ? "not needed 🚫" : "if needed"}</div>}
                </div>
                <div style={{ fontSize: 14.5 }}>🗓️ {M.when(g)}</div>
                <div style={{ fontSize: 14.5 }}>📍 {host.team ? nameOf(res, host.team) + " home · " : ""}{g.venue || host.text}</div>
                <div style={{ fontSize: 14, color: C.muted }}>📺 {g.tv || "TBA"}</div>
                <div style={{ textAlign: "right", fontWeight: 700 }}>
                  {fin ? <span>{winner && <Logo t={winner} res={res} size={22} style={{ display: "inline-grid", verticalAlign: "middle", marginRight: 6 }} />}{g.away} {g.ar}–{g.hr} {g.home}</span>
                    : lv ? <span style={{ color: "#ffc1bb" }}><LiveDot /> {g.away} {g.ar ?? 0}–{g.hr ?? 0} {g.home}</span> : null}
                  {(fin || lv) && onBox && <button onClick={() => onBox(g)} style={{ marginLeft: 8, border: "none", borderRadius: 8, padding: "3px 8px", fontSize: 12, fontWeight: 700, cursor: "pointer", background: "rgba(244,183,64,.2)", color: C.gold, fontFamily: "inherit" }}>📊</button>}
                </div>
              </div>
            );
          })}
        </div>
        <div style={{ fontSize: 12.5, color: C.muted, marginTop: 10, lineHeight: 1.5 }}>
          MLB sets exact start times for later games once the round before is finished. Until a team is decided, 📍 shows the possible cities using the home-field pattern
          ({s.rd === "WC" ? "all 3 games at the higher seed" : s.rd === "DS" ? "games 1, 2 and 5 at the higher seed" : "games 1, 2, 6 and 7 at the " + (s.rd === "WS" ? "team with the better record" : "higher seed")}).
        </div>
      </div>
    </div>
  );
}
