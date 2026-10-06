const Auction = require("../models/Auction");
const Bid = require("../models/Bid");
const { CATEGORIES, CONDITIONS } = Auction;
const { httpError, asyncHandler, isValidId, escapeRegExp } = require("../utils/helpers");

const notFound = () => httpError(404, "This auction doesn't exist or was removed.");
const SORTS = {
  ending: { endTime: 1, _id: 1 },
  low: { currentBid: 1, _id: 1 },
  high: { currentBid: -1, _id: 1 },
  bids: { bidCount: -1, _id: 1 }
};

// Same rules as check() in api.js, enforced on the server too.
function validate(d) {
  if (!d.title || !d.description) return "Add a product name and a description.";
  if (d.title.length > 80) return "Product name must be 80 characters or fewer.";
  if (d.description.length > 2000) return "Description must be 2000 characters or fewer.";
  if (!CATEGORIES.includes(d.category)) return "Choose a valid category.";
  if (!CONDITIONS.includes(d.condition)) return "Choose a valid condition.";
  if (!(d.startingPrice > 0) || !(d.minimumIncrement > 0)) return "Starting price and minimum increment must be above zero.";
  if (!(d.endTime > Date.now())) return "Choose an end time in the future.";
  return "";
}

const validImage = (v) => typeof v === "string" && /^https?:\/\//i.test(v) && v.length < 2048;
const { renewDemo } = require("../seedData");
const fresh = () => renewDemo({ throttle: 5000 }).catch(() => {}); // demo products never sit "ended" when someone looks
const load = (id) => Auction.findById(id).populate("seller", "name");

// GET /api/auctions?search=&category=&sort=
exports.getAuctions = asyncHandler(async (req, res) => {
  await fresh();
  const search = String(req.query.search || "").trim().slice(0, 100);
  const category = String(req.query.category || "");
  const sort = SORTS[req.query.sort] || SORTS.ending;

  const filter = {};
  if (search) filter.title = { $regex: escapeRegExp(search), $options: "i" };
  if (category) filter.category = category;

  res.json(await Auction.find(filter).sort(sort).limit(200).populate("seller", "name"));
});

// GET /api/auctions/:id
exports.getAuction = asyncHandler(async (req, res) => {
  await fresh();
  if (!isValidId(req.params.id)) throw notFound();
  const auction = await load(req.params.id);
  if (!auction) throw notFound();
  res.json(auction);
});

// POST /api/auctions   (seller, currentBid and bidCount are set by the server)
exports.createAuction = asyncHandler(async (req, res) => {
  const b = req.body;
  const data = {
    title: String(b.title || "").trim(),
    description: String(b.description || "").trim(),
    category: b.category,
    condition: b.condition,
    startingPrice: Number(b.startingPrice),
    minimumIncrement: Number(b.minimumIncrement),
    endTime: Number(b.endTime)
  };
  const err = validate(data) || (!validImage(b.image) && "Add a product image.");
  if (err) throw httpError(400, err);

  const auction = await Auction.create({
    ...data,
    image: b.image,
    currentBid: data.startingPrice,
    bidCount: 0,
    seller: req.user._id
  });
  res.status(201).json(await load(auction._id));
});

// PUT /api/auctions/:id   (owner only; prices are locked once bids exist)
exports.updateAuction = asyncHandler(async (req, res) => {
  if (!isValidId(req.params.id)) throw notFound();
  const auction = await Auction.findById(req.params.id);
  if (!auction) throw notFound();
  if (String(auction.seller) !== String(req.user._id)) throw httpError(403, "You can only edit your own auctions.");
  if (auction.endTime <= Date.now()) throw httpError(400, "Ended auctions can't be edited.");

  const b = req.body, locked = auction.bidCount > 0;
  const data = {
    title: b.title === undefined ? auction.title : String(b.title).trim(),
    description: b.description === undefined ? auction.description : String(b.description).trim(),
    category: b.category === undefined ? auction.category : b.category,
    condition: b.condition === undefined ? auction.condition : b.condition,
    startingPrice: locked || b.startingPrice === undefined ? auction.startingPrice : Number(b.startingPrice),
    minimumIncrement: locked || b.minimumIncrement === undefined ? auction.minimumIncrement : Number(b.minimumIncrement),
    endTime: b.endTime === undefined ? auction.endTime : Number(b.endTime)
  };
  const err = validate(data);
  if (err) throw httpError(400, err);

  Object.assign(auction, data);
  if (validImage(b.image) && b.image !== auction.image) {
    auction.image = b.image;
    auction.imageFallback = ""; // a new photo replaces any seeded Wikipedia fallback
  }
  if (!locked) auction.currentBid = auction.startingPrice;

  await auction.save();
  res.json(await load(auction._id));
});

// DELETE /api/auctions/:id   (owner only)
exports.deleteAuction = asyncHandler(async (req, res) => {
  if (!isValidId(req.params.id)) throw notFound();
  const auction = await Auction.findById(req.params.id);
  if (!auction) throw notFound();
  if (String(auction.seller) !== String(req.user._id)) throw httpError(403, "You can only delete your own auctions.");

  await Bid.deleteMany({ auction: auction._id });
  await auction.deleteOne();
  res.json({ ok: true });
});
