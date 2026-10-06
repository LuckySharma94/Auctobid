const User = require("../models/User");
const generateToken = require("../utils/generateToken");
const { httpError, asyncHandler } = require("../utils/helpers");

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const send = (res, user, status = 200) => res.status(status).json({ token: generateToken(user._id), user: user.toPublic() });

// POST /api/auth/register -> { token, user }
exports.register = asyncHandler(async (req, res) => {
  const name = String(req.body.name || "").trim();
  const email = String(req.body.email || "").trim().toLowerCase();
  const password = String(req.body.password || "");

  if (!name || !email || password.length < 6) throw httpError(400, "Fill every field. Password needs 6 or more characters.");
  if (!EMAIL_RE.test(email)) throw httpError(400, "Enter a valid email address.");
  if (name.length > 60) throw httpError(400, "Name must be 60 characters or fewer.");
  if (await User.exists({ email })) throw httpError(409, "An account with this email already exists.");

  const user = await User.create({ name, email, password });
  send(res, user, 201);
});

// POST /api/auth/login -> { token, user }
exports.login = asyncHandler(async (req, res) => {
  const email = String(req.body.email || "").trim().toLowerCase();
  const password = String(req.body.password || "");

  if (!email || password.length < 6) throw httpError(400, "Enter a valid email and a password of at least 6 characters.");

  const user = await User.findOne({ email }).select("+password");
  if (!user || !(await user.matchPassword(password))) throw httpError(401, "Incorrect email or password.");
  send(res, user);
});
