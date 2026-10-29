# Notes for Claude

This repo is Joe's offline Italian flashcard app, served by GitHub Pages from `main` (root). See README.md for the data format.

Weekly routine when a new lesson's handouts arrive:
- Write a new `data/<set>.json` (new ids, never reuse or rename existing ones), or append cards to an existing set.
- Don't put Leona's exercise answers or the handout dialogue lines on cards; homework stays Joe's to do.
- Note handout errors on the cards (`note`) or in a "Notes on the handouts" ref section.
- Run `python3 tools/build_index.py`; fix anything it reports.
- Test locally if the app code changed: `python3 -m http.server` and load it in Playwright, including with the context set offline.
- Commit and push to `main`.

Only bump `VERSION` in sw.js when sw.js logic changes. New data needs no service-worker change.
Don't commit the course PDFs or audio.
