/* MLB Playoffs family hub — data + bracket engine (plain JS, no Babel).
   Browser: defines window.MLB. Node: module.exports = MLB (tests/).
   Everything the UI shows about "who is winning a series" comes from resolve(). */
(function (root) {
  "use strict";

  // How long each round is. `need` = wins to take the series ("first to N").
  var ROUNDS = {
    WC: { id: "WC", name: "Wild Card Series", short: "Wild Card", best: 3, need: 2, pts: 1, step: 1 },
    DS: { id: "DS", name: "Division Series", short: "Division Series", best: 5, need: 3, pts: 2, step: 2 },
    CS: { id: "CS", name: "Championship Series", short: "Championship", best: 7, need: 4, pts: 4, step: 3 },
    WS: { id: "WS", name: "World Series", short: "World Series", best: 7, need: 4, pts: 8, step: 4 },
  };
  var ROUND_ORDER = ["WC", "DS", "CS", "WS"];

  // The fixed MLB bracket (since 2022): seeds 1 & 2 skip the Wild Card round.
  // #1 plays the 4-v-5 winner, #2 plays the 3-v-6 winner.
  // A slot is either {seed:n} or {from:"seriesId"} (the winner of that series).
  var SERIES = [];
  ["AL", "NL"].forEach(function (lg) {
    SERIES.push({ id: lg + "WC1", lg: lg, rd: "WC", top: { seed: 4 }, bot: { seed: 5 } });
    SERIES.push({ id: lg + "WC2", lg: lg, rd: "WC", top: { seed: 3 }, bot: { seed: 6 } });
    SERIES.push({ id: lg + "DS1", lg: lg, rd: "DS", top: { seed: 1 }, bot: { from: lg + "WC1" } });
    SERIES.push({ id: lg + "DS2", lg: lg, rd: "DS", top: { seed: 2 }, bot: { from: lg + "WC2" } });
    SERIES.push({ id: lg + "CS", lg: lg, rd: "CS", top: { from: lg + "DS1" }, bot: { from: lg + "DS2" } });
  });
  SERIES.push({ id: "WS", lg: "WS", rd: "WS", top: { from: "ALCS" }, bot: { from: "NLCS" } });
  var BY_ID = {};
  SERIES.forEach(function (s) { BY_ID[s.id] = s; });

  var LEAGUE = { AL: "American League", NL: "National League", WS: "World Series" };

  // Fallback seeds (ESPN standings, 2026-09-28) so the bracket draws even before
  // live.json loads. live.json's `seeds` always wins.
  var SEEDS_2026 = {
    AL: ["TB", "CLE", "HOU", "NYY", "BOS", "CHW"],
    NL: ["MIL", "LAD", "ATL", "SD", "CHC", "PHI"],
  };
  var TEAMS_2026 = {
    TB: { name: "Tampa Bay Rays", short: "Rays", city: "Tampa Bay", color: "#092c5c", alt: "#8fbce6" },
    CLE: { name: "Cleveland Guardians", short: "Guardians", city: "Cleveland", color: "#002b5c", alt: "#e31937" },
    HOU: { name: "Houston Astros", short: "Astros", city: "Houston", color: "#002d62", alt: "#eb6e1f" },
    NYY: { name: "New York Yankees", short: "Yankees", city: "New York", color: "#132448", alt: "#c4ced4" },
    BOS: { name: "Boston Red Sox", short: "Red Sox", city: "Boston", color: "#0d2b56", alt: "#bd3039" },
    CHW: { name: "Chicago White Sox", short: "White Sox", city: "Chicago", color: "#000000", alt: "#c4ced4" },
    MIL: { name: "Milwaukee Brewers", short: "Brewers", city: "Milwaukee", color: "#13294b", alt: "#ffc72c" },
    LAD: { name: "Los Angeles Dodgers", short: "Dodgers", city: "Los Angeles", color: "#005a9c", alt: "#ffffff" },
    ATL: { name: "Atlanta Braves", short: "Braves", city: "Atlanta", color: "#0c2340", alt: "#ba0c2f" },
    SD: { name: "San Diego Padres", short: "Padres", city: "San Diego", color: "#2f241d", alt: "#ffc425" },
    CHC: { name: "Chicago Cubs", short: "Cubs", city: "Chicago", color: "#0e3386", alt: "#cc3433" },
    PHI: { name: "Philadelphia Phillies", short: "Phillies", city: "Philadelphia", color: "#e81828", alt: "#003278" },
  };

  function seedsOf(feed) {
    var s = feed && feed.seeds;
    if (s && s.AL && s.NL && s.AL.length === 6 && s.NL.length === 6) {
      return { AL: s.AL.map(function (x) { return x.t || x; }), NL: s.NL.map(function (x) { return x.t || x; }) };
    }
    return SEEDS_2026;
  }
  function recordsOf(feed) {
    var out = {}, s = feed && feed.seeds;
    if (s) ["AL", "NL"].forEach(function (lg) { (s[lg] || []).forEach(function (x) { if (x && x.t) out[x.t] = x.w + "-" + x.l; }); });
    return out;
  }
  function teamsOf(feed) {
    var t = {}, k;
    for (k in TEAMS_2026) t[k] = TEAMS_2026[k];
    if (feed && feed.teams) for (k in feed.teams) t[k] = Object.assign({}, t[k] || {}, feed.teams[k]);
    return t;
  }

  function isPair(g, a, b) {
    return (g.home === a && g.away === b) || (g.home === b && g.away === a);
  }

  /* resolve(feed) -> { series: {id: S}, seeds, teams, champion, alive:{team:bool} }
     S = { id, lg, rd, round, top, bot, topSeed, botSeed, wins:{team:n}, games:[...],
           winner, loser, done, started, live, next, need, best, placeholder:{top,bot} } */
  function resolve(feed) {
    var seeds = seedsOf(feed);
    var games = (feed && Array.isArray(feed.games)) ? feed.games : [];
    var out = {};
    var seedOf = {};
    ["AL", "NL"].forEach(function (lg) { seeds[lg].forEach(function (t, i) { seedOf[t] = i + 1; }); });

    SERIES.forEach(function (def) {
      var R = ROUNDS[def.rd];
      function slot(sl) {
        if (sl.seed) return seeds[def.lg][sl.seed - 1] || null;
        var f = out[sl.from];
        return f && f.winner ? f.winner : null;
      }
      var top = slot(def.top), bot = slot(def.bot);
      // Games that belong to this series: same league+round, and (when a team is known)
      // it must involve that team. CS/WS are the only series in their round, so the
      // placeholder "TBD @ TBD" rows belong to them even before teams are known.
      var mine = games.filter(function (g) {
        if (g.rd !== def.rd || (g.lg !== def.lg && def.rd !== "WS")) return false;
        if (def.rd === "CS" || def.rd === "WS") return true;
        var known = [top, bot].filter(Boolean);
        if (!known.length) return false;
        return known.indexOf(g.home) >= 0 || known.indexOf(g.away) >= 0;
      }).sort(function (a, b) { return (a.gn || 0) - (b.gn || 0) || String(a.date).localeCompare(String(b.date)); });

      var wins = {};
      if (top) wins[top] = 0;
      if (bot) wins[bot] = 0;
      var finals = [];
      mine.forEach(function (g) {
        if (g.status !== "FINAL" || g.hr == null || g.ar == null) return;
        if (top && bot && !isPair(g, top, bot)) return;
        var w = g.hr > g.ar ? g.home : g.away;
        if (w in wins) { wins[w]++; finals.push(g); }
      });
      var winner = null;
      if (top && bot) {
        if (wins[top] >= R.need) winner = top;
        else if (wins[bot] >= R.need) winner = bot;
      }
      var live = mine.filter(function (g) { return g.status === "LIVE" || g.status === "DELAY"; })[0] || null;
      // Next game: the first not-final game that is still needed. Once a series is
      // decided, the "If Necessary" games are simply not played.
      var next = null;
      if (!winner) {
        next = mine.filter(function (g) { return g.status === "PRE" || g.status === "PPD"; })[0] || null;
      }
      out[def.id] = {
        id: def.id, lg: def.lg, rd: def.rd, round: R, need: R.need, best: R.best,
        top: top, bot: bot, topSeed: seedOf[top] || null, botSeed: seedOf[bot] || null,
        topFrom: def.top.from || null, botFrom: def.bot.from || null,
        wins: wins, games: mine, finals: finals,
        winner: winner, loser: winner ? (winner === top ? bot : top) : null,
        done: !!winner, started: finals.length > 0 || !!live, live: live, next: next,
      };
    });

    var alive = {};
    ["AL", "NL"].forEach(function (lg) { seeds[lg].forEach(function (t) { alive[t] = true; }); });
    SERIES.forEach(function (d) { var s = out[d.id]; if (s.loser) alive[s.loser] = false; });
    // GitHub Pages has no logos/ folder (team marks aren't ours to redistribute): use ESPN's CDN there.
    return { series: out, seeds: seeds, teams: teamsOf(feed), records: recordsOf(feed), champion: out.WS.winner, alive: alive, seedOf: seedOf,
      logoCDN: !!(feed && feed.source === "espn-browser") };
  }

  // Who could still show up in an empty slot ("Yankees or Red Sox").
  function slotOptions(res, seriesId, side) {
    var def = BY_ID[seriesId];
    var sl = def[side];
    if (sl.seed) return [res.seeds[def.lg][sl.seed - 1]];
    var f = res.series[sl.from];
    if (f.winner) return [f.winner];
    var a = f.top ? [f.top] : slotOptions(res, sl.from, "top");
    var b = f.bot ? [f.bot] : slotOptions(res, sl.from, "bot");
    return a.concat(b);
  }

  // "Rays series winner" / "AL champion" — for an empty slot 2+ rounds out.
  function feederLabel(res, seriesId, side, name) {
    var def = BY_ID[seriesId], sl = def[side];
    if (!sl.from) return null;
    var f = BY_ID[sl.from];
    if (f.rd === "CS") return f.lg + " champion";
    var ft = res.series[sl.from].top;
    return ft ? name(ft) + " series winner" : "Winner";
  }

  /* Kid-friendly sentence about where a series stands. `name(t)` → display name. */
  function story(s, name) {
    var n = s.need;
    if (!s.top || !s.bot) return "First team to win " + n + " game" + (n > 1 ? "s" : "") + " moves on!";
    var A = s.top, B = s.bot, wa = s.wins[A], wb = s.wins[B];
    var nextName = s.rd === "WS" ? "" : (s.rd === "CS" ? "the World Series" : ROUNDS[ROUND_ORDER[ROUND_ORDER.indexOf(s.rd) + 1]].name);
    if (s.winner) {
      var W = s.winner, L = s.loser;
      var sc = s.wins[W] + "–" + s.wins[L];
      if (s.rd === "WS") return "🏆 The " + name(W) + " won the World Series " + sc + "! They're the CHAMPIONS!";
      return "✅ The " + name(W) + " won " + sc + " and move on to " + nextName + "!";
    }
    if (wa === 0 && wb === 0) return "First team to win " + n + " games moves on. Nobody has won yet!";
    if (wa === n - 1 && wb === n - 1) return "😱 Tied " + wa + "–" + wb + "! The next game decides EVERYTHING. Winner moves on!";
    var lead = wa > wb ? A : wb > wa ? B : null;
    if (!lead) return "Tied " + wa + "–" + wb + ". Each team needs " + (n - wa) + " more win" + (n - wa > 1 ? "s" : "") + ".";
    var other = lead === A ? B : A;
    var left = n - s.wins[lead], oleft = n - s.wins[other];
    if (left === 1) return "⭐ The " + name(lead) + " need just 1 more win! The " + name(other) + " need " + oleft + " in a row to stay alive.";
    return "The " + name(lead) + " lead " + s.wins[lead] + "–" + s.wins[other] + ". They need " + left + " more wins; the " + name(other) + " need " + oleft + ".";
  }

  /* What tonight's game means — "If the Yankees win, they move on. If the Red Sox win, there's a Game 3." */
  function stakes(s, name) {
    if (!s.top || !s.bot || s.winner) return null;
    var n = s.need, A = s.top, B = s.bot;
    var to = { WC: "the Division Series", DS: "the Championship Series", CS: "the WORLD SERIES" }[s.rd];
    function one(t, o) {
      if (s.wins[t] + 1 >= n) return s.rd === "WS" ? "If the " + name(t) + " win, they're WORLD CHAMPIONS! 🏆" : "If the " + name(t) + " win, they're going to " + to + "! 🎉";
      if (s.wins[o] === n - 1) return "If the " + name(t) + " win, the series keeps going.";
      return "If the " + name(t) + " win, they'll need " + (n - s.wins[t] - 1) + " more.";
    }
    return [one(A, B), one(B, A)];
  }

  /* ---- family pick'em ----
     picks[playerId][seriesId] = team. A later-round pick is only sensible if it is
     one of that player's own picked (or actual) teams for the feeders. */
  function pickOptions(res, seriesId, myPicks) {
    var def = BY_ID[seriesId], s = res.series[seriesId];
    function side(sl, actual) {
      if (actual) return actual;
      if (sl.seed) return res.seeds[def.lg][sl.seed - 1];
      return (myPicks && myPicks[sl.from]) || null;
    }
    return [side(def.top, s.top), side(def.bot, s.bot)];
  }
  function locked(s) {
    return !!(s.started || s.done);
  }
  function score(res, myPicks) {
    var pts = 0, right = 0, wrong = 0, possible = 0;
    SERIES.forEach(function (d) {
      var s = res.series[d.id], p = myPicks && myPicks[d.id];
      if (!p) return;
      if (s.winner) { if (s.winner === p) { pts += s.round.pts; right++; } else wrong++; }
      else if (res.alive[p] !== false) possible += s.round.pts;
    });
    return { pts: pts, right: right, wrong: wrong, maxLeft: possible };
  }

  /* ---- time helpers (display in the viewer's own zone) ---- */
  function when(g) {
    if (!g || !g.date) return "";
    var d = new Date(g.date);
    var day = d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
    if (g.timeTBD) return day + " · time TBA";
    return day + " · " + d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  }
  function dayKey(g) {
    var d = new Date(g.date);
    if (g.timeTBD) d = new Date(d.getTime() + 12 * 3600e3); // 04:00Z placeholder = that US date
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  }
  function ordinal(n) {
    var s = ["th", "st", "nd", "rd"], v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
  }
  function inningText(g) {
    if (!g) return "";
    var d = String(g.detail || "");
    var m = d.match(/^(Top|Bot|Bottom|Mid|Middle|End)\s+(\d+)/i);
    if (m) {
      var w = m[1].toLowerCase();
      var half = w === "top" ? "Top" : (w === "mid" || w === "middle") ? "Middle" : w === "end" ? "End" : "Bottom";
      return half + " of the " + ordinal(+m[2]);
    }
    return d;
  }

  /* Where is this game? ESPN leaves home = null until a team is decided, so fill it in from
     MLB's home-field patterns: Wild Card all 3 at the higher seed; Division Series 2-2-1;
     Championship + World Series 2-3-2. (Higher seed = better seed in the LCS; better record
     in the World Series.) Returns { team, options, text } — text is ready to print. */
  var HIGH_HOSTS = { WC: [1, 2, 3], DS: [1, 2, 5], CS: [1, 2, 6, 7], WS: [1, 2, 6, 7] };
  function cityOf(res, feed, t) {
    var gs = (feed && feed.games) || [];
    for (var i = 0; i < gs.length; i++) if (gs[i].home === t && gs[i].city) return gs[i].city;
    return (res.teams[t] && res.teams[t].city) || t;
  }
  function betterOf(res, s) {
    if (!s.top || !s.bot) return null;
    if (s.rd !== "WS") return (s.topSeed || 9) <= (s.botSeed || 9) ? s.top : s.bot;
    var pct = function (t) { var r = (res.records[t] || "").split("-"); return r.length === 2 ? +r[0] / (+r[0] + +r[1]) : 0; };
    return pct(s.top) >= pct(s.bot) ? s.top : s.bot;
  }
  function gameHost(res, feed, s, g) {
    if (g.home) return { team: g.home, options: [g.home], text: g.city || cityOf(res, feed, g.home) };
    var highHome = HIGH_HOSTS[s.rd].indexOf(g.gn) >= 0;
    var hi = betterOf(res, s);
    if (hi) { var t = highHome ? hi : (hi === s.top ? s.bot : s.top); return { team: t, options: [t], text: cityOf(res, feed, t) }; }
    // Division Series: the rested #1/#2 seed is known; the other side is a Wild Card winner.
    if (s.rd === "DS" && s.top) {
      if (highHome) return { team: s.top, options: [s.top], text: cityOf(res, feed, s.top) };
      var opts = slotOptions(res, s.id, "bot");
      return { team: null, options: opts, text: opts.map(function (o) { return cityOf(res, feed, o); }).join(" or ") };
    }
    var who = s.rd === "WS" ? "team with the better record" : "higher seed";
    return { team: null, options: [], text: "home of the " + (highHome ? who : (s.rd === "WS" ? "other team" : "lower seed")) };
  }

  function logoUrl(res, t) {
    var tm = res && res.teams && res.teams[t];
    return res && res.logoCDN && tm && tm.logo ? tm.logo : "logos/" + t + ".png";
  }

  var MLB = {
    ROUNDS: ROUNDS, ROUND_ORDER: ROUND_ORDER, SERIES: SERIES, BY_ID: BY_ID, LEAGUE: LEAGUE,
    SEEDS_2026: SEEDS_2026, TEAMS_2026: TEAMS_2026,
    resolve: resolve, logoUrl: logoUrl, gameHost: gameHost, HIGH_HOSTS: HIGH_HOSTS, slotOptions: slotOptions, feederLabel: feederLabel, story: story, stakes: stakes,
    pickOptions: pickOptions, locked: locked, score: score,
    when: when, dayKey: dayKey, ordinal: ordinal, inningText: inningText,
  };
  if (typeof module !== "undefined" && module.exports) module.exports = MLB;
  else root.MLB = MLB;
})(typeof window !== "undefined" ? window : this);
