/* In-browser ESPN feed — the same live.json shape update_mlb.py writes, built client-side.
   Used when there is no live.json (GitHub Pages has no updater and we don't run Actions).
   ESPN's scoreboard sends Access-Control-Allow-Origin: *, so a browser can read it directly.
   Days whose games are all Final are cached in localStorage and never re-fetched. */
(function (root) {
  "use strict";
  var BOARD = "https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/scoreboard?dates=";
  var STAND = "https://site.api.espn.com/apis/v2/sports/baseball/mlb/standings?season=";
  var WINDOWS = { 2025: ["2025-09-30", "2025-11-02"], 2026: ["2026-09-29", "2026-11-07"] };
  var CACHE = "mlb26espn";

  function realTeam(ab) { return ab && ab !== "TBD" && ab.indexOf("/") < 0 && ab.length <= 4 ? ab : null; }
  function roundOf(h) {
    h = (h || "").toUpperCase();
    var r = ["WC", "DS", "CS"], l = ["AL", "NL"];
    for (var i = 0; i < 3; i++) for (var j = 0; j < 2; j++) if (h.indexOf(l[j] + r[i]) === 0) return [l[j], r[i]];
    if (h.indexOf("WORLD SERIES") === 0) return ["WS", "WS"];
    return null;
  }
  function gameNo(h) { var m = /Game\s+(\d+)/.exec(h || ""); return m ? +m[1] : null; }
  function ath(x) { var a = (x && x.athlete) || {}; return a.shortName || a.displayName || null; }

  function normEvent(e, teams) {
    var c = e.competitions[0];
    var notes = (c.notes || []).map(function (n) { return n.headline; }).filter(Boolean);
    var head = notes[0] || "", rr = roundOf(head);
    if (!rr) return null;
    var st = c.status || e.status || {}, stt = st.type || {};
    var status = stt.completed ? "FINAL" : stt.state === "in" ? "LIVE" : "PRE";
    if (["STATUS_POSTPONED", "STATUS_SUSPENDED", "STATUS_DELAYED", "STATUS_RAIN_DELAY"].indexOf(stt.name) >= 0) status = stt.state === "in" ? "DELAY" : "PPD";
    var side = {};
    (c.competitors || []).forEach(function (comp) {
      var t = comp.team || {}, ab = realTeam(t.abbreviation), pre = status === "PRE";
      if (ab && !teams[ab]) teams[ab] = { name: t.displayName, short: t.shortDisplayName || t.name, city: t.location, color: "#" + (t.color || "444444"), alt: "#" + (t.alternateColor || "ffffff"), logo: t.logo };
      var probs = comp.probables || [];
      side[comp.homeAway] = {
        t: ab, r: !pre && /^\d+$/.test(String(comp.score)) ? +comp.score : null,
        h: pre ? null : comp.hits, e: pre ? null : comp.errors,
        ls: pre ? [] : (comp.linescores || []).map(function (l) { return +(l.value || 0); }),
        sp: probs.length ? ath(probs[0]) : null,
      };
    });
    var H = side.home || {}, A = side.away || {}, v = c.venue || {};
    var tv = {};
    (c.broadcasts || []).forEach(function (b) { (b.names || []).forEach(function (n) { tv[n] = 1; }); });
    var g = {
      id: e.id, date: e.date, lg: rr[0], rd: rr[1], gn: gameNo(head), note: head,
      ifnec: /necessary/i.test(head), timeTBD: c.timeValid === false || /T04:00Z$/.test(e.date || ""),
      status: status, detail: stt.shortDetail, inning: st.period,
      home: H.t || null, away: A.t || null, hr: H.r, ar: A.r, hh: H.h, ah: A.h, he: H.e, ae: A.e,
      hls: H.ls || [], als: A.ls || [], hsp: H.sp, asp: A.sp,
      tv: Object.keys(tv).sort().join(", ") || null, venue: v.fullName, city: (v.address || {}).city,
      series: (c.series || {}).summary,
    };
    if (status === "LIVE") {
      var s = c.situation || {};
      g.sit = { b: s.balls, s: s.strikes, o: s.outs, on: [!!s.onFirst, !!s.onSecond, !!s.onThird], bat: ath(s.batter), pit: ath(s.pitcher), last: (s.lastPlay || {}).text };
    }
    if (status === "FINAL") {
      var fa = {};
      (st.featuredAthletes || []).forEach(function (f) { fa[f.name] = ath(f); });
      g.wp = fa.winningPitcher; g.lp = fa.losingPitcher; g.sv = fa.savingPitcher;
    }
    return g;
  }

  function ymd(d) { return d.getUTCFullYear() + String(d.getUTCMonth() + 1).padStart(2, "0") + String(d.getUTCDate()).padStart(2, "0"); }
  function getJSON(url) { return fetch(url, { cache: "no-store" }).then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); }); }

  function loadCache(season) {
    try { var c = JSON.parse(localStorage.getItem(CACHE)); if (c && c.season === season) return c; } catch (e) {}
    return { season: season, days: {}, teams: {}, seeds: null };
  }
  function saveCache(c) { try { localStorage.setItem(CACHE, JSON.stringify(c)); } catch (e) {} }

  function seedsFor(year) {
    return getJSON(STAND + year).then(function (d) {
      var out = {};
      (d.children || []).forEach(function (lg) {
        var key = /American/.test(lg.name || "") ? "AL" : "NL", rows = [];
        (lg.children || [lg]).forEach(function (div) {
          ((div.standings || {}).entries || []).forEach(function (en) {
            var s = {};
            (en.stats || []).forEach(function (x) { s[x.name] = x.value; });
            if (s.playoffSeed >= 1 && s.playoffSeed <= 6) rows.push([+s.playoffSeed, en.team.abbreviation, +s.wins || 0, +s.losses || 0]);
          });
        });
        rows.sort(function (a, b) { return a[0] - b[0]; });
        if (rows.length === 6) out[key] = rows.map(function (r) { return { t: r[1], w: r[2], l: r[3] }; });
      });
      return out.AL && out.NL ? out : null;
    });
  }

  /* buildFeed(season) -> Promise<feed>. Same fetch-skip rules as update_mlb.py. */
  function buildFeed(season) {
    season = season || 2026;
    var cache = loadCache(season), win = WINDOWS[season];
    var start = new Date(win[0] + "T00:00:00Z"), end = new Date(win[1] + "T00:00:00Z");
    var now = new Date(), today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
    var jobs = [];
    for (var d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
      (function (key, delta) {
        var cached = cache.days[key];
        var near = delta >= -1 && delta <= 3;
        var done = cached && cached.length && cached.every(function (g) { return g.status === "FINAL"; });
        var pastEmpty = cached && cached.length === 0 && delta < -1;
        var farKnown = delta > 3 && cached;
        if (near || !(done || pastEmpty || farKnown)) {
          jobs.push(getJSON(BOARD + key).then(function (b) {
            var games = [];
            (b.events || []).forEach(function (e) { var g = normEvent(e, cache.teams); if (g) games.push(g); });
            cache.days[key] = games;
          }).catch(function () { /* keep the cached day */ }));
        }
      })(ymd(d), Math.round((d.getTime() - today) / 864e5));
    }
    if (!cache.seeds) jobs.push(seedsFor(season).then(function (s) { if (s) cache.seeds = s; }).catch(function () {}));
    return Promise.all(jobs).then(function () {
      saveCache(cache);
      var games = [];
      Object.keys(cache.days).sort().forEach(function (k) { games = games.concat(cache.days[k]); });
      games.sort(function (a, b) { return String(a.date).localeCompare(String(b.date)); });
      return { season: season, updated: new Date().toISOString(), seeds: cache.seeds, teams: cache.teams, games: games, source: "espn-browser" };
    });
  }

  var API = { buildFeed: buildFeed, normEvent: normEvent };
  if (typeof module !== "undefined" && module.exports) module.exports = API;
  else root.MLBESPN = API;
})(typeof window !== "undefined" ? window : this);
