const mongoose = require("mongoose");
const Message = require("../models/message");

module.exports = (io) => {
  io.on("connection", (socket) => {
    console.log("🟢 New Client connected");

    socket.on("join-room", (roomId) => {
      socket.join(roomId);
      console.log(`✅ Joined Room: ${roomId}`);
    });

    socket.on("chat-message", async (data) => {
      const { sender, receiver, content } = data;

      if (!sender || !receiver || !content) {
        console.warn("⚠️ Missing sender, receiver, or content");
        return;
      }

      try {
        const message = await Message.create({
          sender: new mongoose.Types.ObjectId(sender),
          receiver: new mongoose.Types.ObjectId(receiver),
          content,
        });

        console.log("💬 Message saved:", message);

        const roomId = [sender, receiver].sort().join("-");
        io.to(roomId).emit("chat-message", message);
      } catch (error) {
        console.error("💥 Error saving message:", error.message);
      }
    });

    socket.on("disconnect", () => {
      console.log("🔴 Client disconnected");
    });
  });
};
