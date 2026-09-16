const mongoose = require('mongoose');

const jobApplicationSchema = new mongoose.Schema(
  {
    job: { type: mongoose.Schema.Types.ObjectId, ref: 'Job', required: true, index: true },
    jobSeeker: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    applicant: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    business: { type: mongoose.Schema.Types.ObjectId, ref: 'Business', required: true, index: true },
    education: { type: String, trim: true },
    experience: { type: String, trim: true },
    skills: [{ type: String, trim: true }],
    cv: { type: String, trim: true },
    coverLetter: { type: String, trim: true },
    status: {
      type: String,
      enum: ['submitted', 'eligible', 'not_eligible', 'shortlisted', 'rejected'],
      default: 'submitted',
      index: true,
    },
  },
  { timestamps: true }
);

jobApplicationSchema.index({ job: 1, jobSeeker: 1 }, { unique: true });
jobApplicationSchema.index({ status: 1, createdAt: -1 });
jobApplicationSchema.index({ business: 1, status: 1, createdAt: -1 });

module.exports = mongoose.model('JobApplication', jobApplicationSchema);
