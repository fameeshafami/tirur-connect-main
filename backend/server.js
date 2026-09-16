require('dotenv').config();

const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const connectDB = require('./config/db');
const authRoutes = require('./routes/auth');
const adminRoutes = require('./routes/admin');
const businessRoutes = require('./routes/businesses');
const shopOwnerRoutes = require('./routes/shopOwner');
const jobSeekerRoutes = require('./routes/jobSeeker');
const jobRoutes = require('./routes/jobs');
const publicRoutes = require('./routes/public');
const chamberMemberRoutes = require('./routes/chamberMember');
const newsRoutes = require('./routes/news');
const offerRoutes = require('./routes/offers');
const resumeRoutes = require('./routes/resumes');

const app = express();
const PORT = process.env.PORT || 5000;

// app.use(
//   cors({
//     origin: ['http://localhost:3000', 'http://127.0.0.1:3000', 'http://localhost:3001', 'http://127.0.0.1:3001', 'http://localhost:3002', 'http://127.0.0.1:3002', 'http://localhost:5173', 'http://127.0.0.1:5173', 'http://localhost:8000', 'http://127.0.0.1:8000'],
//     credentials: true,
//   })
// );
// app.use(
//   cors({
//     origin: ['https://tirur-connect-main.onrender.com','https://tirur-connect-main.onrender.com','https://indigo-lion-193760.hostingersite.com'],
//     credentials: true,
//   })
// );
app.use(cors());

app.use(express.json({ limit: '12mb' }));

app.use((req, res, next) => {
  const mongoConfigured = !!process.env.MONGODB_URI && process.env.MONGODB_URI !== 'your_mongodb_connection_string';
  if (req.path.startsWith('/api') && !mongoConfigured && mongoose.connection.readyState !== 1) {
    return res.status(503).json({ message: 'Database is not configured. Add a valid MongoDB connection string to backend/.env to enable this API.' });
  }
  next();
});

app.get('/', (req, res) => {
  res.json({ message: 'Tirur Connect API is running' });
});

app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/businesses', businessRoutes);
app.use('/api/shop-owner', shopOwnerRoutes);
app.use('/api/job-seeker', jobSeekerRoutes);
app.use('/api/jobs', jobRoutes);
app.use('/api/public', publicRoutes);
app.use('/api/chamber', publicRoutes);
app.use('/api/chamber-member', chamberMemberRoutes);
app.use('/api/news', newsRoutes);
app.use('/api/offers', offerRoutes);
app.use('/api/resumes', resumeRoutes);

app.use((err, req, res, next) => {
  if (err.name === 'CastError' || err.name === 'ValidationError' || err.statusCode === 400) {
    return res.status(400).json({ message: err.statusCode === 400 ? err.message : 'Invalid request.' });
  }
  if (err.code === 11000) {
    return res.status(409).json({ message: 'A record with the same unique value already exists.' });
  }
  console.error(err.message);
  return res.status(err.statusCode || 500).json({ message: err.statusCode === 404 ? err.message : 'Something went wrong on the server.' });
});

connectDB()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  })
  .catch((error) => {
    console.error('Failed to start server:', error.message);
    process.exit(1);
  });
