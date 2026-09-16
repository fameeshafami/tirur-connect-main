const express = require('express');
const { verifyToken } = require('../middleware/auth');
const User = require('../models/User');
const controller = require('../controllers/resumeController');

const router = express.Router();
const allowedRoles = new Set(['admin', 'shop_owner', 'chamber_member']);
router.use(verifyToken, async (req, res, next) => {
  const user = await User.findById(req.user.userId).select('role status');
  if (!user || !allowedRoles.has(user.role) || user.status !== 'active') {
    return res.status(403).json({ message: 'Resume access is restricted to active Admins, Shop Owners, and Chamber Members.' });
  }
  next();
});
router.get('/', controller.listResumes);
router.get('/:id/cv', controller.getResume);

module.exports = router;