const mongoose = require('mongoose');
const User = require('../models/User');
const Business = require('../models/Business');
const Job = require('../models/Job');
const JobApplication = require('../models/JobApplication');
const ChamberMembership = require('../models/ChamberMembership');
const MembershipPayment = require('../models/MembershipPayment');
const Razorpay = require('razorpay');
const crypto = require('crypto');
const Notification = require('../models/Notification');
const QrCode = require('../models/QrCode');

const APPLICATION_STATUSES = ['submitted', 'eligible', 'not_eligible', 'shortlisted', 'rejected'];
const BUSINESS_STATUSES = ['pending', 'approved', 'rejected', 'suspended'];
const JOB_STATUSES = ['pending', 'published', 'rejected', 'closed'];
const MEMBERSHIP_STATUSES = ['pending', 'active', 'rejected', 'expired', 'suspended'];

const invalidId = (id) => !mongoose.isValidObjectId(id);
const getById = async (Model, id, message = 'Resource not found.') => {
  if (invalidId(id)) { const error = new Error('Invalid resource ID.'); error.statusCode = 400; throw error; }
  const record = await Model.findById(id);
  if (!record) { const error = new Error(message); error.statusCode = 404; throw error; }
  return record;
};
const assertOwner = (record, userId) => {
  if (!record.owner || record.owner.toString() !== userId.toString()) { const error = new Error('You do not own this resource.'); error.statusCode = 403; throw error; }
};
const safeUser = (user) => ({ _id: user._id, name: user.name, email: user.email, phone: user.phone, role: user.role, status: user.status, createdAt: user.createdAt, updatedAt: user.updatedAt });
const notify = async (data) => Notification.create(data).catch((error) => { if (error.code !== 11000) throw error; });
const listParams = (query) => ({ page: Math.max(Number.parseInt(query.page, 10) || 1, 1), limit: Math.min(Math.max(Number.parseInt(query.limit, 10) || 20, 1), 100) });

const getProfile = async (req, res) => res.json({ user: safeUser(req.currentUser) });
const updateProfile = async (req, res) => {
  const allowed = ['name', 'email', 'phone'];
  Object.keys(req.body).forEach((key) => { if (allowed.includes(key)) req.currentUser[key] = req.body[key]; });
  await req.currentUser.save();
  res.json({ user: safeUser(req.currentUser) });
};

const getBusiness = async (req, res) => {
  const business = await Business.findOne({ owner: req.currentUser._id });
  res.json({ business: business || null });
};
const createBusiness = async (req, res) => {
  const existing = await Business.findOne({ owner: req.currentUser._id });
  if (existing) return res.status(409).json({ message: 'You already have a business profile.' });
  const { businessName, name, category, description, phone, email, address, location, logo, images, website, socialLinks } = req.body;
  const resolvedName = businessName || name;
  if (!resolvedName || !category || !description || !phone || !address) return res.status(400).json({ message: 'Business name, category, description, phone, and address are required.' });
  const business = await Business.create({ name: resolvedName, businessName: resolvedName, category, description, phone, email, address, location, logo, images, website, socialLinks, owner: req.currentUser._id, ownerName: req.currentUser.name, status: 'pending' });
  await notify({ type: 'business_submitted', message: `New business submitted by ${req.currentUser.name}.`, recipient: null, entityType: 'Business', entityId: business._id });
  res.status(201).json({ business });
};
const updateBusiness = async (req, res) => {
  const business = await getById(Business, req.params.id, 'Business not found.');
  assertOwner(business, req.currentUser._id);
  const allowed = ['businessName', 'name', 'category', 'description', 'phone', 'email', 'address', 'location', 'logo', 'images', 'website', 'socialLinks'];
  Object.keys(req.body).forEach((key) => { if (allowed.includes(key)) business[key] = req.body[key]; });
  if (req.body.businessName) business.name = req.body.businessName;
  if (req.body.name) business.businessName = req.body.name;
  business.status = 'pending';
  await business.save();
  res.json({ business });
};
const deleteBusiness = async (req, res) => { const business = await getById(Business, req.params.id); assertOwner(business, req.currentUser._id); await Business.deleteOne({ _id: business._id }); res.json({ message: 'Business deleted.' }); };

const jobInput = (body) => ({
  title: body.title, description: body.description, category: body.category, location: body.location,
  employmentType: body.employmentType, salary: body.salary, quantity: body.quantity, requirements: body.requirements,
  skills: body.skills, experience: body.experience, education: body.education, applicationMethod: body.applicationMethod,
  applicationLink: body.applicationLink, closingDate: body.closingDate,
});
const validateJob = (body) => {
  if (!body.title || !body.description || !body.location || !body.employmentType) { const error = new Error('Title, description, location, and employment type are required.'); error.statusCode = 400; throw error; }
  if (body.quantity !== undefined && (!Number.isInteger(Number(body.quantity)) || Number(body.quantity) < 1)) { const error = new Error('Quantity must be a positive integer.'); error.statusCode = 400; throw error; }
  if (body.closingDate && Number.isNaN(new Date(body.closingDate).valueOf())) { const error = new Error('Invalid closing date.'); error.statusCode = 400; throw error; }
  if (body.applicationMethod === 'external' && !body.applicationLink) { const error = new Error('Application link is required for external applications.'); error.statusCode = 400; throw error; }
};
const getOwnerJobs = async (req, res) => {
  const { page, limit } = listParams(req.query); const filter = { owner: req.currentUser._id }; if (req.query.status && JOB_STATUSES.includes(req.query.status)) filter.status = req.query.status;
  const [data, total] = await Promise.all([Job.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit), Job.countDocuments(filter)]);
  res.json({ data, pagination: { page, limit, total, totalPages: total ? Math.ceil(total / limit) : 0 } });
};
const getOwnerJob = async (req, res) => { const job = await getById(Job, req.params.id, 'Job not found.'); assertOwner(job, req.currentUser._id); res.json({ job }); };
const createJob = async (req, res) => {
  validateJob(req.body); const business = await Business.findOne({ owner: req.currentUser._id });
  const job = await Job.create({
    ...jobInput(req.body),
    business: business?._id,
    company: business?.name || req.currentUser.name,
    owner: req.currentUser._id,
    status: 'pending',
  });
  const admins = await User.find({ role: 'admin', status: 'active' }).select('_id');
  await Promise.all(admins.map((admin) => notify({
    type: 'job_submitted',
    message: `${job.company} has submitted a new job: ${job.title}. Please review and approve the job.`,
    recipient: admin._id,
    entityType: 'Job',
    entityId: job._id,
  })));
  res.status(201).json({ job });
};
const updateJob = async (req, res) => {
  const job = await getById(Job, req.params.id, 'Job not found.'); assertOwner(job, req.currentUser._id);
  if (job.status === 'closed') return res.status(400).json({ message: 'Closed jobs cannot be edited.' });
  validateJob({ ...job.toObject(), ...req.body }); Object.assign(job, jobInput(req.body)); job.status = 'pending'; await job.save(); res.json({ job });
};
const deleteJob = async (req, res) => { const job = await getById(Job, req.params.id); assertOwner(job, req.currentUser._id); await Job.deleteOne({ _id: job._id }); res.json({ message: 'Job deleted.' }); };
const closeJob = async (req, res) => { const job = await getById(Job, req.params.id); assertOwner(job, req.currentUser._id); if (job.status !== 'published') return res.status(400).json({ message: 'Only published jobs can be closed.' }); job.status = 'closed'; await job.save(); res.json({ job }); };

const getApplications = async (req, res) => {
  const { page, limit } = listParams(req.query);
  const jobs = await Job.find({ owner: req.currentUser._id }).select('_id'); const jobIds = jobs.map((job) => job._id);
  const filter = { job: { $in: jobIds } }; if (req.query.status && APPLICATION_STATUSES.includes(req.query.status)) filter.status = req.query.status;
  const [data, total] = await Promise.all([JobApplication.find(filter).populate('jobSeeker', 'name email phone').populate('job', 'title company').sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit), JobApplication.countDocuments(filter)]);
  res.json({ data, pagination: { page, limit, total, totalPages: total ? Math.ceil(total / limit) : 0 } });
};
const getApplication = async (req, res) => {
  const application = await getById(JobApplication, req.params.id, 'Application not found.'); const job = await getById(Job, application.job); assertOwner(job, req.currentUser._id);
  await application.populate([{ path: 'jobSeeker', select: 'name email phone location bio education experience skills' }, { path: 'job', select: 'title company requirements' }]); res.json({ application });
};
const getApplicationCv = async (req, res) => {
  const application = await getById(JobApplication, req.params.id, 'Application not found.');
  const job = await getById(Job, application.job, 'Job not found.');
  assertOwner(job, req.currentUser._id);
  const candidate = await User.findById(application.jobSeeker).select('cv');
  if (!candidate?.cv?.file) return res.status(404).json({ message: 'CV not found.' });
  res.json({ cv: candidate.cv });
};
const updateApplicationStatus = async (req, res) => {
  if (!APPLICATION_STATUSES.includes(req.body.status)) return res.status(400).json({ message: 'Invalid application status.' });
  const application = await getById(JobApplication, req.params.id); 
  const job = await getById(Job, application.job); 
  assertOwner(job, req.currentUser._id); 
  
  const previousStatus = application.status;
  application.status = req.body.status; 
  await application.save();
  
  // Enhanced notification messages for different status changes
  const statusMessages = {
    eligible: `Great news! Your application for "${job.title}" has been marked as eligible. The employer is interested in your profile.`,
    shortlisted: `🎉 Congratulations! You have been shortlisted for the "${job.title}" position at ${job.business?.name || job.company}. You're one step closer!`,
    rejected: `Unfortunately, your application for "${job.title}" was not selected this time. Keep applying - the right opportunity is waiting for you!`,
    not_eligible: `Your application for "${job.title}" doesn't meet the current requirements. Don't get discouraged - keep improving your profile!`,
    submitted: `Your application for "${job.title}" has been successfully submitted and is under review.`
  };
  
  const message = statusMessages[req.body.status] || `Your application status for "${job.title}" has been updated to ${req.body.status}.`;
  
  // Send notification to job seeker
  await notify({ 
    type: `application_status_${req.body.status}`, 
    message, 
    recipient: application.jobSeeker, 
    entityType: 'JobApplication', 
    entityId: application._id 
  });
  
  res.json({ application });
};

const membershipAmount = (plan) => {
  const match = String(plan || '').match(/₹?\s*([\d,]+)/);
  return match ? Number(match[1].replace(/,/g, '')) : 0;
};
const createMembershipPaymentOrder = async (req, res) => {
  const amount = membershipAmount(req.body.plan);
  if (!amount) return res.status(400).json({ message: 'Select a valid membership plan.' });
  // If Razorpay is not configured, return a mock order so the flow can continue
  if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
    const mockOrderId = `mock_order_${req.currentUser._id}_${Date.now()}`;
    await MembershipPayment.create({ user: req.currentUser._id, orderId: mockOrderId, plan: req.body.plan, amount, status: 'verified' });
    return res.status(201).json({ order: { id: mockOrderId, amount: amount * 100, currency: 'INR' }, keyId: null, mock: true });
  }
  const razorpay = new Razorpay({ key_id: process.env.RAZORPAY_KEY_ID, key_secret: process.env.RAZORPAY_KEY_SECRET });
  const order = await razorpay.orders.create({ amount: amount * 100, currency: 'INR', receipt: `membership_${req.currentUser._id}_${Date.now()}` });
  await MembershipPayment.create({ user: req.currentUser._id, orderId: order.id, plan: req.body.plan, amount, status: 'created' });
  res.status(201).json({ order: { id: order.id, amount: order.amount, currency: order.currency }, keyId: process.env.RAZORPAY_KEY_ID });
};
const verifyMembershipPayment = async (req, res) => {
  const { razorpay_order_id: orderId, razorpay_payment_id: paymentId, razorpay_signature: signature } = req.body;
  if (!orderId || !paymentId || !signature) return res.status(400).json({ message: 'Incomplete payment verification details.' });
  const payment = await MembershipPayment.findOne({ user: req.currentUser._id, orderId });
  if (!payment) return res.status(404).json({ message: 'Payment order not found.' });
  // Mock orders are already verified
  if (payment.status === 'verified') return res.json({ payment: { orderId, paymentId, amount: payment.amount, plan: payment.plan } });
  const expected = crypto.createHmac('sha256', process.env.RAZORPAY_KEY_SECRET).update(`${orderId}|${paymentId}`).digest('hex');
  if (expected !== signature) return res.status(400).json({ message: 'Payment verification failed.' });
  payment.paymentId = paymentId;
  payment.status = 'verified';
  await payment.save();
  res.json({ payment: { orderId, paymentId, amount: payment.amount, plan: payment.plan } });
};
const getMembership = async (req, res) => res.json({ membership: await ChamberMembership.findOne({ user: req.currentUser._id }).populate('business') });
const createMembership = async (req, res) => {
  const existing = await ChamberMembership.findOne({ user: req.currentUser._id }); if (existing) return res.status(409).json({ message: 'A Chamber Membership application already exists.' });
  const business = await Business.findOne({ owner: req.currentUser._id }); if (!business) return res.status(400).json({ message: 'Create a business profile before applying.' });
  const payment = await MembershipPayment.findOne({ user: req.currentUser._id, orderId: req.body.paymentOrderId, status: 'verified', plan: req.body.plan });
  if (!payment) return res.status(400).json({ message: 'Complete and verify payment before submitting your application.' });
  const membership = await ChamberMembership.create({
    user: req.currentUser._id, business: business._id, businessName: business.name, ownerName: req.currentUser.name,
    email: business.email || req.currentUser.email, phone: business.phone || req.currentUser.phone, category: business.category,
    address: business.address, description: business.description, logo: business.logo, website: business.website, plan: req.body.plan, paymentId: payment.paymentId, paymentAmount: payment.amount, paymentStatus: 'verified', status: 'pending',
    publicProfile: { businessName: business.name, ownerName: req.currentUser.name, category: business.category, phone: business.phone || req.currentUser.phone, email: business.email || req.currentUser.email, address: business.address, description: business.description }
  });
  await notify({ type: 'membership_submitted_admin', message: `New Chamber Membership application from ${req.currentUser.name}.`, recipient: null, entityType: 'ChamberMembership', entityId: membership._id });
  await notify({ type: 'membership_submitted_member', message: 'Your Chamber Membership application has been submitted.', recipient: req.currentUser._id, entityType: 'ChamberMembership', entityId: membership._id });
  res.status(201).json({ membership });
};
const updateMembership = async (req, res) => { const membership = await getById(ChamberMembership, req.params.id); if (membership.user.toString() !== req.currentUser._id.toString()) return res.status(403).json({ message: 'You do not own this membership.' }); if (membership.status !== 'pending') return res.status(400).json({ message: 'Only pending memberships can be edited.' }); if (req.body.plan) membership.plan = req.body.plan; await membership.save(); res.json({ membership }); };

const getQrProfile = async (req, res) => {
  const membership = await ChamberMembership.findOne({ user: req.currentUser._id, status: 'active', qrStatus: 'active' });
  if (!membership) return res.json({ qr: null });
  const qr = await QrCode.findOne({ membership: membership._id, status: 'active' });
  if (!qr) return res.json({ qr: null });
  const QRCode = require('qrcode');
  const { buildPublicUrl } = require('../services/chamberMembership');
  const publicId = qr.publicId || qr.code;
  const publicUrl = qr.qrValue || buildPublicUrl(publicId);
  const imageDataUrl = await QRCode.toDataURL(publicUrl, { width: 300, margin: 1, errorCorrectionLevel: 'M' });
  res.json({ qr: { publicId, publicUrl, imageDataUrl, status: qr.status, membershipNumber: membership.membershipNumber } });
};
const getDashboard = async (req, res) => {
  const [businesses, totalJobs, pendingJobs, publishedJobs, closedJobs, jobIds, notifications] = await Promise.all([
    Business.countDocuments({ owner: req.currentUser._id }), Job.countDocuments({ owner: req.currentUser._id }), Job.countDocuments({ owner: req.currentUser._id, status: 'pending' }), Job.countDocuments({ owner: req.currentUser._id, status: 'published' }), Job.countDocuments({ owner: req.currentUser._id, status: 'closed' }), Job.find({ owner: req.currentUser._id }).select('_id'), Notification.countDocuments({ recipient: req.currentUser._id, readAt: null }),
  ]);
  const applications = await JobApplication.countDocuments({ job: { $in: jobIds.map((job) => job._id) } }); const shortlisted = await JobApplication.countDocuments({ job: { $in: jobIds.map((job) => job._id) }, status: 'shortlisted' });
  res.json({ businesses, jobs: { total: totalJobs, pending: pendingJobs, published: publishedJobs, closed: closedJobs }, applications, shortlisted, notifications });
};
const getNotifications = async (req, res) => { const { page, limit } = listParams(req.query); const filter = { recipient: req.currentUser._id }; const [data, total] = await Promise.all([Notification.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit), Notification.countDocuments(filter)]); res.json({ data, pagination: { page, limit, total, totalPages: total ? Math.ceil(total / limit) : 0 } }); };
const markNotificationRead = async (req, res) => { const notification = await getById(Notification, req.params.id); if (notification.recipient.toString() !== req.currentUser._id.toString()) return res.status(403).json({ message: 'You do not own this notification.' }); notification.readAt = new Date(); await notification.save(); res.json({ notification }); };
const markAllNotificationsRead = async (req, res) => { const result = await Notification.updateMany({ recipient: req.currentUser._id, readAt: null }, { readAt: new Date() }); res.json({ modifiedCount: result.modifiedCount }); };

module.exports = { getProfile, updateProfile, getBusiness, createBusiness, updateBusiness, deleteBusiness, getOwnerJobs, getOwnerJob, createJob, updateJob, deleteJob, closeJob, getApplications, getApplication, getApplicationCv, updateApplicationStatus, getMembership, createMembership, updateMembership, createMembershipPaymentOrder, verifyMembershipPayment, getQrProfile, getDashboard, getNotifications, markNotificationRead, markAllNotificationsRead };
