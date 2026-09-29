#!/usr/bin/env python3
"""MLB Playoffs family hub — live feed updater.

Pulls ESPN's free, no-key scoreboard one day at a time (the date-RANGE form of the
endpoint returns nothing for MLB) across the postseason window and writes
live.json next to index.html. Run every minute from cron on the Pi.

Cheap by design: a day whose games are all Final is cached in live.json and never
fetched again; only days with unfinished games, plus today +/- 1 and the next few
days (schedule/pitchers change), are re-fetched each run.

Usage: update_mlb.py [--season 2026] [--out path/live.json] [--all]
"""
import argparse
import datetime as dt
import json
import os
import sys
import tempfile
import urllib.request

UA = {}  # ESPN 403s browser-ish/custom UAs; the default Python-urllib UA is accepted
BOARD = "https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/scoreboard?dates={d}"
STAND = "https://site.api.espn.com/apis/v2/sports/baseball/mlb/standings?season={y}"

# Postseason window per season (first Wild Card day .. last possible World Series day).
WINDOWS = {
    2025: ("2025-09-30", "2025-11-02"),
    2026: ("2026-09-29", "2026-11-07"),
}


def get(url):
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=20) as r:
        return json.loads(r.read().decode("utf-8"))


def round_of(headline):
    h = (headline or "").upper()
    for key in ("WC", "DS", "CS"):
        for lg in ("AL", "NL"):
            if h.startswith(lg + key):
                return lg, key
    if h.startswith("WORLD SERIES"):
        return "WS", "WS"
    return None, None


def game_no(headline):
    try:
        return int((headline or "").rsplit("Game", 1)[1].split()[0])
    except (IndexError, ValueError):
        return None


def real_team(ab):
    """Placeholder rows carry 'TBD' or 'Yankees/Red Sox' — only real club codes count."""
    return ab if ab and ab != "TBD" and "/" not in ab and len(ab) <= 4 else None


def ath(x):
    a = (x or {}).get("athlete") or {}
    return a.get("shortName") or a.get("displayName")


def norm_event(e):
    c = e["competitions"][0]
    notes = [n.get("headline") for n in c.get("notes", []) if n.get("headline")]
    head = notes[0] if notes else ""
    lg, rnd = round_of(head)
    if not rnd:
        return None  # not a postseason game
    st = c.get("status") or e.get("status") or {}
    stt = st.get("type") or {}
    state = stt.get("state")  # pre / in / post
    status = "FINAL" if stt.get("completed") else ("LIVE" if state == "in" else "PRE")
    if stt.get("name") in ("STATUS_POSTPONED", "STATUS_SUSPENDED", "STATUS_DELAYED", "STATUS_RAIN_DELAY"):
        status = "DELAY" if state == "in" else "PPD"
    side = {}
    for comp in c.get("competitors", []):
        t = comp.get("team") or {}
        probs = comp.get("probables") or []
        side[comp.get("homeAway")] = {
            "t": real_team(t.get("abbreviation")),
            "r": int(comp["score"]) if str(comp.get("score", "")).isdigit() and status != "PRE" else None,
            "h": comp.get("hits") if status != "PRE" else None,
            "e": comp.get("errors") if status != "PRE" else None,
            "ls": [int(l.get("value", 0)) for l in comp.get("linescores", [])] if status != "PRE" else [],
            "sp": ath(probs[0]) if probs else None,
            "w": bool(comp.get("winner")),
        }
    home, away = side.get("home", {}), side.get("away", {})
    g = {
        "id": e.get("id"),
        "date": e.get("date"),
        "lg": lg,
        "rd": rnd,
        "gn": game_no(head),
        "note": head,
        "ifnec": "necessary" in head.lower(),
        "timeTBD": c.get("timeValid") is False or (e.get("date") or "").endswith("T04:00Z"),
        "status": status,
        "detail": stt.get("shortDetail"),
        "inning": st.get("period"),
        "home": home.get("t"), "away": away.get("t"),
        "hr": home.get("r"), "ar": away.get("r"),
        "hh": home.get("h"), "ah": away.get("h"),
        "he": home.get("e"), "ae": away.get("e"),
        "hls": home.get("ls"), "als": away.get("ls"),
        "hsp": home.get("sp"), "asp": away.get("sp"),
        "tv": ", ".join(sorted({n for b in c.get("broadcasts", []) for n in b.get("names", [])})) or None,
        "venue": ((c.get("venue") or {}).get("fullName")),
        "city": (((c.get("venue") or {}).get("address")) or {}).get("city"),
        "series": (c.get("series") or {}).get("summary"),
    }
    if status == "LIVE":
        s = c.get("situation") or {}
        g["sit"] = {
            "b": s.get("balls"), "s": s.get("strikes"), "o": s.get("outs"),
            "on": [bool(s.get("onFirst")), bool(s.get("onSecond")), bool(s.get("onThird"))],
            "bat": ath(s.get("batter")), "pit": ath(s.get("pitcher")),
            "last": ((s.get("lastPlay") or {}).get("text")),
        }
    if status == "FINAL":
        fa = {f.get("name"): ath(f) for f in (st.get("featuredAthletes") or [])}
        g["wp"], g["lp"], g["sv"] = fa.get("winningPitcher"), fa.get("losingPitcher"), fa.get("savingPitcher")
    return g, c


def team_info(c, teams):
    for comp in c.get("competitors", []):
        t = comp.get("team") or {}
        ab = real_team(t.get("abbreviation"))
        if ab and ab not in teams:
            teams[ab] = {
                "name": t.get("displayName"), "short": t.get("shortDisplayName") or t.get("name"),
                "city": t.get("location"), "color": "#" + (t.get("color") or "444444"),
                "alt": "#" + (t.get("alternateColor") or "ffffff"), "logo": t.get("logo"),
            }


def fetch_logos(teams, folder):
    os.makedirs(folder, exist_ok=True)
    for ab, t in teams.items():
        dest = os.path.join(folder, ab + ".png")
        if t.get("logo") and not os.path.exists(dest):
            try:
                req = urllib.request.Request(t["logo"], headers=UA)
                with urllib.request.urlopen(req, timeout=20) as r:
                    data = r.read()
                with open(dest + ".tmp", "wb") as f:
                    f.write(data)
                os.chmod(dest + ".tmp", 0o644)
                os.replace(dest + ".tmp", dest)
            except Exception as ex:
                print(f"logo {ab}: {ex}", file=sys.stderr)


def seeds_for(year):
    d = get(STAND.format(y=year))
    out = {}
    for lg in d.get("children", []):
        key = "AL" if "American" in lg.get("name", "") else "NL"
        rows = []
        for div in lg.get("children") or [lg]:
            for en in (div.get("standings") or {}).get("entries", []):
                s = {x["name"]: x.get("value") for x in en.get("stats", [])}
                seed = s.get("playoffSeed")
                if seed and 1 <= int(seed) <= 6:
                    w, l = int(s.get("wins") or 0), int(s.get("losses") or 0)
                    rows.append((int(seed), en["team"]["abbreviation"], w, l))
        rows.sort()
        if len(rows) == 6:
            out[key] = [{"t": t, "w": w, "l": l} for _, t, w, l in rows]
    return out if len(out) == 2 else None


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--season", type=int, default=2026)
    ap.add_argument("--out", default=os.path.join(os.path.dirname(os.path.abspath(__file__)), "live.json"))
    ap.add_argument("--all", action="store_true", help="refetch every day in the window")
    a = ap.parse_args()

    try:
        prev = json.load(open(a.out))
        if prev.get("season") != a.season:
            prev = {}
    except Exception:
        prev = {}
    days = prev.get("days", {})          # "YYYYMMDD" -> [game, ...]
    teams = {k: v for k, v in prev.get("teams", {}).items() if real_team(k)}
    seeds = prev.get("seeds")

    start, end = (dt.date.fromisoformat(x) for x in WINDOWS[a.season])
    today = dt.datetime.now(dt.timezone.utc).date()
    d = start
    fetched = errors = 0
    while d <= end:
        key = d.strftime("%Y%m%d")
        cached = days.get(key)
        near = -1 <= (d - today).days <= 3
        done = cached is not None and len(cached) > 0 and all(g["status"] == "FINAL" for g in cached)
        past_empty = cached == [] and (today - d).days > 1
        future_far = (d - today).days > 3 and cached is not None
        if a.all or near or not (done or past_empty or future_far):
            try:
                board = get(BOARD.format(d=key))
                games = []
                for e in board.get("events", []):
                    r = norm_event(e)
                    if r:
                        games.append(r[0])
                        team_info(r[1], teams)
                days[key] = games
                fetched += 1
            except Exception as ex:  # keep the cached day; a flaky feed never erases results
                errors += 1
                print(f"{key}: {ex}", file=sys.stderr)
        d += dt.timedelta(days=1)

    if not seeds or a.all:
        try:
            seeds = seeds_for(a.season) or seeds
        except Exception as ex:
            print(f"seeds: {ex}", file=sys.stderr)

    fetch_logos(teams, os.path.join(os.path.dirname(a.out), "logos"))
    games = sorted((g for k in sorted(days) for g in days[k]), key=lambda g: g["date"] or "")
    out = {
        "season": a.season,
        "updated": dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds"),
        "seeds": seeds,
        "teams": teams,
        "games": games,
        "days": days,
    }
    fd, tmp = tempfile.mkstemp(dir=os.path.dirname(a.out), suffix=".tmp")
    with os.fdopen(fd, "w") as f:
        json.dump(out, f, separators=(",", ":"))
    os.chmod(tmp, 0o644)
    os.replace(tmp, a.out)
    live = sum(1 for g in games if g["status"] == "LIVE")
    print(f"{out['updated']} fetched {fetched} day(s), {errors} error(s); {len(games)} games, {live} live")


if __name__ == "__main__":
    main()
