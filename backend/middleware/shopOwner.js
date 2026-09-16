const User = require('../models/User');

const ALLOWED_ROLES = ['shop_owner', 'chamber_member'];

const requireShopOwner = async (req, res, next) => {
  try {
    if (!req.user || !ALLOWED_ROLES.includes(req.user.role)) {
      return res.status(403).json({ message: 'Shop Owner access required.' });
    }
    const user = await User.findById(req.user.userId).select('name email phone role status');
    if (!user || !ALLOWED_ROLES.includes(user.role) || user.status === 'suspended' || user.status === 'rejected') {
      return res.status(403).json({ message: 'Your account does not have access.' });
    }
    req.currentUser = user;
    next();
  } catch (error) {
    next(error);
  }
};

module.exports = { requireShopOwner };
