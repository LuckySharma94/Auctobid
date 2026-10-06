/* ============================================================
   AuctoBid API layer
   All data access goes through window.API. The UI never calls
   fetch() directly. To connect your backend:
     1. Set USE_MOCK to false
     2. Set BASE_URL to your Express server
   Each method lists the REST endpoint it maps to.
   ============================================================ */
// Locally the backend runs on port 5000. When the same server hosts the site (deployed, or http://localhost:5000), "/api" is used.
const LOCAL = ["localhost", "127.0.0.1", ""].includes(location.hostname);
const CONFIG = { USE_MOCK: false, BASE_URL: LOCAL && location.port !== "5000" ? "http://localhost:5000/api" : "/api" };
const OFFLINE = "Can't reach the AuctoBid server. Start the backend (cd backend, then npm start) and open http://localhost:5000.";

const store = {
  get token() { return localStorage.getItem("auctobid_token"); },
  get user() { try { return JSON.parse(localStorage.getItem("auctobid_user")); } catch { return null; } },
  save(token, user) { localStorage.setItem("auctobid_token", token); localStorage.setItem("auctobid_user", JSON.stringify(user)); },
  clear() { localStorage.removeItem("auctobid_token"); localStorage.removeItem("auctobid_user"); }
};

async function http(path, { method = "GET", body } = {}) {
  const res = await fetch(CONFIG.BASE_URL + path, {
    method,
    headers: { "Content-Type": "application/json", ...(store.token && { Authorization: `Bearer ${store.token}` }) },
    body: body && JSON.stringify(body)
  }).catch(() => { throw new Error(OFFLINE); });
  const data = await res.json().catch(() => ({}));
  // Stale or expired login (for example a leftover demo-mode token): clear it and ask the user to log in again.
  if (res.status === 401 && store.token && !path.startsWith("/auth")) { store.clear(); location.hash = "#/login"; }
  if (!res.ok) throw new Error(data.message || "Something went wrong");
  return data;
}

/* ---------- Mock data (delete once the backend exists) ---------- */
const H = 36e5, T = Date.now();
// Photos are fetched at runtime from the free Wikipedia API (no key, nothing to download) and cached in localStorage.
// Each auction lists Wikipedia article titles to try, in order. With a real backend, return an `image` URL instead.
const WIKI = {
  1: ["MacBook_Air", "MacBook"], 2: ["Sony_WH-1000X", "Headphones"], 3: ["Rolleiflex", "Twin-lens_reflex_camera"],
  4: ["Banarasi_sari", "Sari"], 5: ["Book", "Hindi_literature"], 6: ["Writing_desk", "Desk"],
  7: ["Royal_Enfield_Classic_350", "Royal_Enfield_Classic"], 8: ["Mechanical_keyboard", "Computer_keyboard"]
};
async function wikiImage(titles) {
  for (const t of titles) {
    const key = "auctobid_img2_" + t; // v2 key: ignores URLs cached by the old (broken) size rewrite
    try {
      const cached = localStorage.getItem(key); if (cached) return JSON.parse(cached);
      const r = await fetch("https://en.wikipedia.org/api/rest_v1/page/summary/" + encodeURIComponent(t));
      if (!r.ok) continue;
      const src = (await r.json()).thumbnail?.source;
      // 500px is a standard Wikimedia size; `fb` is the untouched URL Wikipedia returned, used if 500px fails.
      if (src) { const out = { image: src.replace(/\/\d+px-/, "/500px-"), fb: src }; localStorage.setItem(key, JSON.stringify(out)); return out; }
    } catch {}
  }
  return { image: "", fb: "" };
}
const hydrate = async (list) => { await Promise.all(list.filter((a) => !a.image && a._wiki).map(async (a) => { const w = await wikiImage(a._wiki); a.image = w.image; a.imageFallback = w.fb; })); return list; };
const mk = (id, title, category, condition, startingPrice, currentBid, bids, hrs, seller, description) =>
  ({ _id: id, image: "", _wiki: WIKI[id], title, category, condition, startingPrice, currentBid, minimumIncrement: Math.max(100, Math.round(startingPrice * 0.02 / 100) * 100),
     bidCount: bids, endTime: T + hrs * H, seller: { _id: "s" + id, name: seller }, description });
const mock = {
  auctions: [
    mk(1, "MacBook Air M1", "Electronics", "Like new", 35000, 48500, 12, 2.6, "Aarav", "13-inch, 8GB RAM, 256GB. Battery health 94%. Original charger and box included."),
    mk(2, "Sony WH-1000XM5", "Electronics", "Like new", 10000, 14200, 7, 9, "Meera", "Noise-cancelling headphones, used for three months. Case and cable included."),
    mk(3, "Vintage Rolleiflex camera", "Collectibles", "Good", 18000, 26500, 15, 1.2, "Kabir", "1960s twin-lens reflex camera. Shutter tested, lens clean, leather case."),
    mk(4, "Handloom silk saree", "Fashion", "New", 4000, 5600, 4, 30, "Ishita", "Banarasi silk in deep green with gold border. Never worn."),
    mk(5, "Complete Premchand set", "Books", "Good", 1200, 1800, 5, 52, "Rohan", "Twelve volumes in Hindi, hardbound, minor shelf wear."),
    mk(6, "Teak study desk", "Home", "Good", 6000, 6000, 0, 70, "Neha", "120 x 60 cm solid teak with two drawers. Pickup in Ghaziabad."),
    mk(7, "Royal Enfield Classic 350", "Vehicles", "Good", 90000, 112000, 9, 20, "Vikram", "2018 model, 21,000 km, first owner, papers clear."),
    mk(8, "Mechanical keyboard, 75%", "Electronics", "New", 3500, 4100, 3, 5, "Sara", "Hot-swappable, tactile switches, PBT keycaps.")
  ],
  bids: { 1: [[48500, "Rahul", 12], [47000, "Priya", 40], [45500, "Dev", 75]] },
  mine: []
};
const delay = (v) => new Promise((r) => setTimeout(() => r(structuredClone(v)), 150));
const fail = (m) => Promise.reject(new Error(m));

const check = (d) => !d.title?.trim() || !d.description?.trim() ? "Add a product name and a description."
  : !(d.startingPrice > 0) || !(d.minimumIncrement > 0) ? "Starting price and minimum increment must be above zero."
  : !(d.endTime > Date.now()) ? "Choose an end time in the future." : "";

/* ---------- Public API ---------- */
const API = {
  // POST /auth/login  ->  { token, user }
  async login(email, password) {
    if (!CONFIG.USE_MOCK) { const d = await http("/auth/login", { method: "POST", body: { email, password } }); store.save(d.token, d.user); return d.user; }
    if (!email || password.length < 6) return fail("Enter a valid email and a password of at least 6 characters.");
    const user = { _id: "me", name: email.split("@")[0], email, role: "user" };
    store.save("mock-token", user); return delay(user);
  },
  // POST /auth/register  ->  { token, user }
  async register(name, email, password) {
    if (!CONFIG.USE_MOCK) { const d = await http("/auth/register", { method: "POST", body: { name, email, password } }); store.save(d.token, d.user); return d.user; }
    if (!name || !email || password.length < 6) return fail("Fill every field. Password needs 6 or more characters.");
    const user = { _id: "me", name, email, role: "user" };
    store.save("mock-token", user); return delay(user);
  },
  logout() { store.clear(); },
  currentUser() { return store.user; },

  // GET /auctions?search=&category=&sort=  ->  [auction]
  async getAuctions({ search = "", category = "", sort = "ending" } = {}) {
    if (!CONFIG.USE_MOCK) return http(`/auctions?${new URLSearchParams({ search, category, sort })}`);
    let list = mock.auctions.filter((a) => a.title.toLowerCase().includes(search.toLowerCase()) && (!category || a.category === category));
    const by = { ending: (a, b) => a.endTime - b.endTime, low: (a, b) => a.currentBid - b.currentBid, high: (a, b) => b.currentBid - a.currentBid, bids: (a, b) => b.bidCount - a.bidCount };
    return delay(await hydrate(list.sort(by[sort])));
  },
  // GET /auctions/:id  ->  auction
  async getAuction(id) {
    if (!CONFIG.USE_MOCK) return http(`/auctions/${id}`);
    const a = mock.auctions.find((x) => x._id == id);
    return a ? delay((await hydrate([a]))[0]) : fail("This auction doesn't exist or was removed.");
  },
  // GET /auctions/:id/bids  ->  [{ amount, bidder: { name }, createdAt }]
  async getBids(id) {
    if (!CONFIG.USE_MOCK) return http(`/auctions/${id}/bids`);
    return delay((mock.bids[id] || []).map(([amount, name, ago]) => ({ amount, bidder: { name }, createdAt: Date.now() - ago * 6e4 })));
  },
  // POST /auctions/:id/bids  { amount }  ->  updated auction. The server must re-validate everything.
  async placeBid(id, amount) {
    if (!CONFIG.USE_MOCK) return http(`/auctions/${id}/bids`, { method: "POST", body: { amount } });
    const u = store.user, a = mock.auctions.find((x) => x._id == id);
    if (!u) return fail("Log in to place a bid.");
    if (!a) return fail("This auction doesn't exist or was removed.");
    if (a.seller._id === u._id) return fail("You can't bid on your own auction.");
    if (a.endTime <= Date.now()) return fail("This auction has ended.");
    const min = a.bidCount ? a.currentBid + a.minimumIncrement : a.startingPrice;
    if (amount < min) return fail(`Your bid must be at least ₹${min.toLocaleString("en-IN")}.`);
    a.currentBid = amount; a.bidCount++;
    (mock.bids[id] = mock.bids[id] || []).unshift([amount, u.name, 0]);
    mock.mine = mock.mine.filter((m) => m.auction !== id).concat({ auction: id, amount });
    return delay(a);
  },
  // POST /auctions  { title, description, category, condition, startingPrice, minimumIncrement, endTime (ms), image (url) }  ->  auction
  // Server sets seller from the token, currentBid = startingPrice, bidCount = 0.
  async createAuction(d) {
    if (!CONFIG.USE_MOCK) return http("/auctions", { method: "POST", body: d });
    const u = store.user; if (!u) return fail("Log in to create an auction.");
    const err = check(d) || (!d.image && "Add a product image."); if (err) return fail(err);
    const a = { ...d, _id: Date.now(), currentBid: d.startingPrice, bidCount: 0, seller: { _id: u._id, name: u.name } };
    mock.auctions.unshift(a); return delay(a);
  },
  // PUT /auctions/:id  ->  auction. Owner only. Server must reject price changes once bids exist.
  async updateAuction(id, d) {
    if (!CONFIG.USE_MOCK) return http(`/auctions/${id}`, { method: "PUT", body: d });
    const u = store.user, a = mock.auctions.find((x) => x._id == id);
    if (!a) return fail("This auction doesn't exist or was removed.");
    if (!u || a.seller._id !== u._id) return fail("You can only edit your own auctions.");
    if (a.endTime <= Date.now()) return fail("Ended auctions can't be edited.");
    if (a.bidCount) d = { ...d, startingPrice: a.startingPrice, minimumIncrement: a.minimumIncrement };
    const err = check(d); if (err) return fail(err);
    Object.assign(a, d, { image: d.image || a.image });
    if (!a.bidCount) a.currentBid = a.startingPrice;
    return delay(a);
  },
  // DELETE /auctions/:id  ->  { ok: true }. Owner only.
  async deleteAuction(id) {
    if (!CONFIG.USE_MOCK) return http(`/auctions/${id}`, { method: "DELETE" });
    const u = store.user, a = mock.auctions.find((x) => x._id == id);
    if (!a) return fail("This auction doesn't exist or was removed.");
    if (!u || a.seller._id !== u._id) return fail("You can only delete your own auctions.");
    mock.auctions = mock.auctions.filter((x) => x !== a); delete mock.bids[id];
    mock.mine = mock.mine.filter((m) => m.auction != id);
    return delay({ ok: true });
  },
  // GET /users/my-auctions  ->  [auction]  (auctions where seller is the logged-in user)
  async myAuctions() {
    if (!CONFIG.USE_MOCK) return http("/users/my-auctions");
    const u = store.user; await hydrate(mock.auctions);
    return delay(mock.auctions.filter((a) => u && a.seller._id === u._id));
  },
  // POST /uploads (multipart, field "image")  ->  { url }
  // Backend saves the file (Cloudinary / S3 / local disk) and returns a public URL.
  // Store that URL in the auction's `image` field when you create the listing.
  async uploadImage(file) {
    if (!CONFIG.USE_MOCK) {
      const fd = new FormData(); fd.append("image", file);
      const res = await fetch(CONFIG.BASE_URL + "/uploads", { method: "POST", body: fd, headers: store.token ? { Authorization: `Bearer ${store.token}` } : {} }).catch(() => { throw new Error(OFFLINE); });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || "Upload failed");
      return data.url;
    }
    return delay(URL.createObjectURL(file));
  },
  // GET /users/my-bids  ->  [{ auction, amount }]
  async myBids() {
    if (!CONFIG.USE_MOCK) return http("/users/my-bids");
    await hydrate(mock.auctions);
    return delay(mock.mine.map((m) => ({ ...m, auction: mock.auctions.find((a) => a._id == m.auction) })).reverse());
  }
};
