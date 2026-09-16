const mongoose = require('mongoose');

const chamberMembershipSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true, index: true },
    business: { type: mongoose.Schema.Types.ObjectId, ref: 'Business', required: true, index: true },
    membershipNumber: { type: String, unique: true, sparse: true, trim: true, index: true },
    businessName: { type: String, required: true, trim: true },
    ownerName: { type: String, required: true, trim: true },
    email: { type: String, lowercase: true, trim: true },
    phone: { type: String, trim: true },
    category: { type: String, trim: true },
    address: { type: String, trim: true },
    description: { type: String, trim: true },
    logo: { type: String, trim: true },
    website: { type: String, trim: true },
    plan: { type: String, trim: true },
    paymentId: { type: String, trim: true },
    paymentAmount: { type: Number },
    paymentStatus: { type: String, enum: ['verified'], default: undefined },
    qrCode: { type: String, unique: true, sparse: true, index: true },
    qrStatus: { type: String, enum: ['active', 'inactive', 'disabled'], default: 'inactive' },
    status: {
      type: String,
      enum: ['pending', 'active', 'rejected', 'expired', 'suspended'],
      default: 'pending',
      index: true,
    },
    membershipStartDate: { type: Date },
    membershipExpiryDate: { type: Date, index: true },
    expiresAt: { type: Date },
    renewalDate: { type: Date },
    publicProfile: {
      businessName: String,
      ownerName: String,
      category: String,
      phone: String,
      email: String,
      address: String,
      description: String,
    },
  },
  { timestamps: true }
);

chamberMembershipSchema.index({ status: 1, membershipExpiryDate: 1 });
chamberMembershipSchema.index({ business: 1, status: 1 });

module.exports = mongoose.model('ChamberMembership', chamberMembershipSchema);
