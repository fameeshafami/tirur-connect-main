const User = require('../models/User');

const listResumes = async (req, res) => {
  const users = await User.find({
    role: 'job_seeker',
    status: 'active',
    'cv.file': { $exists: true, $ne: '' },
  })
    .select('name email phone location education experience skills cv')
    .sort({ 'cv.uploadedAt': -1, updatedAt: -1 });
  res.json({ data: users.map((user) => ({
    id: user._id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    location: user.location,
    education: user.education,
    experience: user.experience,
    skills: user.skills || [],
    cv: { fileName: user.cv.fileName, fileType: user.cv.fileType, fileSize: user.cv.fileSize, uploadedAt: user.cv.uploadedAt },
  })) });
};

const getResume = async (req, res) => {
  const user = await User.findOne({ _id: req.params.id, role: 'job_seeker', status: 'active' }).select('cv');
  if (!user?.cv?.file) return res.status(404).json({ message: 'CV not found.' });
  res.json({ cv: user.cv });
};

module.exports = { listResumes, getResume };