const jwt = require('jsonwebtoken')

const protect = (req, res, next) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ message: "Not authorized" });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    res.status(401).json({ message: "Invalid token" });
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

    next();
  };
};

module.exports = {
    protect,
    restrictTo
}