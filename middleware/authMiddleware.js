const jwt = require("jsonwebtoken");
const admin = require("firebase-admin");
const User = require("../models/user");
require("dotenv").config();

// Initialize Firebase Admin if not already initialized
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(require("../config/")),
  });
}

// Standard JWT middleware for traditional auth
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

// Firebase auth middleware for verifying Firebase ID tokens
async function firebaseAuthMiddleware(req, res, next) {
  const token = req.headers.authorization?.split(" ")[1];
  
  if (!token) {
    return res.status(401).json({ message: "Unauthorized - No token provided" });
  }

  try {
    // First try to verify as Firebase token
    const decodedToken = await admin.auth().verifyIdToken(token);
    
    // Find user by Firebase UID
    const user = await User.findOne({ firebaseUid: decodedToken.uid });
    
    if (!user) {
      return res.status(401).json({ message: "User not found" });
    }
    
    req.user = { id: user._id, firebaseUid: decodedToken.uid };
    next();
  } catch (firebaseError) {
    // If Firebase verification fails, try JWT verification
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.user = decoded;
      next();
    } catch (jwtError) {
      return res.status(401).json({ message: "Invalid token" });
    }
  }
}

// Hybrid middleware that accepts both JWT and Firebase tokens
async function hybridAuthMiddleware(req, res, next) {
  const token = req.headers.authorization?.split(" ")[1];
  
  if (!token) {
    return res.status(401).json({ message: "Unauthorized - No token provided" });
  }

  // First try JWT (faster)
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    return next();
  } catch (jwtError) {
    // If JWT fails, try Firebase
    try {
      const decodedToken = await admin.auth().verifyIdToken(token);
      
      // Find user by Firebase UID
      const user = await User.findOne({ firebaseUid: decodedToken.uid });
      
      if (!user) {
        return res.status(401).json({ message: "User not found" });
      }
      
      req.user = { id: user._id, firebaseUid: decodedToken.uid };
      next();
    } catch (firebaseError) {
      return res.status(401).json({ message: "Invalid token" });
    }
  }
}

module.exports = {
  authMiddleware,
  firebaseAuthMiddleware,
  hybridAuthMiddleware,
};