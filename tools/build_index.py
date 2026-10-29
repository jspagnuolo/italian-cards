"""Check every card set in data/ and rebuild data/index.json.

Run after adding or editing a set:  python3 tools/build_index.py
Fails loudly (exit 1) on duplicate ids, unknown decks or missing fields,
so a broken set never gets pushed.
"""
import json, sys, glob, os, datetime

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, "data")
errors, sets = [], []

for path in sorted(glob.glob(os.path.join(DATA, "*.json"))):
    name = os.path.basename(path)
    if name == "index.json":
        continue
    try:
        s = json.load(open(path, encoding="utf-8"))
    except Exception as e:
        errors.append(f"{name}: not valid JSON ({e})"); continue
    for k in ("id", "title", "decks", "cards"):
        if k not in s: errors.append(f"{name}: missing '{k}'")
    if errors: continue
    if s["id"] + ".json" != name:
        errors.append(f"{name}: id '{s['id']}' must match the file name")
    for dk, d in s["decks"].items():
        if d.get("kind") not in ("word", "sent"): errors.append(f"{name}: deck '{dk}' kind must be word or sent")
        if "name" not in d: errors.append(f"{name}: deck '{dk}' needs a name")
    seen = set()
    for i, c in enumerate(s["cards"]):
        cid = c.get("id")
        if not cid: errors.append(f"{name}: card #{i} has no id"); continue
        if cid in seen: errors.append(f"{name}: duplicate card id '{cid}'")
        seen.add(cid)
        d = s["decks"].get(c.get("deck"))
        if not d: errors.append(f"{name}: card '{cid}' uses unknown deck '{c.get('deck')}'"); continue
        need = ("it", "en") if d["kind"] == "word" else ("q", "a")
        for k in need:
            if not c.get(k): errors.append(f"{name}: card '{cid}' needs '{k}'")
    sets.append({"id": s["id"], "file": name, "title": s["title"], "subtitle": s.get("subtitle", ""),
                 "order": s.get("order", 100), "count": len(s["cards"])})

if errors:
    print("Problems found:\n  " + "\n  ".join(errors)); sys.exit(1)

sets.sort(key=lambda x: x["order"])
index = {"updated": datetime.date.today().isoformat(), "sets": sets}
json.dump(index, open(os.path.join(DATA, "index.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
print(f"OK: {len(sets)} sets, {sum(s['count'] for s in sets)} cards")
for s in sets: print(f"  {s['order']:>4}  {s['id']:<14} {s['count']:>5}  {s['title']}")
