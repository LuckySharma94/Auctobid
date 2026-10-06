// Demo data. Used by server.js on every start (self-healing) and by seed.js (npm run seed, which resets everything).
const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const User = require("./models/User");
const Auction = require("./models/Auction");
const Bid = require("./models/Bid");
const CATALOG = require("./catalog.json"); // 119 sample products: t=title c=category k=condition p=start price d=description w=Wikipedia titles h=hours left n=bids s=seller

const H = 36e5, MIN = 6e4;

const DEMO = [
  { name: "Demo User", email: "demo@auctobid.com", password: "demo1234" },
  { name: "Demo Buyer", email: "demo2@auctobid.com", password: "demo1234" }
];
const BIDDERS = ["Rahul", "Priya", "Dev", "Simran", "Nikhil", "Pooja"];
const minInc = (p) => Math.max(100, Math.round((p * 0.02) / 100) * 100);
const emailOf = (n) => `${n.toLowerCase().replace(/\s+/g, "")}@auctobid.demo`;

// Creates or repairs a user directly in the collection, so even an old/broken user document (wrong hash, missing fields) is fixed.
async function upsertUser({ name, email, password }) {
  const hash = await bcrypt.hash(password, 10);
  await User.collection.updateOne(
    { email },
    { $set: { name, email, password: hash, role: "user" }, $setOnInsert: { createdAt: new Date() } },
    { upsert: true }
  );
  return User.findOne({ email });
}

async function ensureUsers() {
  const users = {};
  for (const u of DEMO) users[u.name] = await upsertUser(u); // demo logins always work, password reset to demo1234
  const names = [...new Set([...CATALOG.map((a) => a.s), ...BIDDERS])];
  for (const n of names) {
    users[n] = (await User.findOne({ email: emailOf(n) })) ||
      (await upsertUser({ name: n, email: emailOf(n), password: crypto.randomBytes(12).toString("hex") })); // display-only accounts
  }
  return users;
}

// Wikipedia summary thumbnail (500px) with the original URL as fallback.
async function wikiImage(titles) {
  for (const t of titles) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const r = await fetch("https://en.wikipedia.org/api/rest_v1/page/summary/" + encodeURIComponent(t), {
          headers: { "User-Agent": "AuctoBid-demo/1.0 (student project)" },
          signal: AbortSignal.timeout(8000)
        });
        if (r.status === 404) break;
        if (!r.ok) continue;
        const src = (await r.json()).thumbnail?.source;
        if (src) return { image: src.replace(/\/\d+px-/, "/500px-"), imageFallback: src };
        break;
      } catch { /* retry, then try the next title */ }
    }
  }
  return { image: "", imageFallback: "" };
}

// Fetch photos for every demo listing that has none. Runs in small batches; safe to run again and again.
async function fillImages() {
  const todo = await Auction.find({ isDemo: true, $or: [{ image: "" }, { image: { $exists: false } }] }).select("title");
  if (!todo.length) return;
  const byTitle = new Map(CATALOG.map((a) => [a.t, a]));
  let done = 0;
  for (let i = 0; i < todo.length; i += 6) {
    await Promise.all(todo.slice(i, i + 6).map(async (doc) => {
      const item = byTitle.get(doc.title); if (!item) return;
      const img = await wikiImage(item.w);
      if (img.image) { await Auction.updateOne({ _id: doc._id }, { $set: img }); done++; }
    }));
  }
  console.log(`Photos: added ${done} of ${todo.length} missing demo photos.${done < todo.length ? " (needs internet; they are retried on the next start)" : ""}`);
}

// Creates any catalog item that is not in the database yet.
async function addMissing(users) {
  const have = new Set((await Auction.find({ isDemo: true }).select("title")).map((a) => a.title));
  const now = Date.now();
  let made = 0;
  for (let i = 0; i < CATALOG.length; i++) {
    const a = CATALOG[i];
    if (have.has(a.t)) continue;
    const inc = minInc(a.p);
    // Bid ladder: starting price, then climbing by 1-3 increments each time.
    const amounts = []; let cur = a.p;
    for (let k = 0; k < a.n; k++) { amounts.push(cur); cur += inc * (1 + ((i + k) % 3)); }
    const current = a.n ? amounts[amounts.length - 1] : a.p;
    const auction = await Auction.create({
      title: a.t, description: a.d, category: a.c, condition: a.k, startingPrice: a.p, currentBid: current,
      minimumIncrement: inc, bidCount: a.n, endTime: Math.round(now + a.h * H), seller: users[a.s]._id, isDemo: true
    });
    made++;
    if (!a.n) continue;
    const who = amounts.map((_, k) => BIDDERS[(i + k) % BIDDERS.length]);
    who[who.length - 1] = a.top || who[who.length - 1];
    if (a.t === "MacBook Air M1" && who.length > 2) who[who.length - 2] = "Demo User"; // Demo User is outbid here
    await Bid.insertMany(amounts.map((amount, k) => ({
      auction: auction._id, bidder: users[who[k]]._id, amount, createdAt: new Date(now - (amounts.length - k) * 17 * MIN)
    })));
  }
  return made;
}

// Demo listings created by an earlier version have no isDemo flag. Recognise them (same title as a catalog item and
// owned by a demo/sample account) and mark them, then remove duplicates left by a previous run.
async function adoptLegacy() {
  const owners = await User.find({ $or: [{ email: /@auctobid\.demo$/ }, { email: { $in: DEMO.map((d) => d.email) } }] }).select("_id");
  const ids = owners.map((o) => o._id);
  let adopted = 0;
  for (const a of CATALOG) {
    const r = await Auction.collection.updateMany({ title: a.t, seller: { $in: ids }, isDemo: { $ne: true } }, { $set: { isDemo: true } });
    adopted += r.modifiedCount || 0;
  }
  // duplicates (same title, both demo): keep the oldest, delete the rest
  const docs = await Auction.find({ isDemo: true }).sort({ createdAt: 1, _id: 1 }).select("title");
  const seen = new Set(), extra = [];
  for (const d of docs) { if (seen.has(d.title)) extra.push(d._id); else seen.add(d.title); }
  if (extra.length) { await Bid.deleteMany({ auction: { $in: extra } }); await Auction.deleteMany({ _id: { $in: extra } }); }
  if (adopted || extra.length) console.log(`Demo repair: marked ${adopted} old demo listing(s), removed ${extra.length} duplicate(s).`);
}

// Old data from an earlier version (no endTime / currentBid / seller) breaks every page with NaN or crashes. Remove it.
async function removeBroken() {
  const col = Auction.collection;
  const bad = await col.find({ $or: [
    { endTime: { $not: { $type: "number" } } }, { currentBid: { $not: { $type: "number" } } },
    { startingPrice: { $not: { $type: "number" } } }, { minimumIncrement: { $not: { $type: "number" } } },
    { seller: { $exists: false } }, { title: { $exists: false } },
    { category: { $nin: Auction.CATEGORIES } }, { condition: { $nin: Auction.CONDITIONS } }
  ] }, { projection: { _id: 1 } }).toArray();
  // also auctions whose seller user no longer exists (the page would crash reading seller.name)
  const sellers = await col.distinct("seller");
  const alive = new Set((await User.find({ _id: { $in: sellers } }).select("_id")).map((u) => String(u._id)));
  const orphan = (await col.find({ seller: { $in: sellers.filter((s) => !alive.has(String(s))) } }, { projection: { _id: 1 } }).toArray());
  const ids = [...new Set([...bad, ...orphan].map((d) => d._id))];
  if (!ids.length) return 0;
  await Bid.deleteMany({ auction: { $in: ids } });
  await col.deleteMany({ _id: { $in: ids } });
  return ids.length;
}

// Demo listings whose timer ran out get a fresh timer, so 100+ demo products are always live.
// Only isDemo listings are touched; auctions created by real users expire normally and stay ended.
const HOURS = new Map(CATALOG.map((a) => [a.t, a.h]));
let lastRenew = 0;
async function renewDemo({ throttle = 0 } = {}) {
  if (process.env.DEMO_REVIVE === "false") return 0;
  if (throttle && Date.now() - lastRenew < throttle) return 0;
  lastRenew = Date.now();
  const now = Date.now();
  const ended = await Auction.find({ isDemo: true, endTime: { $lt: now } }).select("title");
  for (const a of ended) {
    const hrs = Math.max(2, HOURS.get(a.title) || 24);
    await Auction.updateOne({ _id: a._id }, { $set: { endTime: Math.round(now + hrs * H) } });
  }
  return ended.length;
}

// Called on EVERY server start. Safe to run repeatedly; it never touches auctions real users created.
async function ensureDemo() {
  const removed = await removeBroken();
  if (removed) console.log(`Cleaned up ${removed} broken auction(s) left over from an older version.`);
  const users = await ensureUsers();
  await adoptLegacy();
  const made = await addMissing(users);
  if (made) console.log(`Added ${made} demo auctions.`);
  const n = await renewDemo();
  if (n) console.log(`Restarted ${n} ended demo auction(s).`);
  console.log(`Demo login: ${DEMO[0].email} / ${DEMO[0].password}`);
  fillImages().catch((e) => console.error("Photo fill failed:", e.message)); // background, does not delay startup
}

module.exports = async function seed({ reset = false } = {}) {
  if (reset) await Promise.all([User.deleteMany({}), Auction.deleteMany({}), Bid.deleteMany({})]);
  await ensureDemo();
  await fillImages(); // for `npm run seed`, wait for photos before exiting
};
module.exports.ensureDemo = ensureDemo;
module.exports.renewDemo = renewDemo;
module.exports.refreshDemo = ensureDemo;
