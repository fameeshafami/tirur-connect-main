const mongoose = require('mongoose');
const Business = require('../models/Business');

const publicFields = 'name category description phone email address ownerName hours open createdAt updatedAt';
const validStatuses = ['pending', 'approved', 'rejected', 'suspended'];

const pagination = (query) => {
  const page = Math.max(Number.parseInt(query.page, 10) || 1, 1);
  const limit = Math.min(Math.max(Number.parseInt(query.limit, 10) || 20, 1), 100);
  return { page, limit, skip: (page - 1) * limit };
};

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const searchFilter = (search) => {
  if (!search || !search.trim()) return {};
  const expression = new RegExp(escapeRegex(search.trim()), 'i');
  return { $or: [{ name: expression }, { description: expression }, { category: expression }, { address: expression }] };
};

const getApprovedBusinesses = async (req, res) => {
  const { page, limit, skip } = pagination(req.query);
  const filter = { status: 'approved', ...searchFilter(req.query.search) };
  if (req.query.category) filter.category = req.query.category;
  if (req.query.location) filter.address = new RegExp(escapeRegex(req.query.location.trim()), 'i');
  if (req.query.open === 'true' || req.query.open === 'false') filter.open = req.query.open === 'true';
  const [data, total] = await Promise.all([
    Business.find(filter).select(publicFields).sort({ createdAt: -1 }).skip(skip).limit(limit),
    Business.countDocuments(filter),
  ]);
  res.json({ data, pagination: { page, limit, total, totalPages: total === 0 ? 0 : Math.ceil(total / limit) } });
};

const getApprovedBusiness = async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ message: 'Invalid business ID.' });
  const business = await Business.findOne({ _id: req.params.id, status: 'approved' }).select(publicFields);
  if (!business) return res.status(404).json({ message: 'Business not found.' });
  res.json({ business });
};

const createBusiness = async (req, res) => {
  const { name, category, description, phone, email, address, hours, open = true } = req.body;
  if (!name || !category || !description || !phone || !address) return res.status(400).json({ message: 'Name, category, description, phone, and address are required.' });
  const business = await Business.create({ name, category, description, phone, email, address, hours, open, owner: req.user.userId, ownerName: req.user.name, status: 'pending' });
  res.status(201).json({ business });
};

const getOwnerBusiness = async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ message: 'Invalid business ID.' });
  const business = await Business.findById(req.params.id);
  if (!business) return res.status(404).json({ message: 'Business not found.' });
  if (!business.owner || business.owner.toString() !== req.user.userId.toString()) return res.status(403).json({ message: 'You do not own this business.' });
  res.json({ business });
};

const updateOwnerBusiness = async (req, res) => {
  const business = await getOwnedBusiness(req);
  const allowed = ['name', 'category', 'description', 'phone', 'email', 'address', 'hours', 'open'];
  Object.keys(req.body).forEach((key) => { if (allowed.includes(key)) business[key] = req.body[key]; });
  business.status = 'pending';
  await business.save();
  res.json({ business });
};

const deleteOwnerBusiness = async (req, res) => {
  const business = await getOwnedBusiness(req);
  await Business.deleteOne({ _id: business._id });
  res.json({ message: 'Business deleted.' });
};

const getOwnedBusiness = async (req) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    const error = new Error('Invalid business ID.');
    error.statusCode = 400;
    throw error;
  }
  const business = await Business.findById(req.params.id);
  if (!business) {
    const error = new Error('Business not found.');
    error.statusCode = 404;
    throw error;
  }
  if (!business.owner || business.owner.toString() !== req.user.userId.toString()) {
    const error = new Error('You do not own this business.');
    error.statusCode = 403;
    throw error;
  }
  return business;
};

module.exports = { getApprovedBusinesses, getApprovedBusiness, createBusiness, getOwnerBusiness, updateOwnerBusiness, deleteOwnerBusiness };
