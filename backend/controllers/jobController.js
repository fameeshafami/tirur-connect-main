const mongoose = require('mongoose');
const Job = require('../models/Job');

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

const populateBusiness = { path: 'business', select: 'name businessName' };

const getPublishedJobs = async (req, res) => {
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

const getPublishedJob = async (req, res) => {
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

module.exports = { getPublishedJobs, getPublishedJob };
