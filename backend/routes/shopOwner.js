const express = require('express');
const { verifyToken } = require('../middleware/auth');
const { requireShopOwner } = require('../middleware/shopOwner');
const controller = require('../controllers/shopOwnerController');

const router = express.Router();
const asyncHandler = (handler) => (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);

router.use(verifyToken, requireShopOwner);

router.get('/health', (req, res) => res.json({ message: 'Shop Owner authorization verified.' }));
router.get('/profile', asyncHandler(controller.getProfile));
router.patch('/profile', asyncHandler(controller.updateProfile));

router.get('/business', asyncHandler(controller.getBusiness));
router.post('/business', asyncHandler(controller.createBusiness));
router.patch('/business/:id', asyncHandler(controller.updateBusiness));
router.delete('/business/:id', asyncHandler(controller.deleteBusiness));

router.get('/jobs', asyncHandler(controller.getOwnerJobs));
router.get('/jobs/:id', asyncHandler(controller.getOwnerJob));
router.post('/jobs', asyncHandler(controller.createJob));
router.patch('/jobs/:id', asyncHandler(controller.updateJob));
router.delete('/jobs/:id', asyncHandler(controller.deleteJob));
router.patch('/jobs/:id/close', asyncHandler(controller.closeJob));

router.get('/applications', asyncHandler(controller.getApplications));
router.get('/applications/:id', asyncHandler(controller.getApplication));
router.get('/applications/:id/cv', asyncHandler(controller.getApplicationCv));
router.patch('/applications/:id/status', asyncHandler(controller.updateApplicationStatus));

router.get('/membership', asyncHandler(controller.getMembership));
router.post('/membership/payment/order', asyncHandler(controller.createMembershipPaymentOrder));
router.post('/membership/payment/verify', asyncHandler(controller.verifyMembershipPayment));
router.post('/membership', asyncHandler(controller.createMembership));
router.patch('/membership/:id', asyncHandler(controller.updateMembership));

router.get('/qr', asyncHandler(controller.getQrProfile));
router.get('/dashboard', asyncHandler(controller.getDashboard));
router.get('/notifications', asyncHandler(controller.getNotifications));
router.patch('/notifications/:id/read', asyncHandler(controller.markNotificationRead));
router.patch('/notifications/read-all', asyncHandler(controller.markAllNotificationsRead));

module.exports = router;
