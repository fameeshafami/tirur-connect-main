const crypto = require('crypto');
const mongoose = require('mongoose');
const User = require('../models/User');
const Business = require('../models/Business');
const ChamberMembership = require('../models/ChamberMembership');
const Job = require('../models/Job');
const JobApplication = require('../models/JobApplication');
const News = require('../models/News');
const Offer = require('../models/Offer');
const Ad = require('../models/Ad');
const Notification = require('../models/Notification');
const QrCode = require('../models/QrCode');
const { issueMembershipNumber, ensureMembershipQr: provisionMembershipQr, expireElapsedMemberships } = require('../services/chamberMembership');

const USER_ROLES = ['admin', 'shop_owner', 'job_seeker', 'chamber_member'];
const USER_STATUSES = ['pending', 'active', 'suspended', 'rejected'];
const BUSINESS_STATUSES = ['pending', 'approved', 'rejected', 'suspended'];
const MEMBERSHIP_STATUSES = ['pending', 'active', 'rejected', 'expired', 'suspended'];
const JOB_STATUSES = ['pending', 'published', 'rejected', 'closed'];
const APPLICATION_STATUSES = ['submitted', 'eligible', 'not_eligible', 'shortlisted', 'rejected'];
const NEWS_STATUSES = ['draft', 'published', 'archived'];
const OFFER_STATUSES = ['draft', 'published', 'expired'];
const QR_STATUSES = ['active', 'disabled', 'inactive'];

const safeUser = (user) => ({
  _id: user._id,
  name: user.name,
  email: user.email,
  phone: user.phone,
  role: user.role,
  status: user.status,
  createdAt: user.createdAt,
  updatedAt: user.updatedAt,
});

const isValidId = (id) => mongoose.isValidObjectId(id);
const requireValidId = (id) => {
  if (!isValidId(id)) {
    const error = new Error('Invalid resource ID.');
    error.statusCode = 400;
    throw error;
  }
};

const getPagination = (query) => {
  const page = Math.max(Number.parseInt(query.page, 10) || 1, 1);
  const limit = Math.min(Math.max(Number.parseInt(query.limit, 10) || 20, 1), 100);
  return { page, limit, skip: (page - 1) * limit };
};

const paginationResponse = (data, page, limit, total) => ({
  data,
  pagination: { page, limit, total, totalPages: total === 0 ? 0 : Math.ceil(total / limit) },
});

const searchFilter = (search, fields) => {
  if (!search || !search.trim()) return {};
  const expression = new RegExp(search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
  return { $or: fields.map((field) => ({ [field]: expression })) };
};

const validateEnum = (value, allowed, field) => {
  if (!allowed.includes(value)) {
    const error = new Error(`Invalid ${field}.`);
    error.statusCode = 400;
    throw error;
  }
};

const getOneOr404 = async (Model, id, populate = []) => {
  requireValidId(id);
  let query = Model.findById(id);
  populate.forEach((path) => { query = query.populate(path); });
  const record = await query;
  if (!record) {
    const error = new Error('Resource not found.');
    error.statusCode = 404;
    throw error;
  }
  return record;
};

const protectAdminAccount = async (target, changes, actorId) => {
  const isSelf = target._id.toString() === actorId.toString();
  if (isSelf && (changes.role && changes.role !== 'admin' || changes.status && changes.status !== 'active')) {
    const error = new Error('An administrator cannot remove their own active admin access.');
    error.statusCode = 400;
    throw error;
  }

  const becomesInactiveAdmin = target.role === 'admin' &&
    ((changes.role && changes.role !== 'admin') || (changes.status && changes.status !== 'active'));
  if (becomesInactiveAdmin) {
    const activeAdmins = await User.countDocuments({ role: 'admin', status: 'active' });
    if (activeAdmins <= 1) {
      const error = new Error('The final active administrator cannot be demoted or deactivated.');
      error.statusCode = 400;
      throw error;
    }
  }
};

const getUsers = async (req, res) => {
  const { page, limit, skip } = getPagination(req.query);
  const filter = {};
  if (req.query.role) validateEnum(req.query.role, USER_ROLES, 'role');
  if (req.query.status) validateEnum(req.query.status, USER_STATUSES, 'status');
  if (req.query.role) filter.role = req.query.role;
  if (req.query.status) filter.status = req.query.status;
  Object.assign(filter, searchFilter(req.query.search, ['name', 'email', 'phone']));
  const [users, total] = await Promise.all([
    User.find(filter).select('_id name email phone role status createdAt updatedAt').sort({ createdAt: -1 }).skip(skip).limit(limit),
    User.countDocuments(filter),
  ]);
  res.json(paginationResponse(users.map(safeUser), page, limit, total));
};

const getUser = async (req, res) => res.json({ user: safeUser(await getOneOr404(User, req.params.id)) });

const updateUserStatus = async (req, res) => {
  const { status } = req.body;
  validateEnum(status, USER_STATUSES, 'status');
  const user = await getOneOr404(User, req.params.id);
  await protectAdminAccount(user, { status }, req.user.userId);
  user.status = status;
  await user.save();
  res.json({ user: safeUser(user) });
};

const updateUserRole = async (req, res) => {
  const { role } = req.body;
  validateEnum(role, USER_ROLES, 'role');
  const user = await getOneOr404(User, req.params.id);
  await protectAdminAccount(user, { role }, req.user.userId);
  user.role = role;
  await user.save();
  res.json({ user: safeUser(user) });
};

const deleteUser = async (req, res) => {
  const user = await getOneOr404(User, req.params.id);
  await protectAdminAccount(user, { status: 'deleted' }, req.user.userId);
  await User.deleteOne({ _id: user._id });
  res.json({ message: 'User deleted.' });
};

const getDashboard = async (req, res) => {
  await expireElapsedMemberships();
  const [totalUsers, jobSeekers, shopOwners, chamberMembers, admins, pendingUsers, activeUsers,
    businessesTotal, businessesPending, businessesApproved, businessesRejected,
    jobsTotal, jobsPending, jobsPublished, jobsClosed,
    applicationsTotal, applicationsEligible, applicationsNotEligible, applicationsShortlisted,
    membershipsTotal, membershipsPending, membershipsActive, membershipsExpired, membershipsSuspended, activeQrCodes] = await Promise.all([
    User.countDocuments(), User.countDocuments({ role: 'job_seeker' }), User.countDocuments({ role: 'shop_owner' }),
    User.countDocuments({ role: 'chamber_member' }), User.countDocuments({ role: 'admin' }), User.countDocuments({ status: 'pending' }), User.countDocuments({ status: 'active' }),
    Business.countDocuments(), Business.countDocuments({ status: 'pending' }), Business.countDocuments({ status: 'approved' }), Business.countDocuments({ status: 'rejected' }),
    Job.countDocuments(), Job.countDocuments({ status: 'pending' }), Job.countDocuments({ status: 'published' }), Job.countDocuments({ status: 'closed' }),
    JobApplication.countDocuments(), JobApplication.countDocuments({ status: 'eligible' }), JobApplication.countDocuments({ status: 'not_eligible' }), JobApplication.countDocuments({ status: 'shortlisted' }),
    ChamberMembership.countDocuments(), ChamberMembership.countDocuments({ status: 'pending' }), ChamberMembership.countDocuments({ status: 'active' }), ChamberMembership.countDocuments({ status: 'expired' }), ChamberMembership.countDocuments({ status: 'suspended' }), QrCode.countDocuments({ status: 'active' }),
  ]);
  res.json({
    users: { total: totalUsers, jobSeekers, shopOwners, chamberMembers, admins, pending: pendingUsers, active: activeUsers },
    businesses: { total: businessesTotal, pending: businessesPending, approved: businessesApproved, rejected: businessesRejected },
    jobs: { total: jobsTotal, pending: jobsPending, published: jobsPublished, closed: jobsClosed },
    applications: { total: applicationsTotal, eligible: applicationsEligible, notEligible: applicationsNotEligible, shortlisted: applicationsShortlisted },
    chamberMemberships: { total: membershipsTotal, pending: membershipsPending, active: membershipsActive, expired: membershipsExpired, suspended: membershipsSuspended, activeQrCodes },
  });
};

const listResource = async (Model, req, res, options = {}) => {
  const { page, limit, skip } = getPagination(req.query);
  const filter = { ...(options.filter || {}) };
  if (req.query.status && options.statuses) validateEnum(req.query.status, options.statuses, 'status');
  if (req.query.status) filter.status = req.query.status;
  Object.assign(filter, searchFilter(req.query.search, options.searchFields || []));
  if (options.extraFilter) options.extraFilter(req, filter);
  const query = Model.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit);
  (options.populate || []).forEach((path) => { query.populate(path); });
  const [data, total] = await Promise.all([query, Model.countDocuments(filter)]);
  res.json(paginationResponse(data, page, limit, total));
};

const getBusinesses = async (req, res) => listResource(Business, req, res, {
  statuses: BUSINESS_STATUSES, searchFields: ['name', 'ownerName', 'category', 'phone', 'email'],
  extraFilter: (request, filter) => { if (request.query.category) filter.category = request.query.category; },
});
const getBusiness = async (req, res) => res.json({ business: await getOneOr404(Business, req.params.id, ['owner']) });
const updateBusinessStatus = async (req, res) => {
  validateEnum(req.body.status, BUSINESS_STATUSES, 'status');
  const business = await getOneOr404(Business, req.params.id);
  business.status = req.body.status;
  await business.save();
  res.json({ business });
};
const deleteBusiness = async (req, res) => { const business = await getOneOr404(Business, req.params.id); await Business.deleteOne({ _id: business._id }); res.json({ message: 'Business deleted.' }); };

const getChamberMembers = async (req, res) => {
  await expireElapsedMemberships();
  return listResource(ChamberMembership, req, res, {
    statuses: MEMBERSHIP_STATUSES,
    searchFields: ['businessName', 'ownerName', 'email', 'phone', 'category', 'membershipNumber'],
    populate: ['user', 'business'],
  });
};
const getChamberMember = async (req, res) => {
  await expireElapsedMemberships();
  res.json({ membership: await getOneOr404(ChamberMembership, req.params.id, ['user', 'business']) });
};
const updateChamberMemberStatus = async (req, res) => {
  await expireElapsedMemberships();
  validateEnum(req.body.status, MEMBERSHIP_STATUSES, 'status');
  const membership = await getOneOr404(ChamberMembership, req.params.id);
  membership.status = req.body.status;
  if (req.body.status === 'active') {
    if (!membership.membershipExpiryDate || membership.membershipExpiryDate < new Date()) {
      const expiresAt = new Date();
      expiresAt.setFullYear(expiresAt.getFullYear() + 1);
      membership.membershipStartDate = new Date();
      membership.membershipExpiryDate = expiresAt;
      membership.expiresAt = expiresAt;
      membership.renewalDate = expiresAt;
    }
    await issueMembershipNumber(membership);
    await provisionMembershipQr(membership);
    await User.updateOne({ _id: membership.user }, { $set: { role: 'chamber_member', status: 'active' } });
    await Notification.create({ type: 'membership_approved', message: 'Your Chamber Membership has been approved.', recipient: membership.user, entityType: 'ChamberMembership', entityId: membership._id }).catch((error) => { if (error.code !== 11000) throw error; });
  } else {
    membership.qrStatus = 'disabled';
    await QrCode.updateMany({ membership: membership._id }, { $set: { status: 'disabled' } });
    const notificationMessage = {
      rejected: 'Your Chamber Membership application has been rejected.',
      suspended: 'Your Chamber Membership has been suspended.',
      expired: 'Your Chamber Membership has expired.',
    }[req.body.status];
    if (notificationMessage) await Notification.create({ type: `membership_${req.body.status}`, message: notificationMessage, recipient: membership.user, entityType: 'ChamberMembership', entityId: membership._id }).catch((error) => { if (error.code !== 11000) throw error; });
  }
  await membership.save();
  res.json({ membership });
};
const approveChamberMember = async (req, res) => { req.body.status = 'active'; return updateChamberMemberStatus(req, res); };
const rejectChamberMember = async (req, res) => { req.body.status = 'rejected'; return updateChamberMemberStatus(req, res); };
const deleteChamberMember = async (req, res) => { const membership = await getOneOr404(ChamberMembership, req.params.id); await QrCode.deleteOne({ membership: membership._id }); await ChamberMembership.deleteOne({ _id: membership._id }); res.json({ message: 'Chamber membership deleted.' }); };

// Returns all active QR codes with membership details — used in admin QR overview panel
const getAllMembersQr = async (req, res) => {
  await expireElapsedMemberships();
  const qrCodes = await QrCode.find({ status: 'active' })
    .populate({ path: 'membership', select: 'businessName ownerName category phone email membershipNumber membershipExpiryDate plan status' })
    .sort({ createdAt: -1 })
    .lean();
  const data = qrCodes
    .filter((q) => q.membership && q.membership.status === 'active')
    .map((q) => ({
      _id: q._id,
      publicId: q.publicId || q.code,
      qrValue: q.qrValue,
      membershipNumber: q.membershipNumber,
      status: q.status,
      membership: q.membership,
    }));
  res.json({ data });
};

const getQrCodes = async (req, res) => listResource(QrCode, req, res, { statuses: QR_STATUSES, searchFields: ['code'], populate: ['membership'] });
const getQrCode = async (req, res) => res.json({ qrCode: await getOneOr404(QrCode, req.params.id, ['membership']) });
const updateQrCodeStatus = async (req, res) => {
  validateEnum(req.body.status, QR_STATUSES, 'status');
  const qrCode = await getOneOr404(QrCode, req.params.id);
  qrCode.status = req.body.status;
  await qrCode.save();
  await ChamberMembership.updateOne({ _id: qrCode.membership }, { qrStatus: req.body.status === 'active' ? 'active' : 'disabled' });
  res.json({ qrCode });
};

const getJobs = async (req, res) => {
  const { page, limit, skip } = getPagination(req.query);
  const filter = {};
  if (req.query.status) validateEnum(req.query.status, JOB_STATUSES, 'status');
  if (req.query.status) filter.status = req.query.status;
  Object.assign(filter, searchFilter(req.query.search, ['title', 'company', 'description', 'location', 'category']));
  if (req.query.location) filter.location = new RegExp(req.query.location.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
  if (req.query.category) filter.category = req.query.category;
  const [jobs, total] = await Promise.all([
    Job.find(filter).populate('owner', 'name email').populate('business', 'name businessName').sort({ createdAt: -1 }).skip(skip).limit(limit),
    Job.countDocuments(filter),
  ]);
  const data = await Promise.all(jobs.map(async (job) => ({ ...job.toObject(), applicationCount: await JobApplication.countDocuments({ job: job._id }) })));
  res.json(paginationResponse(data, page, limit, total));
};
const getJob = async (req, res) => res.json({ job: await getOneOr404(Job, req.params.id, ['owner', 'business']) });
const updateJobStatus = async (req, res) => {
  validateEnum(req.body.status, JOB_STATUSES, 'status');
  const job = await getOneOr404(Job, req.params.id);
  const previousStatus = job.status;
  const validTransition = (job.status === 'pending' && ['published', 'rejected'].includes(req.body.status))
    || (job.status === 'published' && req.body.status === 'closed')
    || job.status === req.body.status;
  if (!validTransition) return res.status(400).json({ message: `Cannot change a ${job.status} job to ${req.body.status}.` });
  job.status = req.body.status;
  job.publishedAt = req.body.status === 'published' ? (job.publishedAt || new Date()) : job.publishedAt;
  await job.save();
  const owner = await User.findById(job.owner).select('_id');
  if (owner && previousStatus !== req.body.status && ['published', 'rejected'].includes(req.body.status)) {
    await Notification.create({
      type: 'job_status_changed',
      message: req.body.status === 'published'
        ? `Your job "${job.title}" has been approved and published.`
        : `Your job "${job.title}" was rejected.`,
      recipient: owner._id,
      entityType: 'Job',
      entityId: job._id,
    });
  }
  res.json({ job });
};
const deleteJob = async (req, res) => { const job = await getOneOr404(Job, req.params.id); await Job.deleteOne({ _id: job._id }); res.json({ message: 'Job deleted.' }); };

const applicationPopulate = [
  { path: 'jobSeeker', select: 'name email phone location education experience skills cv role status' },
  { path: 'job', select: 'title company requirements location status business' },
];
const getApplications = async (req, res) => {
  const { page, limit, skip } = getPagination(req.query);
  const filter = {};
  if (req.query.status) validateEnum(req.query.status, APPLICATION_STATUSES, 'status');
  if (req.query.status) filter.status = req.query.status;
  if (req.query.search?.trim()) {
    const expression = new RegExp(req.query.search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    const [users, jobs] = await Promise.all([
      User.find({ $or: [{ name: expression }, { email: expression }] }).select('_id'),
      Job.find({ $or: [{ title: expression }, { company: expression }] }).select('_id'),
    ]);
    filter.$or = [{ jobSeeker: { $in: users.map((user) => user._id) } }, { job: { $in: jobs.map((job) => job._id) } }];
  }
  const [data, total] = await Promise.all([
    JobApplication.find(filter).populate(applicationPopulate).sort({ createdAt: -1 }).skip(skip).limit(limit),
    JobApplication.countDocuments(filter),
  ]);
  res.json(paginationResponse(data, page, limit, total));
};
const getApplication = async (req, res) => res.json({ application: await getOneOr404(JobApplication, req.params.id, applicationPopulate) });
const updateApplicationStatus = async (req, res) => {
  validateEnum(req.body.status, APPLICATION_STATUSES, 'status');
  const application = await getOneOr404(JobApplication, req.params.id, [{ path: 'job', select: 'title' }]);
  application.status = req.body.status;
  await application.save();
  const labels = { submitted: 'Submitted', eligible: 'Eligible', not_eligible: 'Not Eligible', shortlisted: 'Shortlisted', rejected: 'Rejected' };
  await Notification.create({
    type: `application_status_${req.body.status}`,
    message: req.body.status === 'shortlisted'
      ? `Congratulations! You have been shortlisted for the ${application.job.title} position.`
      : `Your application for ${application.job.title} has been marked as ${labels[req.body.status]}.`,
    recipient: application.jobSeeker,
    entityType: 'JobApplication',
    entityId: application._id,
  });
  res.json({ application });
};
const getApplicationCandidate = async (req, res) => {
  const application = await getOneOr404(JobApplication, req.params.id, applicationPopulate);
  res.json({
    candidate: { name: application.jobSeeker?.name, email: application.jobSeeker?.email, phone: application.jobSeeker?.phone, location: application.jobSeeker?.location, education: application.education, experience: application.experience, skills: application.skills, cv: application.jobSeeker?.cv ? { fileName: application.jobSeeker.cv.fileName, fileType: application.jobSeeker.cv.fileType, fileSize: application.jobSeeker.cv.fileSize } : null },
    job: { title: application.job?.title, company: application.job?.company, requirements: application.job?.requirements },
    application: { status: application.status, createdAt: application.createdAt },
  });
};
const getApplicationCv = async (req, res) => {
  const application = await getOneOr404(JobApplication, req.params.id);
  const user = await User.findById(application.jobSeeker).select('cv');
  if (!user?.cv?.file) return res.status(404).json({ message: 'CV not found.' });
  res.json({ cv: user.cv });
};

const slugify = (value) => String(value).toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
const uniqueSlug = async (title, requested, currentId) => {
  const base = slugify(requested || title);
  if (!base) { const error = new Error('A valid title or slug is required.'); error.statusCode = 400; throw error; }
  let slug = base; let suffix = 2;
  while (await News.exists({ slug, ...(currentId ? { _id: { $ne: currentId } } : {}) })) slug = `${base}-${suffix++}`;
  return slug;
};
const getNews = async (req, res) => listResource(News, req, res, { statuses: NEWS_STATUSES, searchFields: ['title', 'description', 'summary', 'content', 'category'], populate: [{ path: 'author', select: 'name' }] });
const getNewsItem = async (req, res) => res.json({ news: await getOneOr404(News, req.params.id, [{ path: 'author', select: 'name' }]) });
const createNews = async (req, res) => {
  const { title, description, summary, content, image, category, author, status = 'draft', publishedAt } = req.body;
  if (!title || !content) { const error = new Error('title and content are required.'); error.statusCode = 400; throw error; }
  validateEnum(status, NEWS_STATUSES, 'status');
  const news = await News.create({ title, slug: await uniqueSlug(title, req.body.slug), description: description || summary, summary: summary || description, content, image, category, author: author || req.user.userId, status, publishedAt: status === 'published' ? (publishedAt || new Date()) : undefined });
  res.status(201).json({ news });
};
const updateNews = async (req, res) => {
  const news = await getOneOr404(News, req.params.id);
  const allowed = ['title', 'description', 'summary', 'content', 'image', 'category', 'author', 'status', 'publishedAt'];
  Object.keys(req.body).forEach((key) => { if (allowed.includes(key)) news[key] = req.body[key]; });
  if (req.body.title || req.body.slug) news.slug = await uniqueSlug(req.body.title || news.title, req.body.slug || news.slug, news._id);
  if (req.body.description) news.summary = req.body.description;
  if (req.body.summary) news.description = req.body.summary;
  if (req.body.status) validateEnum(req.body.status, NEWS_STATUSES, 'status');
  if (news.status === 'published' && !news.publishedAt) news.publishedAt = new Date();
  if (news.status !== 'published') news.publishedAt = undefined;
  await news.save();
  res.json({ news });
};
const updateNewsStatus = async (req, res) => {
  validateEnum(req.body.status, NEWS_STATUSES, 'status');
  const news = await getOneOr404(News, req.params.id);
  news.status = req.body.status;
  news.publishedAt = req.body.status === 'published' ? (news.publishedAt || new Date()) : undefined;
  await news.save();
  res.json({ news });
};
const deleteNews = async (req, res) => { const news = await getOneOr404(News, req.params.id); await News.deleteOne({ _id: news._id }); res.json({ message: 'News item deleted.' }); };

const getOffers = async (req, res) => listResource(Offer, req, res, { statuses: OFFER_STATUSES, searchFields: ['title', 'description', 'category'], populate: ['business'] });
const getOffer = async (req, res) => res.json({ offer: await getOneOr404(Offer, req.params.id, ['business']) });
const normalizeOfferDates = (body) => ({ ...body, endDate: /^\d{4}-\d{2}-\d{2}$/.test(String(body.endDate || '')) ? `${body.endDate}T23:59:59.999Z` : body.endDate });
const validateOfferBody = (body) => { if (!body.title || !body.startDate || !body.endDate) { const error = new Error('title, startDate, and endDate are required.'); error.statusCode = 400; throw error; } if (body.status) validateEnum(body.status, OFFER_STATUSES, 'status'); if (body.startDate && Number.isNaN(new Date(body.startDate).valueOf())) { const error = new Error('Invalid start date.'); error.statusCode = 400; throw error; } if (body.endDate && Number.isNaN(new Date(body.endDate).valueOf())) { const error = new Error('Invalid end date.'); error.statusCode = 400; throw error; } if (new Date(body.endDate) < new Date(body.startDate)) { const error = new Error('endDate must be after startDate.'); error.statusCode = 400; throw error; } };
const createOffer = async (req, res) => { const body = normalizeOfferDates(req.body); validateOfferBody(body); const offer = await Offer.create({ ...body, status: body.status || 'draft' }); res.status(201).json({ offer }); };
const updateOffer = async (req, res) => { const offer = await getOneOr404(Offer, req.params.id); const body = normalizeOfferDates(req.body); validateOfferBody(body); const allowed = ['title', 'description', 'image', 'category', 'business', 'link', 'status', 'startDate', 'endDate']; Object.keys(body).forEach((key) => { if (allowed.includes(key)) offer[key] = body[key]; }); await offer.save(); res.json({ offer }); };
const updateOfferStatus = async (req, res) => {
  validateEnum(req.body.status, OFFER_STATUSES, 'status');
  const offer = await getOneOr404(Offer, req.params.id);
  offer.status = req.body.status;
  await offer.save();
  res.json({ offer });
};
const deleteOffer = async (req, res) => { const offer = await getOneOr404(Offer, req.params.id); await Offer.deleteOne({ _id: offer._id }); res.json({ message: 'Offer deleted.' }); };

const getAds = async (req, res) => { const { page, limit, skip } = getPagination(req.query); const [data, total] = await Promise.all([Ad.find().sort({ order: 1, createdAt: -1 }).skip(skip).limit(limit), Ad.countDocuments()]); res.json(paginationResponse(data, page, limit, total)); };
const createAd = async (req, res) => { const ad = await Ad.create(req.body); res.status(201).json({ ad }); };
const updateAd = async (req, res) => { const ad = await getOneOr404(Ad, req.params.id); Object.assign(ad, req.body); await ad.save(); res.json({ ad }); };
const updateAdStatus = async (req, res) => { validateEnum(req.body.status, ['draft', 'published', 'unpublished'], 'status'); const ad = await getOneOr404(Ad, req.params.id); ad.status = req.body.status; await ad.save(); res.json({ ad }); };
const deleteAd = async (req, res) => { const ad = await getOneOr404(Ad, req.params.id); await Ad.deleteOne({ _id: ad._id }); res.json({ message: 'Advertisement deleted.' }); };

const getNotifications = async (req, res) => listResource(Notification, req, res, { filter: { recipient: req.user.userId }, statuses: [], searchFields: ['type', 'message'] });
const markNotificationRead = async (req, res) => { const notification = await getOneOr404(Notification, req.params.id); if (notification.recipient?.toString() !== req.user.userId) return res.status(403).json({ message: 'You do not own this notification.' }); notification.readAt = new Date(); await notification.save(); res.json({ notification }); };
const markAllNotificationsRead = async (req, res) => { const result = await Notification.updateMany({ recipient: req.user.userId, readAt: null }, { readAt: new Date() }); res.json({ modifiedCount: result.modifiedCount }); };

module.exports = {
  getUsers, getUser, updateUserStatus, updateUserRole, deleteUser,
  getDashboard,
  getBusinesses, getBusiness, updateBusinessStatus, deleteBusiness,
  getChamberMembers, getChamberMember, updateChamberMemberStatus, approveChamberMember, rejectChamberMember, deleteChamberMember,
  getAllMembersQr, getQrCodes, getQrCode, updateQrCodeStatus,
  getJobs, getJob, updateJobStatus, deleteJob,
  getApplications, getApplication, updateApplicationStatus, getApplicationCandidate, getApplicationCv,
  getNews, getNewsItem, createNews, updateNews, updateNewsStatus, deleteNews,
  getOffers, getOffer, createOffer, updateOffer, updateOfferStatus, deleteOffer,
  getAds, createAd, updateAd, updateAdStatus, deleteAd,
  getNotifications, markNotificationRead, markAllNotificationsRead,
};
