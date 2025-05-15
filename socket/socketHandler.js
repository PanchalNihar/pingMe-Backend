const mongoose = require("mongoose");
const Message = require("../models/message");
const CryptoJS = require("crypto-js");

const onlineUsers = new Map();

// Helper functions for encryption/decryption instead of using model methods
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

module.exports = (io) => {
  io.on("connection", (socket) => {
    console.log("🟢 New Client connected");
    
    socket.on("register-users", (userId) => {
      onlineUsers.set(userId, socket.id);
      io.emit("online-users", Array.from(onlineUsers.keys()));
    });
    
    socket.on("join-room", (roomId) => {
      socket.join(roomId);
      console.log(`✅ Joined Room: ${roomId}`);
    });

    socket.on("chat-message", async (data) => {
      console.log("Received message data:", data);
      const { sender, receiver, content, imageBase64, imageType } = data;

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
            // Use the standalone encryption function
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
          // Explicitly set image to undefined to avoid any issues
          messageData.image = undefined;
        }

        console.log("Creating message with data:", {
          sender: messageData.sender,
          receiver: messageData.receiver,
          hasContent: !!messageData.content,
          hasImage: !!messageData.image,
        });

        const message = await Message.create(messageData);

        // Prepare message for sending - carefully handle the image conversion
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
          // Make sure image is undefined/null in the response if not present
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
      socket.to(roomId).emit("typing", sender);
    });
    
    socket.on("stop-typing", ({ roomId }) => {
      socket.to(roomId).emit("stop-typing");
    });
    
    socket.on("delete-message", async ({ messageId, roomId }) => {
      try {
        const deleted = await Message.findByIdAndDelete(messageId);
        if (deleted) {
          io.to(roomId).emit("message-deleted", { messageId });
        }
      } catch (err) {
        console.error("Error deleting message:", { messageId });
      }
    });
    
    socket.on("edit-message", async ({ messageId, newContent, roomId }) => {
      try {
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
          
          if (updated) {
            io.to(roomId).emit("message-edited", updated);
          }
        }
      } catch (err) {
        console.error("Error editing message:", { messageId, newContent, error: err });
      }
    });
    
    socket.on("disconnect", () => {
      // Don't delete the user from onlineUsers immediately
      // Just update their status or set a timer
      
      // Find the userId associated with this socket
      let disconnectedUserId = null;
      for (const [userId, socketId] of onlineUsers.entries()) {
        if (socketId === socket.id) {
          disconnectedUserId = userId;
          // We don't delete immediately
          // onlineUsers.delete(userId);
          break;
        }
      }
      
      if (disconnectedUserId) {
        // Set a timeout to remove the user from online users after a delay
        // This gives them time to refresh without appearing offline
        setTimeout(() => {
          // Check if the user has reconnected with a different socket
          const currentSocketId = onlineUsers.get(disconnectedUserId);
          if (currentSocketId === socket.id) {
            // If no new connection was made, remove them
            onlineUsers.delete(disconnectedUserId);
            io.emit("online-users", Array.from(onlineUsers.keys()));
            console.log(`🔴 User ${disconnectedUserId} removed from online users after timeout`);
          }
        }, 5000); // 5 second delay - adjust as needed
      }
      
      console.log("🔴 Client disconnected but waiting before removing from online users");
    });
  });
};