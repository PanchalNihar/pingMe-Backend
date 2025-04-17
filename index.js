const express = require("express");
const http = require("http");
const socketIO = require("socket.io");
const cors = require("cors");
const path=require("path")
const connectDB = require("./config/db");
const authRoutes = require("./routes/authRoutes");
const chatRoutes = require("./routes/chatRoutes");
require("dotenv").config();

const app = express();
const server = http.createServer(app);
const io = socketIO(server, {
  cors: {
    origin: "*",
  },
});

connectDB();
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

//routes
app.use("/api/auth", authRoutes);
app.use("/chat", chatRoutes);
//socket setup
require("./socket/socketHandler")(io);

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
