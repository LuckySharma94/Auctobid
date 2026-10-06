const mongoose = require("mongoose");

// Error that carries an HTTP status. The error middleware turns it into { message }.
const httpError = (status, message) => Object.assign(new Error(message), { status });

// Lets async controllers throw without try/catch.
const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

const isValidId = (id) => mongoose.isValidObjectId(id) && String(id).length === 24;

const escapeRegExp = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

module.exports = { httpError, asyncHandler, isValidId, escapeRegExp };
