// npm run seed  ->  wipes users, auctions and bids, then loads the demo data again (fresh end times).
require("dotenv").config();
const mongoose = require("mongoose");
const connectDB = require("./config/db");

(async () => {
  try {
    await connectDB();
    await require("./seedData")({ reset: true });
  } catch (err) {
    console.error("Seed failed:", err.message);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
})();
