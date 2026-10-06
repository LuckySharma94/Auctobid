// Unknown /api route
exports.notFound = (req, res) => {
  res.status(404).json({ message: `Route not found: ${req.method} ${req.originalUrl}` });
};

// Every error becomes { message }, which is what api.js reads (data.message).
exports.errorHandler = (err, req, res, next) => {
  if (res.headersSent) return next(err);

  let status = err.status || 500;
  let message = err.message;

  if (err.name === "MulterError") {
    status = 400;
    message = err.code === "LIMIT_FILE_SIZE" ? "Image is too large. Maximum size is 5 MB." : "Upload failed.";
  } else if (err.type === "entity.parse.failed") {
    status = 400; message = "Invalid request body.";
  } else if (err.name === "CastError") {
    status = 404; message = "This auction doesn't exist or was removed.";
  } else if (err.name === "ValidationError") {
    status = 400; message = Object.values(err.errors)[0]?.message || "Invalid data.";
  } else if (err.code === 11000) {
    status = 409; message = "An account with this email already exists.";
  }

  if (status >= 500) {
    console.error(err);
    message = "Something went wrong on the server.";
  }
  res.status(status).json({ message });
};
