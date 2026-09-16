const mongoose = require('mongoose');

const membershipPaymentSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    orderId: { type: String, required: true, unique: true, index: true },
    paymentId: { type: String, unique: true, sparse: true },
    plan: { type: String, required: true, trim: true },
    amount: { type: Number, required: true },
    status: { type: String, enum: ['created', 'verified'], default: 'created' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('MembershipPayment', membershipPaymentSchema);
