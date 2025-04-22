const mongoose = require("mongoose");

const messageSchema = new mongoose.Schema({
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
  },
  receiver: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
  },
  content: {
    type: String,
    required: function() {
      // Content is required only if there's no image
      return !this.image || !this.image.data;
    }
  },
  image: {
    data: Buffer,
    contentType: String,
  },
  isRead: {
    type: Boolean,
    default: false,
  },
  timestamp: {
    type: Date,
    default: Date.now,
  },
});

const Message = mongoose.model("Message", messageSchema);

module.exports = Message;
