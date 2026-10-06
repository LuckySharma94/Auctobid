const router = require("express").Router();
const { protect } = require("../middleware/authMiddleware");
const { myAuctions, myBids } = require("../controllers/userController");

router.get("/my-auctions", protect, myAuctions);
router.get("/my-bids", protect, myBids);

module.exports = router;
