const express = require("express");
const { registerNewuser, loginUser, getAllUsers } = require("../controllers/authController");
const router = express.Router();

router.post("/register", registerNewuser);
router.post("/login", loginUser);
router.get("/users",getAllUsers)
module.exports = router;
