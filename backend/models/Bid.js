const mongoose = require("mongoose");

const bidSchema = new mongoose.Schema(
  {
    auction: { type: mongoose.Schema.Types.ObjectId, ref: "Auction", required: true },
    bidder: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    amount: { type: Number, required: true, min: 1 }
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

bidSchema.index({ auction: 1, amount: -1 });
bidSchema.index({ bidder: 1, createdAt: -1 });

bidSchema.set("toJSON", {
  transform: (doc, ret) => { delete ret.__v; return ret; }
});

module.exports = mongoose.model("Bid", bidSchema);
