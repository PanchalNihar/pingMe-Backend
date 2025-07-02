const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/user");

async function registerNewuser(req, res) {
  const { name, email, password } = req.body;
  try {
    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(400).json({ message: "Email already exists" });
    }
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await User.create({
      name,
      email,
      password: hashedPassword,
    });
    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
      expiresIn: "7d",
    });
    res.status(201).json({
      user: { id: user._id, name: user.name, email: user.email },
      token,
    });
  } catch (err) {
    return res
      .status(500)
      .json({ message: "Error registering user", error: err });
  }
}

async function loginUser(req, res) {
  const { email, password } = req.body;
  try {
    const user = await User.findOne({ email });
    if (!user) {
      console.log("❌ User not found");
      return res.status(400).json({ message: "Invalid email or password" });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      console.log("❌ Password does not match");
      return res.status(400).json({ message: "Invalid email or password" });
    }

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
      expiresIn: "7d",
    });

    console.log("✅ Login successful");
    res.status(200).json({
      user: { id: user._id, name: user.name, email: user.email },
      token,
    });
  } catch (err) {
    console.error("🔥 Error logging in:", err.message);
    res.status(500).json({ message: "Error logging in user", error: err });
  }
}

async function getAllUsers(req, res) {
  try {
    const currentUserId = req.query.exclude;
    const users = await User.find({ _id: { $ne: currentUserId } }).select(
      "name _id"
    );
    res.json(users);
  } catch (err) {
    return res
      .status(500)
      .json({ message: "Error fetching users", error: err });
  }
}

async function getProfile(req, res) {
  const userId = req.query.id;
  try {
    const user = await User.findById(userId).select("-password");
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    res.json({
      _id: user._id,
      name: user.name,
      email: user.email,
      avatar: user.avatar,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt
    });
  } catch (err) {
    return res
      .status(500)
      .json({ message: "Error fetching user profile", error: err });
  }
}

// In authController.js - updateProfile function
async function updateProfile(req, res) {
  // Make sure user exists and matches authenticated user
  if (!req.user || !req.user.id) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  
  const { name, email } = req.body;
  const id = req.user.id; // Use the ID from the token, not from the body
  let avatar = req.body.avatar;
  
  if (req.file) {
    avatar = `http://localhost:5000/uploads/${req.file.filename}`;
  }
  
  try {
    const updateUser = await User.findByIdAndUpdate(
      id,
      {
        name: name || undefined,
        email: email || undefined,
        avatar: avatar || undefined,
      },
      { new: true }
    ).select("name email avatar");
    
    if (!updateUser) {
      return res.status(404).json({ message: "User not found" });
    }
    
    res.json(updateUser);
  } catch (err) {
    return res
      .status(500)
      .json({ message: "Error updating user profile", error: err.message });
  }
}

module.exports = {
  registerNewuser,
  loginUser,
  getAllUsers,
  getProfile,
  updateProfile,
};
