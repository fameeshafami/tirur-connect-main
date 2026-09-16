const mongoose = require('mongoose');

const newsSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, trim: true, lowercase: true },
    description: { type: String, trim: true },
    summary: { type: String, trim: true },
    content: { type: String, required: true, trim: true },
    image: { type: String, trim: true },
    category: { type: String, trim: true },
    author: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    status: { type: String, enum: ['draft', 'published', 'archived'], default: 'draft', index: true },
    publishedAt: { type: Date },
  },
  { timestamps: true }
);

newsSchema.index({ title: 'text', summary: 'text', content: 'text', category: 'text' });
newsSchema.index({ status: 1, category: 1, publishedAt: -1, createdAt: -1 });

module.exports = mongoose.model('News', newsSchema);
