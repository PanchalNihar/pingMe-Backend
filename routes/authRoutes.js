const express = require("express");
const { registerNewuser, loginUser } = require("../controllers/authController");
const router = express.Router();

router.post("/register", registerNewuser);
router.post("/login", loginUser);

module.exports = router;
