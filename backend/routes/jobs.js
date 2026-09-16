const express = require('express');
const { verifyToken } = require('../middleware/auth');
const jobController = require('../controllers/jobController');
const shopOwnerController = require('../controllers/shopOwnerController');
const User = require('../models/User');

const router = express.Router();
const asyncHandler = (handler) => (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);

// Middleware to allow any authenticated active user
const requireGeneralAuth = async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: 'Authentication required.' });
    }
    
    const user = await User.findById(req.user.userId)
      .select('name email phone role status');
      
    if (!user || user.status === 'suspended' || user.status === 'rejected') {
      return res.status(403).json({ 
        message: 'Your account does not have access.' 
      });
    }
    
    req.currentUser = user;
    next();
  } catch (error) {
    next(error);
  }
};

// Public job routes (no auth required)
router.get('/', asyncHandler(jobController.getPublishedJobs));
router.get('/:id', asyncHandler(jobController.getPublishedJob));

// Authenticated job posting - use the same createJob function from shopOwnerController
router.post('/', verifyToken, requireGeneralAuth, asyncHandler(shopOwnerController.createJob));

module.exports = router;
