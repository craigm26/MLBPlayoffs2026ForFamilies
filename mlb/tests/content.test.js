// Quiz/fact/map data sanity: a bad answer index or a missing ballpark shows up here, not on the TV.
const test = require("node:test");
const assert = require("node:assert");
const F = require("../mlb-facts.js");
const MAP = require("../mlb-map.js");
const MLB = require("../mlb-data.js");

test("every quiz answer points at a real choice", () => {
  assert.ok(F.QUIZ.length >= 20);
  for (const q of F.QUIZ) {
    assert.ok(q.a >= 0 && q.a < q.c.length, q.q);
    assert.ok(q.why && q.why.length > 5, q.q);
  }
});

test("every 2026 playoff team has 3 facts and a ballpark on the map", () => {
  for (const t of MLB.SEEDS_2026.AL.concat(MLB.SEEDS_2026.NL)) {
    assert.strictEqual((F.TEAM[t] || []).length, 3, t);
    const p = MAP.parks[t];
    assert.ok(p && p.x > 0 && p.x < MAP.W && p.y > 0 && p.y < MAP.H, t);
  }
  assert.strictEqual(Object.keys(MAP.parks).length, 30);
});
