const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
    },
    password: {
      type: String,
      required: function(){
        return !this.isGoogleUser
      },
    },
    avatar: {
      type: String,
    },
    firebaseUid:{
      type:String,
      unique:true,
      sparse:true
    },
    isGoogleUser:{
      type:Boolean,
      default:false
    }
  },
  {
    timestamps: true,
  }
);

const User = mongoose.model("User", userSchema);

module.exports = User;
