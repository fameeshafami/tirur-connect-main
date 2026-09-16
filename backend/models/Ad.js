const mongoose = require('mongoose');

const adSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    subtitle: { type: String, trim: true },
    description: { type: String, trim: true },
    content: { type: String, trim: true },
    category: { type: String, trim: true },
    badge: { type: String, trim: true },
    placement: { type: String, enum: ['homepage', 'sidebar-left', 'sidebar-right', 'directory'], default: 'homepage' },
    imageUrl: { type: String, trim: true },
    link: { type: String, trim: true },
    status: { type: String, enum: ['draft', 'published', 'unpublished'], default: 'draft', index: true },
    enabled: { type: Boolean, default: true },
    startAt: { type: Date, required: true },
    endAt: { type: Date, required: true },
    order: { type: Number, default: 0 },
  },
  { timestamps: true }
);

adSchema.index({ status: 1, enabled: 1, placement: 1, startAt: 1, endAt: 1 });

module.exports = mongoose.model('Ad', adSchema);