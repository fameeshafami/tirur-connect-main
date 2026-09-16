const express = require('express');
const { verifyToken } = require('../middleware/auth');
const { requireRole } = require('../middleware/roles');
const controller = require('../controllers/businessController');

const router = express.Router();
const asyncHandler = (handler) => (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);

router.get('/', asyncHandler(controller.getApprovedBusinesses));
router.get('/:id', asyncHandler(controller.getApprovedBusiness));
router.post('/', verifyToken, requireRole('shop_owner'), asyncHandler(controller.createBusiness));
router.get('/:id/owner', verifyToken, requireRole('shop_owner'), asyncHandler(controller.getOwnerBusiness));
router.patch('/:id', verifyToken, requireRole('shop_owner'), asyncHandler(controller.updateOwnerBusiness));
router.delete('/:id', verifyToken, requireRole('shop_owner'), asyncHandler(controller.deleteOwnerBusiness));

module.exports = router;
