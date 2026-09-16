const express = require('express');
const { verifyToken } = require('../middleware/auth');
const { requireAdmin } = require('../middleware/admin');
const controller = require('../controllers/adminController');

const router = express.Router();
const asyncHandler = (handler) => (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);

router.use(verifyToken, requireAdmin);

router.get('/health', (req, res) => res.json({ message: 'Admin authorization verified.' }));
router.get('/dashboard', asyncHandler(controller.getDashboard));

router.get('/users', asyncHandler(controller.getUsers));
router.get('/users/:id', asyncHandler(controller.getUser));
router.patch('/users/:id/status', asyncHandler(controller.updateUserStatus));
router.patch('/users/:id/role', asyncHandler(controller.updateUserRole));
router.delete('/users/:id', asyncHandler(controller.deleteUser));

router.get('/businesses', asyncHandler(controller.getBusinesses));
router.get('/businesses/:id', asyncHandler(controller.getBusiness));
router.patch('/businesses/:id/status', asyncHandler(controller.updateBusinessStatus));
router.delete('/businesses/:id', asyncHandler(controller.deleteBusiness));

router.get('/chamber-members', asyncHandler(controller.getChamberMembers));
router.get('/chamber-members/:id', asyncHandler(controller.getChamberMember));
router.patch('/chamber-members/:id/status', asyncHandler(controller.updateChamberMemberStatus));
router.patch('/chamber-members/:id/approve', asyncHandler(controller.approveChamberMember));
router.patch('/chamber-members/:id/reject', asyncHandler(controller.rejectChamberMember));
router.delete('/chamber-members/:id', asyncHandler(controller.deleteChamberMember));

router.get('/all-members-qr', asyncHandler(controller.getAllMembersQr));
router.get('/qr-codes', asyncHandler(controller.getQrCodes));
router.get('/qr-codes/:id', asyncHandler(controller.getQrCode));
router.patch('/qr-codes/:id/status', asyncHandler(controller.updateQrCodeStatus));

router.get('/jobs', asyncHandler(controller.getJobs));
router.get('/jobs/:id', asyncHandler(controller.getJob));
router.patch('/jobs/:id/status', asyncHandler(controller.updateJobStatus));
router.delete('/jobs/:id', asyncHandler(controller.deleteJob));

router.get('/applications', asyncHandler(controller.getApplications));
router.get('/applications/:id', asyncHandler(controller.getApplication));
router.get('/applications/:id/candidate', asyncHandler(controller.getApplicationCandidate));
router.get('/applications/:id/cv', asyncHandler(controller.getApplicationCv));
router.patch('/applications/:id/status', asyncHandler(controller.updateApplicationStatus));

router.get('/news', asyncHandler(controller.getNews));
router.get('/news/:id', asyncHandler(controller.getNewsItem));
router.post('/news', asyncHandler(controller.createNews));
router.patch('/news/:id', asyncHandler(controller.updateNews));
router.patch('/news/:id/status', asyncHandler(controller.updateNewsStatus));
router.delete('/news/:id', asyncHandler(controller.deleteNews));

router.get('/offers', asyncHandler(controller.getOffers));
router.get('/offers/:id', asyncHandler(controller.getOffer));
router.post('/offers', asyncHandler(controller.createOffer));
router.patch('/offers/:id', asyncHandler(controller.updateOffer));
router.patch('/offers/:id/status', asyncHandler(controller.updateOfferStatus));
router.delete('/offers/:id', asyncHandler(controller.deleteOffer));

router.get('/ads', asyncHandler(controller.getAds));
router.post('/ads', asyncHandler(controller.createAd));
router.patch('/ads/:id', asyncHandler(controller.updateAd));
router.patch('/ads/:id/status', asyncHandler(controller.updateAdStatus));
router.delete('/ads/:id', asyncHandler(controller.deleteAd));

router.get('/notifications', asyncHandler(controller.getNotifications));
router.patch('/notifications/:id/read', asyncHandler(controller.markNotificationRead));
router.patch('/notifications/read-all', asyncHandler(controller.markAllNotificationsRead));

module.exports = router;
