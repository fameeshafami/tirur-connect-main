const mongoose = require('mongoose');

const connectDB = async () => {
  const mongoUri = process.env.MONGODB_URI;

  if (!mongoUri || mongoUri === 'your_mongodb_connection_string') {
    console.warn('MONGODB_URI is not configured. Add a valid MongoDB connection string to backend/.env');
    return;
  }

  try {
    await mongoose.connect(mongoUri);
    console.log('MongoDB connected');
  } catch (error) {
    console.error('MongoDB connection error:', error.message);
    process.exit(1);
  }
};

module.exports = connectDB;
