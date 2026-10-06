/* AuctoBid UI: hash router + view renderers. Data comes only from API (js/api.js). */
const $ = (s) => document.querySelector(s);
const app = $("#app");
const inr = (n) => "₹" + Number(n).toLocaleString("en-IN");
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const CATS = ["Electronics", "Fashion", "Collectibles", "Books", "Home", "Vehicles", "Other"];
const CONDS = ["New", "Like new", "Good", "Fair"];
let pollTimer;

function toast(msg, isErr) {
  const t = $("#toast"); t.innerHTML = `<span class="ti">${isErr ? ICON.alert : ICON.check}</span><span>${esc(msg)}</span>`; t.className = "show" + (isErr ? " err" : "");
  clearTimeout(toast.id); toast.id = setTimeout(() => (t.className = ""), 2800);
}
const EMOJI = { Electronics: "💻", Fashion: "👗", Collectibles: "🏺", Books: "📚", Home: "🛋️", Vehicles: "🏍️", Other: "🎁" };
const photo = (a, extra = "") => `<div class="ph" data-l="${EMOJI[a.category] || esc((a.title || "?")[0])}"><img src="${esc(a.image || "")}" data-fb="${esc(a.imageFallback || "")}" alt="${esc(a.title)}" loading="lazy" onload="this.classList.add('loaded')" onerror="if(this.dataset.fb&&this.src!==this.dataset.fb){this.src=this.dataset.fb}else{this.classList.add('broken')}">${extra}</div>`;
const tag = (a) => a.isDemo ? `<span class="demo-tag">Demo</span>` : `<span class="demo-tag real">Real listing</span>`;
const chip = (end, demo) => `<span class="chip${end <= Date.now() ? " over" : ""}"><i></i><b class="lv">Live</b>${timer(end, demo)}</span>`;
const bidsText = (n) => `${n} ${n === 1 ? "bid" : "bids"}`;
const timer = (end, demo) => `<span class="timer" data-end="${end}"${demo ? ' data-demo="1"' : ""}></span>`;

/* ---- motion + small UI helpers ---- */
const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
const bump = (el) => { if (!el) return; el.classList.remove("bump"); void el.offsetWidth; el.classList.add("bump"); };
const skeletons = (n = 8) => Array.from({ length: n }, () => `<div class="card sk"><div class="ph"></div><div class="body"><i style="width:40%"></i><i style="width:80%;height:18px"></i><i style="width:55%;margin-top:10px"></i></div></div>`).join("");
const svg = (d) => `<svg viewBox="0 0 24 24" aria-hidden="true">${d}</svg>`;
const ICON = {
  mail: svg('<rect x="3" y="5" width="18" height="14" rx="3"/><path d="m4 8 8 5.5L20 8"/>'),
  lock: svg('<rect x="5" y="10.5" width="14" height="9.5" rx="2.5"/><path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5"/>'),
  user: svg('<circle cx="12" cy="8.5" r="3.5"/><path d="M5 20c.8-3.6 3.7-5.5 7-5.5s6.2 1.9 7 5.5"/>'),
  eye: svg('<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z"/><circle cx="12" cy="12" r="2.8"/>'),
  off: svg('<path d="M3 3l18 18"/><path d="M10.6 6A9.6 9.6 0 0 1 12 5.5c6 0 9.5 6.5 9.5 6.5a16 16 0 0 1-3 3.8M6.4 7.4A16 16 0 0 0 2.5 12S6 18.5 12 18.5c1.6 0 3-.4 4.2-1"/>'),
  check: svg('<path d="m5 12.5 4.5 4.5L19 7.5"/>'),
  alert: svg('<path d="M12 6.5v7"/><path d="M12 17.5h.01"/>'),
  gavel: svg('<path d="m14.5 12.5-8 8a2.12 2.12 0 0 1-3-3l8-8"/><path d="m16 16 6-6"/><path d="m8 8 6-6"/><path d="m9 7 8 8"/><path d="m21 11-8-8"/>'),
  search: svg('<circle cx="11" cy="11" r="6.5"/><path d="m20 20-4.2-4.2"/>')
};
// Friendly empty / error state: icon, one-line title, one-line hint, optional action button.
const emptyState = (icon, title, text, action = "", style = "") =>
  `<div class="empty rich"${style ? ` style="${style}"` : ""}><span class="ico">${ICON[icon]}</span><h3>${title}</h3><p>${text}</p>${action}</div>`;

// Animated confirmation dialog (replaces the browser's confirm()). Resolves true / false.
function confirmDialog({ title, text, ok = "Confirm" }) {
  return new Promise((resolve) => {
    const prev = document.activeElement, o = document.createElement("div");
    o.className = "modal-bg";
    o.innerHTML = `<div class="modal" role="alertdialog" aria-modal="true" aria-labelledby="m-t" aria-describedby="m-d"><span class="m-ico">${ICON.alert}</span>
      <h3 id="m-t">${esc(title)}</h3><p id="m-d">${esc(text)}</p>
      <div class="m-acts"><button class="btn small plain" data-r="0">Cancel</button><button class="btn small solid-danger" data-r="1">${esc(ok)}</button></div></div>`;
    const btns = () => [...o.querySelectorAll("button")];
    const done = (v) => {
      document.removeEventListener("keydown", key); o.classList.add("out");
      setTimeout(() => { o.remove(); prev && prev.focus && prev.focus(); }, reduced() ? 0 : 180); resolve(v);
    };
    const key = (e) => {
      if (e.key === "Escape") return done(false);
      if (e.key !== "Tab") return;
      const [first, last] = [btns()[0], btns().at(-1)];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    o.onclick = (e) => { if (e.target === o) return done(false); const b = e.target.closest("[data-r]"); if (b) done(b.dataset.r === "1"); };
    document.addEventListener("keydown", key); document.body.appendChild(o); btns()[0].focus();
  });
}

// Loading skeletons shown (after a short delay) while a page's data is being fetched.
const sk = (w, h = 14, extra = "") => `<i class="shim" style="width:${w};height:${h}px;${extra}"></i>`;
const skRows = (n = 3) => Array.from({ length: n }, () => `<div class="sk-row"><i class="shim" style="width:52px;height:52px;flex:none"></i><div style="flex:1;display:grid;gap:8px">${sk("55%")}${sk("30%", 12)}</div></div>`).join("");
const SKELETON = {
  home: () => `<div class="hero-band"><div class="wrap"><section class="hero"><div style="display:grid;gap:18px">${sk("85%", 78, "border-radius:14px").replace("shim", "shim dk")}${sk("60%", 18).replace("shim", "shim dk")}${sk("45%", 18).replace("shim", "shim dk")}</div>
    <i class="shim dk" style="height:340px;border-radius:20px"></i></section></div></div><div class="wrap" style="padding-top:0"><div style="margin:56px 0 22px">${sk("220px", 30)}</div><div class="grid">${skeletons(4)}</div></div>`,
  auction: () => `<div class="wrap detail"><i class="shim" style="aspect-ratio:1;border-radius:20px"></i><div style="display:grid;gap:16px;align-content:start">${sk("40%", 24)}${sk("85%", 44)}${sk("35%", 14)}${sk("100%", 230, "border-radius:20px;margin-top:8px")}${sk("90%")}${sk("70%")}</div></div>`,
  list: () => `<div class="wrap">${sk("260px", 40, "margin-bottom:26px")}${skRows(4)}</div>`
};
SKELETON["my-auctions"] = SKELETON["my-bids"] = SKELETON.dashboard = SKELETON.list;
function progress(on) {
  let b = $("#bar"); if (!b) { b = document.createElement("div"); b.id = "bar"; document.body.prepend(b); }
  if (on) { b.className = ""; void b.offsetWidth; b.className = "go"; } else b.className = "done";
}
function countUp(el) {
  const to = +el.dataset.count;
  if (!to || reduced()) { el.textContent = to || 0; return; }
  const t0 = performance.now();
  (function f(t) { const p = Math.min(1, (t - t0) / 700); el.textContent = Math.round(to * (1 - Math.pow(1 - p, 3))); if (p < 1) requestAnimationFrame(f); })(t0);
}
// Runs after every page render: fade the page in, reveal sections on scroll, count up numbers.
function enter() {
  app.classList.remove("page-in"); void app.offsetWidth; app.classList.add("page-in");
  app.querySelectorAll("[data-count]").forEach(countUp);
  if (!("IntersectionObserver" in window)) return;
  const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } }), { threshold: 0.12 });
  app.querySelectorAll(".steps > div, .section-head, .stat").forEach((el) => { el.classList.add("reveal"); io.observe(el); });
}

// Demo auctions are renewed by the server when their timer ends. When one reaches zero we ask again
// (a few tries, since the server may need a moment) and the current page swaps in the fresh timer.
let refreshHook = null, renewT = 0, renewTries = 0;
function renewDemoSoon() {
  if (renewT || !refreshHook || renewTries >= 8) return;
  renewT = setTimeout(async () => {
    renewT = 0; renewTries++;
    try { await (refreshHook && refreshHook()); } catch {}
    if ([...document.querySelectorAll('.timer[data-demo="1"]')].some((el) => +el.dataset.end <= Date.now())) renewDemoSoon();
    else renewTries = 0;
  }, renewTries ? 3000 : 800);
}
function tick() {
  document.querySelectorAll(".timer").forEach((el) => {
    const ms = +el.dataset.end - Date.now();
    if (Number.isNaN(ms)) { el.textContent = "—"; return; }
    if (ms <= 0) {
      el.textContent = "Ended"; el.classList.add("low"); el.closest(".chip")?.classList.add("over");
      if (el.dataset.demo) renewDemoSoon();
      const box = el.closest(".bidbox");
      if (box) {
        box.querySelector("form button")?.setAttribute("disabled", "");
        const st = $("#state"); if (st && !st.classList.contains("off")) { st.className = "pill off"; st.textContent = "Ended"; }
      }
      return;
    }
    const h = Math.floor(ms / 36e5), m = Math.floor(ms / 6e4) % 60, s = Math.floor(ms / 1e3) % 60;
    const pad = (n) => String(n).padStart(2, "0");
    const html = h >= 48 ? `${Math.floor(h / 24)}d ${h % 24}h` : `${pad(h)}h ${pad(m)}m <span class="sec">${pad(s)}s</span>`;
    if (el._h !== html) { el._h = html; el.innerHTML = html; }
    el.classList.toggle("low", ms < 36e5);
  });
}
setInterval(tick, 1000);

const card = (a, i = 0) => `<a class="card${a.endTime <= Date.now() ? " over" : ""}" style="--i:${Math.min(i, 11)}" href="#/auction/${a._id}">${photo(a, chip(a.endTime, a.isDemo) + tag(a))}<div class="body">
  <div class="tags"><span class="cat">${esc(a.category)}</span><span class="meta">${esc(a.condition)}</span></div><h3>${esc(a.title)}</h3>
  <div class="foot"><div><span class="lbl">Current bid</span><br><span class="price">${inr(a.currentBid)}</span></div><span class="meta">${bidsText(a.bidCount)}</span></div>
  <span class="cta">${a.endTime <= Date.now() ? "View result" : "Place bid"}</span></div></a>`;

const ended = (a) => a.endTime <= Date.now();
const needLogin = () => { if (API.currentUser()) return false; toast("Log in to continue", true); location.hash = "#/login"; return true; };
const bidStatus = (b) => { const lead = b.amount >= b.auction.currentBid; return ended(b.auction) ? (lead ? "Won" : "Lost") : (lead ? "Leading" : "Outbid"); };
const auctionRows = (list) => list.length ? `<div class="list">${list.map((a) => `<div><a class="row-l" href="#/auction/${a._id}">${photo(a)}<span>${esc(a.title)}<br><span class="meta">${inr(a.currentBid)}, ${a.bidCount} bids, ${ended(a) ? "Ended" : "Active"}</span></span></a>
  <span class="acts"><a class="btn small" href="#/edit/${a._id}">Edit</a><button class="btn small danger" data-del="${a._id}">Delete</button></span></div>`).join("")}</div>`
  : emptyState("gavel", "No listings yet", "List your first item and it will show up here.", `<a class="btn green small" href="#/sell">Sell a product</a>`);
const bidRows = (list) => list.length ? `<div class="list">${list.map((b) => { const st = bidStatus(b); return `<div><a class="row-l" href="#/auction/${b.auction._id}">${photo(b.auction)}<span>${esc(b.auction.title)}<br><span class="meta">Your bid ${inr(b.amount)}, current bid ${inr(b.auction.currentBid)}</span></span></a>
  <span class="pill ${st === "Won" || st === "Leading" ? "ok" : "off"}">${st}</span></div>`; }).join("")}</div>`
  : emptyState("gavel", "No bids yet", "Start exploring auctions and place your first bid.", `<a class="btn green small" href="#/auctions">Browse auctions</a>`);
const bindDelete = (after) => app.querySelectorAll("[data-del]").forEach((b) => b.onclick = async () => {
  if (!(await confirmDialog({ title: "Delete this auction?", text: "This can't be undone. Any bids placed on it will be lost.", ok: "Delete auction" }))) return;
  try { await API.deleteAuction(b.dataset.del); toast("Auction deleted"); after(); } catch (e) { toast(e.message, true); }
});

function renderNav() {
  const u = API.currentUser(), h = location.hash || "#/";
  const l = (href, t) => `<a href="${href}" class="${h.startsWith(href) && href !== "#/" ? "on" : ""}">${t}</a>`;
  $("#nav-links").innerHTML = l("#/auctions", "Auctions") + (u
    ? l("#/sell", "Sell") + l("#/my-auctions", "My auctions") + l("#/my-bids", "My bids") + l("#/dashboard", "Dashboard") + `<span class="who"><span class="avatar" title="${esc(u.name)}">${esc(u.name[0].toUpperCase())}</span><button id="logout" class="out">Log out</button></span>`
    : l("#/login", "Log in") + `<a class="btn green" href="#/register">Sign up</a>`);
  $(".nav").classList.remove("open"); $(".burger").setAttribute("aria-expanded", "false");
  const lo = $("#logout"); if (lo) lo.onclick = () => { API.logout(); location.hash = "#/"; renderNav(); toast("You've been logged out"); };
}

$(".burger").onclick = () => { const o = $(".nav").classList.toggle("open"); $(".burger").setAttribute("aria-expanded", String(o)); };
$("#nav-links").addEventListener("click", (e) => { if (e.target.closest("a")) $(".nav").classList.remove("open"); });

const views = {
  async home() {
    const live = (l) => l.filter((a) => !ended(a));
    const topCard = (top) => `<a class="live" id="home-top" href="#/auction/${top._id}">${photo(top, chip(top.endTime, top.isDemo))}<div class="info"><span class="tag">Ending soonest</span><h3>${esc(top.title)}</h3>
      <span class="price">${inr(top.currentBid)}</span><small>${bidsText(top.bidCount)} so far</small></div></a>`;
    const list = live(await API.getAuctions({ sort: "ending" })), top = list[0];
    app.innerHTML = `<div class="hero-band"><div class="wrap"><section class="hero"><div><h1>Bid. Win. Own.</h1>
      <p>Find one-of-a-kind products, bid against other buyers, and take home what you want at a price you set.</p>
      <div class="row"><a class="btn green" href="#/auctions">Explore auctions</a><a class="btn ghost" href="#/register">Start selling</a></div></div>
      ${top ? topCard(top) : ""}</section></div></div>
    <div class="wrap" style="padding-top:0">
    <div class="section-head"><h2>Ending soon</h2><a class="meta" href="#/auctions">See all auctions</a></div>
    ${list.length ? `<div class="grid" id="home-grid">${list.slice(0, 4).map(card).join("")}</div>` : emptyState("gavel", "No live auctions right now", "Check back soon, or list an item of your own.", `<a class="btn green small" href="#/sell">Sell a product</a>`)}
    <div class="section-head"><h2>How it works</h2></div>
    <div class="steps"><div><h3>Create an account</h3><p>Sign up free and browse every live auction.</p></div>
      <div><h3>Place your bid</h3><p>Beat the current price by the minimum increment.</p></div>
      <div><h3>Win the item</h3><p>When the clock hits zero, the highest bidder wins.</p></div></div></div>`;
    tick();
    // A demo timer ran out: fetch again and swap the hero card and the grid in place.
    refreshHook = async () => {
      const l = live(await API.getAuctions({ sort: "ending" })), t = l[0], grid = $("#home-grid"), box = $("#home-top");
      if (!grid) return;
      grid.classList.add("quiet"); grid.innerHTML = l.slice(0, 4).map(card).join("");
      if (box && t) box.outerHTML = topCard(t);
      tick();
    };
  },

  async auctions() {
    app.innerHTML = `<div class="wrap"><h1 class="page-h">All auctions</h1>
    <div class="filters"><input id="q" type="search" placeholder="Search products" aria-label="Search">
        <select id="sort" aria-label="Sort"><option value="ending">Ending soon</option><option value="low">Lowest bid</option><option value="high">Highest bid</option><option value="bids">Most bids</option></select></div>
    <div class="cats" id="cats">${["", ...CATS].map((c) => `<button data-c="${c}" class="${c ? "" : "on"}">${c || "All"}</button>`).join("")}</div>
    <div id="results" class="grid"></div></div>`;
    let cat = "";
    let seq = 0, first = true;
    const clearAll = () => { $("#q").value = ""; cat = ""; document.querySelectorAll("#cats button").forEach((x) => x.classList.toggle("on", !x.dataset.c)); run(); };
    const run = async (quiet = false) => {
      const box = $("#results"); if (!box) return;
      const my = ++seq;
      if (first) box.innerHTML = skeletons();
      try {
        const list = await API.getAuctions({ search: $("#q").value, category: cat, sort: $("#sort").value });
        if (my !== seq || !$("#results")) return;
        first = false; box.classList.toggle("quiet", quiet === true);
        box.innerHTML = list.length ? list.map(card).join("") : emptyState("search", "No auctions found", "Try a different search or category.", `<button class="btn small plain" id="clear">Clear filters</button>`, "grid-column:1/-1");
        if ($("#clear")) $("#clear").onclick = clearAll;
        tick();
      } catch (e) {
        if (my !== seq || !$("#results")) return;
        box.innerHTML = emptyState("alert", "Couldn't load auctions", esc(e.message), `<button class="btn small" id="retry">Try again</button>`, "grid-column:1/-1");
        $("#retry").onclick = () => { first = true; run(); };
      }
    };
    let d; $("#q").oninput = () => { clearTimeout(d); d = setTimeout(() => run(), 250); };
    $("#sort").onchange = () => run();
    $("#cats").onclick = (e) => { const bt = e.target.closest("button"); if (!bt) return; cat = bt.dataset.c;
      document.querySelectorAll("#cats button").forEach((x) => x.classList.toggle("on", x === bt)); run(); };
    refreshHook = () => run(true);
    run();
  },

  async auction(id) {
    const a = await API.getAuction(id);
    const next = () => (a.bidCount ? a.currentBid + a.minimumIncrement : a.startingPrice);
    const me = API.currentUser(), own = me && a.seller?._id === me._id, done = ended(a);
    const bidArea = done ? `<p class="notice" id="win">This auction has ended.</p>`
      : !me ? `<p class="notice">Log in to place a bid. <a href="#/login" style="text-decoration:underline">Log in</a></p>`
      : own ? `<p class="notice">This is your listing, so you can't bid on it.</p>`
      : `<form id="bidform"><input id="amt" type="number" inputmode="numeric" required aria-label="Your bid in rupees" placeholder="${next()}"><button class="btn green"><span>Place bid</span></button></form>`;
    const owner = own ? `<div class="acts" style="margin-top:12px"><a class="btn small" href="#/edit/${a._id}">Edit</a><button class="btn small danger" data-del="${a._id}">Delete</button></div>` : "";
    app.innerHTML = `<div class="wrap detail">${photo(a)}<div>
      ${done ? '<span class="pill off" id="state">Ended</span>' : '<span class="pill live" id="state"><i></i>Live</span>'} <span class="pill">${esc(a.category)}</span> <span class="pill off">${esc(a.condition)}</span> ${tag(a)}
      <h1>${esc(a.title)}</h1><p class="meta">Sold by ${esc(a.seller?.name || "AuctoBid seller")}</p>${owner}
      <div class="bidbox"><span class="meta">Current bid</span><span class="price" id="cur">${inr(a.currentBid)}</span>
        <p class="meta"><span id="cnt">${bidsText(a.bidCount)}</span> · started at ${inr(a.startingPrice)} · +${inr(a.minimumIncrement)} minimum</p>
        <p style="margin-top:10px">Ends in ${timer(a.endTime, a.isDemo)}</p>
        ${bidArea}
        <p class="error" id="err"></p><div class="quick" id="quick"></div></div>
      <h3>About this item</h3><p style="margin:8px 0 28px;color:var(--mute)">${esc(a.description)}</p>
      <h3 style="margin-bottom:8px">Bid history</h3><div class="list" id="hist"></div></div></div>`;
    let sig = null; // only redraw the history when it actually changed, so rows don't re-animate on every poll
    const hist = async () => {
      const b = await API.getBids(id), key = b.map((x) => x.amount + "|" + (x.bidder?.name || "")).join(), box = $("#hist");
      if (box && key !== sig) {
        const fresh = sig !== null; sig = key;
        box.innerHTML = b.length ? b.map((x, i) => `<div><span>${esc(x.bidder?.name || "Bidder")} ${i === 0 ? '<span class="pill ok">Leading</span>' : ""}</span><b>${inr(x.amount)}</b></div>`).join("") : `<div class="meta">No bids yet. Be the first.</div>`;
        if (fresh && b.length) box.firstElementChild.classList.add("fresh");
      }
      if (done && $("#win")) $("#win").textContent = b.length ? `Auction ended. Won by ${b[0].bidder?.name || "a bidder"} at ${inr(b[0].amount)}.` : "Auction ended with no bids.";
    };
    const quick = () => {
      if (!$("#bidform")) return;
      $("#quick").innerHTML = [0, 1, 3].map((k) => `<button type="button" data-v="${next() + k * a.minimumIncrement}">${inr(next() + k * a.minimumIncrement)}</button>`).join("");
      $("#amt").placeholder = next();
    };
    $("#quick").onclick = (e) => { const v = e.target.dataset.v; if (v) { $("#amt").value = v; $("#amt").focus(); } };
    quick(); hist(); tick(); bindDelete(() => (location.hash = "#/my-auctions"));
    if ($("#bidform")) $("#bidform").onsubmit = async (e) => {
      e.preventDefault();
      const form = e.target, btn = form.querySelector("button"), label = btn.querySelector("span"), err = $("#err");
      err.textContent = ""; btn.classList.add("loading"); btn.disabled = true;
      try {
        const u = await API.placeBid(id, +$("#amt").value);
        Object.assign(a, { currentBid: u.currentBid, bidCount: u.bidCount }); quick();
        $("#cur").textContent = inr(u.currentBid); bump($("#cur")); $("#cnt").textContent = bidsText(u.bidCount); $("#amt").value = "";
        toast("Bid placed"); hist();
        const box = form.closest(".bidbox"); box.classList.remove("flash"); void box.offsetWidth; box.classList.add("flash");
        btn.classList.add("ok"); label.innerHTML = ICON.check + "Bid placed";
        setTimeout(() => { btn.classList.remove("ok"); label.textContent = "Place bid"; }, 1800);
      } catch (er) {
        err.textContent = er.message; form.classList.remove("shake"); void form.offsetWidth; form.classList.add("shake");
      } finally { btn.classList.remove("loading"); btn.disabled = ended(a); }
    };
    // Backend later: replace polling with Socket.IO ("bid:new" event) to refresh price and history live.
    const poll = async () => {
      try { const f = await API.getAuction(id); if (f.endTime !== a.endTime && !ended(f)) return route(); if (f.currentBid !== a.currentBid) bump($("#cur")); $("#cur").textContent = inr(f.currentBid); $("#cnt").textContent = bidsText(f.bidCount); Object.assign(a, { currentBid: f.currentBid, bidCount: f.bidCount }); quick(); hist(); } catch {}
    };
    refreshHook = poll; // a demo timer that ends is re-checked straight away; if the server renewed it, the page reloads with the new timer
    pollTimer = setInterval(poll, 10000);
  },

  async login() { authView("Log in", false); },
  async register() { authView("Create your account", true); },

  async sell() { if (needLogin()) return; sellForm(); },
  async edit(id) {
    if (needLogin()) return;
    const a = await API.getAuction(id);
    if (a.seller?._id !== API.currentUser()._id) throw new Error("You can only edit your own auctions.");
    if (ended(a)) throw new Error("Ended auctions can't be edited.");
    sellForm(a);
  },

  async "my-auctions"() {
    if (needLogin()) return;
    const mine = await API.myAuctions();
    app.innerHTML = `<div class="wrap"><div class="section-head" style="margin-top:0"><h1 class="page-h">My auctions</h1><a class="btn green" href="#/sell">Sell a product</a></div>${auctionRows(mine)}</div>`;
    bindDelete(route);
  },

  async "my-bids"() {
    if (needLogin()) return;
    app.innerHTML = `<div class="wrap"><h1 class="page-h" style="margin-bottom:24px">My bids</h1>${bidRows(await API.myBids())}</div>`;
  },

  async dashboard() {
    if (needLogin()) return;
    const u = API.currentUser(), [bids, mine] = await Promise.all([API.myBids(), API.myAuctions()]);
    app.innerHTML = `<div class="wrap"><h1 class="page-h">Hello, ${esc(u.name)}</h1>
    <div class="stats"><div class="stat"><b data-count="${mine.filter((a) => !ended(a)).length}">0</b>My active auctions</div><div class="stat"><b data-count="${bids.filter((b) => !ended(b.auction)).length}">0</b>Active bids</div><div class="stat"><b data-count="${bids.filter((b) => bidStatus(b) === "Won").length}">0</b>Auctions won</div></div>
    <div class="section-head"><h2>My auctions</h2><a class="meta" href="#/my-auctions">See all</a></div>${auctionRows(mine.slice(0, 3))}
    <div class="section-head"><h2>Recent bids</h2><a class="meta" href="#/my-bids">See all</a></div>${bidRows(bids.slice(0, 3))}</div>`;
    bindDelete(route);
  }
};

function sellForm(a) {
  const edit = !!a, locked = edit && a.bidCount > 0;
  const local = (ms) => new Date(ms - new Date().getTimezoneOffset() * 6e4).toISOString().slice(0, 16);
  const opt = (list, v) => list.map((c) => `<option ${c === v ? "selected" : ""}>${c}</option>`).join("");
  app.innerHTML = `<div class="wrap auth wide"><h1>${edit ? "Edit auction" : "Sell a product"}</h1><form id="sf">
    <label>Product name<input name="title" required maxlength="80" value="${esc(a?.title || "")}"></label>
    <label>Description<textarea name="description" required rows="4">${esc(a?.description || "")}</textarea></label>
    <div class="two"><label>Category<select name="category">${opt(CATS, a?.category)}</select></label><label>Condition<select name="condition">${opt(CONDS, a?.condition)}</select></label></div>
    <div class="two"><label>Starting price (₹)<input name="startingPrice" type="number" min="1" required ${locked ? "disabled" : ""} value="${a?.startingPrice || ""}"></label>
    <label>Minimum increment (₹)<input name="minimumIncrement" type="number" min="1" required ${locked ? "disabled" : ""} value="${a?.minimumIncrement || 100}"></label></div>
    ${locked ? `<p class="meta">Prices are locked because this auction already has bids.</p>` : ""}
    <label>Auction ends<input name="endTime" type="datetime-local" required min="${local(Date.now())}" value="${local(a?.endTime || Date.now() + 864e5)}"></label>
    <label>Product image${edit ? " (leave empty to keep the current one)" : ""}<input name="image" type="file" accept="image/*" ${edit ? "" : "required"}></label>
    <p class="error" id="err"></p><button class="btn green">${edit ? "Save changes" : "Create auction"}</button></form></div>`;
  $("#sf").onsubmit = async (e) => {
    e.preventDefault(); const f = new FormData(e.target), d = Object.fromEntries(f);
    d.startingPrice = +d.startingPrice; d.minimumIncrement = +d.minimumIncrement; d.endTime = new Date(d.endTime).getTime();
    if (locked) { delete d.startingPrice; delete d.minimumIncrement; }
    try {
      const file = f.get("image"); d.image = file && file.size ? await API.uploadImage(file) : undefined;
      const r = edit ? await API.updateAuction(a._id, d) : await API.createAuction(d);
      toast(edit ? "Changes saved" : "Auction created"); location.hash = "#/auction/" + r._id;
    } catch (er) { $("#err").textContent = er.message; }
  };
}

function authView(title, isReg) {
  const perks = isReg
    ? ["Free to join, no card needed", "Bid on live auctions in seconds", "List your own items and start selling"]
    : ["Pick up right where you left off", "Track every bid on one dashboard", "Jump back to auctions ending soon"];
  const field = (label, icon, input) => `<label class="field"><span>${label}</span><div class="in">${icon}${input}</div></label>`;
  app.innerHTML = `<div class="auth-page">
    <aside class="auth-side"><i class="orb o1"></i><i class="orb o2"></i><i class="orb o3"></i>
      <div class="side-in"><span class="eyebrow">${isReg ? "Join AuctoBid" : "Welcome back"}</span>
        <h2>${isReg ? "Your next great find is one bid away." : "Good to see you again."}</h2>
        <ul class="perks">${perks.map((p, i) => `<li style="--i:${i}"><b>${ICON.check}</b>${p}</li>`).join("")}</ul>
        <div class="ticker"><i></i>Live bidding, 24 hours a day</div></div></aside>
    <section class="auth-card"><h1>${title}</h1>
      <p class="sub">${isReg ? "It takes less than a minute." : "Log in to bid, sell and track your auctions."}</p>
      <form id="af">
        ${isReg ? field("Name", ICON.user, '<input name="name" required autocomplete="name" placeholder="Your name">') : ""}
        ${field("Email", ICON.mail, '<input name="email" type="email" required autocomplete="email" placeholder="you@example.com">')}
        ${field("Password", ICON.lock, `<input name="password" type="password" required minlength="6" autocomplete="${isReg ? "new-password" : "current-password"}" placeholder="${isReg ? "At least 6 characters" : "Your password"}"><button type="button" class="eye" aria-label="Show password">${ICON.eye}</button>`)}
        ${isReg ? '<div class="strength" id="str"><i></i><span></span></div>' : ""}
        <p class="error" id="err"></p>
        <button class="btn green wide" id="go"><span>${isReg ? "Create account" : "Log in"}</span></button>
        ${isReg ? "" : '<div class="or"><span>or</span></div><button type="button" class="btn demo wide" id="demo">Try the demo account</button>'}
      </form>
      <p class="meta alt">${isReg ? 'Have an account? <a href="#/login">Log in</a>' : 'New here? <a href="#/register">Create an account</a>'}</p></section></div>`;

  const form = $("#af"), btn = $("#go"), pw = form.querySelector("[name=password]");
  form.querySelector("input").focus({ preventScroll: true });
  form.querySelector(".eye").onclick = (e) => {
    const show = pw.type === "password"; pw.type = show ? "text" : "password";
    e.currentTarget.innerHTML = show ? ICON.off : ICON.eye; e.currentTarget.setAttribute("aria-label", show ? "Hide password" : "Show password");
  };
  if (isReg) pw.oninput = () => {
    const v = pw.value, str = $("#str");
    const sc = !v ? 0 : Math.min(4, (v.length >= 6) + (v.length >= 10) + (/[a-z]/.test(v) && /[A-Z]/.test(v)) + (/\d|[^A-Za-z0-9]/.test(v)));
    str.dataset.s = sc; str.style.setProperty("--s", sc); str.querySelector("span").textContent = ["", "Weak", "Okay", "Good", "Strong"][sc];
  };
  const demo = $("#demo");
  if (demo) demo.onclick = () => {
    form.querySelector("[name=email]").value = "demo@auctobid.com"; pw.value = "demo1234";
    form.requestSubmit ? form.requestSubmit() : form.dispatchEvent(new Event("submit", { cancelable: true }));
  };
  form.onsubmit = async (e) => {
    e.preventDefault(); const f = Object.fromEntries(new FormData(form));
    $("#err").textContent = ""; btn.classList.add("loading"); btn.disabled = true;
    try { isReg ? await API.register(f.name, f.email, f.password) : await API.login(f.email, f.password); toast("Welcome to AuctoBid"); location.hash = "#/dashboard"; }
    catch (er) { $("#err").textContent = er.message; form.classList.remove("shake"); void form.offsetWidth; form.classList.add("shake"); }
    finally { btn.classList.remove("loading"); btn.disabled = false; }
  };
}

let routeId = 0;
async function route() {
  const my = ++routeId;
  clearInterval(pollTimer); clearTimeout(renewT); renewT = 0; renewTries = 0; refreshHook = null; renderNav(); window.scrollTo(0, 0);
  const [, name = "home", arg] = (location.hash || "#/").slice(1).split("/");
  const key = name || "home", view = views[key] || views.home;
  // Show a skeleton only if the data takes a moment, so fast loads don't flicker.
  const needsAuth = ["my-auctions", "my-bids", "dashboard"].includes(key) && !API.currentUser();
  const wait = SKELETON[key] && !needsAuth ? setTimeout(() => { if (my === routeId) { app.classList.remove("page-in"); app.innerHTML = SKELETON[key](); } }, 150) : 0;
  app.setAttribute("aria-busy", "true"); progress(true);
  try { await view(arg); } catch (e) { app.innerHTML = `<div class="wrap">${emptyState("alert", "Something went wrong", esc(e.message), `<a class="btn small" href="#/auctions">Back to auctions</a>`)}</div>`; }
  clearTimeout(wait); app.removeAttribute("aria-busy"); progress(false); enter();
}
window.addEventListener("hashchange", route);
route();
