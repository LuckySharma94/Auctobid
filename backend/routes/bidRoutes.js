// Mounted at /api/auctions/:id/bids
const router = require("express").Router({ mergeParams: true });
const { protect } = require("../middleware/authMiddleware");
const { getBids, placeBid } = require("../controllers/bidController");

router.get("/", getBids);
router.post("/", protect, placeBid);

module.exports = router;
