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

  window.MLBPrint = { build: build, page2: page2 };
})();
