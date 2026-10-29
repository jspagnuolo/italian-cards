# Italian Cards

Offline flashcards for the Ciao Bella Gente! Italian course (Level 2). It's an installable web app: open it once while online, add it to your home screen, and it works with no connection.

**Live:** https://jspagnuolo.github.io/italian-cards/

## Layout

```
index.html, style.css, app.js   the app (one page, no build step)
sw.js                           service worker: offline cache, network-first so updates arrive
manifest.webmanifest, icons/    install metadata
data/<set>.json                 one file per card set
data/index.json                 generated list of sets (don't edit by hand)
tools/build_index.py            validates every set and rebuilds data/index.json
tools/make_icons.py             regenerates icons
```

## Adding or updating cards (weekly)

1. Add `data/<new-set>.json` (or edit an existing set). Format below.
2. Run `python3 tools/build_index.py`. It refuses to write the index if anything is broken.
3. Commit and push. GitHub Pages redeploys in about a minute; every device picks up the change the next time the app opens online.

Never change an existing card's `id`: progress is stored per id, so a renamed id resets that card.

## Set format

```json
{
  "id": "time-travel",              // must match the file name
  "title": "Time & travel",
  "subtitle": "Clock, dates, directions, the station (Lesson 6)",
  "order": 60,                      // position on the home screen
  "defaultDir": "en",               // "en" = English first, "it" = Italian first
  "decks": {
    "tem": { "name": "Time words", "short": "time", "kind": "word", "color": "c2",
             "askEn": "Say it in Italian", "askIt": "What does this mean?" },
    "sta": { "name": "Station", "short": "phrase", "kind": "sent", "color": "cs",
             "ask": "Say it in Italian (formal, with Lei)" }
  },
  "cards": [
    { "id": "tm-ritardo", "deck": "tem", "it": "in ritardo", "en": "late, delayed",
      "ex": "Il treno è <b>in ritardo</b>.", "note": "optional tip" },
    { "id": "st-orario", "deck": "sta", "q": "Is the train on time?", "a": "Il treno è in orario?",
      "g": "optional alternative answer", "note": "optional tip" }
  ],
  "refs": [ { "title": "Reference chart", "html": "<div class=\"tblwrap\"><table class=\"ref\">…</table></div>" } ]
}
```

- `kind: "word"` cards have `it` / `en` and can be shown either way round. Optional `ex`, `note`, `chips` (`[{"t": "maschile", "c": "m"}]`).
- `kind: "sent"` cards have `q` (prompt) / `a` (answer), optional `g`, `note`.
- Colors: `c1` blue, `c2` purple, `c3` amber, `c4` rose, `cs` green.

## Progress

Stored in each browser's localStorage under `ic.v1.<set id>`. The home screen has **Move progress to another device** (copy/paste or a file) and **Copy every practice list for Claude**.

The course handouts themselves are not in this repo, only the card wording.
