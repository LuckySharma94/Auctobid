const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 60 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true, minlength: 6, select: false },
    role: { type: String, enum: ["user", "admin"], default: "user" }
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

userSchema.methods.matchPassword = function (plain) {
  return bcrypt.compare(plain, this.password);
};

// Exactly the shape the frontend stores: { _id, name, email, role }
userSchema.methods.toPublic = function () {
  return { _id: String(this._id), name: this.name, email: this.email, role: this.role };
};

module.exports = mongoose.model("User", userSchema);
