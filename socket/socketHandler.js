const mongoose = require("mongoose");
const Message = require("../models/message");
const User = require("../models/user");
const CryptoJS = require("crypto-js");
const jwt = require("jsonwebtoken");
const admin = require("firebase-admin");

// Initialize Firebase Admin if not already initialized
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(require("../config/firebase-service-account.json")),
  });
}

const onlineUsers = new Map();

// Helper functions for encryption/decryption
function encryptContent(content, secretKey) {
  return CryptoJS.AES.encrypt(content, secretKey).toString();
}

function decryptContent(encryptedContent, secretKey) {
  try {
    const bytes = CryptoJS.AES.decrypt(encryptedContent, secretKey);
    return bytes.toString(CryptoJS.enc.Utf8);
  } catch (error) {
    console.error("Decryption error:", error);
    return "[Encrypted message]";
  }
}

// Authentication helper for socket connections
async function authenticateSocket(token) {
  if (!token) {
    throw new Error("No token provided");
  }

  // First try JWT authentication
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id);
    if (!user) {
      throw new Error("User not found");
    }
    return { id: user._id.toString(), user };
  } catch (jwtError) {
    // If JWT fails, try Firebase authentication
    try {
      const decodedToken = await admin.auth().verifyIdToken(token);
      const user = await User.findOne({ firebaseUid: decodedToken.uid });
      if (!user) {
        throw new Error("User not found");
      }
      return { id: user._id.toString(), user };
    } catch (firebaseError) {
      throw new Error("Invalid token");
    }
  }
}

module.exports = (io) => {
  // Socket authentication middleware
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.split(" ")[1];
      
      if (!token) {
        return next(new Error("Authentication error: No token provided"));
      }

      const authResult = await authenticateSocket(token);
      socket.userId = authResult.id;
      socket.user = authResult.user;
      next();
    } catch (error) {
      console.error("Socket authentication error:", error.message);
      next(new Error("Authentication error"));
    }
  });

  io.on("connection", (socket) => {
    console.log(`🟢 New Client connected: ${socket.user.name} (${socket.userId})`);
    
    // Automatically register the authenticated user
    onlineUsers.set(socket.userId, socket.id);
    io.emit("online-users", Array.from(onlineUsers.keys()));
    
    socket.on("register-users", (userId) => {
      // Verify that the userId matches the authenticated user
      if (userId !== socket.userId) {
        console.warn(`⚠️ User ${socket.userId} tried to register as ${userId}`);
        return;
      }
      onlineUsers.set(userId, socket.id);
      io.emit("online-users", Array.from(onlineUsers.keys()));
    });
    
    socket.on("join-room", (roomId) => {
      socket.join(roomId);
      console.log(`✅ ${socket.user.name} joined Room: ${roomId}`);
    });

    socket.on("chat-message", async (data) => {
      console.log("Received message data:", data);
      const { sender, receiver, content, imageBase64, imageType } = data;

      // Verify that the sender matches the authenticated user
      if (sender !== socket.userId) {
        console.warn(`⚠️ User ${socket.userId} tried to send message as ${sender}`);
        return;
      }

      // Validate required fields
      if (!sender || !receiver) {
        console.warn("⚠️ Missing sender or receiver");
        return;
      }

      // Validate that we have either content or image
      if ((!content || content.trim() === "") && !imageBase64) {
        console.warn("⚠️ Message must contain text or image");
        return;
      }

      try {
        // Verify that both sender and receiver exist
        const [senderUser, receiverUser] = await Promise.all([
          User.findById(sender),
          User.findById(receiver)
        ]);

        if (!senderUser || !receiverUser) {
          console.warn("⚠️ Invalid sender or receiver");
          return;
        }

        // Create base message document
        const messageData = {
          sender: new mongoose.Types.ObjectId(sender),
          receiver: new mongoose.Types.ObjectId(receiver),
          isRead: false,
          timestamp: new Date(),
        };

        // Get encryption key from environment variables
        const secretKey = process.env.MESSAGE_ENCRYPTION_KEY;
        
        // Add and encrypt content if provided
        if (content && content.trim() !== "") {
          if (secretKey) {
            messageData.content = encryptContent(content.trim(), secretKey);
          } else {
            messageData.content = content.trim();
          }
        }

        // Only add image if imageBase64 exists and is not empty
        if (imageBase64) {
          messageData.image = {
            data: Buffer.from(imageBase64, "base64"),
            contentType: imageType || "image/jpeg",
          };
        } else {
          messageData.image = undefined;
        }

        console.log("Creating message with data:", {
          sender: messageData.sender,
          receiver: messageData.receiver,
          hasContent: !!messageData.content,
          hasImage: !!messageData.image,
        });

        const message = await Message.create(messageData);

        // Prepare message for sending
        let messageToSend = message.toObject();

        // If we have encrypted content, decrypt it before sending
        if (secretKey && messageToSend.content) {
          messageToSend.content = decryptContent(messageToSend.content, secretKey);
        }

        // Only convert image if it actually exists
        if (message.image && message.image.data) {
          messageToSend.image = {
            data: Buffer.from(message.image.data).toString("base64"),
            contentType: message.image.contentType,
          };
        } else {
          messageToSend.image = undefined;
        }

        const roomId = [sender, receiver].sort().join("-");
        io.to(roomId).emit("chat-message", messageToSend);
      } catch (error) {
        console.error("💥 Error saving message:", error.message);
        console.error("Message data:", {
          sender,
          receiver,
          hasContent: !!content,
          hasImage: !!imageBase64,
          error: error.stack,
        });
      }
    });

    socket.on("typing", ({ roomId, sender }) => {
      // Verify that the sender matches the authenticated user
      if (sender !== socket.userId) {
        console.warn(`⚠️ User ${socket.userId} tried to send typing indicator as ${sender}`);
        return;
      }
      socket.to(roomId).emit("typing", sender);
    });
    
    socket.on("stop-typing", ({ roomId }) => {
      socket.to(roomId).emit("stop-typing");
    });
    
    socket.on("delete-message", async ({ messageId, roomId }) => {
      try {
        // Verify that the user owns the message
        const message = await Message.findById(messageId);
        if (!message || message.sender.toString() !== socket.userId) {
          console.warn(`⚠️ User ${socket.userId} tried to delete message they don't own`);
          return;
        }

        const deleted = await Message.findByIdAndDelete(messageId);
        if (deleted) {
          io.to(roomId).emit("message-deleted", { messageId });
        }
      } catch (err) {
        console.error("Error deleting message:", { messageId, error: err.message });
      }
    });
    
    socket.on("edit-message", async ({ messageId, newContent, roomId }) => {
      try {
        // Verify that the user owns the message
        const message = await Message.findById(messageId);
        if (!message || message.sender.toString() !== socket.userId) {
          console.warn(`⚠️ User ${socket.userId} tried to edit message they don't own`);
          return;
        }

        const secretKey = process.env.MESSAGE_ENCRYPTION_KEY;
        let contentToSave = newContent;
        
        // Encrypt the content if we have a secret key
        if (secretKey) {
          contentToSave = encryptContent(newContent, secretKey);
        }
        
        const updateMessage = await Message.findByIdAndUpdate(
          messageId,
          {
            content: contentToSave,
          },
          {
            new: true,
          }
        );
        
        if (updateMessage) {
          const updated = updateMessage.toObject();
          
          // Decrypt the content before sending
          if (secretKey && updated.content) {
            updated.content = decryptContent(updated.content, secretKey);
          }
          
          if (updated.image && updated.image.data) {
            updated.image = {
              data: Buffer.from(updateMessage.image.data).toString("base64"),
              contentType: updated.image.contentType,
            };
          } else {
            updated.image = undefined;
          }
          
          io.to(roomId).emit("message-edited", updated);
        }
      } catch (err) {
        console.error("Error editing message:", { messageId, newContent, error: err.message });
      }
    });
    
    socket.on("disconnect", () => {
      // Find and remove the disconnected user
      let disconnectedUserId = socket.userId;
      
      if (disconnectedUserId) {
        // Set a timeout to remove the user from online users after a delay
        setTimeout(() => {
          const currentSocketId = onlineUsers.get(disconnectedUserId);
          if (currentSocketId === socket.id) {
            onlineUsers.delete(disconnectedUserId);
            io.emit("online-users", Array.from(onlineUsers.keys()));
            console.log(`🔴 User ${socket.user.name} (${disconnectedUserId}) removed from online users after timeout`);
          }
        }, 5000); // 5 second delay
      }
      
      console.log(`🔴 Client disconnected: ${socket.user.name} (${socket.userId})`);
    });
  });
};