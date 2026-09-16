const mongoose = require('mongoose');

const membershipSequenceSchema = new mongoose.Schema(
  {
    year: { type: Number, required: true, unique: true },
    value: { type: Number, required: true, default: 0 },
  },
  { timestamps: true }
);

module.exports = mongoose.model('MembershipSequence', membershipSequenceSchema);
