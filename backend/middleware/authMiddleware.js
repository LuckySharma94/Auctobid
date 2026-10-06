const jwt = require("jsonwebtoken");
const User = require("../models/User");
const { httpError, asyncHandler } = require("../utils/helpers");

// Requires "Authorization: Bearer <token>". Sets req.user.
exports.protect = asyncHandler(async (req, res, next) => {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!token) throw httpError(401, "Log in to continue.");

  let payload;
  try {
    payload = jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    throw httpError(401, "Your session has expired. Please log in again.");
  }

  const user = await User.findById(payload.id);
  if (!user) throw httpError(401, "Your session has expired. Please log in again.");
  req.user = user;
  next();
});
