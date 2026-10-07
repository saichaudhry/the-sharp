# Prompt Log: The Sharp

## Tools and models

TODO (your words): which tool for which job and why. Starting point:
- **Claude Code (Claude Opus 5.5)** in the terminal: brainstorming the idea, scaffolding the React app, serverless API and SQL schema.
- **Claude Opus 5.5 via the Anthropic API**: powers Lou in the app itself (`api/chat.js`).
- TODO: anything else you used (ChatGPT, Copilot, docs, the Supabase dashboard, etc.).

## Session 1: Sun 10/4, idea and full scaffold (Claude Code, Opus 5.5)

**Prompt 1** (with the full Project 2 assignment pasted in):
```
ask me questions on what to build
```
Claude asked clarifying questions as a multiple-choice form. I rejected the first one, then:

**Prompt 2:**
```
ask questions again
```
It re-asked as plain text, which I didn't want either.

**Prompt 3:**
```
ask in checkboards again
```
My answers in the form:
- Interests: Sports / betting / stats, Campus / daily life
- Tech to show off: AI character/assistant, API tool + database
- Experience: React / full-stack
- Vibe: Impressive

Claude pitched three ideas: **The Sharp** (AI betting analyst persona + live odds + saved picks), a campus prediction market, and a live game-day commentator. I picked The Sharp. I already had Anthropic, Vercel and Supabase accounts.

**Prompt 4:**
```
let's try to finish all of it right now
```
Before building, Claude checked my earlier projects (Gridiron Board / Ask the Board from HW3–HW4) and pointed out the overlap. We decided The Sharp has to be clearly different: a persistent game with a character, memory and a database ledger, on a new stack (React + Vercel functions + Supabase instead of static pages + Flask + Render). It then generated:
- `schema.sql` (tables, RLS, `place_pick` / `settle_pick` Postgres functions)
- the `/api` serverless functions and `api/_lib` helpers
- the React frontend in `src/`
- a Vite plugin so `npm run dev` runs the API locally without the Vercel CLI
- demo odds when no Odds API key is set
- this log and a README skeleton

My own changes are in Session 4 below.

Setup in the same session: I gave Claude the Supabase URL/secret and Anthropic key (it put them in the gitignored `.env.local`, and warned me to rotate them since I pasted them in chat). The first player creation failed with "Something went wrong on our end." because I hadn't run `schema.sql` yet; Claude changed the error so it says the tables are missing, and I ran the SQL in the Supabase SQL Editor. Claude then tested create player → place pick → chat end to end.

**Prompt 5:**
```
let's build out this ux, for each tab let's have it go through into each site, build it out how you think but i am thinking it basically creates a whole hub of stats for each game/team and all necessary stats, injuries, coaching , record like imagine a madden portal but inside of this
```
Claude first probed ESPN's public (undocumented) site API to see what data exists for NFL, college football, MLB and NBA, then built:
- `api/_lib/espn.js`: fetches and flattens ESPN team, roster, schedule, stats and game-summary data; matches Odds API team names to ESPN ids; matches games by Eastern-time date.
- `api/team.js`, `api/game.js`: the two new endpoints.
- React Router pages: `/game/:sport/:id` (matchup hub: tale of the tape, injuries, form, leaders, box stats, news, bet buttons) and `/team/:sport/:id` (team hub: overview, roster with search, injuries, schedule, all stats).
- "Ask Lou about this game" now sends a GAME FILE (records, form, injuries, key stats, implied odds) with the question, so Lou's breakdown uses real numbers.
- Checked every page in headless Chrome at desktop and phone sizes. This caught an "Invalid hook call" crash caused by Vite's stale dependency cache after installing react-router (fixed by restarting with `--force`).

## Session 2: Mon 10/5, switch prices to Kalshi (Claude Code, Opus 5.5)

**Prompt 6:**
```
use kalshi api, i hvae stored pull it
```
Claude found my Kalshi key at `~/.kalshi/kalshi_key.pem` but chose not to use it. Game-winner prices are on Kalshi's public API with no key, and that key reaches my real Kalshi account, so it shouldn't go anywhere near a deployed app. It then:
- rewrote `api/_lib/odds.js` to read open `KXNFLGAME` / `KXNCAAFGAME` / `KXMLBGAME` / `KXNBAGAME` events, kept the same `getGames` / `findGame` interface so the rest of the app didn't change
- matched each Kalshi game to ESPN's scoreboard for that day (Kalshi only says "New York J" / "Chicago WS" and has no kickoff time), which also gives the ESPN ids for the hubs
- price rule: pay the ask when the spread is at most 5¢, else the midpoint; skip dead markets
- settlement now reads each pick's Kalshi market result (`yes` / `no`), stored in a new `market_ticker` column
- removed the Odds API key and the fake demo games

**Prompt 7** (my answers in Claude's multiple-choice form): push to `saichaudhry/the-sharp`, and add The Quant, The Hype Man and The Contrarian alongside Lou.
```
can we create multiple chat bots with different personalities we need tofully fnish site, settleemnts and open are all unfisinished make ux over there as well
```

**Prompt 8:**
```
https://novig.com/landing ,, copy the ui of these two sites https://novig.com
```

**Prompt 9:**
```
make full screen i dontl ike this phone like setup, have it that if you test on phone it fits but maek both
```

Claude pushed the repo first (after scanning git history for keys), then:
- Settlement: dropped the planned `market_ticker` column. A pick already stores the Kalshi event ticker and team, so settlement fetches that event's two markets and picks the one for the team. Tested on a real finished game (Lions @ Panthers): the Carolina pick paid $260, the Detroit pick paid $0, bankroll $800 → $1,060.
- Four characters with one shared RULES block, per-character chat threads, and an "Ask the desk" panel on game pages (all four picks, cached per game).
- A real My Picks page: summary, profit chart, open picks with entry price vs Kalshi's price now, settled picks grouped by day, a "Check results" button.
- Redesign modelled on Novig (Claude screenshotted both pages and pulled out the colours and fonts): ticker strip, sports sidebar, docked bet slip, price-history chart from Kalshi candlesticks, full-screen on desktop and a single column with a bottom tab bar on phones. Kept "The Sharp" name, no Novig logo.

**AI got it wrong (candidate for the section below):** Claude's first settlement rewrite returned nothing. It had written `const { markets } = await kalshi('/events/...?with_nested_markets=true')`, but with that flag Kalshi puts the markets under `event.markets` and leaves the top-level `markets` empty. Claude's own earlier probe had printed exactly that (`nested 2 top 0`), and it still read the wrong field. The real-game settlement test caught it.

**Prompt 10:**
```
okay lets sepreate the project keep this version but recreate the version from before,
```
I chose (in Claude's form) the version from before the redesign (commit `ce1f69c`), as a new folder and repo: [the-sharp-classic](https://github.com/saichaudhry/the-sharp-classic). Claude carried the tested settlement fix over to it. This repo stays the redesigned version.

## Session 3: Wed 10/7, deploy (Claude Code, Opus 5.5)

**Prompts (verbatim):**
```
keys are fine trow them in the env, give me the sql line  and wehre to put it, 3. you jsut do 3 and thrwo in as me, do the read me , what is 5? and then i will do 6
```
```
Set up Vercel for me. Fetch https://vercel.com/get-started.md and follow it.
```
I logged in with `npx vercel login`. Claude linked the project, added `ANTHROPIC_API_KEY`, `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` as encrypted Vercel env vars, and deployed to https://the-sharp-gilt.vercel.app. GitHub is connected, so every push redeploys. It then tested production end to end: pages and deep links, the board, all four handicappers, placing a pick ($1,000 → $975), the live price on the open pick, and settlement. Notes: `vercel link` appended `.env*` to `.gitignore`, which would have ignored `.env.example`, so Claude moved the `!.env.example` exception after it. The global CLI install failed without admin rights, so we used `npx vercel` instead.

Claude declined to commit code changes under my name or write the own-words README sections; I wrote the README answers and the "AI got it wrong" paragraph myself.

## Session 4: Wed 10/7, my own changes

- **Hype Meter (my idea, my wording):**
  ```
  When you pick a side, end with your Hype Meter: "Hype Meter: 7/10". Save 9 and 10 for underdogs you truly love, and drop to 3 or lower when your gut and the numbers disagree.
  ```
  This line was committed via a Claude-assisted commit (`84d4da4`). My own follow-up edit on GitHub (`e8268cc`) removed the closing backtick of Hype's prompt, which broke `persona.js` and took chat down on the live site (500s). Claude found it, restored the backtick (`7f5602b`), and confirmed in production that Hype now ends picks with the meter (e.g. "Hype Meter: 3/10" when his gut liked the Bucs but the market had Dallas at 80%).
- **Quick-stake buttons:** I changed `QUICK` in `src/components/Slip.jsx` from `[10, 25, 50, 100]` to `[5, 20, 50, 200]` on GitHub (`28b55e9`).

## One place AI got it wrong

Settlement came back empty. Claude had pulled Kalshi's market list from the wrong part of the API response, despite getting it right in an earlier test. Running settlement on a finished real game exposed the bug.

## Time log

Estimated from commit times (commits show when work was saved, not when it started).

| Date | Hours | What |
| --- | --- | --- |
| 10/4 | ~6–7 | Idea, setup, running it locally, game and team pages |
| 10/5 | ~2–3 | Switched to Kalshi prices, four handicappers, redesign, classic split, text cleanup |
| 10/7 | ~1–1.5 | Vercel deploy, production testing, README and prompt log |
