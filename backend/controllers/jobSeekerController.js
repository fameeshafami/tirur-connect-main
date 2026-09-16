const mongoose = require('mongoose');
const User = require('../models/User');
const Job = require('../models/Job');
const JobApplication = require('../models/JobApplication');
const SavedJob = require('../models/SavedJob');
const Notification = require('../models/Notification');

const APPLICATION_STATUSES = ['submitted', 'eligible', 'not_eligible', 'shortlisted', 'rejected'];
const JOB_STATUSES = ['pending', 'published', 'rejected', 'closed'];

const pagination = (query) => {
  const page = Math.max(Number.parseInt(query.page, 10) || 1, 1);
  const limit = Math.min(Math.max(Number.parseInt(query.limit, 10) || 20, 1), 100);
  return { page, limit, skip: (page - 1) * limit };
};

const paginationResponse = (data, page, limit, total) => ({
  data,
  pagination: { page, limit, total, totalPages: total === 0 ? 0 : Math.ceil(total / limit) },
});

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const serializeUser = (user) => ({
  _id: user._id,
  name: user.name,
  email: user.email,
  phone: user.phone,
  location: user.location,
  bio: user.bio,
  education: user.education,
  experience: user.experience,
  skills: user.skills,
  role: user.role,
  status: user.status,
  createdAt: user.createdAt,
  updatedAt: user.updatedAt,
});

const getProfile = async (req, res) => {
  res.json({ user: serializeUser(req.currentUser) });
};

const updateProfile = async (req, res) => {
  const allowed = ['name', 'email', 'phone', 'location', 'bio', 'dateOfBirth', 'education', 'experience', 'skills'];
  const updates = {};

  Object.keys(req.body).forEach((key) => {
    if (allowed.includes(key)) updates[key] = req.body[key];
  });

  if (!updates.name && !updates.email && !updates.phone && !updates.location && !updates.bio && !updates.dateOfBirth && !updates.education && !updates.experience && !updates.skills) {
    return res.status(400).json({ message: 'No valid profile fields were provided.' });
  }

  const user = await User.findById(req.currentUser._id);
  Object.keys(updates).forEach((key) => {
    if (key === 'skills') {
      user.skills = Array.isArray(updates.skills) ? updates.skills : String(updates.skills || '').split(',').map((item) => item.trim()).filter(Boolean);
      return;
    }
    user[key] = updates[key];
  });

  await user.save();
  res.json({ user: serializeUser(user) });
};

const getCv = async (req, res) => {
  const user = await User.findById(req.currentUser._id).select('cv');
  res.json({ cv: user?.cv || null });
};

const createCv = async (req, res) => {
  const { file, fileName, fileType, fileSize } = req.body;
  if (!file || !fileName) {
    return res.status(400).json({ message: 'CV file and file name are required.' });
  }

  const allowedExtensions = ['pdf', 'doc', 'docx'];
  const safeName = String(fileName).replace(/[^a-zA-Z0-9._-]/g, '_');
  const extension = safeName.split('.').pop()?.toLowerCase();
  if (!allowedExtensions.includes(extension)) {
    return res.status(400).json({ message: 'Only PDF, DOC, and DOCX files are allowed.' });
  }
  const allowedMimeTypes = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
  if (fileType && fileType !== 'application/octet-stream' && !allowedMimeTypes.includes(fileType)) return res.status(400).json({ message: 'Invalid CV file type.' });
  if (!Number.isInteger(Number(fileSize)) || Number(fileSize) <= 0 || Number(fileSize) > 5 * 1024 * 1024) {
    return res.status(400).json({ message: 'CV file must be between 1 byte and 5MB.' });
  }

  const user = await User.findById(req.currentUser._id);
  user.cv = {
    file,
    fileName: safeName,
    fileType: fileType || 'application/octet-stream',
    fileSize: Number(fileSize) || 0,
    uploadedAt: new Date(),
  };
  await user.save();

  res.status(201).json({ cv: user.cv });
};

const updateCv = async (req, res) => {
  return createCv(req, res);
};

const deleteCv = async (req, res) => {
  const user = await User.findById(req.currentUser._id);
  user.cv = undefined;
  await user.save();
  res.json({ message: 'CV deleted.' });
};

const populateBusiness = { path: 'business', select: 'name businessName' };

const getJobs = async (req, res) => {
  const { page, limit, skip } = pagination(req.query);
  const filter = { status: 'published' };

  if (req.query.search) {
    const search = escapeRegex(req.query.search.trim());
    filter.$or = [
      { title: new RegExp(search, 'i') },
      { company: new RegExp(search, 'i') },
      { description: new RegExp(search, 'i') },
      { location: new RegExp(search, 'i') },
    ];
  }

  if (req.query.location) filter.location = new RegExp(escapeRegex(req.query.location.trim()), 'i');
  if (req.query.category) filter.category = req.query.category;
  if (req.query.employmentType) filter.employmentType = req.query.employmentType;
  if (req.query.experience) filter.experience = new RegExp(escapeRegex(req.query.experience.trim()), 'i');
  if (req.query.education) filter.education = new RegExp(escapeRegex(req.query.education.trim()), 'i');
  if (req.query.salary) filter.salary = new RegExp(escapeRegex(req.query.salary.trim()), 'i');

  const [data, total] = await Promise.all([
    Job.find(filter).populate(populateBusiness).sort({ publishedAt: -1, createdAt: -1 }).skip(skip).limit(limit),
    Job.countDocuments(filter),
  ]);

  res.json(paginationResponse(data, page, limit, total));
};

const getJob = async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(400).json({ message: 'Invalid job ID.' });
  }

  const job = await Job.findById(req.params.id).populate(populateBusiness);
  if (!job) {
    return res.status(404).json({ message: 'Job not found.' });
  }
  if (job.status !== 'published') {
    return res.status(404).json({ message: 'Job not found.' });
  }

  res.json({ job });
};

const getApplications = async (req, res) => {
  const { page, limit, skip } = pagination(req.query);
  const filter = { jobSeeker: req.currentUser._id };

  if (req.query.status && APPLICATION_STATUSES.includes(req.query.status)) {
    filter.status = req.query.status;
  }

  const [data, total] = await Promise.all([
    JobApplication.find(filter).populate('job', 'title company location status').sort({ createdAt: -1 }).skip(skip).limit(limit),
    JobApplication.countDocuments(filter),
  ]);

  res.json(paginationResponse(data, page, limit, total));
};

const getApplication = async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(400).json({ message: 'Invalid application ID.' });
  }

  const application = await JobApplication.findById(req.params.id).populate('job', 'title company location description employmentType salary');
  if (!application) {
    return res.status(404).json({ message: 'Application not found.' });
  }
  if (application.jobSeeker.toString() !== req.currentUser._id.toString()) {
    return res.status(403).json({ message: 'You do not have permission to view this application.' });
  }

  res.json({ application });
};

const createApplication = async (req, res) => {
  const { jobId, coverLetter, education, experience, skills } = req.body;

  if (!jobId) {
    return res.status(400).json({ message: 'Job ID is required.' });
  }

  if (!mongoose.isValidObjectId(jobId)) {
    return res.status(400).json({ message: 'Invalid job ID.' });
  }

  const job = await Job.findById(jobId);
  if (!job) {
    return res.status(404).json({ message: 'Job not found.' });
  }
  if (job.status !== 'published') {
    return res.status(400).json({ message: 'This job is not accepting applications.' });
  }
  if (job.closingDate && new Date(job.closingDate) < new Date()) {
    return res.status(400).json({ message: 'This job is no longer accepting applications.' });
  }

  const hasExistingApplication = await JobApplication.findOne({ job: jobId, jobSeeker: req.currentUser._id });
  if (hasExistingApplication) {
    return res.status(409).json({ message: 'You have already applied for this job.' });
  }

  if (!coverLetter && !education && !experience && !skills) {
    return res.status(400).json({ message: 'Application details are required.' });
  }

  const user = await User.findById(req.currentUser._id);
  const cv = user.cv;
  if (job.applicationMethod === 'tirur_connect' && !cv) {
    return res.status(400).json({ message: 'A CV is required before applying to this job.' });
  }

  const application = await JobApplication.create({
    job: jobId,
    jobSeeker: req.currentUser._id,
    business: job.business || job.owner || null,
    coverLetter: coverLetter || '',
    education: education || user.education || '',
    experience: experience || user.experience || '',
    skills: Array.isArray(skills) ? skills : (user.skills || []).slice(0, 10),
    cv: cv ? cv.fileName : '',
    status: 'submitted',
  });

  await Notification.create({
    type: 'application_submitted',
    message: `Your application for ${job.title} was submitted successfully.`,
    recipient: req.currentUser._id,
    entityType: 'JobApplication',
    entityId: application._id,
  });
  let jobOwner = job.owner;
  if (!jobOwner && job.business) {
    const business = await require('../models/Business').findById(job.business).select('owner');
    jobOwner = business?.owner;
  }
  if (jobOwner) {
    await Notification.create({
      type: 'application_submitted',
      message: `A new candidate has applied for: ${job.title}.`,
      recipient: jobOwner,
      entityType: 'JobApplication',
      entityId: application._id,
    });
  }

  res.status(201).json({ application });
};

const getApplicationCv = async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ message: 'Invalid application ID.' });
  const application = await JobApplication.findById(req.params.id).select('jobSeeker');
  if (!application || application.jobSeeker.toString() !== req.currentUser._id.toString()) return res.status(404).json({ message: 'CV not found.' });
  const user = await User.findById(req.currentUser._id).select('cv');
  if (!user?.cv?.file) return res.status(404).json({ message: 'CV not found.' });
  res.json({ cv: user.cv });
};

const getSavedJobs = async (req, res) => {
  const { page, limit, skip } = pagination(req.query);
  const filter = { jobSeeker: req.currentUser._id };
  const [data, total] = await Promise.all([
    SavedJob.find(filter).populate('job').sort({ createdAt: -1 }).skip(skip).limit(limit),
    SavedJob.countDocuments(filter),
  ]);

  res.json(paginationResponse(data, page, limit, total));
};

const saveJob = async (req, res) => {
  const { jobId } = req.params;
  if (!mongoose.isValidObjectId(jobId)) {
    return res.status(400).json({ message: 'Invalid job ID.' });
  }

  const job = await Job.findById(jobId);
  if (!job || job.status !== 'published') {
    return res.status(404).json({ message: 'Published job not found.' });
  }

  const saved = await SavedJob.findOne({ job: jobId, jobSeeker: req.currentUser._id });
  if (saved) {
    return res.status(409).json({ message: 'This job is already saved.' });
  }

  const record = await SavedJob.create({ job: jobId, jobSeeker: req.currentUser._id });
  res.status(201).json({ savedJob: record });
};

const unsaveJob = async (req, res) => {
  const { jobId } = req.params;
  if (!mongoose.isValidObjectId(jobId)) {
    return res.status(400).json({ message: 'Invalid job ID.' });
  }

  const result = await SavedJob.deleteOne({ job: jobId, jobSeeker: req.currentUser._id });
  if (result.deletedCount === 0) {
    return res.status(404).json({ message: 'Saved job not found.' });
  }

  res.json({ message: 'Saved job removed.' });
};

const getNotifications = async (req, res) => {
  const { page, limit, skip } = pagination(req.query);
  const filter = { recipient: req.currentUser._id };
  const [data, total] = await Promise.all([
    Notification.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
    Notification.countDocuments(filter),
  ]);

  res.json(paginationResponse(data, page, limit, total));
};

const markNotificationRead = async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(400).json({ message: 'Invalid notification ID.' });
  }

  const notification = await Notification.findById(req.params.id);
  if (!notification) {
    return res.status(404).json({ message: 'Notification not found.' });
  }
  if (notification.recipient.toString() !== req.currentUser._id.toString()) {
    return res.status(403).json({ message: 'You do not have access to this notification.' });
  }

  notification.readAt = new Date();
  await notification.save();
  res.json({ notification });
};

const markAllNotificationsRead = async (req, res) => {
  const result = await Notification.updateMany({ recipient: req.currentUser._id, readAt: null }, { readAt: new Date() });
  res.json({ modifiedCount: result.modifiedCount });
};

const getDashboard = async (req, res) => {
  const user = await User.findById(req.currentUser._id).select('name email phone location bio education experience skills cv');

  const [totalApplications, submitted, eligible, notEligible, shortlisted, rejected, savedJobs, unreadNotifications] = await Promise.all([
    JobApplication.countDocuments({ jobSeeker: req.currentUser._id }),
    JobApplication.countDocuments({ jobSeeker: req.currentUser._id, status: 'submitted' }),
    JobApplication.countDocuments({ jobSeeker: req.currentUser._id, status: 'eligible' }),
    JobApplication.countDocuments({ jobSeeker: req.currentUser._id, status: 'not_eligible' }),
    JobApplication.countDocuments({ jobSeeker: req.currentUser._id, status: 'shortlisted' }),
    JobApplication.countDocuments({ jobSeeker: req.currentUser._id, status: 'rejected' }),
    SavedJob.countDocuments({ jobSeeker: req.currentUser._id }),
    Notification.countDocuments({ recipient: req.currentUser._id, readAt: null }),
  ]);

  const completion = {
    name: !!user.name,
    phone: !!user.phone,
    location: !!user.location,
    education: !!user.education,
    experience: !!user.experience,
    skills: !!(user.skills && user.skills.length),
    cv: !!(user.cv && user.cv.fileName),
  };

  const completed = Object.values(completion).filter(Boolean).length;
  const totalChecks = Object.keys(completion).length;

  res.json({
    profile: { completed: completed >= 4, percentage: Math.round((completed / totalChecks) * 100) },
    applications: {
      total: totalApplications,
      submitted,
      eligible,
      notEligible: notEligible,
      shortlisted,
      rejected,
    },
    savedJobs,
    notifications: unreadNotifications,
  });
};

module.exports = {
  getProfile,
  updateProfile,
  getCv,
  createCv,
  updateCv,
  deleteCv,
  getJobs,
  getJob,
  createApplication,
  getApplications,
  getApplication,
  getApplicationCv,
  getSavedJobs,
  saveJob,
  unsaveJob,
  getNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  getDashboard,
};
