const User = require('../models/User');

const requireChamberMember = async (req, res, next) => {
  try {
    if (!req.user || req.user.role !== 'chamber_member') return res.status(403).json({ message: 'Chamber Member access required.' });
    const user = await User.findById(req.user.userId).select('name email phone role status createdAt updatedAt');
    if (!user || user.role !== 'chamber_member' || user.status !== 'active') return res.status(403).json({ message: 'Your Chamber Member account is not active.' });
    req.currentUser = user;
    next();
  } catch (error) {
    next(error);
  }
};

module.exports = { requireChamberMember };
