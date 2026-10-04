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

TODO: add what you checked and changed after reading the code.

## Session 2: TODO date, setup and deploy

TODO: Supabase setup, env vars, first deploy, any errors hit and the prompts you used to fix them (verbatim).

## Session 3: TODO date, my own changes

TODO: the changes you made by hand (e.g. rewriting Lou's persona, changing the roast thresholds in `moodFor`, adding a feature) and any prompts.

## One place AI got it wrong

TODO (one short paragraph): a time a tool was confidently wrong, proposed something that couldn't work, or introduced a bug, and what you did about it.

## Time log

| Date | Hours | What |
| --- | --- | --- |
| 10/4 | TODO | Idea, scaffold, local run |
| TODO | | |
