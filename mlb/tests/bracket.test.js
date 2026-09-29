// node --test tests/  — the bracket engine against the real 2025 postseason + the 2026 schedule.
const test = require("node:test");
const assert = require("node:assert");
const MLB = require("../mlb-data.js");
const f25 = require("./fixture-2025.json");
const nm = (t) => t;

test("2025: every series resolves to the real winner", () => {
  const r = MLB.resolve(f25);
  const want = { ALWC1: "NYY", ALWC2: "DET", NLWC1: "CHC", NLWC2: "LAD", ALDS1: "TOR", ALDS2: "SEA",
    NLDS1: "MIL", NLDS2: "LAD", ALCS: "TOR", NLCS: "LAD", WS: "LAD" };
  for (const [id, w] of Object.entries(want)) assert.strictEqual(r.series[id].winner, w, id);
  assert.strictEqual(r.champion, "LAD");
  assert.deepStrictEqual(r.series.WS.wins, { TOR: 3, LAD: 4 });
  assert.deepStrictEqual(r.series.NLCS.wins, { MIL: 0, LAD: 4 });
  assert.strictEqual(r.alive.NYY, false);
  assert.strictEqual(r.alive.LAD, true);
});

test("2025 mid-series: story + stakes read right for a 6-year-old", () => {
  const cut = (iso) => Object.assign({}, f25, { games: f25.games.map((g) => g.date < iso ? g : Object.assign({}, g, { status: "PRE", hr: null, ar: null })) });
  // After WS Game 6 (3-3): winner-take-all
  const r = MLB.resolve(cut("2025-11-02"));
  const ws = r.series.WS;
  assert.strictEqual(ws.winner, null);
  assert.match(MLB.story(ws, nm), /Tied 3–3.*decides EVERYTHING/);
  const st = MLB.stakes(ws, nm);
  assert.ok(st.every((x) => /WORLD CHAMPIONS/.test(x)));
  assert.strictEqual(ws.next.gn, 7);
  // WC round after game 1 of each: nobody through; the If-Necessary Game 3 is still "next" only after game 2
  const r1 = MLB.resolve(cut("2025-10-01T12:00"));
  assert.strictEqual(r1.series.ALWC1.wins.BOS, 1);
  assert.match(MLB.story(r1.series.ALWC1, nm), /BOS need just 1 more win/);
  assert.deepStrictEqual(MLB.stakes(r1.series.ALWC1, nm), ["If the NYY win, the series keeps going.", "If the BOS win, they're going to the Division Series! 🎉"]);
  // Sweep: LAD won the WC 2-0, so its Game 3 never shows as next
  assert.strictEqual(r1.series.NLWC2.winner, null);
  const r2 = MLB.resolve(cut("2025-10-02T12:00"));
  assert.strictEqual(r2.series.NLWC2.winner, "LAD");
  assert.strictEqual(r2.series.NLWC2.next, null);
});

test("2026 schedule: seeds, byes and placeholder games", () => {
  const f26 = require("./fixture-2026-schedule.json");
  const r = MLB.resolve(f26);
  assert.deepStrictEqual(r.seeds.AL, ["TB", "CLE", "HOU", "NYY", "BOS", "CHW"]);
  assert.strictEqual(r.series.ALWC1.top, "NYY");
  assert.strictEqual(r.series.ALWC2.bot, "CHW");
  assert.strictEqual(r.series.ALDS1.top, "TB");
  assert.strictEqual(r.series.ALDS1.bot, null);
  assert.deepStrictEqual(MLB.slotOptions(r, "ALDS1", "bot"), ["NYY", "BOS"]);
  assert.strictEqual(r.series.ALWC1.games.length, 3);
  assert.strictEqual(r.series.ALDS1.games.length, 5);
  assert.strictEqual(r.series.ALCS.games.length, 7);
  assert.strictEqual(r.series.WS.games.length, 7);
  assert.match(MLB.story(r.series.ALWC1, nm), /First team to win 2 games/);
});

test("pick'em scoring: bracket points double each round", () => {
  const r = MLB.resolve(f25);
  const s = MLB.score(r, { ALWC1: "NYY", ALDS1: "NYY", WS: "LAD", NLCS: "MIL" });
  assert.deepStrictEqual(s, { pts: 1 + 8, right: 2, wrong: 2, maxLeft: 0 });
  assert.deepStrictEqual(MLB.pickOptions(MLB.resolve(require("./fixture-2026-schedule.json")), "ALDS1", { ALWC1: "BOS" }), ["TB", "BOS"]);
});

test("every scheduled game has a place, even before teams are known", () => {
  const f26 = require("./fixture-2026-schedule.json");
  const r = MLB.resolve(f26);
  const where = (id, gn) => MLB.gameHost(r, f26, r.series[id], r.series[id].games.find((g) => g.gn === gn)).text;
  assert.strictEqual(where("ALWC1", 3), "Bronx");
  assert.strictEqual(where("ALDS1", 1), MLB.gameHost(r, f26, r.series.ALDS1, r.series.ALDS1.games[0]).text);
  assert.match(where("ALDS1", 3), / or /);            // Yankees' or Red Sox' city
  assert.match(where("ALCS", 1), /higher seed/);
  assert.match(where("ALCS", 3), /lower seed/);
  assert.match(where("WS", 1), /better record/);
  for (const d of MLB.SERIES) for (const g of r.series[d.id].games) assert.ok(MLB.gameHost(r, f26, r.series[d.id], g).text, d.id + g.gn);
  // once teams are known, the pattern names the real park (2025: TOR had the better WS record? LAD 93-69 vs TOR 94-68)
  const r25 = MLB.resolve(f25);
  const ws = r25.series.WS;
  const g1 = Object.assign({}, ws.games[0], { home: null, city: null });
  assert.strictEqual(MLB.gameHost(r25, f25, ws, g1).team, "TOR");
});
