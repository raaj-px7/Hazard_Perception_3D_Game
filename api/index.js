const mongoose = require('mongoose');

// Cache the mongoose connection across warm serverless invocations
// to avoid exhausting MongoDB Atlas connection limits.
let cachedConnection = null;

async function connectDb() {
  if (cachedConnection && mongoose.connection.readyState === 1) {
    return cachedConnection;
  }
  cachedConnection = await mongoose.connect(process.env.MONGODB_URI, {
    bufferCommands: false,
  });
  return cachedConnection;
}

// Import the Express app (server.js now exports it without calling .listen())
const app = require('../server/server');

module.exports = async (req, res) => {
  await connectDb();
  return app(req, res);
};
