const mongoose = require("mongoose");
const Message = require("../models/message");
const onlineUsers = new Map();
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

        // Add content if provided
        if (content && content.trim() !== "") {
          messageData.content = content.trim();
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
    socket.on("disconnect", () => {
      for (const [userId, socketId] of onlineUsers.entries()) {
        if (socketId === socket.id) {
          onlineUsers.delete(userId);
          break;
        }
      }
      io.emit("Online-users", Array.from(onlineUsers.keys()));
      console.log("🔴 Client disconnected");
    });
  });
};