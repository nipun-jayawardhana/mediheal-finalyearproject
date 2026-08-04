/**
 * Role-based authorization middleware.
 * Restricts route access to specified roles.
 * @param  {...string} roles - Allowed roles (e.g. 'admin', 'doctor', 'patient', 'caregiver')
 */
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Not authorized, user missing',
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `User role '${req.user.role}' is not authorized to access this resource`,
      });
    }

    next();
  };
};

module.exports = { authorize };
