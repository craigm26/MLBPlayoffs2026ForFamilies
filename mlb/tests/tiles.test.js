// The wall poster is taped together from Letter sheets and colored in by small kids:
// every series box (its win-dots + write-in lines) must sit wholly inside ONE sheet,
// at least SAFE inches from that sheet's edges, for any poster size we allow.
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const vm = require("vm");

function load() {
  const window = { MLB: require("../mlb-data.js"), MLBFACTS: require("../mlb-facts.js"), MLBMAP: require("../mlb-map.js") };
  const ctx = { window, location: { host: "test", pathname: "/" }, Intl, console };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(__dirname + "/../print.js", "utf8"), ctx);
  return window;
}

test("every fillable box sits inside a single sheet, 0.4in+ from its edges", () => {
  const w = load(), P = w.MLBPrint;
  const feed = require("./fixture-2026-schedule.json");
  const res = w.MLB.resolve(feed);
  for (const [W, H] of [[49, 33], [36, 24], [56, 40], [42, 30], [60, 36]]) {
    const G = P.tileGrid(W, H);
    assert.ok(!G.error, W + "x" + H);
    assert.strictEqual(G.cols, 7);
    P.kidPoster(res, { mode: "blank" }, G);
    const boxes = P.kidPoster.lastBoxes;
    assert.strictEqual(Object.keys(boxes).length, 11);
    for (const [id, b] of Object.entries(boxes)) {
      const c = Math.floor(b.x / G.tw), r = Math.floor(b.y / G.th);
      const left = b.x - c * G.tw, right = (c + 1) * G.tw - (b.x + b.w);
      const topM = b.y - r * G.th, bot = (r + 1) * G.th - (b.y + b.h + 0.75); // + caption
      for (const m of [left, right, topM, bot]) assert.ok(m >= 0.4, `${W}x${H} ${id} margin ${m.toFixed(2)}`);
    }
  }
});

test("49x33 = 7 portrait sheets across x 4 down", () => {
  const G = load().MLBPrint.tileGrid(49, 33);
  assert.deepStrictEqual([G.cols, G.rows, G.orient], [7, 4, "portrait"]);
});
