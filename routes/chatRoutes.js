const express = require("express");
const { getChatMessages } = require("../controllers/chatController");
const router = express.Router();

router.get("/messages",getChatMessages);

module.exports = router;
