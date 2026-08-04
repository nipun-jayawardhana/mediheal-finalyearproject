/**
 * Centralized 404 handler middleware.
 * Catches any request to routes that are not defined.
 */
const notFoundHandler = (req, res, next) => {
  res.status(404).json({
    success: false,
    message: `Route not found - ${req.originalUrl}`,
  });
};

module.exports = notFoundHandler;
