const QrCode = require('../models/QrCode');
const News = require('../models/News');
const Offer = require('../models/Offer');
const Ad = require('../models/Ad');
const Business = require('../models/Business');
const Job = require('../models/Job');
const ChamberMembership = require('../models/ChamberMembership');
const { expireElapsedMemberships, membershipExpiry } = require('../services/chamberMembership');

// A QR scan must never reveal account credentials, payment data, or dashboard data.
const getMemberVerification = async (req, res) => {
  const publicId = String(req.params.publicId || req.params.code || '').trim();
  if (!publicId) return res.status(400).json({ message: 'A verification code is required.' });

  await expireElapsedMemberships();
  const qr = await QrCode.findOne({ $or: [{ publicId }, { code: publicId }] }).populate('membership');
  const membership = qr?.membership;
  if (!membership) return res.status(404).json({ message: 'No Chamber membership was found for this QR code.' });

  const publicProfile = membership.publicProfile || {};
  return res.json({
    member: {
      verificationId: (qr.publicId || qr.code).toUpperCase(),
      businessName: publicProfile.businessName || membership.businessName,
      ownerName: publicProfile.ownerName || membership.ownerName,
      category: publicProfile.category || membership.category,
      phone: publicProfile.phone || membership.phone,
      email: publicProfile.email || membership.email,
      address: publicProfile.address || '',
      description: publicProfile.description || '',
      logo: membership.logo || '',
      website: membership.website || '',
      plan: membership.plan || '',
      membershipNumber: membership.membershipNumber || '',
      status: membership.status,
      membershipExpiryDate: membershipExpiry(membership) || null,
      qrStatus: qr.status,
      verified: membership.status === 'active' && qr.status === 'active',
    },
  });
};

const pagination = (query) => {
  const page = Math.max(Number.parseInt(query.page, 10) || 1, 1);
  const limit = Math.min(Math.max(Number.parseInt(query.limit, 10) || 20, 1), 100);
  return { page, limit, skip: (page - 1) * limit };
};
const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const publicNews = async (req, res) => {
  const { page, limit, skip } = pagination(req.query);
  const filter = { status: 'published' };
  if (req.query.search) {
    const expression = new RegExp(escapeRegex(req.query.search.trim()), 'i');
    filter.$or = [{ title: expression }, { description: expression }, { content: expression }, { category: expression }];
  }
  if (req.query.category) filter.category = req.query.category;
  const [data, total] = await Promise.all([
    News.find(filter).populate('author', 'name').sort({ publishedAt: -1, createdAt: -1 }).skip(skip).limit(limit),
    News.countDocuments(filter),
  ]);
  res.json({ data, pagination: { page, limit, total, totalPages: total ? Math.ceil(total / limit) : 0 } });
};
const publicNewsItem = async (req, res) => {
  const news = await News.findOne({ slug: req.params.slug, status: 'published' }).populate('author', 'name');
  if (!news) return res.status(404).json({ message: 'News not found.' });
  res.json({ news });
};
const publicUpdates = async (req, res) => {
  const [businessCount, activeMembers, latestBusiness, latestJob, latestAd] = await Promise.all([
    Business.countDocuments({ status: 'approved' }),
    ChamberMembership.countDocuments({ status: 'active' }),
    Business.findOne({ status: 'approved' }).sort({ createdAt: -1 }).select('name createdAt'),
    Job.findOne({ status: 'published' }).sort({ createdAt: -1 }).select('title company createdAt'),
    Ad.findOne({ status: 'published', enabled: true }).sort({ createdAt: -1 }).select('title createdAt'),
  ]);
  const updates = [
    businessCount ? { icon: '🏬', title: `${businessCount} shops joined the directory`, createdAt: latestBusiness?.createdAt } : null,
    latestJob ? { icon: '💼', title: `${latestJob.company || 'A local business'} is hiring — ${latestJob.title}`, createdAt: latestJob.createdAt } : null,
    activeMembers ? { icon: '🏅', title: `Tirur Chamber has ${activeMembers} active members`, createdAt: new Date() } : null,
    latestAd ? { icon: '📢', title: `${latestAd.title} is featured on the homepage`, createdAt: latestAd.createdAt } : null,
  ].filter(Boolean).sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
  res.json({ data: updates.slice(0, 4) });
};
const publicOffers = async (req, res) => {
  const { page, limit, skip } = pagination(req.query);
  const now = new Date();
  await Offer.updateMany({ status: 'published', endDate: { $lt: now } }, { $set: { status: 'expired' } });
  const filter = { status: 'published', startDate: { $lte: now }, endDate: { $gte: now } };
  if (req.query.search) filter.title = new RegExp(escapeRegex(req.query.search.trim()), 'i');
  if (req.query.category) filter.category = req.query.category;
  const [data, total] = await Promise.all([
    Offer.find(filter).populate('business', 'name businessName').sort({ createdAt: -1 }).skip(skip).limit(limit),
    Offer.countDocuments(filter),
  ]);
  res.json({ data, pagination: { page, limit, total, totalPages: total ? Math.ceil(total / limit) : 0 } });
};
const publicOffer = async (req, res) => {
  const now = new Date();
  const offer = await Offer.findOne({ _id: req.params.id, status: 'published', startDate: { $lte: now }, endDate: { $gte: now } }).populate('business', 'name businessName');
  if (!offer) return res.status(404).json({ message: 'Offer not found.' });
  res.json({ offer });
};

const publicAds = async (req, res) => {
  const now = new Date();
  const filter = { status: 'published', enabled: true, startAt: { $lte: now }, endAt: { $gte: now } };
  if (req.query.placement) filter.placement = req.query.placement;
  const data = await Ad.find(filter).sort({ order: 1, createdAt: -1 });
  res.json({ data });
};

module.exports = { getMemberVerification, publicNews, publicNewsItem, publicUpdates, publicOffers, publicOffer, publicAds };
