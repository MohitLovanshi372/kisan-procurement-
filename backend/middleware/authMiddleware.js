const jwt = require("jsonwebtoken");
const Farmer = require("../models/Farmer");

const JWT_SECRET = process.env.JWT_SECRET || "sih26032_kisan_mitra_secret_jwt_key_2026";

const protect = async (req, res, next) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith("Bearer ")) {
    try {
      token = req.headers.authorization.split(" ")[1];
      const decoded = jwt.verify(token, JWT_SECRET);

      const user = await Farmer.findById(decoded.id);
      if (!user) {
        return res.status(401).json({ success: false, message: "User not found or session expired" });
      }

      req.user = {
        id: user._id,
        farmerId: user.farmerId,
        name: user.name,
        mobile: user.mobile,
        role: user.role || "farmer"
      };

      return next();
    } catch (error) {
      return res.status(401).json({ success: false, message: "Invalid or expired authorization token" });
    }
  }

  if (!token) {
    return res.status(401).json({ success: false, message: "Not authorized, no token provided" });
  }
};

const adminOnly = (req, res, next) => {
  if (req.user && req.user.role === "admin") {
    next();
  } else {
    res.status(403).json({ success: false, message: "Access forbidden: Admin role required" });
  }
};

module.exports = { protect, adminOnly, JWT_SECRET };
