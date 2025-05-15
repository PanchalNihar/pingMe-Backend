const mongoose = require("mongoose");
const CryptoJS = require("crypto-js");

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
    required: function () {
      // Content is required only if there's no image
      return !this.image || !this.image.data;
    },
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

// Correctly define methods on the schema
messageSchema.methods.encryptContent = function (content, secretKey) {
  return CryptoJS.AES.encrypt(content, secretKey).toString();
};

messageSchema.methods.decryptContent = function (encryptedContent, secretKey) {
  const bytes = CryptoJS.AES.decrypt(encryptedContent, secretKey);
  return bytes.toString(CryptoJS.enc.Utf8);
};

const Message = mongoose.model("Message", messageSchema);
module.exports = Message;