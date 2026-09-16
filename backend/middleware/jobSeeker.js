const User = require('../models/User');

const requireJobSeeker = async (req, res, next) => {
  try {
    if (!req.user || req.user.role !== 'job_seeker') {
      return res.status(403).json({ message: 'Job Seeker access required.' });
    }

    const user = await User.findById(req.user.userId).select('name email phone role status createdAt updatedAt');
    if (!user || user.role !== 'job_seeker' || user.status === 'suspended' || user.status === 'rejected') {
      return res.status(403).json({ message: 'Your Job Seeker account does not have access.' });
    }

    req.currentUser = user;
    next();
  } catch (error) {
    next(error);
  }
};

module.exports = { requireJobSeeker };
