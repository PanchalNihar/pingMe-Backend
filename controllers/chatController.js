// Fix for chatController.js to handle message retrieval properly

const { default: mongoose } = require("mongoose");
const Message = require("../models/message");
const CryptoJS = require("crypto-js");

// Helper function for decryption
function decryptContent(encryptedContent, secretKey) {
  try {
    const bytes = CryptoJS.AES.decrypt(encryptedContent, secretKey);
    return bytes.toString(CryptoJS.enc.Utf8);
  } catch (error) {
    console.error("Decryption error:", error);
    return "[Encrypted message]";
  }
}

exports.getChatMessages = async (req, res) => {
  const { user1, user2 } = req.query;
  
  // Add validation for user IDs
  if (!user1 || !user2) {
    return res.status(400).json({ msg: "Both user IDs are required" });
  }
  
  try {
    console.log(`Fetching messages between users ${user1} and ${user2}`);
    
    // Convert string IDs to ObjectIDs if they're not already
    const sender = mongoose.Types.ObjectId.isValid(user1) ? 
      new mongoose.Types.ObjectId(user1) : user1;
    const receiver = mongoose.Types.ObjectId.isValid(user2) ? 
      new mongoose.Types.ObjectId(user2) : user2;
    
    const messages = await Message.find({
      $or: [
        { sender: sender, receiver: receiver },
        { sender: receiver, receiver: sender },
      ],
    }).sort({ timestamp: 1 });
    
    console.log(`Found ${messages.length} messages`);
    
    // Get the encryption key
    const secretKey = process.env.MESSAGE_ENCRYPTION_KEY;
    
    // Process messages before sending
    const processedMessages = messages.map(message => {
      // Convert to plain object to avoid mongoose document issues
      const plainMessage = message.toObject();
      
      // Decrypt content if necessary
      if (secretKey && plainMessage.content) {
        try {
          plainMessage.content = decryptContent(plainMessage.content, secretKey);
        } catch (err) {
          console.error("Failed to decrypt message:", err);
          plainMessage.content = "[Encrypted message]";
        }
      }
      
      // Convert image buffer to base64 if it exists
      if (plainMessage.image && plainMessage.image.data) {
        plainMessage.image = {
          data: Buffer.from(plainMessage.image.data).toString('base64'),
          contentType: plainMessage.image.contentType
        };
      }
      
      return plainMessage;
    });
    
    res.json(processedMessages);
  } catch (err) {
    console.error("Error fetching messages:", err);
    res.status(500).json({ msg: "Error fetching messages", error: err.message });
  }
};

exports.markMessagesAsRead = async (req, res) => {
  const { sender, receiver } = req.body;
  
  if (!sender || !receiver) {
    return res.status(400).json({ msg: "Both sender and receiver IDs are required" });
  }
  
  try {
    const result = await Message.updateMany(
      {
        sender,
        receiver,
        isRead: false,
      },
      {
        $set: { isRead: true },
      }
    );
    
    console.log(`Marked ${result.modifiedCount} messages as read`);
    res.json({ 
      msg: "Messages marked as read", 
      count: result.modifiedCount 
    });
  } catch (err) {
    console.error("Error marking messages as read:", err);
    res.status(500).json({ msg: "Error marking messages as read", error: err.message });
  }
};

exports.getUnreadCounts = async (req, res) => {
  const { userId } = req.query;
  
  if (!userId) {
    return res.status(400).json({ msg: "User ID is required" });
  }
  
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
    console.error("Error fetching unread counts:", err);
    res.status(500).json({ msg: "Error fetching unread counts", error: err.message });
  }
};