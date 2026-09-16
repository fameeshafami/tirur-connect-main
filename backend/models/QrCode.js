const mongoose = require('mongoose');

const qrCodeSchema = new mongoose.Schema(
  {
    membership: { type: mongoose.Schema.Types.ObjectId, ref: 'ChamberMembership', required: true, unique: true, index: true },
    publicId: { type: String, unique: true, sparse: true, trim: true, index: true },
    code: { type: String, required: true, unique: true, index: true },
    membershipNumber: { type: String, trim: true, index: true },
    qrValue: { type: String, trim: true },
    status: { type: String, enum: ['active', 'disabled', 'inactive'], default: 'inactive', index: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('QrCode', qrCodeSchema);
