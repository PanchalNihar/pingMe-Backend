const mongoose = require("mongoose");

const connectDB = async () => {
  const mongoURI = process.env.MONGO_URI;
  let retries = 5;

  while (retries) {
    try {
      const conn = await mongoose.connect(mongoURI, {
        useNewUrlParser: true,
        useUnifiedTopology: true,
      });
      console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
      break;
    } catch (err) {
      console.error(`❌ MongoDB connection failed: ${err.message}`);
      retries -= 1;
      console.log(`⏳ Retrying... (${5 - retries}/5)`);
      await new Promise(res => setTimeout(res, 5000));
    }
  }

  if (!retries) {
    console.error("💥 Could not connect to MongoDB after multiple attempts.");
    process.exit(1);
  }
};

module.exports = connectDB;
