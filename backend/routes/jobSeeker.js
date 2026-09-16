const express = require('express');
const { verifyToken } = require('../middleware/auth');
const { requireJobSeeker } = require('../middleware/jobSeeker');
const controller = require('../controllers/jobSeekerController');

const router = express.Router();
const asyncHandler = (handler) => (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);

router.use(verifyToken, requireJobSeeker);

router.get('/health', (req, res) => res.json({ message: 'Job Seeker authorization verified.' }));
router.get('/profile', asyncHandler(controller.getProfile));
router.patch('/profile', asyncHandler(controller.updateProfile));

router.get('/cv', asyncHandler(controller.getCv));
router.post('/cv', asyncHandler(controller.createCv));
router.patch('/cv', asyncHandler(controller.updateCv));
router.delete('/cv', asyncHandler(controller.deleteCv));

router.get('/applications', asyncHandler(controller.getApplications));
router.get('/applications/:id', asyncHandler(controller.getApplication));
router.get('/applications/:id/cv', asyncHandler(controller.getApplicationCv));
router.post('/applications', asyncHandler(controller.createApplication));

router.get('/saved-jobs', asyncHandler(controller.getSavedJobs));
router.post('/saved-jobs/:jobId', asyncHandler(controller.saveJob));
router.delete('/saved-jobs/:jobId', asyncHandler(controller.unsaveJob));

router.get('/notifications', asyncHandler(controller.getNotifications));
router.patch('/notifications/:id/read', asyncHandler(controller.markNotificationRead));
router.patch('/notifications/read-all', asyncHandler(controller.markAllNotificationsRead));

router.get('/dashboard', asyncHandler(controller.getDashboard));

module.exports = router;
