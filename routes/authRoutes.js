const express = require("express");
const {
  registerNewuser,
  loginUser,
  getAllUsers,
  getProfile,
  updateProfile,
  googleLogin,
} = require("../controllers/authController");
const router = express.Router();
const uploads = require("../middleware/upload");
const { authMiddleware } = require("../middleware/authMiddleware");
router.post("/register", registerNewuser);
router.post("/login", loginUser);
router.get("/users", getAllUsers);

router.post("/google-login",googleLogin)

router.get("/profile", getProfile);
router.put("/profile", authMiddleware, uploads.single("avatar"), updateProfile);

module.exports = router;
