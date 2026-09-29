/* Printable bracket: one vector SVG, so it prints crisp on Letter AND on a poster of any size.
   Letter = fixed @page letter landscape. Poster = no @page size, so the size you pick in the
   print preview wins and the SVG stretches to fill it (vector, never pixelated). */
(function () {
  "use strict";
  var M = window.MLB;
  var NS = "http://www.w3.org/2000/svg";
  var ROW = 38, HEAD = 22, BOXH = HEAD + ROW * 2 + 6;

  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function nm(res, t) { return t ? ((res.teams[t] && res.teams[t].short) || t) : ""; }

  /* ---- layouts: box positions in a fixed viewBox ---- */
  // `aspect` = paper width / height. Wider-than-Letter paper (e.g. a 49x33in wall poster) stretches
  // the whole bracket sideways (wider boxes + gaps) instead of leaving empty bands at the edges.
  function wideLayout(aspect) {
    var H = 927, W = Math.max(1200, Math.round(H * (aspect || 0))), k = W / 1200;
    var cw = { WC: 150 * k, DS: 156 * k, CS: 160 * k, WS: 180 * k }, gap = 12 * k;
    var x = 14 * k, L = {}, R = {};
    L.WC = x; x += cw.WC + gap; L.DS = x; x += cw.DS + gap; L.CS = x; x += cw.CS + gap;
    var wsx = x; x += cw.WS + gap;
    R.CS = x; x += cw.CS + gap; R.DS = x; x += cw.DS + gap; R.WC = x;
    var y1 = 330, y2 = 690, yc = (y1 + y2) / 2;
    var b = {};
    [["AL", L, 1], ["NL", R, -1]].forEach(function (a) {
      var lg = a[0], X = a[1];
      b[lg + "DS1"] = { x: X.DS, y: y1 - BOXH / 2, w: cw.DS };
      b[lg + "DS2"] = { x: X.DS, y: y2 - BOXH / 2, w: cw.DS };
      // each Wild Card box sits level with the Division Series slot it feeds (the bottom row)
      b[lg + "WC1"] = { x: X.WC, y: y1 - BOXH / 2 + HEAD / 2 + ROW / 2 + 6, w: cw.WC };
      b[lg + "WC2"] = { x: X.WC, y: y2 - BOXH / 2 + HEAD / 2 + ROW / 2 + 6, w: cw.WC };
      b[lg + "CS"] = { x: X.CS, y: yc - BOXH / 2, w: cw.CS };
    });
    b.WS = { x: wsx, y: yc - BOXH / 2 + 40, w: cw.WS, big: true };
    return { W: W, H: H, box: b, top: 150, champ: { x: wsx + cw.WS / 2, y: yc - 150 }, lgLabel: [{ x: L.WC, t: "AMERICAN LEAGUE", a: "start" }, { x: R.WC + cw.WC, t: "NATIONAL LEAGUE", a: "end" }] };
  }
  function tallLayout() {
    var W = 927, H = 1200, cw = 280, gap = 23;
    var xs = { WC: 20, DS: 20 + cw + gap, CS: 20 + 2 * (cw + gap) };
    var b = {};
    function half(lg, y1, y2) {
      var yc = (y1 + y2) / 2;
      b[lg + "DS1"] = { x: xs.DS, y: y1 - BOXH / 2, w: cw };
      b[lg + "DS2"] = { x: xs.DS, y: y2 - BOXH / 2, w: cw };
      b[lg + "WC1"] = { x: xs.WC, y: y1 - BOXH / 2 + HEAD / 2 + ROW / 2 + 6, w: cw };
      b[lg + "WC2"] = { x: xs.WC, y: y2 - BOXH / 2 + HEAD / 2 + ROW / 2 + 6, w: cw };
      b[lg + "CS"] = { x: xs.CS, y: yc - BOXH / 2, w: cw };
    }
    half("AL", 250, 440);
    half("NL", 860, 1050);
    b.WS = { x: xs.CS, y: 650 - BOXH / 2, w: cw, big: true };
    return { W: W, H: H, box: b, top: 150, champ: { x: xs.DS + cw / 2 - 30, y: 610 }, lgLabel: [{ x: 20, y: 190, t: "AMERICAN LEAGUE", a: "start" }, { x: 20, y: 800, t: "NATIONAL LEAGUE", a: "start" }] };
  }

  /* ---- what goes in each slot for the chosen fill mode ---- */
  function slots(res, mode, picks) {
    var out = {};
    M.SERIES.forEach(function (d) {
      var s = res.series[d.id];
      if (mode === "blank") {
        // keep the seeded teams (they're known before a single pitch); everything else is for you to write in
        out[d.id] = { top: d.top.seed ? s.top : null, bot: d.bot.seed ? s.bot : null, wins: {}, winner: null };
      } else if (mode === "picks") {
        var o = M.pickOptions(res, d.id, picks);
        out[d.id] = { top: o[0], bot: o[1], wins: {}, winner: picks[d.id] || null, pick: true };
      } else {
        out[d.id] = { top: s.top, bot: s.bot, wins: s.wins, winner: s.winner };
      }
    });
    return out;
  }

  function dotRow(x, y, n, won, color, r) {
    var s = "";
    for (var i = 0; i < n; i++) {
      var cx = x + i * (r * 2 + 5) + r;
      if (i < won) s += '<circle cx="' + cx + '" cy="' + y + '" r="' + r + '" fill="' + color + '" stroke="#222" stroke-width="1.2"/><text x="' + cx + '" y="' + (y + r * 0.42) + '" font-size="' + (r * 1.2) + '" text-anchor="middle">⚾</text>';
      else s += '<circle cx="' + cx + '" cy="' + y + '" r="' + r + '" fill="#fff" stroke="#555" stroke-width="1.4" stroke-dasharray="3 2"/>';
    }
    return s;
  }

  function drawBox(res, id, b, sl, opts) {
    var d = M.BY_ID[id], R = M.ROUNDS[d.rd], s = res.series[id];
    var x = b.x, y = b.y, w = b.w, r = 8;
    var dotsW = R.need * (r * 2 + 5);
    var out = '<g>';
    out += '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + BOXH + '" rx="12" fill="#fff" stroke="' + (d.rd === "WS" ? "#c9971c" : "#1c3563") + '" stroke-width="' + (d.rd === "WS" ? 3.5 : 2) + '"/>';
    out += '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + HEAD + '" rx="12" fill="' + (d.rd === "WS" ? "#c9971c" : "#1c3563") + '"/>';
    out += '<rect x="' + x + '" y="' + (y + HEAD - 10) + '" width="' + w + '" height="10" fill="' + (d.rd === "WS" ? "#c9971c" : "#1c3563") + '"/>';
    out += '<text x="' + (x + 8) + '" y="' + (y + 15.5) + '" font-size="' + (opts.compact ? 10.5 : 12) + '" font-weight="700" fill="#fff">' + esc(d.rd === "WS" ? "WORLD SERIES" : d.lg + " " + (opts.compact && d.rd === "DS" ? "DIVISION" : R.short.toUpperCase())) + '</text>';
    out += '<text x="' + (x + w - 8) + '" y="' + (y + 15.5) + '" font-size="10.5" fill="#fff" text-anchor="end">win ' + R.need + (opts.compact ? '' : ' ⚾') + '</text>';
    ["top", "bot"].forEach(function (side, i) {
      var t = sl[side], ry = y + HEAD + 4 + i * ROW, cy = ry + ROW / 2;
      var seed = t && res.seedOf[t];
      var isW = sl.winner && sl.winner === t, isL = sl.winner && t && sl.winner !== t && !sl.pick;
      if (i === 1) out += '<line x1="' + (x + 6) + '" y1="' + ry + '" x2="' + (x + w - 6) + '" y2="' + ry + '" stroke="#ddd"/>';
      if (isW) out += '<rect x="' + (x + 3) + '" y="' + (ry + 2) + '" width="' + (w - 6) + '" height="' + (ROW - 4) + '" rx="8" fill="#fff1c9"/>';
      var won = t && sl.wins ? (sl.wins[t] || 0) : 0;
      var color = t && res.teams[t] ? res.teams[t].color : "#1c3563";
      var tx = x + 8;
      var bye = d.rd === "DS" && side === "top";
      if (opts.compact) {
        var hint = t ? null : M.slotOptions(res, id, side).map(function (o) { return nm(res, o); });
        if (hint && hint.length > 2) hint = [M.feederLabel(res, id, side, function (q) { return nm(res, q); })];
        out += '<circle cx="' + (tx + 13) + '" cy="' + cy + '" r="14" fill="#fff" stroke="#bbb"' + (t ? '' : ' stroke-dasharray="3 2"') + '/>';
        if (t) out += '<image href="' + esc(M.logoUrl(res, t)) + '" x="' + (tx + 2) + '" y="' + (cy - 11) + '" width="22" height="22"' + (isL ? ' opacity=".35"' : '') + '/>';
        if (seed) out += '<circle cx="' + (tx + 24) + '" cy="' + (cy + 10) + '" r="6.5" fill="#1c3563"/><text x="' + (tx + 24) + '" y="' + (cy + 13) + '" font-size="8.5" font-weight="700" fill="#fff" text-anchor="middle">' + seed + '</text>';
        tx += 34;
        var avail = x + w - 8 - tx;
        if (t) {
          var lab = nm(res, t) + (isW ? (sl.pick ? " ★" : " ✓") : "");
          var fs = Math.min(b.big ? 15 : 13, avail / (0.6 * lab.length));
          out += '<text x="' + tx + '" y="' + (cy - 3) + '" font-size="' + fs.toFixed(1) + '" font-weight="700" fill="' + (isL ? "#999" : "#111") + '"' + (isL ? ' text-decoration="line-through"' : '') + '>' + esc(lab) + '</text>';
        } else {
          out += '<line x1="' + tx + '" y1="' + (cy - 1) + '" x2="' + (x + w - 8) + '" y2="' + (cy - 1) + '" stroke="#888"/>';
        }
        out += dotRow(tx, cy + 10, R.need, won, color, 6);
        var after = tx + R.need * 17 + 4;
        var note = bye ? "😴 bye" : (hint && opts.hints ? hint.join(" or ") : "");
        if (note) {
          var nfs = Math.min(8, (x + w - 6 - after) / (0.55 * note.length));
          out += '<text x="' + after + '" y="' + (cy + 13) + '" font-size="' + nfs.toFixed(1) + '" fill="#777">' + esc(note) + '</text>';
        }
        return;
      }
      var tx = x + 8;
      if (t) {
        out += '<circle cx="' + (tx + 13) + '" cy="' + cy + '" r="14" fill="#fff" stroke="#bbb"/>';
        out += '<image href="' + esc(M.logoUrl(res, t)) + '" x="' + (tx + 2) + '" y="' + (cy - 11) + '" width="22" height="22"' + (isL ? ' opacity=".35"' : '') + '/>';
        tx += 32;
        var label = nm(res, t) + (isW ? " ✓" : "");
        var avail = x + w - dotsW - 10 - tx, fs = b.big ? 15 : 13.5;
        fs = Math.min(fs, avail / (0.6 * label.length));
        out += '<text x="' + tx + '" y="' + (cy - 1) + '" font-size="' + fs.toFixed(1) + '" font-weight="700" fill="' + (isL ? "#999" : "#111") + '"' + (isL ? ' text-decoration="line-through"' : '') + '>' + esc(sl.pick && isW ? label.replace(/ ✓$/, " ★") : label) + '</text>';
        if (seed) out += '<text x="' + tx + '" y="' + (cy + 12) + '" font-size="9.5" fill="#666">#' + seed + ' seed' + (d.rd === "DS" && side === "top" ? " · 😴 skipped rd 1" : "") + '</text>';
      } else {
        var hint = M.slotOptions(res, id, side).map(function (o) { return nm(res, o); });
        out += '<circle cx="' + (tx + 13) + '" cy="' + cy + '" r="14" fill="#fff" stroke="#bbb" stroke-dasharray="3 2"/>';
        tx += 32;
        out += '<line x1="' + tx + '" y1="' + (cy + 4) + '" x2="' + (x + w - dotsW - 12) + '" y2="' + (cy + 4) + '" stroke="#888" stroke-width="1"/>';
        if (hint.length > 2) hint = [M.feederLabel(res, id, side, function (t) { return nm(res, t); })];
        if (opts.hints) out += '<text x="' + tx + '" y="' + (cy + 15) + '" font-size="8.5" fill="#888">' + esc(hint.join(" or ")) + '</text>';
      }
      out += dotRow(x + w - dotsW - 4, cy, R.need, won, color, r);
    });
    return out + '</g>';
  }

  function connector(from, to, toSide, flowsRight) {
    var sy = from.y + BOXH / 2;
    var ty = to.y + HEAD + 4 + (toSide === "top" ? 0 : ROW) + ROW / 2;
    var sx, tx;
    if (Math.abs(from.x - to.x) < 2) { // stacked (tall layout CS→WS): drop straight down/up
      sx = from.x + from.w / 2; tx = to.x + to.w / 2;
      var sy2 = from.y < to.y ? from.y + BOXH : from.y, ty2 = from.y < to.y ? to.y : to.y + BOXH;
      return '<path d="M' + sx + ' ' + sy2 + ' V' + ty2 + '" fill="none" stroke="#1c3563" stroke-width="2.5" marker-end="url(#arrow)"/>';
    }
    if (flowsRight) { sx = from.x + from.w; tx = to.x; } else { sx = from.x; tx = to.x + to.w; }
    var mx = (sx + tx) / 2;
    return '<path d="M' + sx + ' ' + sy + ' H' + mx + ' V' + ty + ' H' + tx + '" fill="none" stroke="#1c3563" stroke-width="2.5" marker-end="url(#arrow)"/>';
  }

  /* ---- dates, places, channels ---- */
  function shortWhen(g) {
    if (!g || !g.date) return "";
    var d = new Date(g.date);
    var day = d.toLocaleDateString("en-US", { weekday: "short", month: "numeric", day: "numeric" });
    if (g.timeTBD) return day + " (time TBA)";
    return day + " " + d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZoneName: "short" }).replace(":00 ", " ");
  }
  function placeOf(g, res, s) { return g ? M.gameHost(res, window.__FEED || null, s, g).text : ""; }
  function caption(res, id, b, opt) {
    var s = res.series[id];
    var g = s.games.filter(function (x) { return x.gn === 1; })[0] || s.games[0];
    var lines = [];
    if (opt.mode === "results" && s.winner) {
      lines.push("Final: " + nm(res, s.winner) + " won " + s.wins[s.winner] + "–" + s.wins[s.loser]);
    } else {
      var nx = (opt.mode === "results" && s.next) ? s.next : g;
      if (nx) {
        lines.push((opt.mode === "results" && s.started ? "Next: Game " + nx.gn + " · " : "Game 1 · ") + shortWhen(nx));
        var tail = ["📍 " + placeOf(nx, res, s), nx.tv ? "📺 " + nx.tv : ""].filter(Boolean).join("  ");
        lines.push(tail);
      }
    }
    var out = "", fs = b.big ? 10.5 : 9.2;
    lines.forEach(function (t, i) {
      var f = Math.min(fs, (b.w - 4) / (0.52 * t.length));
      out += '<text x="' + (b.x + b.w / 2) + '" y="' + (b.y + BOXH + 12 + i * 12) + '" font-size="' + f.toFixed(1) + '" text-anchor="middle" fill="#445">' + esc(t) + '</text>';
    });
    return out;
  }

  function wrap(t, n) {
    var words = String(t).split(" "), lines = [], cur = "";
    words.forEach(function (w) { if ((cur + " " + w).trim().length > n) { if (cur) lines.push(cur); cur = w; } else cur = (cur + " " + w).trim(); });
    if (cur) lines.push(cur);
    return lines;
  }

  /* ---- page 2: schedule by series, ballpark map, fun facts, mini quiz ---- */
  function page2(res, opt) {
    var tall = opt.layout === "tall";
    var W = tall ? 927 : Math.max(1200, Math.round(927 * (opt.aspect || 0))), H = tall ? 1200 : 927, k = tall ? 1 : W / 1200;
    var svg = '<svg xmlns="' + NS + '" viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="xMidYMid meet" font-family="Fredoka, Arial Rounded MT Bold, sans-serif">';
    svg += '<rect width="100%" height="100%" fill="#fff"/>';
    svg += '<text x="' + W / 2 + '" y="40" font-size="28" font-weight="700" text-anchor="middle" fill="#1c3563">📅 When, where &amp; what channel</text>';
    svg += '<text x="' + W / 2 + '" y="62" font-size="13" text-anchor="middle" fill="#555">Times shown in ' + esc(Intl.DateTimeFormat().resolvedOptions().timeZone.replace(/_/g, " ")) + '. * = only played if needed.</text>';
    // schedule: one block per series
    var colW = tall ? W - 40 : 700 * k, x0 = 20, y = 84;
    var rows = M.SERIES.map(function (d) { return res.series[d.id]; });
    rows.forEach(function (s) {
      var R = s.round;
      var who = (s.top ? nm(res, s.top) : "?") + " vs " + (s.bot ? nm(res, s.bot) : M.slotOptions(res, s.id, "bot").length <= 2 ? M.slotOptions(res, s.id, "bot").map(function (o) { return nm(res, o); }).join("/") : M.feederLabel(res, s.id, "bot", function (t) { return nm(res, t); }));
      if (!s.top) who = M.feederLabel(res, s.id, "top", function (t) { return nm(res, t); }) + " vs " + M.feederLabel(res, s.id, "bot", function (t) { return nm(res, t); });
      var tv = {}, cities = {};
      s.games.forEach(function (g) { if (g.tv) g.tv.split(", ").forEach(function (c) { tv[c] = 1; }); if (g.city) cities[g.city] = 1; });
      var perL = tall ? 3 : 2, bh = 24 + Math.ceil(s.games.length / perL) * 13;
      svg += '<rect x="' + x0 + '" y="' + y + '" width="' + colW + '" height="' + bh + '" rx="8" fill="' + (s.rd === "WS" ? "#fff6dd" : "#f3f6fc") + '" stroke="#c9d3e6"/>';
      svg += '<text x="' + (x0 + 10) + '" y="' + (y + 17) + '" font-size="13" font-weight="700" fill="#1c3563">' + esc((s.rd === "WS" ? "WORLD SERIES" : s.lg + " " + R.short.toUpperCase()) + ": " + who) + '</text>';
      svg += '<text x="' + (x0 + colW - 10) + '" y="' + (y + 17) + '" font-size="11" text-anchor="end" fill="#555">' + esc("first to " + R.need + " wins · 📺 " + (Object.keys(tv).join(", ") || "TBA")) + '</text>';
      var gtxt = s.games.map(function (g) {
        var sc = (opt.mode === "results" && g.status === "FINAL") ? " (" + g.away + " " + g.ar + "–" + g.hr + " " + g.home + ")" : "";
        return "G" + g.gn + (g.ifnec ? "*" : "") + " " + shortWhen(g) + " @ " + placeOf(g, res, s) + sc;
      });
      var per = tall ? 3 : 2, cw = (colW - 20) / per;
      gtxt.forEach(function (t, i) {
        var cx = x0 + 10 + (i % per) * cw, cy = y + 32 + Math.floor(i / per) * 13;
        var f = Math.min(10.5, (cw - 6) / (0.5 * t.length));
        svg += '<text x="' + cx + '" y="' + cy + '" font-size="' + f.toFixed(1) + '" fill="#222">' + esc(t) + '</text>';
      });
      y += bh + 5;
    });
    // right column (or bottom when tall): map + facts + quiz
    var rx = tall ? 20 : 740 * k, ry = tall ? y + 6 : 84, rw = tall ? W - 40 : W - rx - 20;
    var MAP = window.MLBMAP;
    if (MAP) {
      var mw = tall ? rw * 0.5 : rw, mh = mw * MAP.H / MAP.W, sc = mw / MAP.W;
      svg += '<g transform="translate(' + rx + ',' + ry + ') scale(' + sc.toFixed(4) + ')">';
      svg += '<path d="' + MAP.lower48 + '" fill="#e6edf8" stroke="none"/><path d="' + MAP.borders + '" fill="none" stroke="#b8c6de" stroke-width="1"/>';
      rows.filter(function (s) { return s.top && s.bot && !s.winner; }).forEach(function (s) {
        var A = MAP.parks[s.top], Bp = MAP.parks[s.bot]; if (!A || !Bp) return;
        svg += '<line x1="' + A.x + '" y1="' + A.y + '" x2="' + Bp.x + '" y2="' + Bp.y + '" stroke="#c9971c" stroke-width="3" stroke-dasharray="8 6"/>';
      });
      res.seeds.AL.concat(res.seeds.NL).forEach(function (t) {
        var p = MAP.parks[t]; if (!p) return;
        svg += '<circle cx="' + p.x + '" cy="' + p.y + '" r="19" fill="#fff" stroke="#1c3563" stroke-width="2"/><image href="' + esc(M.logoUrl(res, t)) + '" x="' + (p.x - 14) + '" y="' + (p.y - 14) + '" width="28" height="28"/>';
      });
      svg += '</g>';
      svg += '<text x="' + rx + '" y="' + (ry + mh + 14) + '" font-size="11" fill="#555">🗺️ The 12 playoff ballparks. Dashed lines connect teams playing each other.</text>';
      var fy = tall ? ry : ry + mh + 36, fx = tall ? rx + mw + 20 : rx, fw = tall ? rw - mw - 20 : rw;
      var F = window.MLBFACTS;
      if (F) {
        svg += '<text x="' + fx + '" y="' + fy + '" font-size="16" font-weight="700" fill="#1c3563">💡 Fun facts</text>';
        var ly = fy + 18, chars = Math.floor(fw / 6.1);
        F.FACTS.slice(0, tall ? 7 : 8).forEach(function (f) {
          wrap(f.t, chars).forEach(function (ln, i) { svg += '<text x="' + (fx + (i ? 12 : 0)) + '" y="' + ly + '" font-size="11" fill="#222">' + (i ? "" : "• ") + esc(ln) + '</text>'; ly += 13; });
          ly += 3;
        });
        ly += 8;
        svg += '<text x="' + fx + '" y="' + ly + '" font-size="16" font-weight="700" fill="#1c3563">🧠 Quiz yourself</text>'; ly += 18;
        var qs = F.QUIZ.slice(0, 5), ans = [];
        qs.forEach(function (q, k) {
          wrap((k + 1) + ". " + q.q + "  (" + q.c.join(" / ") + ")", chars).forEach(function (ln) { svg += '<text x="' + fx + '" y="' + ly + '" font-size="11" fill="#222">' + esc(ln) + '</text>'; ly += 13; });
          ly += 3; ans.push((k + 1) + ". " + q.c[q.a]);
        });
        svg += '<text x="' + fx + '" y="' + (ly + 6) + '" font-size="9.5" fill="#888">Answers: ' + esc(ans.join("   ")) + '</text>';
      }
    }
    svg += '<text x="' + W / 2 + '" y="' + (H - 12) + '" font-size="11" text-anchor="middle" fill="#888">' + esc(location.host + location.pathname.replace(/print\.html$/, "")) + '</text>';
    return svg + '</svg>';
  }

  function build(res, opt) {
    var Lo = opt.layout === "tall" ? tallLayout() : wideLayout(opt.aspect);
    var B = Lo.box, sl = slots(res, opt.mode, opt.picks || {});
    var season = opt.season || 2026;
    var svg = '<svg xmlns="' + NS + '" viewBox="0 0 ' + Lo.W + ' ' + Lo.H + '" preserveAspectRatio="xMidYMid meet" font-family="Fredoka, Arial Rounded MT Bold, sans-serif">';
    svg += '<defs><marker id="arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 z" fill="#1c3563"/></marker></defs>';
    svg += '<rect width="100%" height="100%" fill="#fff"/>';
    // title + the one rule a 6-year-old needs
    svg += '<text x="' + Lo.W / 2 + '" y="46" font-size="36" font-weight="700" text-anchor="middle" fill="#1c3563">⚾ ' + season + ' MLB PLAYOFFS ⚾</text>';
    svg += '<text x="' + Lo.W / 2 + '" y="74" font-size="16" text-anchor="middle" fill="#333">' + esc(opt.subtitle) + '</text>';
    // road legend
    var lw = Math.min(250, (Lo.W - 60) / 4), lx = (Lo.W - lw * 4 - 30) / 2;
    M.ROUND_ORDER.forEach(function (rd, i) {
      var R = M.ROUNDS[rd], x = lx + i * (lw + 10);
      svg += '<rect x="' + x + '" y="88" width="' + lw + '" height="40" rx="10" fill="' + (rd === "WS" ? "#fff1c9" : "#eef3fb") + '" stroke="#1c3563" stroke-width="1"/>';
      svg += '<text x="' + (x + 10) + '" y="104" font-size="12.5" font-weight="700" fill="#1c3563">Round ' + (i + 1) + ': ' + esc(R.name) + '</text>';
      svg += '<text x="' + (x + 10) + '" y="120" font-size="11" fill="#333">Best of ' + R.best + ' · win ' + R.need + '</text>';
      svg += dotRow(x + lw - R.need * 15 - 6, 116, R.need, 0, "#fff", 5.5);
    });
    Lo.lgLabel.forEach(function (l) { svg += '<text x="' + l.x + '" y="' + (l.y || Lo.top + 10) + '" font-size="15" font-weight="700" fill="#8a9bbb" letter-spacing="2" text-anchor="' + l.a + '">' + l.t + '</text>'; });
    function dir(id) { if (opt.layout === "tall") return 1; return id.indexOf("NL") === 0 ? -1 : 1; }
    // connectors under boxes
    M.SERIES.forEach(function (d) {
      ["top", "bot"].forEach(function (side) {
        var from = d[side].from;
        if (!from) return;
        var flowsRight = d.rd === "WS" ? (opt.layout === "tall" ? true : from === "ALCS") : dir(d.id) > 0;
        svg += connector(B[from], B[d.id], side, flowsRight);
      });
    });
    M.SERIES.forEach(function (d) { svg += drawBox(res, d.id, B[d.id], sl[d.id], { hints: opt.mode !== "picks", compact: opt.layout !== "tall", dir: dir }); });
    M.SERIES.forEach(function (d) { svg += caption(res, d.id, B[d.id], opt); });
    // champion
    var champ = opt.mode === "picks" ? (opt.picks || {}).WS : opt.mode === "results" ? res.champion : null;
    var cx = Lo.champ.x, cy = Lo.champ.y;
    svg += '<text x="' + cx + '" y="' + cy + '" font-size="58" text-anchor="middle">🏆</text>';
    svg += '<text x="' + cx + '" y="' + (cy + 30) + '" font-size="15" font-weight="700" text-anchor="middle" fill="#c9971c">CHAMPION</text>';
    if (champ) {
      svg += '<image href="' + esc(M.logoUrl(res, champ)) + '" x="' + (cx - 22) + '" y="' + (cy + 38) + '" width="44" height="44"/>';
      svg += '<text x="' + cx + '" y="' + (cy + 100) + '" font-size="18" font-weight="700" text-anchor="middle" fill="#111">' + esc(nm(res, champ)) + '</text>';
    } else {
      svg += '<line x1="' + (cx - 80) + '" y1="' + (cy + 62) + '" x2="' + (cx + 80) + '" y2="' + (cy + 62) + '" stroke="#888"/>';
    }
    svg += '<text x="' + Lo.W / 2 + '" y="' + (Lo.H - 12) + '" font-size="11" text-anchor="middle" fill="#888">' + esc(opt.footer || "") + '</text>';
    return svg + '</svg>';
  }


  /* ---- tiled poster for little hands: W x H inches on Letter sheets ----
     The sheet grid IS the bracket grid: 7 columns of sheets = the 7 bracket columns
     (AL WC, AL DS, AL CS, World Series, NL CS, NL DS, NL WC). Rows: a header row, then slots.
     Every box a child writes or colors in sits wholly inside ONE sheet, at least SAFE inches
     from its edges; only thin connector lines cross the seams. Each sheet also carries a FLAP
     (gray overlap strip) on its right/bottom that the next sheet is taped over. */
  var FLAP = 0.3, SAFE = 0.5, TOP_M = 0.55, BOT_M = 0.7, SIDE_M = 0.35;
  var PAPER = { portrait: { w: 8.5, h: 11 }, landscape: { w: 11, h: 8.5 } };
  var COLS = [
    { rd: "WC", lg: "AL", ids: ["ALWC1", "ALWC2"] }, { rd: "DS", lg: "AL", ids: ["ALDS1", "ALDS2"] }, { rd: "CS", lg: "AL", ids: ["ALCS"] },
    { rd: "WS", lg: "WS", ids: ["WS"] },
    { rd: "CS", lg: "NL", ids: ["NLCS"] }, { rd: "DS", lg: "NL", ids: ["NLDS1", "NLDS2"] }, { rd: "WC", lg: "NL", ids: ["NLWC1", "NLWC2"] },
  ];
  function rowName(r) { return String.fromCharCode(65 + r); }
  function tileGrid(W, H) {
    var cols = 7, tw = W / cols, orient = null;
    // tile + overlap strip + side margins must fit on the paper
    if (tw + FLAP + 2 * SIDE_M <= PAPER.portrait.w) orient = "portrait";
    else if (tw + FLAP + 2 * SIDE_M <= PAPER.landscape.w) orient = "landscape";
    if (!orient) return { error: "Too wide for 7 Letter sheets across (max " + ((PAPER.landscape.w - FLAP - 2 * SIDE_M) * 7).toFixed(1) + " in)." };
    var maxTH = PAPER[orient].h - TOP_M - BOT_M - FLAP;
    var rows = Math.max(4, Math.ceil(H / maxTH - 1e-9));
    return { cols: cols, rows: rows, tw: tw, th: H / rows, orient: orient, paper: PAPER[orient] };
  }

  function T(x, y, fs, txt, o) {
    o = o || {};
    return '<text x="' + x.toFixed(3) + '" y="' + y.toFixed(3) + '" font-size="' + fs.toFixed(3) + '"' + (o.b ? ' font-weight="700"' : '') +
      ' text-anchor="' + (o.a || "start") + '" fill="' + (o.c || "#111") + '"' + (o.extra || "") + '>' + esc(txt) + '</text>';
  }
  function fit(txt, fs, maxW) { return Math.min(fs, maxW / (0.56 * Math.max(1, String(txt).length))); }

  function kidPoster(res, opt, G) {
    var W = G.cols * G.tw, H = G.rows * G.th, sl = slots(res, opt.mode, opt.picks || {});
    var R = G.rows, top = 1, bottom = R - 1, mid = Math.max(1, Math.floor(R / 2));
    var cell = function (c, r) { return { x: c * G.tw + SAFE, y: r * G.th + SAFE, w: G.tw - 2 * SAFE, h: G.th - 2 * SAFE }; };
    var out = '<svg xmlns="' + NS + '" viewBox="0 0 ' + W + ' ' + H + '" font-family="Fredoka, Arial Rounded MT Bold, sans-serif">';
    out += '<defs><marker id="karrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="4" markerHeight="4" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 z" fill="#1c3563"/></marker></defs>';
    out += '<rect width="' + W + '" height="' + H + '" fill="#fff"/>';
    var boxes = {}, used = {};
    var mark = function (c, r) { used[c + ":" + r] = 1; };

    // ---- one series box, sized to its sheet ----
    function seriesBox(id, c, r) {
      var d = M.BY_ID[id], Rd = M.ROUNDS[d.rd], sd = sl[id], s = res.series[id], C = cell(c, r);
      var capH = 0.75, head = 0.62;
      // each team row: [logo] Name  on top, then a full-width row of big win-dots underneath
      var rh = Math.min(2.9, (C.h - capH - head - 0.15) / 2);
      var logo = Math.min(1.1, rh * 0.42), nameFs = Math.min(0.5, logo * 0.45);
      var dia = Math.min(1.15, (C.w - 0.4) / (Rd.need * 1.3 - 0.3), rh - logo - 0.4);
      var bh = head + 2 * rh + 0.12, bx = C.x, by = C.y + (C.h - capH - bh) / 2, bw = C.w;
      var gold = d.rd === "WS", col = gold ? "#c9971c" : "#1c3563";
      var o = '<rect x="' + bx + '" y="' + by + '" width="' + bw + '" height="' + bh + '" rx="0.22" fill="#fff" stroke="' + col + '" stroke-width="0.06"/>';
      o += '<path d="M' + bx + ' ' + (by + head) + ' V' + (by + 0.22) + ' Q' + bx + ' ' + by + ' ' + (bx + 0.22) + ' ' + by + ' H' + (bx + bw - 0.22) + ' Q' + (bx + bw) + ' ' + by + ' ' + (bx + bw) + ' ' + (by + 0.22) + ' V' + (by + head) + ' Z" fill="' + col + '"/>';
      var title = gold ? "WORLD SERIES" : d.lg + " " + Rd.short.toUpperCase();
      o += T(bx + 0.2, by + head * 0.66, fit(title, 0.3, bw * 0.6), title, { b: 1, c: "#fff" });
      o += T(bx + bw - 0.2, by + head * 0.66, 0.24, "first to " + Rd.need + " wins", { a: "end", c: "#fff" });
      ["top", "bot"].forEach(function (side, i) {
        var t = sd[side], ry = by + head + 0.06 + i * rh;
        if (i) o += '<line x1="' + (bx + 0.15) + '" y1="' + ry + '" x2="' + (bx + bw - 0.15) + '" y2="' + ry + '" stroke="#ccd" stroke-width="0.02"/>';
        var lx = bx + 0.2 + logo / 2, ly = ry + 0.12 + logo / 2;
        var isW = sd.winner && sd.winner === t, isL = sd.winner && t && sd.winner !== t && !sd.pick;
        if (isW) o += '<rect x="' + (bx + 0.08) + '" y="' + (ry + 0.05) + '" width="' + (bw - 0.16) + '" height="' + (rh - 0.1) + '" rx="0.15" fill="#fff1c9"/>';
        o += '<circle cx="' + lx + '" cy="' + ly + '" r="' + (logo / 2) + '" fill="#fff" stroke="#999" stroke-width="0.03"' + (t ? '' : ' stroke-dasharray="0.08 0.06"') + '/>';
        var nx = bx + 0.2 + logo + 0.25, nmW = bx + bw - 0.2 - nx;
        if (t) {
          var u = M.logoUrl(res, t);
          if (u) o += '<image href="' + esc(u) + '" x="' + (lx - logo * 0.38) + '" y="' + (ly - logo * 0.38) + '" width="' + (logo * 0.76) + '" height="' + (logo * 0.76) + '"' + (isL ? ' opacity=".35"' : '') + '/>';
          var seed = res.seedOf[t];
          if (seed) o += '<circle cx="' + (lx + logo * 0.36) + '" cy="' + (ly + logo * 0.36) + '" r="' + (logo * 0.17) + '" fill="#1c3563"/>' + T(lx + logo * 0.36, ly + logo * 0.36 + logo * 0.06, logo * 0.19, String(seed), { a: "middle", c: "#fff", b: 1 });
          var lab = nm(res, t) + (isW ? (sd.pick ? " ★" : " ✓") : "");
          o += T(nx, ly + nameFs * 0.35, fit(lab, nameFs, nmW), lab, { b: 1, c: isL ? "#999" : "#111", extra: isL ? ' text-decoration="line-through"' : "" });
        } else {
          // a big write-in line, with a small hint of who it could be
          o += '<line x1="' + nx + '" y1="' + (ly + 0.12) + '" x2="' + (bx + bw - 0.2) + '" y2="' + (ly + 0.12) + '" stroke="#777" stroke-width="0.03"/>';
          var hint = M.slotOptions(res, id, side).map(function (q) { return nm(res, q); });
          if (hint.length > 2) hint = [M.feederLabel(res, id, side, function (q) { return nm(res, q); })];
          if (opt.mode !== "picks") o += T(nx, ly + 0.36, fit(hint.join(" or "), 0.18, nmW), hint.join(" or "), { c: "#999" });
        }
        // the win-dots: big, thick, evenly spaced, fully inside this sheet
        var won = t && sd.wins ? (sd.wins[t] || 0) : 0;
        var colr = t && res.teams[t] ? res.teams[t].color : "#1c3563";
        var dy = ry + 0.12 + logo + 0.15 + dia / 2;
        for (var k = 0; k < Rd.need; k++) {
          var cx = bx + 0.2 + dia / 2 + k * dia * 1.3;
          if (k < won) o += '<circle cx="' + cx + '" cy="' + dy + '" r="' + (dia / 2) + '" fill="' + colr + '" stroke="#222" stroke-width="0.04"/>' + T(cx, dy + dia * 0.2, dia * 0.55, "⚾", { a: "middle" });
          else o += '<circle cx="' + cx + '" cy="' + dy + '" r="' + (dia / 2) + '" fill="#fff" stroke="#333" stroke-width="0.045" stroke-dasharray="0.12 0.07"/>';
        }
      });
      // caption: next game, place, TV (small, for the grown-ups)
      var g = (opt.mode === "results" && s.next) ? s.next : (s.games.filter(function (x) { return x.gn === 1; })[0] || s.games[0]);
      if (opt.mode === "results" && s.winner) o += T(bx + bw / 2, by + bh + 0.3, 0.2, "Final: " + nm(res, s.winner) + " won " + s.wins[s.winner] + "–" + s.wins[s.loser], { a: "middle", c: "#445" });
      else if (g) {
        var l1 = "Game " + g.gn + " · " + shortWhen(g), l2 = "📍 " + placeOf(g, res, s) + (g.tv ? "   📺 " + g.tv : "");
        o += T(bx + bw / 2, by + bh + 0.3, fit(l1, 0.2, bw), l1, { a: "middle", c: "#445" });
        o += T(bx + bw / 2, by + bh + 0.56, fit(l2, 0.2, bw), l2, { a: "middle", c: "#445" });
      }
      boxes[id] = { x: bx, y: by, w: bw, h: bh, rowY: [by + head + 0.06 + rh / 2, by + head + 0.06 + rh * 1.5] };
      mark(c, r);
      return o;
    }

    // ---- header sheets (row A): which round, how many wins; sized to fill the sheet ----
    COLS.forEach(function (colDef, c) {
      var C = cell(c, 0), Rd = M.ROUNDS[colDef.rd], o = "", at = function (f) { return C.y + C.h * f; };
      var mx = C.x + C.w / 2;
      if (colDef.rd === "WS") {
        o += T(mx, at(0.13), fit("MLB PLAYOFFS", 0.9, C.w), "MLB PLAYOFFS", { a: "middle", b: 1, c: "#1c3563" });
        o += T(mx, at(0.27), 0.8, "⚾ " + (opt.season || 2026) + " ⚾", { a: "middle", b: 1, c: "#c9971c" });
        o += T(mx, at(0.40), fit("Round 4 · WORLD SERIES", 0.5, C.w), "Round 4 · WORLD SERIES", { a: "middle", b: 1, c: "#333" });
      } else {
        var rn = M.ROUND_ORDER.indexOf(colDef.rd) + 1, lgName = colDef.lg === "AL" ? "AMERICAN LEAGUE" : "NATIONAL LEAGUE";
        o += T(mx, at(0.10), fit(lgName, 0.4, C.w), lgName, { a: "middle", b: 1, c: "#8a9bbb" });
        o += T(mx, at(0.23), 0.62, "Round " + rn, { a: "middle", c: "#333" });
        o += T(mx, at(0.38), fit(Rd.short.toUpperCase(), 0.9, C.w), Rd.short.toUpperCase(), { a: "middle", b: 1, c: "#1c3563" });
      }
      o += T(mx, at(0.53), fit("Win " + Rd.need + " games to move on!", 0.5, C.w), "Win " + Rd.need + " games to move on!", { a: "middle", b: 1, c: "#c0392b" });
      var dia = Math.min(1.1, C.w / (Rd.need * 1.4)), totalW = Rd.need * dia * 1.3 - dia * 0.3, sx = C.x + (C.w - totalW) / 2;
      for (var k = 0; k < Rd.need; k++) o += '<circle cx="' + (sx + dia / 2 + k * dia * 1.3) + '" cy="' + (at(0.66)) + '" r="' + (dia / 2) + '" fill="#fff" stroke="#333" stroke-width="0.05" stroke-dasharray="0.12 0.07"/>';
      o += T(mx, at(0.66) + dia / 2 + 0.55, fit("Color one dot for every win.", 0.36, C.w), "Color one dot for every win.", { a: "middle", c: "#555" });
      if (colDef.rd !== "WC") o += T(mx, at(0.95), fit("⬇ winners from the round before", 0.26, C.w), colDef.rd === "WS" ? "⬇ the AL champ vs. the NL champ" : "⬇ winners from the round before", { a: "middle", c: "#888" });
      else o += T(mx, at(0.95), fit("⬇ 4 teams start here", 0.26, C.w), "⬇ the playoffs start here!", { a: "middle", c: "#888" });
      out += o; mark(c, 0);
    });

    // ---- the series boxes ----
    out += seriesBox("ALWC1", 0, top) + seriesBox("ALWC2", 0, bottom) + seriesBox("ALDS1", 1, top) + seriesBox("ALDS2", 1, bottom) + seriesBox("ALCS", 2, mid);
    out += seriesBox("WS", 3, mid);
    out += seriesBox("NLCS", 4, mid) + seriesBox("NLDS1", 5, top) + seriesBox("NLDS2", 5, bottom) + seriesBox("NLWC1", 6, top) + seriesBox("NLWC2", 6, bottom);

    // ---- connectors: thin lines only; they may cross seams ----
    function link(from, to, side, rightward) {
      var A = boxes[from], B = boxes[to], y1 = A.y + A.h / 2, y2 = B.rowY[side === "top" ? 0 : 1];
      var x1 = rightward ? A.x + A.w : A.x, x2 = rightward ? B.x : B.x + B.w;
      var xm = rightward ? x2 - 0.25 : x2 + 0.25;   // turn just before the target box, inside its sheet
      out += '<path d="M' + x1 + ' ' + y1 + ' H' + xm + ' V' + y2 + ' H' + x2 + '" fill="none" stroke="#1c3563" stroke-width="0.05" marker-end="url(#karrow)"/>';
    }
    link("ALWC1", "ALDS1", "bot", true); link("ALWC2", "ALDS2", "bot", true);
    link("ALDS1", "ALCS", "top", true); link("ALDS2", "ALCS", "bot", true); link("ALCS", "WS", "top", true);
    link("NLWC1", "NLDS1", "bot", false); link("NLWC2", "NLDS2", "bot", false);
    link("NLDS1", "NLCS", "top", false); link("NLDS2", "NLCS", "bot", false); link("NLCS", "WS", "bot", false);

    // ---- champion box above the World Series ----
    var champRow = mid - 1 >= 1 ? mid - 1 : null;
    if (champRow != null && !used["3:" + champRow]) {
      var C = cell(3, champRow), champ = opt.mode === "picks" ? (opt.picks || {}).WS : opt.mode === "results" ? res.champion : null;
      var o = '<rect x="' + C.x + '" y="' + C.y + '" width="' + C.w + '" height="' + C.h + '" rx="0.3" fill="#fff8e1" stroke="#c9971c" stroke-width="0.07"/>';
      o += T(C.x + C.w / 2, C.y + C.h * 0.3, Math.min(1.4, C.h * 0.25), "🏆", { a: "middle" });
      o += T(C.x + C.w / 2, C.y + C.h * 0.3 + 0.7, fit("CHAMPION!", 0.6, C.w - 0.4), "CHAMPION!", { a: "middle", b: 1, c: "#c9971c" });
      if (champ) o += T(C.x + C.w / 2, C.y + C.h * 0.78, fit(nm(res, champ), 0.6, C.w - 0.4), nm(res, champ), { a: "middle", b: 1 });
      else {
        o += '<circle cx="' + (C.x + C.w / 2) + '" cy="' + (C.y + C.h * 0.62) + '" r="' + Math.min(0.55, C.h * 0.1) + '" fill="#fff" stroke="#999" stroke-width="0.03" stroke-dasharray="0.08 0.06"/>';
        o += '<line x1="' + (C.x + 0.4) + '" y1="' + (C.y + C.h * 0.86) + '" x2="' + (C.x + C.w - 0.4) + '" y2="' + (C.y + C.h * 0.86) + '" stroke="#777" stroke-width="0.03"/>';
        o += T(C.x + C.w / 2, C.y + C.h * 0.86 + 0.3, 0.2, "write the winner here", { a: "middle", c: "#999" });
      }
      out += o; mark(3, champRow);
    }

    // ---- fill every leftover sheet with something to draw or read (never a blank sheet) ----
    var F = window.MLBFACTS ? window.MLBFACTS.FACTS : [];
    var kidFacts = [0, 1, 3, 16, 12, 4, 11, 14].map(function (i) { return F[i]; }).filter(Boolean), fi = 0;
    function card(c, r, kind) {
      var C = cell(c, r), o = "";
      if (kind === "draw") {
        o += '<rect x="' + C.x + '" y="' + C.y + '" width="' + C.w + '" height="' + C.h + '" rx="0.3" fill="#fff" stroke="#8a9bbb" stroke-width="0.05" stroke-dasharray="0.25 0.12"/>';
        var t1 = "🎨 Draw your team's mascot!";
        o += T(C.x + C.w / 2, C.y + 0.75, fit(t1, 0.5, C.w - 0.4), t1, { a: "middle", b: 1, c: "#1c3563" });
      } else if (kind === "how") {
        o += '<rect x="' + C.x + '" y="' + C.y + '" width="' + C.w + '" height="' + C.h + '" rx="0.3" fill="#eef3fb"/>';
        var lines = ["How to play", "1. Every time a team wins,", "    color one of its dots.", "2. Fill ALL your dots first?", "    You move on! ➜", "3. Write the winner in the", "    next box.", "4. Last team left = CHAMPION! 🏆"];
        var step = Math.min(0.85, (C.h - 1) / 8);
        lines.forEach(function (ln, i) { o += T(C.x + 0.35, C.y + 0.9 + i * step, i ? fit(ln, 0.42, C.w - 0.6) : 0.65, ln, { b: i === 0, c: i ? "#222" : "#1c3563" }); });
      } else if (kind === "league") {
        var lg = c < 3 ? "AL" : "NL", nmL = lg === "AL" ? "American League" : "National League";
        var teams = res.seeds[lg], lz = Math.min(1.7, (C.w - 0.4) / 3.4, (C.h - 1.6) / 3.2);
        var gh2 = 2 * lz * 1.55, y0 = C.y + (C.h - gh2) / 2 + 0.4;
        o += T(C.x + C.w / 2, y0 - 0.55, fit(nmL, 0.55, C.w), nmL, { a: "middle", b: 1, c: "#8a9bbb" });
        teams.forEach(function (t, i) {
          var cx = C.x + C.w / 2 + ((i % 3) - 1) * lz * 1.15, cy = y0 + lz / 2 + Math.floor(i / 3) * (lz * 1.55);
          var u = M.logoUrl(res, t);
          o += '<circle cx="' + cx + '" cy="' + cy + '" r="' + lz / 2 + '" fill="#fff" stroke="#bbb" stroke-width="0.03"/>';
          if (u) o += '<image href="' + esc(u) + '" x="' + (cx - lz * 0.38) + '" y="' + (cy - lz * 0.38) + '" width="' + lz * 0.76 + '" height="' + lz * 0.76 + '"/>';
          o += T(cx, cy + lz / 2 + 0.32, fit(nm(res, t), 0.28, lz * 1.1), nm(res, t), { a: "middle", c: "#333" });
        });
      } else {
        var f = kidFacts[fi++ % Math.max(1, kidFacts.length)];
        if (!f) return;
        o += '<rect x="' + C.x + '" y="' + C.y + '" width="' + C.w + '" height="' + C.h + '" rx="0.3" fill="#f3fbf6"/>';
        o += T(C.x + C.w / 2, C.y + C.h * 0.35, Math.min(1.3, C.h * 0.22), f.e, { a: "middle" });
        o += T(C.x + C.w / 2, C.y + C.h * 0.35 + 0.7, 0.3, "Did you know?", { a: "middle", b: 1, c: "#1f7a4d" });
        wrap(f.t, Math.max(12, Math.floor((C.w - 0.4) / (0.36 * 0.55)))).forEach(function (ln, i) {
          o += T(C.x + C.w / 2, C.y + C.h * 0.35 + 1.25 + i * 0.48, 0.36, ln, { a: "middle", c: "#222" });
        });
      }
      out += o; mark(c, r);
    }
    for (var r = 1; r < R; r++) for (var c = 0; c < 7; c++) {
      if (used[c + ":" + r]) continue;
      var kind = c === 3 ? (used["3:how"] ? "fact" : (used["3:how"] = "how")) : (c === 2 || c === 4) ? (used[c + ":lg"] ? "fact" : (used[c + ":lg"] = "league")) : (c === 0 || c === 6) ? "draw" : "fact";
      card(c, r, kind);
    }
    out += T(W / 2, H - 0.25, 0.18, opt.footer || "", { a: "middle", c: "#aaa" });
    kidPoster.lastBoxes = boxes;   // for tests: every fillable box must sit inside one sheet
    return out + '</svg>';
  }

  function tiles(res, opt) {
    var W = opt.w, H = opt.h, G = tileGrid(W, H);
    if (G.error) return { html: '<div class="tile-page"><div class="tp-in" style="padding:1in">' + esc(G.error) + '</div></div>', grid: G, sheets: 0 };
    var inner = kidPoster(res, opt, G);
    var P = G.paper, n = G.cols * G.rows, html = "";
    var pageStyle = 'style="width:' + P.w + 'in;height:' + P.h + 'in"';
    // guide sheet
    var gw = P.w - 1.2, gh = gw * H / W;
    if (gh > P.h * 0.55) { gh = P.h * 0.55; gw = gh * W / H; }
    var grid = "";
    for (var r = 0; r < G.rows; r++) for (var c = 0; c < G.cols; c++) {
      grid += '<rect x="' + (c * G.tw) + '" y="' + (r * G.th) + '" width="' + G.tw + '" height="' + G.th + '" fill="none" stroke="#d33" stroke-width="' + (W / 300) + '"/>';
      grid += '<text x="' + ((c + 0.5) * G.tw) + '" y="' + (r * G.th + H / 22) + '" font-size="' + (H / 18) + '" font-weight="700" text-anchor="middle" fill="#d33" fill-opacity=".8" font-family="Fredoka, sans-serif">' + rowName(r) + (c + 1) + '</text>';
    }
    html += '<div class="tile-page guide" ' + pageStyle + '><div class="tp-in">' +
      '<div class="tp-title">🧩 Your ' + W + ' × ' + H + ' inch wall bracket: ' + n + ' sheets + this guide</div>' +
      '<svg xmlns="' + NS + '" viewBox="0 0 ' + W + ' ' + H + '" style="width:' + gw + 'in;height:' + gh + 'in;display:block;margin:0.1in auto;border:1px solid #999">' + inner.replace(/^<svg[^>]*>/, "").replace(/<\/svg>$/, "") + grid + '</svg>' +
      '<ol class="tp-steps">' +
      '<li><b>Print every page at 100%</b> ("Actual size", not "Fit to page"), Letter paper, <b>' + G.orient + '</b>. Turn on "Background graphics".</li>' +
      '<li><b>Lay the sheets out like the map</b>: rows <b>A</b> (top) to <b>' + rowName(G.rows - 1) + '</b>, columns <b>1</b> (left) to <b>' + G.cols + '</b>. Each column of sheets is one round of the playoffs.</li>' +
      '<li><b>Cut along the dashed lines</b> ✂️ on each sheet\'s left and top edges (and right/bottom on the last column and row).</li>' +
      '<li><b>Overlap and tape:</b> slide each sheet over the <b>gray strip</b> of the sheet to its left and above, line up the connector lines, tape on the back.</li>' +
      '<li>Every dot, name line and box sits wholly on one sheet, so nothing a kid colors ever crosses a seam. 🖍️</li>' +
      '</ol></div></div>';
    var body = inner.replace(/^<svg[^>]*>/, "").replace(/<\/svg>$/, "");
    for (var rr = 0; rr < G.rows; rr++) for (var cc = 0; cc < G.cols; cc++) {
      var lastC = cc === G.cols - 1, lastR = rr === G.rows - 1;
      var fx = lastC ? 0 : FLAP, fy = lastR ? 0 : FLAP;
      var tx = cc * G.tw, ty = rr * G.th, vw = G.tw + fx, vh = G.th + fy;
      var ov = "";
      if (fx) ov += '<rect x="' + (tx + G.tw) + '" y="' + ty + '" width="' + fx + '" height="' + vh + '" fill="#888" fill-opacity=".28"/>' +
        '<text transform="translate(' + (tx + G.tw + fx / 2 + 0.05) + ',' + (ty + vh / 2) + ') rotate(90)" font-size="0.13" text-anchor="middle" fill="#444" font-family="Fredoka, sans-serif">overlap: ' + rowName(rr) + (cc + 2) + ' goes on top</text>';
      if (fy) ov += '<rect x="' + tx + '" y="' + (ty + G.th) + '" width="' + (fx ? G.tw : vw) + '" height="' + fy + '" fill="#888" fill-opacity=".28"/>' +
        '<text x="' + (tx + G.tw / 2) + '" y="' + (ty + G.th + fy / 2 + 0.05) + '" font-size="0.13" text-anchor="middle" fill="#444" font-family="Fredoka, sans-serif">overlap: ' + rowName(rr + 1) + (cc + 1) + ' goes on top</text>';
      var cut = 'stroke="#000" stroke-width="0.012" stroke-dasharray="0.08 0.05"';
      ov += '<line x1="' + tx + '" y1="' + ty + '" x2="' + tx + '" y2="' + (ty + vh) + '" ' + cut + '/>';
      ov += '<line x1="' + tx + '" y1="' + ty + '" x2="' + (tx + vw) + '" y2="' + ty + '" ' + cut + '/>';
      if (lastC) ov += '<line x1="' + (tx + G.tw) + '" y1="' + ty + '" x2="' + (tx + G.tw) + '" y2="' + (ty + vh) + '" ' + cut + '/>';
      if (lastR) ov += '<line x1="' + tx + '" y1="' + (ty + G.th) + '" x2="' + (tx + vw) + '" y2="' + (ty + G.th) + '" ' + cut + '/>';
      var name = rowName(rr) + (cc + 1);
      var nb = [cc > 0 ? "⬅ " + rowName(rr) + cc : null, rr > 0 ? "⬆ " + rowName(rr - 1) + (cc + 1) : null, !lastC ? rowName(rr) + (cc + 2) + " ➡" : null, !lastR ? rowName(rr + 1) + (cc + 1) + " ⬇" : null].filter(Boolean).join(" · ");
      html += '<div class="tile-page" ' + pageStyle + '><div class="tp-name">' + name + '</div>' +
        '<div class="tp-head">MLB Playoffs ' + (opt.season || 2026) + ' wall bracket · sheet <b>' + name + '</b> (' + ((rr * G.cols) + cc + 1) + ' of ' + n + ')</div>' +
        '<svg xmlns="' + NS + '" class="tp-svg" viewBox="' + tx + ' ' + ty + ' ' + vw + ' ' + vh + '" style="width:' + vw + 'in;height:' + vh + 'in;left:' + ((P.w - (G.tw + FLAP)) / 2) + 'in;top:' + TOP_M + 'in" font-family="Fredoka, Arial Rounded MT Bold, sans-serif">' +
        '<defs><marker id="karrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="4" markerHeight="4" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 z" fill="#1c3563"/></marker></defs>' +
        '<rect x="' + tx + '" y="' + ty + '" width="' + vw + '" height="' + vh + '" fill="#fff"/>' + body + ov + '</svg>' +
        '<div class="tp-foot">✂️ Cut on the dashed lines · gray strip = tape the next sheet over it · ' + nb + '</div></div>';
    }
    return { html: html, grid: G, sheets: n };
  }

  window.MLBPrint = { build: build, page2: page2, tiles: tiles, tileGrid: tileGrid, kidPoster: kidPoster };
})();
