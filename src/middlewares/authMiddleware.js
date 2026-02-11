const jwt = require("jsonwebtoken");

const protect = (req, res, next) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) {return res.status(401).json({ message: "Not authorized" });}

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    return next();
  } catch (error) {
    return res.status(401).json({ message: "Invalid token" });
  }
};

/** Optional auth: if token present and valid, set req.user; otherwise req.user is undefined. Never 401. */
const protectOptional = (req, res, next) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) {
    req.user = undefined;
    return next();
  }
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    return next();
  } catch (error) {
    req.user = undefined;
    return next();
  }
};

const restrictTo = (...allowedRoles) => {
  return (req, res, next) => {
    const userRoles = Array.isArray(req.user.roles)
      ? req.user.roles
      : [req.user.role]; // backward compatibility

    const isAllowed = userRoles.some(role => allowedRoles.includes(role));
    // console.log("User Roles:", userRoles, "Allowed Roles:", allowedRoles, "Is Allowed:", isAllowed);

    if (!isAllowed) {
      return res
        .status(403)
        .json({ message: "Forbidden: insufficient permissions" });
    }

    return next();
  };
};

module.exports = {
  protect,
  protectOptional,
  restrictTo
};