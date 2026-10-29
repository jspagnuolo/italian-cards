/* Italian Cards: one app, one data file per card set (data/<id>.json, listed in data/index.json).
   Progress lives in localStorage under "ic.v1.<setId>"; export/import moves it between devices. */
"use strict";

const $ = id => document.getElementById(id);
const PREFIX = "ic.v1.";
const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
};
const strip = s => String(s ?? "").replace(/<[^>]+>/g, "");
const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

/* ---------- data loading ---------- */
let INDEX = null;           // {updated, sets:[{id,file,title,subtitle,order,count}]}
const SETS = {};            // id -> full set json

async function getJSON(url) {
  const r = await fetch(url, { cache: "no-cache" });
  if (!r.ok) throw new Error(url + " " + r.status);
  return r.json();
}
async function loadSet(id) {
  if (SETS[id]) return SETS[id];
  const meta = INDEX.sets.find(s => s.id === id);
  if (!meta) return null;
  SETS[id] = await getJSON("data/" + meta.file);
  return SETS[id];
}

/* ---------- progress ---------- */
function progress(id) {
  const p = store.get(PREFIX + id, {});
  p.marks = p.marks || {};
  return p;
}
const isPractice = m => m && m.missed && m.streak < 2;
const isSolid = m => m && m.streak >= 2;

/* ---------- home ---------- */
function renderHome() {
  const seen = store.get("ic.seenSets", null);
  const list = INDEX.sets.slice().sort((a, b) => a.order - b.order);
  $("sets").innerHTML = list.map(s => {
    const marks = progress(s.id).marks;
    let P = 0, S = 0;
    for (const k in marks) { if (isPractice(marks[k])) P++; else if (isSolid(marks[k])) S++; }
    const isNew = seen && !seen.includes(s.id);
    return `<li><a href="#${esc(s.id)}">
      <span class="t">${esc(s.title)}${isNew ? '<span class="newbadge">New</span>' : ""}</span>
      <span class="nums">${s.count} cards<br><b class="p">${P}</b> to practice · <b class="s">${S}</b> solid</span>
      <span class="st">${esc(s.subtitle || "")}</span></a></li>`;
  }).join("");
  if (!seen) store.set("ic.seenSets", list.map(s => s.id));
  $("version").textContent = `Cards updated ${INDEX.updated}`;
  updateNet();
}
function updateNet() {
  const el = $("netline"); const on = navigator.onLine;
  const cached = store.get("ic.cachedAt", null);
  el.className = "netline " + (on ? "on" : "off");
  el.textContent = on
    ? (cached ? "Online. All sets are saved for offline use." : "Online. Saving sets for offline use…")
    : "Offline. Using the cards saved on this device.";
}
window.addEventListener("online", () => { updateNet(); refreshIndex(); });
window.addEventListener("offline", updateNet);

/* ---------- study view ---------- */
let SET = null, PROG = null;
let queue = [], pos = 0, flipped = false, total = 0, done = 0;

function deckOf(c) { return SET.decks[c.deck]; }
function pool() { return SET.cards.filter(c => PROG.deck === "all" || c.deck === PROG.deck); }
function saveProg() { store.set(PREFIX + SET.id, PROG); }

async function openSet(id) {
  const s = await loadSet(id);
  if (!s) { location.hash = ""; return; }
  SET = s; PROG = progress(id);
  if (!(PROG.deck === "all" || SET.decks[PROG.deck])) PROG.deck = "all";
  PROG.dir = PROG.dir || SET.defaultDir || "en";
  PROG.size = PROG.size || "15";
  const seen = store.get("ic.seenSets", []);
  if (!seen.includes(id)) store.set("ic.seenSets", seen.concat(id));

  $("setTitle").textContent = SET.title;
  $("setSub").textContent = SET.subtitle || "";
  document.title = SET.title + " · Italian Cards";
  const keys = Object.keys(SET.decks);
  $("deck").innerHTML = keys.map(k => `<button data-v="${esc(k)}">${esc(SET.decks[k].name)}</button>`).join("")
    + (keys.length > 1 ? `<button data-v="all">All</button>` : "");
  if (keys.length === 1) PROG.deck = keys[0];
  $("refs").innerHTML = (SET.refs || []).map(r => `<details><summary>${esc(r.title)}</summary>${r.html}</details>`).join("");
  $("copyArea").hidden = true; $("copyBtn").textContent = "Copy list for Claude";
  showView("study-view");
  refresh(); buildQueue(); show();
  window.scrollTo(0, 0);
}

function buildQueue() {
  let p = pool();
  const m = id => PROG.marks[id];
  if (PROG.size === "miss") p = shuffle(p.filter(c => isPractice(m(c.id))));
  else {
    const practice = shuffle(p.filter(c => isPractice(m(c.id))));
    const unseen = shuffle(p.filter(c => !m(c.id)));
    const rest = shuffle(p.filter(c => m(c.id) && !isPractice(m(c.id))));
    p = practice.concat(unseen, rest);
    if (PROG.size !== "0") p = p.slice(0, +PROG.size);
    shuffle(p);
  }
  queue = p.slice(); pos = 0; done = 0; total = queue.length;
}

function frontBack(c) {
  const d = deckOf(c);
  if (d.kind === "sent") {
    const clock = /^\d/.test(strip(c.q)) && strip(c.q).length < 30 ? " clock" : "";
    return {
      f: `<div class="ask">${c.ask || d.ask || ""}</div><div class="sent${clock}">${c.q}</div>`,
      b: `<div class="sent"><b>${c.a}</b></div>${c.g ? `<div class="gloss">${c.g}</div>` : ""}<div class="ex">${c.q}</div>${c.note ? `<div class="note">${c.note}</div>` : ""}`
    };
  }
  const long = strip(c.it).length > 10 ? " long" : "";
  const itSide = `<div class="big${long}">${c.it}</div>`;
  const enSide = `<div class="en">${c.en}</div>`;
  const chips = c.chips ? `<div class="chips">${c.chips.map(x => `<span class="chip ${esc(x.c || "")}">${esc(x.t)}</span>`).join("")}</div>` : "";
  const extra = `${chips}${c.ex ? `<div class="ex">${c.ex}</div>` : ""}${c.note ? `<div class="note">${c.note}</div>` : ""}`;
  if (PROG.dir === "en") return { f: `<div class="ask">${d.askEn || "Say it in Italian"}</div>${enSide}`, b: `${itSide}<div class="gloss">${c.en}</div>${extra}` };
  return { f: `<div class="ask">${d.askIt || "What does this mean?"}</div>${itSide}`, b: `${enSide}<div class="gloss">${c.it}</div>${extra}` };
}

function show() {
  const card = $("card");
  card.classList.add("instant"); card.classList.remove("flipped"); void card.offsetWidth; card.classList.remove("instant");
  flipped = false;
  $("flipBtn").hidden = false; $("missBtn").hidden = true; $("okBtn").hidden = true;
  if (pos >= queue.length) { finish(); return; }
  $("study").hidden = false; $("answer").hidden = false; $("done").hidden = true;
  const c = queue[pos]; const fb = frontBack(c); const d = deckOf(c);
  const tag = `<span class="tag ${esc(d.color || "")}">${esc(d.name)}</span>`;
  $("fTag").innerHTML = tag; $("bTag").innerHTML = tag;
  const m = PROG.marks[c.id];
  const st = isPractice(m) ? "Practice" : isSolid(m) ? "Solid" : m ? "" : "New";
  $("fSrc").textContent = st; $("bSrc").textContent = st;
  $("fMid").innerHTML = fb.f; $("bMid").innerHTML = fb.b;
  $("count").textContent = `Card ${Math.min(done + 1, total)} of ${total}`;
  $("mix").textContent = `${queue.length - pos} left in queue`;
  $("barfill").style.width = (total ? done / total * 100 : 0) + "%";
}
function flip() {
  if (pos >= queue.length) return;
  flipped = !flipped; $("card").classList.toggle("flipped", flipped);
  if (flipped) { $("flipBtn").hidden = true; $("missBtn").hidden = false; $("okBtn").hidden = false; }
}
function mark(ok) {
  if (!flipped || pos >= queue.length) return;
  const c = queue[pos]; const m = PROG.marks[c.id] || { streak: 0, missed: 0, seen: 0 };
  m.seen++; m.t = Date.now();
  if (ok) { m.streak++; done++; pos++; }
  else { m.streak = 0; m.missed++; queue.splice(Math.min(pos + 4, queue.length), 0, c); pos++; }
  PROG.marks[c.id] = m; saveProg(); refresh(); show();
}
function finish() {
  $("study").hidden = true; $("answer").hidden = true; $("done").hidden = false;
  $("barfill").style.width = total ? "100%" : "0"; $("count").textContent = `${total} cards`; $("mix").textContent = "";
  const n = pool().filter(c => isPractice(PROG.marks[c.id])).length;
  $("doneMsg").textContent = total === 0
    ? (PROG.size === "miss" ? "Your practice list is empty here. Pick another session." : "No cards here yet.")
    : (n ? `${n} card${n > 1 ? "s" : ""} on your practice list.` : "Nothing on your practice list. Ottimo!");
}
function label(c) { return deckOf(c).kind === "sent" ? strip(c.a) : `${strip(c.it)} (${deckOf(c).short || deckOf(c).name})`; }
function meaning(c) { return deckOf(c).kind === "sent" ? strip(c.q) : strip(c.en); }
function practiceText(set, prog) {
  const all = set.cards.filter(c => isPractice(prog.marks[c.id]));
  const prevSET = SET; SET = set;
  const lines = all.map(c => `- ${label(c)} = ${meaning(c)}`);
  SET = prevSET;
  return `${set.title} flashcards, practice list:\n` + (lines.length ? lines.join("\n") : "(empty)");
}
function refresh() {
  const p = pool();
  $("tP").textContent = p.filter(c => isPractice(PROG.marks[c.id])).length;
  $("tS").textContent = p.filter(c => isSolid(PROG.marks[c.id])).length;
  $("tN").textContent = p.filter(c => !PROG.marks[c.id]).length;
  const all = SET.cards.filter(c => isPractice(PROG.marks[c.id]));
  $("pcount").textContent = all.length;
  $("plist").innerHTML = all.length
    ? all.map(c => `<li><span>${esc(label(c))}</span><span>${esc(meaning(c))}</span></li>`).join("")
    : `<li><span class="hint">Nothing yet. Cards you mark “Practice again” show up here.</span></li>`;
  ["deck", "dir", "size"].forEach(k => $(k).querySelectorAll("button").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.v === PROG[k]))));
  const sentOnly = PROG.deck !== "all" && SET.decks[PROG.deck].kind === "sent";
  $("dir").querySelectorAll("button").forEach(b => b.disabled = sentOnly);
}
function setOpt(k, v) { PROG[k] = v; saveProg(); refresh(); buildQueue(); show(); }
["deck", "dir", "size"].forEach(k => $(k).addEventListener("click", e => {
  const b = e.target.closest("button"); if (b && !b.disabled) setOpt(k, b.dataset.v);
}));

$("card").addEventListener("click", flip);
$("card").addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); flip(); } });
$("flipBtn").addEventListener("click", flip);
$("missBtn").addEventListener("click", () => mark(false));
$("okBtn").addEventListener("click", () => mark(true));
$("againBtn").addEventListener("click", () => { buildQueue(); show(); });
document.addEventListener("keydown", e => {
  if ($("study-view").hidden || e.target.closest("textarea, input, summary")) return;
  if (e.key === " ") { e.preventDefault(); flip(); }
  else if (e.key === "1" || e.key === "ArrowLeft") mark(false);
  else if (e.key === "2" || e.key === "ArrowRight") mark(true);
});

/* ---------- copy helpers ---------- */
function copyText(text, btn, area, okLabel) {
  area.value = text;
  const orig = btn.textContent;
  const fallback = () => { area.hidden = false; area.focus(); area.select(); btn.textContent = "Select and copy the text below"; };
  try {
    navigator.clipboard.writeText(text).then(() => { area.hidden = true; btn.textContent = okLabel || "Copied"; setTimeout(() => btn.textContent = orig, 1800); }, fallback);
  } catch (e) { fallback(); }
}
$("copyBtn").addEventListener("click", () => copyText(practiceText(SET, PROG), $("copyBtn"), $("copyArea")));
$("resetBtn").addEventListener("click", () => { $("resetConfirm").hidden = false; $("resetBtn").hidden = true; });
$("resetNo").addEventListener("click", () => { $("resetConfirm").hidden = true; $("resetBtn").hidden = false; });
$("resetYes").addEventListener("click", () => { PROG.marks = {}; saveProg(); $("resetConfirm").hidden = true; $("resetBtn").hidden = false; refresh(); buildQueue(); show(); });

$("copyAll").addEventListener("click", async () => {
  const parts = [];
  for (const s of INDEX.sets.slice().sort((a, b) => a.order - b.order)) {
    const prog = progress(s.id);
    if (!Object.values(prog.marks).some(isPractice)) continue;
    try { parts.push(practiceText(await loadSet(s.id), prog)); } catch (e) {}
  }
  copyText(parts.length ? parts.join("\n\n") : "Practice lists: all empty.", $("copyAll"), $("copyAllArea"));
});

/* ---------- export / import progress ---------- */
function exportData() {
  const out = { app: "italian-cards", v: 1, at: new Date().toISOString(), sets: {} };
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && k.startsWith(PREFIX)) out.sets[k.slice(PREFIX.length)] = store.get(k, {});
  }
  return JSON.stringify(out);
}
$("exportCopy").addEventListener("click", () => copyText(exportData(), $("exportCopy"), $("importArea"), "Copied. Paste it on the other device."));
$("exportFile").addEventListener("click", () => {
  const blob = new Blob([exportData()], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `italian-cards-progress-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
});
function importData(text) {
  let data;
  try { data = JSON.parse(text); } catch (e) { return "That doesn't look like a progress export."; }
  if (!data || data.app !== "italian-cards" || !data.sets) return "That doesn't look like a progress export.";
  let n = 0;
  for (const id in data.sets) {
    const mine = progress(id), theirs = data.sets[id] || {};
    for (const cid in (theirs.marks || {})) {
      const a = mine.marks[cid], b = theirs.marks[cid];
      if (!a || (b.t || 0) > (a.t || 0)) { mine.marks[cid] = b; n++; }
    }
    store.set(PREFIX + id, mine);
  }
  renderHome();
  return `Imported. ${n} card mark${n === 1 ? "" : "s"} updated.`;
}
$("importBtn").addEventListener("click", () => { $("importMsg").textContent = importData($("importArea").value.trim()); });
$("importFile").addEventListener("change", e => {
  const f = e.target.files[0]; if (!f) return;
  f.text().then(t => { $("importMsg").textContent = importData(t); e.target.value = ""; });
});

/* ---------- routing ---------- */
function showView(id) { ["home", "study-view", "loading"].forEach(v => $(v).hidden = v !== id); }
function route() {
  const id = decodeURIComponent(location.hash.slice(1));
  if (id && INDEX.sets.some(s => s.id === id)) openSet(id).catch(() => { location.hash = ""; });
  else { document.title = "Italian Cards"; renderHome(); showView("home"); }
}
window.addEventListener("hashchange", route);

/* ---------- startup + offline cache ---------- */
async function precacheAll() {
  // Touch every set file so the service worker stores it; then the whole app works offline.
  if (!navigator.onLine) return;
  try {
    await Promise.all(INDEX.sets.map(s => fetch("data/" + s.file, { cache: "no-cache" })));
    store.set("ic.cachedAt", Date.now());
    if (!$("home").hidden) updateNet();
  } catch (e) {}
}
async function refreshIndex() {
  try {
    const fresh = await getJSON("data/index.json");
    if (JSON.stringify(fresh) !== JSON.stringify(INDEX)) {
      INDEX = fresh;
      for (const k in SETS) delete SETS[k];
      if (!$("home").hidden) renderHome();
    }
    precacheAll();
  } catch (e) {}
}
async function start() {
  if ("serviceWorker" in navigator) {
    try { await navigator.serviceWorker.register("sw.js"); } catch (e) {}
  }
  try { INDEX = await getJSON("data/index.json"); }
  catch (e) { $("loading").innerHTML = '<p class="hint center">Couldn\'t load the cards. Open this page once while online so it can save them.</p>'; return; }
  route();
  precacheAll();
}
start();
