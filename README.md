# 🗨️ PingMe Backend

This is the backend for **PingMe**, a real-time chat application built with **Node.js**, **Express**, **MongoDB**, and **Socket.IO**.

It handles user authentication, profile management, and real-time chat features. The project is Docker-ready for easy development and deployment.

---

## 🚀 Features

- ✅ User Registration & Login with JWT
- 👤 User Profile Update with Avatar Upload
- 💬 Real-time Chat using Socket.IO
- 🔐 Authentication Middleware
- 📦 RESTful APIs
- 🐳 Docker & Docker Compose Support

---

## 📁 Folder Structure
pingMe-Backend/
├── config/ # DB connection logic
├── controllers/ # Auth & chat logic
├── middleware/ # Auth & upload middleware
├── models/ # Mongoose schemas
├── routes/ # API route definitions
├── socket/ # Socket.IO setup
├── uploads/ # Uploaded profile images
├── .env # Local environment variables
├── .env.docker # Docker environment variables
├── Dockerfile
├── docker-compose.yml
├── index.js



---

## ⚙️ Environment Variables

Create a `.env` or `.env.docker` file:

# Install dependencies
npm install

# Start the server
npm run dev

# 🐳 Run with Docker Compose

docker-compose up --build


# 🛠 Tech Stack
Node.js + Express,
MongoDB with Mongoose,
JWT for auth,
Socket.IO for real-time chat,
Multer for file uploads,
Docker, Docker Compose


# 👨‍💻 Author
Nihar — Engineering student, backend + cloud enthusiast
Building real-world systems with DevOps & AI in mind 🌐☁️


