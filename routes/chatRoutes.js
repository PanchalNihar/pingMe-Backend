const express = require("express");
const {
  getChatMessages,
  markMessagesAsRead,
} = require("../controllers/chatController");
const router = express.Router();

router.get("/messages", getChatMessages);
router.post("/mark-read", markMessagesAsRead);

module.exports = router;