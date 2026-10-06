const Auction = require("../models/Auction");
const Bid = require("../models/Bid");
const { asyncHandler } = require("../utils/helpers");

// GET /api/users/my-auctions -> [auction]
exports.myAuctions = asyncHandler(async (req, res) => {
  await require("../seedData").renewDemo({ throttle: 5000 }).catch(() => {});
  res.json(await Auction.find({ seller: req.user._id }).sort({ createdAt: -1 }).populate("seller", "name"));
});

// GET /api/users/my-bids -> [{ auction, amount }]  (one row per auction: your highest bid, most recent first)
exports.myBids = asyncHandler(async (req, res) => {
  const bids = await Bid.find({ bidder: req.user._id }).sort({ createdAt: -1 });

  const rows = new Map();
  for (const b of bids) {
    const key = String(b.auction);
    const row = rows.get(key);
    if (!row) rows.set(key, { auction: key, amount: b.amount });
    else if (b.amount > row.amount) row.amount = b.amount;
  }

  const auctions = await Auction.find({ _id: { $in: [...rows.keys()] } }).populate("seller", "name");
  const byId = new Map(auctions.map((a) => [String(a._id), a]));

  res.json([...rows.values()].filter((r) => byId.has(r.auction)).map((r) => ({ auction: byId.get(r.auction), amount: r.amount })));
});
