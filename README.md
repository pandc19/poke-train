# Poké Train

Track Pokédex progress and a trained competitive roster across Pokémon games. The first game module is **Pokémon Violet**.

- **Pokédex grid** per regional dex with click, shift-click range and drag-to-paint toggling. Each game also has its own **National Dex** tab: the same caught list as its regional dexes, with a badge on Pokémon you caught in your other games.
- **Spreadsheet importer** (.csv / .xlsx) with a column-mapping step. Reads Spanish or English names and tolerates typos.
- **Trained roster** as cards or a dense table. Every nature, ability, item, EV spread and move is a checklist item: orange while pending, green when done.
- **Have it now vs. caught.** A caught Pokémon stays in the Pokédex after it evolves. Untick its ✓ and it shows as "not in my box" (with what it evolved into), and the breeding planner stops counting it as a parent.
- **Genders.** Record ♂/♀ on caught Pokémon in the Pokédex and on roster cards; the breeding planner uses them to know which parents you actually have.
- **Move legality check** against the game's real learnsets (no AI involved).
- **Breeding assistant**: finds parents in your roster and Pokédex, fathers that can pass an egg move, multi-generation chains, and the Mirror Herb picnic shortcut.
- **Starter team**: checks which Pokémon in the game can do early utility jobs (catching, egg hatching) from real moveset and ability data, and whether you already have one.
- **Optional AI** (OpenAI or Claude, switchable): build and team audits, where to find items and TMs, where to catch a Pokémon.

## Run it locally

**You need:** Node 24, npm, and Docker with the `postgres18` container (PostgreSQL 18 on port 5432). The app uses its own role and database inside that container; it does not start another one and does not touch other projects' databases.

1. **Make sure Postgres is up.**
   ```bash
   docker ps --filter name=postgres18     # should show "Up"
   docker start postgres18                # only if it is stopped
   ```
2. **Create the role and database (once).** Safe to re-run.
   ```bash
   ./scripts/setup-db.sh
   ```
   This creates the role `poketrain` (with `CREATEDB`, which Prisma needs for migrations) and the database `poketrain_dev`.
3. **Install dependencies.**
   ```bash
   npm install
   ```
4. **Create your env file.** The database URL works as-is.
   ```bash
   cp .env.local.example .env.local
   ```
5. **Create the tables and seed the base rows** (your user, the Violet game and one save profile).
   ```bash
   npm run db:migrate
   npm run db:seed
   ```
6. **Download the Pokémon reference data from PokéAPI.** About two minutes the first time. It can be interrupted and resumed, and only needs repeating when a game is added.
   ```bash
   npm run sync:pokeapi
   ```
7. **Start the app** and open http://localhost:3000.
   ```bash
   npm run dev
   ```

**Day to day:** `docker start postgres18` if needed, then `npm run dev`.

### Environment variables

| Variable | Required | Purpose |
|---|---|---|
| `DATABASE_URL` | yes | Connection string for the `poketrain_dev` database |
| `AI_PROVIDER` | no | `openai` (default) or `claude` |
| `OPENAI_API_KEY` | for OpenAI | Enables AI features with OpenAI |
| `OPENAI_BULK_MODEL` | no | Everyday requests. Default `gpt-4o-mini` |
| `OPENAI_ESCALATION_MODEL` | no | Harder requests. Default `gpt-4o` |
| `ANTHROPIC_API_KEY` | for Claude | Enables AI features with Claude |
| `ANTHROPIC_WORKSPACE_ID` | if needed | Required when the API says the key is not scoped to a workspace |
| `CLAUDE_BULK_MODEL` | no | Everyday requests. Default `claude-sonnet-5-5` |
| `CLAUDE_ESCALATION_MODEL` | no | Harder requests. Default `claude-opus-5-5` |
| `CLAUDE_MODEL` / `OPENAI_MODEL` | no | Older single-model setting: used for both when the pair above is not set |

**Which model does what.** The bulk model answers single-Pokémon audits and location lookups. The escalation model answers the whole-roster audit and the starter-team advice, and you can re-run any single audit on it with "Re-run with the stronger model". Claude models older than Opus 4.6 / Sonnet 4.6 (such as Haiku) automatically use the basic web search tool.

With no API key the app runs in **no-AI mode**: everything works except the AI buttons, which explain how to turn them on. To switch provider, change `AI_PROVIDER` and restart `npm run dev`. AI answers are cached in the database, so repeating a question costs nothing.

### Other commands

| Command | What it does |
|---|---|
| `npm test` | Runs the unit tests |
| `npm run lint` | Lints the code |
| `npm run build` | Production build |
| `npm run db:studio` | Opens Prisma Studio to browse the data |
| `npm run db:reset` | **Deletes all data** in the database (roster, Pokédex, breeding plans, AI cache, and the Pokémon reference data) but keeps the tables. It does nothing else and runs no migration. Afterwards run `npm run db:seed` and then `npm run sync:pokeapi` |
| `docker exec -it postgres18 psql -U poketrain -d poketrain_dev` | Opens a SQL shell on the database |

### Common problems

- **Connection refused** on startup or migrate: the `postgres18` container is stopped. Run `docker start postgres18`.
- **Port 3000 is taken:** `npm run dev -- -p 3001`.
- **Empty Pokédex:** the reference data has not been synced. Run `npm run sync:pokeapi`.
- **AI button says "not configured":** add a key to `.env.local` and restart the dev server.

## Importing a spreadsheet

Open **Import**, drop the file, check what each column is imported as, preview, then import. `samples/violet-roster.csv` is a working example.

How rows are read:

- **Status column.** "Listo" / "Done" marks everything done. "Falta golpe bajo" / "Missing Sucker Punch" marks only that move pending. A **blank status means you do not have that Pokémon yet** (Obtained = No); any status text means you do.
- **Recommended vs. current columns.** When a row has current moves, those are the build that is tracked and counted as known; the recommended list is kept in the notes. With only recommended moves, everything starts pending.
- **Nature** is done when the current nature matches the recommended one.
- **Alternatives** such as "Vidasfera o Cinta Elegida" keep the first as the item and the full text as a note.
- **Unrecognised names** are kept as typed and flagged, so nothing from the sheet is lost. Fix them with **Edit** in the roster table.

## How it is put together

| Path | What lives there |
|---|---|
| `src/lib/games/` | Per-game config. Adding a game is a new entry here plus a seed and sync |
| `prisma/schema.prisma` | Reference data (from PokéAPI) and user data |
| `scripts/sync-pokeapi.ts` | Reference data download, cached in `.cache/pokeapi` |
| `src/lib/import/` | Name matching, column mapping and row interpretation |
| `src/lib/roster-status.ts` | The pending/complete status engine |
| `src/lib/legality.ts` | Move legality from learnsets |
| `src/lib/breeding/` | Breeding engine (`engine.ts` is pure and unit tested) |
| `src/lib/ai/` | Provider interface, OpenAI and Claude providers, prompts and caching |
| `src/app/` | Pages and API routes |

**Data sources.** PokéAPI supplies everything deterministic: species, types, stats, egg groups, abilities, items, moves and learnsets, in English and Spanish. AI is used only for judgement and for facts PokéAPI does not have. PokéAPI has no wild-encounter data for Generation 9, so "where do I catch this" is an AI web lookup; treat those answers as a lead to check in game.

**Multi-dex linking.** Caught state is stored once, per save profile and species. A game's regional dexes and its National Dex are two views of those same rows, so marking a Pokémon in one marks it in the other. Other games' saves only add the "caught in ..." badges; they never count as caught.
