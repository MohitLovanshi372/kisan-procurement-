const jwt = require("jsonwebtoken");
const Farmer = require("../models/Farmer");

const JWT_SECRET = process.env.JWT_SECRET || "sih26032_kisan_mitra_secret_jwt_key_2026";

function normalizeRole(role) {
  if (!role) return "FARMER";
  const upper = String(role).trim().toUpperCase();
  if (upper === "ADMIN") return "GOVERNMENT_ADMIN";
  if (upper === "FARMER") return "FARMER";
  if (upper === "CENTRE_OFFICER" || upper === "OFFICER") return "CENTRE_OFFICER";
  if (upper === "GOVERNMENT_ADMIN") return "GOVERNMENT_ADMIN";
  return upper;
}

const authenticateJWT = async (req, res, next) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith("Bearer ")) {
    token = req.headers.authorization.split(" ")[1];
  }

  if (!token) {
    return res.status(401).json({ success: false, message: "Authentication required" });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);

    const user = await Farmer.findById(decoded.id);
    if (!user) {
      return res.status(401).json({ success: false, message: "Invalid token: User not found or session expired" });
    }

    if (user.isActive === false) {
      return res.status(403).json({ success: false, message: "Account disabled by administrator" });
    }

    const normRole = normalizeRole(user.role);

    req.user = {
      id: user._id,
      farmerId: user.farmerId,
      name: user.name,
      mobile: user.mobile,
      role: normRole,
      assignedCentreId: user.assignedCentreId || null,
      assignedCentreName: user.assignedCentreName || user.preferredCentre || null,
      preferredCentre: user.preferredCentre || null,
      isActive: user.isActive !== false
    };

    return next();
  } catch (error) {
    return res.status(401).json({ success: false, message: "Invalid token" });
  }
};

const authorizeRoles = (...roles) => {
  const allowed = roles.map(r => normalizeRole(r));
  return (req, res, next) => {
    if (!req.user || !req.user.role) {
      return res.status(401).json({ success: false, message: "Authentication required" });
    }

    const userRole = normalizeRole(req.user.role);
    if (!allowed.includes(userRole)) {
      return res.status(403).json({
        success: false,
        message: `Access denied: Required role [${allowed.join(", ")}], your role is ${userRole}`
      });
    }

    next();
  };
};

const authorizeCentre = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ success: false, message: "Authentication required" });
  }

  // GOVERNMENT_ADMIN has system-wide access to all centres
  if (req.user.role === "GOVERNMENT_ADMIN") {
    return next();
  }

  // If user is CENTRE_OFFICER:
  if (req.user.role === "CENTRE_OFFICER") {
    const targetCentre = req.params.centreId || req.query.centreId || req.body.centreId || req.body.centre;

    // If no target centre specified in request, default to officer's assigned centre
    if (!targetCentre) {
      req.centreId = req.user.assignedCentreId;
      req.centreName = req.user.assignedCentreName;
      return next();
    }

    const assignedId = String(req.user.assignedCentreId || "").trim().toLowerCase();
    const assignedName = String(req.user.assignedCentreName || "").trim().toLowerCase();
    const target = String(targetCentre).trim().toLowerCase();

    if (target !== assignedId && target !== assignedName) {
      return res.status(403).json({
        success: false,
        message: "You are not authorized for this procurement centre"
      });
    }

    req.centreId = req.user.assignedCentreId;
    req.centreName = req.user.assignedCentreName;
    return next();
  }

  return res.status(403).json({
    success: false,
    message: "Access denied: Centre Officer role required"
  });
};

// Aliases for backward compatibility
const protect = authenticateJWT;
const adminOnly = authorizeRoles("GOVERNMENT_ADMIN");

module.exports = {
  authenticateJWT,
  authorizeRoles,
  authorizeCentre,
  protect,
  adminOnly,
  normalizeRole,
  JWT_SECRET
};
