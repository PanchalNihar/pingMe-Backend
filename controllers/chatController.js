const Message = require("../models/message");

exports.getChatMessages = async (req, res) => {
  const { user1, user2 } = req.query;
  try {
    const messages = await Message.find({
      $or: [
        { sender: user1, receiver: user2 },
        { sender: user2, receiver: user1 },
      ],
    }).sort({ timestamp: 1 });
    res.json(messages);
  } catch (err) {
    res.status(500).json({ msg: "Error fetching messages" });
  }
};

exports.markMessagesAsRead = async (req, res) => {
  const { sender, receiver } = req.body;
  try {
    await Message.updateMany(
      {
        sender,
        receiver,
        isRead: false,
      },
      {
        $set: { isRead: true },
      }
    );
    res.json({ msg: "Messages marked as read" });
  } catch (err) {
    res.status(500).json({ msg: "Error marking messages as read" });
  }
};
