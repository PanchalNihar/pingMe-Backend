const { default: mongoose } = require("mongoose");
const Message = require("../models/message");
const cryptoJS = require("crypto-js");

exports.sendMessage = async (req, res) => {
  const { sender, receiver, content } = req.body;
  try {
    const newMessage = new Message({
      sender,
      receiver,
      content: "",
      isRead: false,
      timestamp: new Date(),
    });
    const secretkey = process.env.MESSAGE_ENCRYPTION_KEY;
    if (!secretkey) {
      return res.status(500).json({ msg: "Encryption key not found" });
    }
    const encryptedContent = newMessage.encryptedContent(content, secretkey);
    newMessage.content = content;
    await newMessage.save();
    res.status(201).json({
      id: newMessage._id,
      sender: newMessage.sender,
      receiver: newMessage.receiver,
      timestamp: newMessage.timestamp,
      isRead: newMessage.isRead,
    });
  } catch (err) {
    res.status(500).json({ msg: "error sending message" });
  }
};
exports.getChatMessages = async (req, res) => {
  const { user1, user2 } = req.query;
  try {
    const messages = await Message.find({
      $or: [
        { sender: user1, receiver: user2 },
        { sender: user2, receiver: user1 },
      ],
    }).sort({ timestamp: 1 });
    const secretKey = process.env.MESSAGE_ENCRYPTION_KEY;
    if (!secretKey) {
      return res.status(500).json({ msg: "Encryption key not configured" });
    }
    const decryptedMessage = messages.map((message) => {
      const plainMessage = message.toObject();
      try {
        plainMessage.content = message.decryptContent(
          message.content,
          secretKey
        );
      } catch (decryptError) {
        plainMessage.content = "[Encrypted message - unable to decrypt]";
      }
    });
    res.json(decryptedMessage)
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

exports.getUnreadCounts = async (req, res) => {
  const { userId } = req.query;
  try {
    const unread = await Message.aggregate([
      {
        $match: {
          receiver: new mongoose.Types.ObjectId(userId),
          isRead: false,
        },
      },
      {
        $group: {
          _id: "$sender",
          count: { $sum: 1 },
        },
      },
    ]);
    res.json(unread);
  } catch (err) {
    res.status(500).json({ msg: "Error fetching unread counts" });
  }
};
