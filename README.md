# MLB Playoffs 2026 — Family Hub ⚾

A kid-first MLB playoff hub. It's built so a 6-year-old can follow the bracket: every series shows
**"first to N wins"** as dots to fill in.

- **Live:** https://craigm26.github.io/MLBPlayoffs2026ForFamilies/ (and `pi-nas.local/mlb` at home)
- **Tabs:** Home (live scoreboard + "what this game means"), Bracket (tap a series for every game:
  when, where, TV), Games (+ box scores), Teams (roster, season stats ranked among the 12 playoff
  teams, stars to know, fun facts), Map (ballparks + travel miles), Quiz, Family Picks, How It Works
  (a pretend best-of-3/5/7 series).
- **Print:** `mlb/print.html` gives you Letter, or a Poster that takes its paper size from the print
  dialog (vector). The shape can be wide or tall, and the fill can be blank, real results, or a
  family member's picks. An optional page 2 has the full schedule, the ballpark map, fun facts
  and a mini quiz.

## How the data flows

- **Home server (Pi):** `mlb/update_mlb.py` runs from cron every minute. It writes `live.json` and
  downloads team logos to `logos/`.
- **Anywhere else (GitHub Pages):** there's no `live.json`, so `mlb-espn.js` builds the same feed in
  the browser from ESPN's public scoreboard (it's CORS-enabled). Logos load from ESPN's CDN and
  are not stored in this repo. No GitHub Actions.
- Rosters, team stats, leaders and box scores come from ESPN in the browser (`mlb-teamdata.js`).

## Develop

```
node --test mlb/tests/*.test.js      # bracket engine (real 2025 postseason), locations, quiz/map data
python3 mlb/update_mlb.py            # refresh live.json locally
open mlb/?feed=tests/demo-live.json  # a frozen 2025 ALCS Game 7 with a fake live inning
```

Deploy to the Pi: `rsync -a --exclude tests --exclude live.json mlb/ merry@pi-nas.local:/var/www/html/mlb/`

Scores and stats from ESPN. Team names and logos are trademarks of their clubs and MLB. This is an
unofficial family project.
