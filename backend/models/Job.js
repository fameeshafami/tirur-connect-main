const mongoose = require('mongoose');

const jobSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    business: { type: mongoose.Schema.Types.ObjectId, ref: 'Business', index: true },
    company: { type: String, trim: true },
    description: { type: String, required: true, trim: true },
    location: { type: String, trim: true },
    category: { type: String, trim: true },
    employmentType: { type: String, trim: true },
    salary: { type: String, trim: true },
    requirements: { type: String, trim: true },
    skills: [{ type: String, trim: true }],
    experience: { type: String, trim: true },
    education: { type: String, trim: true },
    quantity: { type: Number, min: 1, default: 1 },
    applicationMethod: { type: String, enum: ['tirur_connect', 'external'], trim: true, default: 'tirur_connect' },
    applicationLink: { type: String, trim: true },
    closingDate: { type: Date },
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
    status: {
      type: String,
      enum: ['pending', 'published', 'rejected', 'closed'],
      default: 'pending',
      index: true,
    },
    publishedAt: { type: Date },
  },
  { timestamps: true }
);

jobSchema.index({ title: 'text', company: 'text', description: 'text', location: 'text', category: 'text' });
jobSchema.index({ owner: 1, status: 1, createdAt: -1 });
jobSchema.index({ status: 1, createdAt: -1, closingDate: 1 });

module.exports = mongoose.model('Job', jobSchema);
