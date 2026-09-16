const express = require('express');
const controller = require('../controllers/publicController');

const router = express.Router();
const asyncHandler = (handler) => (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);

router.get('/member/:code', asyncHandler(controller.getMemberVerification));
router.get('/public/:publicId', asyncHandler(controller.getMemberVerification));
router.get('/news', asyncHandler(controller.publicNews));
router.get('/news/:slug', asyncHandler(controller.publicNewsItem));
router.get('/updates', asyncHandler(controller.publicUpdates));
router.get('/offers', asyncHandler(controller.publicOffers));
router.get('/offers/:id', asyncHandler(controller.publicOffer));
router.get('/ads', asyncHandler(controller.publicAds));

module.exports = router;
