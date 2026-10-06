const Auction = require("../models/Auction");
const Bid = require("../models/Bid");
const { httpError, asyncHandler, isValidId } = require("../utils/helpers");

const notFound = () => httpError(404, "This auction doesn't exist or was removed.");

// GET /api/auctions/:id/bids -> [{ amount, bidder: { name }, createdAt }], highest first
exports.getBids = asyncHandler(async (req, res) => {
  if (!isValidId(req.params.id)) throw notFound();
  if (!(await Auction.exists({ _id: req.params.id }))) throw notFound();

  const bids = await Bid.find({ auction: req.params.id })
    .sort({ amount: -1, createdAt: -1 })
    .limit(100)
    .populate("bidder", "name");
  res.json(bids);
});

// POST /api/auctions/:id/bids { amount } -> updated auction
exports.placeBid = asyncHandler(async (req, res) => {
  const { id } = req.params;
  if (!isValidId(id)) throw notFound();

  const amount = Number(req.body.amount);
  if (!Number.isFinite(amount) || amount <= 0) throw httpError(400, "Enter a valid bid amount.");

  // The update only applies if nobody bid in between (optimistic concurrency); retry a few times.
  for (let attempt = 0; attempt < 3; attempt++) {
    const auction = await Auction.findById(id);
    if (!auction) throw notFound();
    if (String(auction.seller) === String(req.user._id)) throw httpError(403, "You can't bid on your own auction.");
    if (auction.endTime <= Date.now()) throw httpError(400, "This auction has ended.");

    const min = auction.bidCount ? auction.currentBid + auction.minimumIncrement : auction.startingPrice;
    if (amount < min) throw httpError(400, `Your bid must be at least ₹${min.toLocaleString("en-IN")}.`);

    const updated = await Auction.findOneAndUpdate(
      { _id: id, currentBid: auction.currentBid, bidCount: auction.bidCount, endTime: { $gt: Date.now() } },
      { $set: { currentBid: amount }, $inc: { bidCount: 1 } },
      { new: true }
    );
    if (updated) {
      await Bid.create({ auction: id, bidder: req.user._id, amount });
      await updated.populate("seller", "name");
      return res.json(updated);
    }
  }
  throw httpError(409, "Someone else just placed a bid. Please try again.");
});
