# MLB Playoffs 2026 — Family Hub ⚾

A kid-first MLB playoff hub. It's built so a 6-year-old can follow the bracket: every series shows
**"first to N wins"** as dots to fill in.

- **Live:** https://craigm26.github.io/MLBPlayoffs2026ForFamilies/ (and `pi-nas.local/mlb` at home)
- **Tabs:** Home (live scoreboard + "what this game means"), Bracket (tap a series for every game:
  when, where, TV), Games (+ box scores), Teams (roster, season stats ranked among the 12 playoff
  teams, stars to know, fun facts), Map (ballparks + travel miles), Quiz, Family Picks, How It Works
  (a pretend best-of-3/5/7 series).
- **Print** (`mlb/print.html`, the 🖨️ button on the Bracket tab):
  - **📄 Letter** is one page, wide or tall.
  - **🖼️ Poster (any size)** takes its paper size from the print dialog.
  - **📐 One big sheet** is an exact size in inches (default 49 × 33) for a print shop. The bracket
    stretches to fill the paper's shape.
  - **🧩 Big poster on Letter sheets** builds a wall poster (default 49 × 33 in = 28 portrait
    sheets, 7 × 4) plus a guide page with the tile map and assembly steps.
  - Every mode has a fill: blank to color in, real results so far, or a family member's picks.
    Optional page 2 has the full schedule (every game: date/time or TBA, place, TV), the ballpark
    map, fun facts and a mini quiz.

### Kid-safe wall poster

The tiled poster is colored in by small kids, so it's designed so that **nothing they draw on
ever crosses a seam**. The sheet grid *is* the bracket grid: 7 columns of sheets, one per bracket
column (AL Wild Card → AL Division → AL Championship → World Series ← NL …). A header row says
which round each column is and how many wins it takes. Every series box (team names, write-in
lines, ~1.1 in win-dots) sits wholly on one sheet with a ½ in safe margin. Only thin connector
arrows cross the seams. The remaining sheets hold the Champion box, How to play, league logos,
"draw your team's mascot" frames and big-print fun facts. Each sheet is labeled (A1…D7), with
dashed cut lines and a gray overlap strip to tape the next sheet over.
`mlb/tests/tiles.test.js` checks those margins at five poster sizes.

## How the data flows

- **Home server (Pi):** `mlb/update_mlb.py` runs from cron every minute. It writes `live.json` and
  downloads team logos to `logos/`.
- **Anywhere else (GitHub Pages):** there's no `live.json`, so `mlb-espn.js` builds the same feed in
  the browser from ESPN's public scoreboard (it's CORS-enabled). Logos load from ESPN's CDN and
  are not stored in this repo. No GitHub Actions.
- Rosters, team stats, leaders and box scores come from ESPN in the browser (`mlb-teamdata.js`).

## Develop

```
node --test mlb/tests/*.test.js      # bracket engine (real 2025 postseason), game locations,
                                     # quiz/map data, wall-poster seam margins
python3 mlb/update_mlb.py            # refresh live.json locally
open mlb/?feed=tests/demo-live.json  # a frozen 2025 ALCS Game 7 with a fake live inning
```

Deploy to the Pi: `rsync -a --exclude tests --exclude live.json mlb/ merry@pi-nas.local:/var/www/html/mlb/`

Scores and stats from ESPN. Team names and logos are trademarks of their clubs and MLB. This is an
unofficial family project.
