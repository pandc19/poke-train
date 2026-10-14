# Next ideas

Things we talked about and decided to do later. Nothing here is built yet.

## 1. Map guide ("how do I get to…")

A page where you type a place and the app says where to fast-travel and which way to go. No AI.
Not a map product: no game map art, no route drawing.

### What it should answer

- "Sierra Napada" → fast-travel to *Gimnasio de Sierra Napada* (the place sits right at that point).
- "Bosquejada" → fast-travel to *Área 3 Este*, then walk toward the lake (a place that is not on the game's map).

### Data model (one table, three kinds of entry)

| Kind | Has | Result |
|---|---|---|
| Fast-travel point | name es/en, province | the anchors; also a result by itself |
| Place with a position | name, x/y on a simple grid | nearest fast-travel point + compass direction + distance, computed |
| Place known by a hint | name, anchor (a fast-travel point), direction, distance bucket, note | "Viaja a X → hint" |

Fields to keep per entry:

- `nameEs`, `nameEn`, optional `aliases` (names vary between players and wikis).
- `kind`: `fast-travel` | `town` | `zone` | `landmark` | `custom`.
- `game` and `region` (Paldea mainland first; Kitakami and Blueberry later, each its own seed file).
- `anchorId` (a fast-travel entry), optional `x`, `y`.
- `direction`: n, ne, e, se, s, sw, w, nw (when there are no coordinates).
- `distance`: `junto a` | `cerca` | `a un paseo` | `lejos`.
- `note`: free text in Spanish ("hacia el lago", "por la cuesta").

### What the page does

- One search box, Spanish or English, ignoring accents and capitals; matches aliases too.
- Answer card: where to fast-travel, direction and distance, the note.
- A list of all places grouped by province.
- "Añadir lugar" form: name, nearest fast-travel point (picked from a list), direction, distance, note.
  Stored in the database per game, so the guide grows as you play. This is how the places that are
  not on the game's map get in.

### Seed data

- PokéAPI has **84 Paldea locations** (`GET /region/paldea` → `locations`), with English and French names.
  It has **no Spanish names and no coordinates** (checked: `names` has no `es`, `areas` is empty).
- Spanish names and the nearest fast-travel point for each have to be entered by hand
  (about 1 to 2 hours). Prepare a seed file with the English names and blank Spanish names / anchors,
  then fill it in.
- Do not scrape WikiDex prose: turning text into coordinates needs a model, and the text is CC BY-SA
  (would need attribution). Quoting a short note with a link is fine.
- Do not ship the game's map art.

### Build plan (small)

1. Table (`map_places`) + migration: the fields above, plus a per-profile flag for entries the player added.
2. Seed file for Paldea (84 locations) and a loader.
3. API: list, search, add, edit, delete (custom ones only).
4. Page `/[game]/map` (tab "Mapa"): search box, answer card, grouped list, add form.
5. Optional later: link the AI "¿Dónde lo encuentro?" results to a place here when the nearby name matches.

### Open questions

- Seed list first (English names + blanks to fill) or start nearly empty and grow by adding?
- Paldea only to begin? (Suggested: yes.)
- Do we want a rough direction/distance on seeded places, or only the anchor + note?

### Risks

- Accuracy depends entirely on the data entered. A straight-line direction ignores cliffs and water,
  so the short notes are what make it useful.
- Names change between wikis and languages: keep `aliases`.

## 2. Smaller things

- **Swipe to change page on the breeders list.** The roster list already does it
  (`RosterList.tsx`, pointer events with `touch-action: pan-y`); the breeders list has the same paging.
- **Level hint: show only for the stat being trained.** Today the "at the most it can be at level N"
  note appears for any stat at its maximum, and can be waved away per Pokémon. Showing it only for the
  stat chosen in "Entrenando" would make it less noisy.
- **Place names in AI answers.** Spanish place names depend on the model and its web search. Once the map
  guide has a place list, the same list can be used to localize place names after the answer
  (the way `localizeNames` does for moves, items and abilities).
