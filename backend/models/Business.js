const mongoose = require('mongoose');

const businessSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    businessName: { type: String, trim: true },
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    ownerName: { type: String, trim: true },
    category: { type: String, required: true, trim: true },
    phone: { type: String, trim: true },
    email: { type: String, lowercase: true, trim: true },
    address: { type: String, trim: true },
    location: { type: String, trim: true },
    description: { type: String, trim: true },
    logo: { type: String, trim: true },
    images: [{ type: String, trim: true }],
    website: { type: String, trim: true },
    socialLinks: { type: mongoose.Schema.Types.Mixed },
    hours: { type: String, trim: true },
    open: { type: Boolean, default: true },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected', 'suspended'],
      default: 'pending',
      index: true,
    },
  },
  { timestamps: true }
);

businessSchema.index({ name: 'text', ownerName: 'text', category: 'text' });

module.exports = mongoose.model('Business', businessSchema);
