const mongoose = require('mongoose');

const savedJobSchema = new mongoose.Schema(
  {
    job: { type: mongoose.Schema.Types.ObjectId, ref: 'Job', required: true },
    jobSeeker: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

savedJobSchema.index({ job: 1, jobSeeker: 1 }, { unique: true });

module.exports = mongoose.model('SavedJob', savedJobSchema);
