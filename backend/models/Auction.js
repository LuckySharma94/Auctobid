const mongoose = require("mongoose");

const CATEGORIES = ["Electronics", "Fashion", "Collectibles", "Books", "Home", "Vehicles", "Other"];
const CONDITIONS = ["New", "Like new", "Good", "Fair"];

const auctionSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 80 },
    description: { type: String, required: true, trim: true, maxlength: 2000 },
    category: { type: String, enum: CATEGORIES, default: "Other" },
    condition: { type: String, enum: CONDITIONS, default: "Good" },
    image: { type: String, default: "" },
    // Only used by seeded demo items: the untouched Wikipedia URL the UI falls back to if the 500px one fails.
    imageFallback: { type: String, default: "" },
    startingPrice: { type: Number, required: true, min: 1 },
    currentBid: { type: Number, required: true },
    minimumIncrement: { type: Number, required: true, min: 1 },
    // Milliseconds since epoch (a number, because the frontend compares it with Date.now()).
    endTime: { type: Number, required: true },
    seller: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    bidCount: { type: Number, default: 0 },
    // true for the built-in sample listings (never set for anything a real user creates)
    isDemo: { type: Boolean, default: false }
  },
  { timestamps: true }
);

auctionSchema.index({ endTime: 1 });
auctionSchema.index({ seller: 1, createdAt: -1 });

auctionSchema.set("toJSON", {
  transform: (doc, ret) => { delete ret.__v; return ret; }
});

module.exports = mongoose.model("Auction", auctionSchema);
module.exports.CATEGORIES = CATEGORIES;
module.exports.CONDITIONS = CONDITIONS;
