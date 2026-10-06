const router = require("express").Router();
const { protect } = require("../middleware/authMiddleware");
const { getAuctions, getAuction, createAuction, updateAuction, deleteAuction } = require("../controllers/auctionController");

router.get("/", getAuctions);
router.get("/:id", getAuction);
router.post("/", protect, createAuction);
router.put("/:id", protect, updateAuction);
router.delete("/:id", protect, deleteAuction);

module.exports = router;
