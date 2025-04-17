const jwt = require("jsonwebtoken");
require("dotenv").config();
function authMiddleware(req, res, next) {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(500).json({ message: "Internal Server Error" });
  }
}

module.exports = {
  authMiddleware,
};
