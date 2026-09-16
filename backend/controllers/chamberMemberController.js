const QRCode = require('qrcode');
const ChamberMembership = require('../models/ChamberMembership');
const Business = require('../models/Business');
const Notification = require('../models/Notification');
const QrCode = require('../models/QrCode');
const { buildPublicUrl, ensureMembershipQr, expireElapsedMemberships, membershipExpiry } = require('../services/chamberMembership');

const safeUser = (user) => ({ _id: user._id, name: user.name, email: user.email, phone: user.phone, role: user.role, status: user.status });
const safeMembership = (membership) => ({
  _id: membership._id,
  businessName: membership.businessName,
  ownerName: membership.ownerName,
  phone: membership.phone,
  email: membership.email,
  category: membership.category,
  address: membership.address,
  description: membership.description,
  logo: membership.logo,
  website: membership.website,
  plan: membership.plan,
  membershipNumber: membership.membershipNumber,
  membershipStartDate: membership.membershipStartDate,
  membershipExpiryDate: membershipExpiry(membership),
  status: membership.status,
  qrStatus: membership.qrStatus,
  createdAt: membership.createdAt,
  updatedAt: membership.updatedAt,
});
const getMembershipForUser = async (userId) => {
  await expireElapsedMemberships();
  return ChamberMembership.findOne({ user: userId }).populate('business');
};

const getProfile = async (req, res) => res.json({ user: safeUser(req.currentUser) });
const updateProfile = async (req, res) => {
  const allowed = ['name', 'email', 'phone'];
  Object.keys(req.body).forEach((key) => { if (allowed.includes(key) && req.body[key]) req.currentUser[key] = String(req.body[key]).trim(); });
  await req.currentUser.save();
  const membership = await ChamberMembership.findOne({ user: req.currentUser._id });
  if (membership) {
    membership.ownerName = req.currentUser.name;
    membership.email = req.currentUser.email;
    membership.phone = req.currentUser.phone;
    membership.publicProfile.ownerName = req.currentUser.name;
    membership.publicProfile.email = req.currentUser.email;
    membership.publicProfile.phone = req.currentUser.phone;
    await membership.save();
  }
  res.json({ user: safeUser(req.currentUser) });
};

const getMembership = async (req, res) => {
  const membership = await getMembershipForUser(req.currentUser._id);
  res.json({ membership: membership ? safeMembership(membership) : null });
};

const createMembership = async (req, res) => {
  const existing = await ChamberMembership.findOne({ user: req.currentUser._id });
  if (existing) return res.status(409).json({ message: 'A Chamber Membership application already exists.' });
  const business = await Business.findOne({ owner: req.currentUser._id });
  if (!business) return res.status(400).json({ message: 'Create a business profile before applying.' });
  const membership = await ChamberMembership.create({
    user: req.currentUser._id, business: business._id, businessName: business.name, ownerName: req.currentUser.name,
    phone: business.phone || req.currentUser.phone, email: business.email || req.currentUser.email, category: business.category,
    address: business.address, description: business.description, logo: business.logo, website: business.website,
    plan: req.body.plan ? String(req.body.plan).trim() : undefined, status: 'pending',
    publicProfile: { businessName: business.name, ownerName: req.currentUser.name, category: business.category, phone: business.phone || req.currentUser.phone, email: business.email || req.currentUser.email, address: business.address, description: business.description },
  });
  await Notification.create({ type: 'membership_submitted_member', message: 'Your Chamber Membership application has been submitted.', recipient: req.currentUser._id, entityType: 'ChamberMembership', entityId: membership._id });
  await Notification.create({ type: 'membership_submitted_admin', message: `New Chamber Membership application from ${req.currentUser.name}.`, entityType: 'ChamberMembership', entityId: membership._id });
  res.status(201).json({ membership: safeMembership(membership) });
};

const updateMembership = async (req, res) => {
  const membership = await ChamberMembership.findOne({ user: req.currentUser._id });
  if (!membership) return res.status(404).json({ message: 'Membership not found.' });
  if (!['pending', 'active'].includes(membership.status)) return res.status(400).json({ message: 'This membership cannot be updated in its current status.' });
  const allowed = ['businessName', 'ownerName', 'phone', 'email', 'category', 'address', 'description', 'logo', 'website', 'plan'];
  allowed.forEach((key) => { if (req.body[key] !== undefined) membership[key] = String(req.body[key]).trim(); });
  Object.assign(membership.publicProfile, Object.fromEntries(allowed.filter((key) => req.body[key] !== undefined && key !== 'plan').map((key) => [key, membership[key]])));
  await membership.save();
  const business = await Business.findById(membership.business);
  if (business) {
    ['category', 'address', 'description', 'logo', 'website', 'phone', 'email'].forEach((key) => { if (req.body[key] !== undefined) business[key] = membership[key]; });
    if (req.body.businessName !== undefined) { business.name = membership.businessName; business.businessName = membership.businessName; }
    if (req.body.ownerName !== undefined) business.ownerName = membership.ownerName;
    await business.save();
  }
  res.json({ membership: safeMembership(membership) });
};

const getQr = async (req, res) => {
  const membership = await getMembershipForUser(req.currentUser._id);
  if (!membership || membership.status !== 'active') return res.json({ qr: null });
  const qr = await QrCode.findOne({ membership: membership._id, status: 'active' });
  if (!qr) return res.json({ qr: null });
  const publicId = qr.publicId || qr.code;
  const publicUrl = qr.qrValue || buildPublicUrl(publicId);
  const imageDataUrl = await QRCode.toDataURL(publicUrl, { width: 300, margin: 1, errorCorrectionLevel: 'M' });
  res.json({ qr: { publicId, publicUrl, imageDataUrl, status: qr.status, membershipNumber: membership.membershipNumber } });
};

const createQr = async (req, res) => {
  const membership = await getMembershipForUser(req.currentUser._id);
  if (!membership) return res.status(404).json({ message: 'Membership not found.' });
  if (membership.status !== 'active') return res.status(400).json({ message: 'Only active memberships have a QR code.' });
  const qr = await ensureMembershipQr(membership);
  await membership.save();
  const publicId = qr.publicId || qr.code;
  const publicUrl = qr.qrValue || buildPublicUrl(publicId);
  const imageDataUrl = await QRCode.toDataURL(publicUrl, { width: 300, margin: 1, errorCorrectionLevel: 'M' });
  res.status(201).json({ qr: { publicId, publicUrl, imageDataUrl, status: qr.status, membershipNumber: membership.membershipNumber } });
};

// All active chamber members (public-safe fields) — visible to logged-in chamber members
const getAllActiveMembers = async (req, res) => {
  await expireElapsedMemberships();
  const memberships = await ChamberMembership.find({ status: 'active' })
    .select('businessName ownerName category phone email address description logo website membershipNumber membershipExpiryDate qrCode qrStatus plan membershipStartDate')
    .sort({ businessName: 1 })
    .lean();
  const data = memberships.map((m) => ({
    _id: m._id,
    businessName: m.businessName,
    ownerName: m.ownerName,
    category: m.category,
    phone: m.phone,
    email: m.email,
    address: m.address,
    description: m.description,
    logo: m.logo,
    website: m.website,
    membershipNumber: m.membershipNumber,
    membershipExpiryDate: m.membershipExpiryDate,
    qrCode: m.qrCode,       // publicId — for building the profile link
    qrStatus: m.qrStatus,
    plan: m.plan,
  }));
  res.json({ members: data });
};

const getNotifications = async (req, res) => {
  const data = await Notification.find({ recipient: req.currentUser._id }).sort({ createdAt: -1 }).limit(100);
  res.json({ data });
};
const markNotificationRead = async (req, res) => {
  const notification = await Notification.findOne({ _id: req.params.id, recipient: req.currentUser._id });
  if (!notification) return res.status(404).json({ message: 'Notification not found.' });
  notification.readAt = new Date(); await notification.save(); res.json({ notification });
};
const markAllNotificationsRead = async (req, res) => {
  const result = await Notification.updateMany({ recipient: req.currentUser._id, readAt: null }, { $set: { readAt: new Date() } });
  res.json({ modifiedCount: result.modifiedCount });
};

module.exports = { getProfile, updateProfile, getMembership, createMembership, updateMembership, getQr, createQr, getAllActiveMembers, getNotifications, markNotificationRead, markAllNotificationsRead };
