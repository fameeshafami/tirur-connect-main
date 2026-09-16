const mongoose = require('mongoose');

const offerSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    image: { type: String, trim: true },
    category: { type: String, enum: ['education', 'electronics', 'food', 'coffee', 'offers', 'local'], trim: true },
    business: { type: mongoose.Schema.Types.ObjectId, ref: 'Business' },
    link: { type: String, trim: true },
    status: { type: String, enum: ['draft', 'published', 'expired'], default: 'draft', index: true },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
  },
  { timestamps: true }
);

offerSchema.index({ title: 'text', description: 'text', category: 'text' });
offerSchema.index({ status: 1, category: 1, startDate: 1, endDate: 1, createdAt: -1 });

module.exports = mongoose.model('Offer', offerSchema);
