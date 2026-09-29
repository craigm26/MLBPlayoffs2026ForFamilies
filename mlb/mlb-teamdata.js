/* Rosters, season stats, team leaders and box scores — fetched in the browser from ESPN
   (these endpoints send Access-Control-Allow-Origin: *). Season data is frozen once the
   playoffs start, so it's cached in localStorage for 12h; box scores of Final games forever. */
(function (root) {
  "use strict";
  var SITE = "https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/";
  var CORE = "https://sports.core.api.espn.com/v2/sports/baseball/leagues/mlb/";
  var mem = {};

  function getJSON(u) { return fetch(u).then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); }); }
  function cached(key, ttlMs, make) {
    if (mem[key]) return mem[key];
    try {
      var c = JSON.parse(localStorage.getItem(key));
      if (c && (ttlMs === Infinity || Date.now() - c.at < ttlMs)) return (mem[key] = Promise.resolve(c.v));
    } catch (e) {}
    mem[key] = make().then(function (v) {
      try { localStorage.setItem(key, JSON.stringify({ at: Date.now(), v: v })); } catch (e) {}
      return v;
    }, function (err) { delete mem[key]; throw err; });
    return mem[key];
  }
  function flat(cats) {
    var out = {};
    (cats || []).forEach(function (c) { out[c.name] = {}; (c.stats || []).forEach(function (s) { if (!(s.name in out[c.name])) out[c.name][s.name] = { v: s.value, d: s.displayValue }; }); });
    return out;
  }

  var LEADER_CATS = [
    ["homeRuns", "Home runs", "💥"], ["avg", "Batting average", "🏏"], ["RBIs", "Runs batted in", "🏃"], ["stolenBases", "Stolen bases", "💨"],
    ["wins", "Pitching wins", "🏅"], ["strikeouts", "Strikeouts", "✋"], ["ERA", "ERA (low = great)", "🎯"], ["saves", "Saves", "🔒"],
  ];

  function team(abbr, season) {
    var a = String(abbr).toLowerCase();
    return cached("mlb26team:" + abbr + ":" + season, 12 * 3600e3, function () {
      return Promise.all([getJSON(SITE + "teams/" + a + "/roster"), getJSON(SITE + "teams/" + a + "/statistics")]).then(function (rs) {
        var ro = rs[0], st = rs[1];
        var tid = (ro.team && ro.team.id) || (st.team && st.team.id);
        var byId = {}, groups = [], countries = {};
        (ro.athletes || []).forEach(function (g) {
          var items = (g.items || []).map(function (p) {
            var bp = p.birthPlace || {};
            var ctry = bp.country || "";
            if (ctry) countries[ctry] = (countries[ctry] || 0) + 1;
            var o = { id: p.id, name: p.displayName, short: p.shortName, num: p.jersey, pos: (p.position || {}).abbreviation, age: p.age,
              bats: (p.bats || {}).abbreviation, throws: (p.throws || {}).abbreviation, from: [bp.city, bp.state || (ctry !== "United States" ? ctry : "")].filter(Boolean).join(", "), country: ctry,
              photo: (p.headshot || {}).href || null, ht: p.displayHeight, wt: p.displayWeight };
            byId[p.id] = o;
            return o;
          });
          items.sort(function (x, y) { return (+x.num || 99) - (+y.num || 99); });
          groups.push({ name: g.position, players: items });
        });
        var stats = flat(((st.results || {}).stats || {}).categories);
        var lead = tid ? getJSON(CORE + "seasons/" + season + "/types/2/teams/" + tid + "/leaders").catch(function () { return null; }) : Promise.resolve(null);
        return lead.then(function (ld) {
          var leaders = [];
          if (ld && ld.categories) {
            LEADER_CATS.forEach(function (lc) {
              var c = ld.categories.filter(function (x) { return x.name === lc[0]; })[0];
              var top = c && c.leaders && c.leaders[0];
              if (!top) return;
              var m = /athletes\/(\d+)/.exec((top.athlete || {}).$ref || "");
              var p = m && byId[m[1]];
              leaders.push({ cat: lc[0], label: lc[1], e: lc[2], value: top.displayValue, id: m && m[1], name: p ? p.name : null, pos: p ? p.pos : null, photo: p ? p.photo : null, num: p ? p.num : null });
            });
          }
          return { abbr: abbr, id: tid, coach: (ro.coach && ro.coach[0]) ? ro.coach[0].firstName + " " + ro.coach[0].lastName : null, groups: groups, stats: stats, leaders: leaders, countries: countries };
        });
      });
    });
  }

  // Just the season stats for many teams at once (for "rank among playoff teams").
  function allStats(abbrs, season) {
    return Promise.all(abbrs.map(function (t) { return team(t, season).then(function (d) { return [t, d.stats]; }, function () { return [t, null]; }); }))
      .then(function (rows) { var o = {}; rows.forEach(function (r) { if (r[1]) o[r[0]] = r[1]; }); return o; });
  }

  function box(eventId, isFinal) {
    var key = "mlb26box:" + eventId;
    if (!isFinal) { delete mem[key]; }
    var make = function () {
      return getJSON(SITE + "summary?event=" + eventId).then(function (s) {
        var teams = ((s.boxscore || {}).players || []).map(function (p) {
          var out = { abbr: p.team.abbreviation, batting: [], pitching: [] };
          (p.statistics || []).forEach(function (grp) {
            var names = grp.names || grp.labels || [];
            (grp.athletes || []).forEach(function (a) {
              var row = { name: (a.athlete || {}).shortName || (a.athlete || {}).displayName, pos: (a.position || {}).abbreviation, starter: a.starter, sub: !a.starter };
              names.forEach(function (n, i) { row[n] = (a.stats || [])[i]; });
              if (grp.type === "batting") out.batting.push(row);
              else if (grp.type === "pitching") out.pitching.push(row);
            });
          });
          return out;
        });
        var scoring = (s.plays || []).filter(function (x) { return x.scoringPlay; }).map(function (x) {
          return { inn: (x.period || {}).displayValue, half: (x.period || {}).type, text: x.text, away: x.awayScore, home: x.homeScore, team: (x.team || {}).id };
        });
        return { teams: teams, scoring: scoring };
      });
    };
    if (!isFinal) return (mem[key] = make());
    return cached(key, Infinity, make);
  }

  var API = { team: team, allStats: allStats, box: box, LEADER_CATS: LEADER_CATS };
  if (typeof module !== "undefined" && module.exports) module.exports = API;
  else root.MLBTEAM = API;
})(typeof window !== "undefined" ? window : this);
