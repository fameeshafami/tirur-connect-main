require('dotenv').config();

const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const User = require('../models/User');

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 12;

const requiredEnvironmentValues = ['ADMIN_NAME', 'ADMIN_EMAIL', 'ADMIN_PHONE', 'ADMIN_PASSWORD'];

const validateEnvironment = () => {
  const missingValues = requiredEnvironmentValues.filter((key) => !process.env[key]?.trim());

  if (missingValues.length > 0) {
    throw new Error(`Missing required environment variable(s): ${missingValues.join(', ')}`);
  }

  if (!EMAIL_PATTERN.test(process.env.ADMIN_EMAIL.trim())) {
    throw new Error('ADMIN_EMAIL is not a valid email address.');
  }

  if (process.env.ADMIN_PASSWORD.length < MIN_PASSWORD_LENGTH) {
    throw new Error(`ADMIN_PASSWORD must be at least ${MIN_PASSWORD_LENGTH} characters long.`);
  }

  if (!process.env.MONGODB_URI || process.env.MONGODB_URI === 'your_mongodb_connection_string') {
    throw new Error('MONGODB_URI is not configured with a real MongoDB connection string.');
  }
}

const createAdmin = async () => {
  validateEnvironment();

  await mongoose.connect(process.env.MONGODB_URI);

  const existingAdmin = await User.findOne({ role: 'admin' }).select('_id status');
  if (existingAdmin) {
    console.log('An admin account already exists. No new admin account was created.');
    return;
  }

  const passwordHash = await bcrypt.hash(process.env.ADMIN_PASSWORD, 12);

  await User.create({
    name: process.env.ADMIN_NAME.trim(),
    email: process.env.ADMIN_EMAIL.trim().toLowerCase(),
    phone: process.env.ADMIN_PHONE.trim(),
    passwordHash,
    role: 'admin',
    status: 'active',
  });

  console.log('First administrator account created successfully.');
};

createAdmin()
  .catch((error) => {
    console.error(`Admin creation failed: ${error.message}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.connection.close();
    }
  });
