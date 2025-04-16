const express = require("express");
const {
  getChatMessages,
  markMessagesAsRead,
  getUnreadCounts,
} = require("../controllers/chatController");
const router = express.Router();

router.get("/messages", getChatMessages);
router.post("/mark-read", markMessagesAsRead);
router.get("/unread-counts", getUnreadCounts);

module.exports = router;
