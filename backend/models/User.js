const mongoose = require('mongoose');

const cvSchema = new mongoose.Schema(
  {
    fileName: { type: String, trim: true },
    fileType: { type: String, trim: true },
    fileSize: { type: Number, default: 0 },
    uploadedAt: { type: Date, default: Date.now },
    file: { type: String },
  },
  { _id: false }
);

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    phone: {
      type: String,
      required: true,
      trim: true,
    },
    passwordHash: {
      type: String,
      required: true,
      select: false,
    },
    passwordResetTokenHash: { type: String, select: false },
    passwordResetExpiresAt: { type: Date, select: false },
    role: {
      type: String,
      enum: ['admin', 'shop_owner', 'job_seeker', 'chamber_member', 'public'],
      default: 'public',
      required: true,
    },
    status: {
      type: String,
      enum: ['pending', 'active', 'suspended', 'rejected'],
      default: 'pending',
      required: true,
    },
    location: { type: String, trim: true },
    bio: { type: String, trim: true },
    education: { type: String, trim: true },
    experience: { type: String, trim: true },
    skills: [{ type: String, trim: true }],
    dateOfBirth: { type: Date },
    cv: { type: cvSchema },
    createdAt: {
      type: Date,
      default: Date.now,
    },
    updatedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

userSchema.pre('save', function (next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('User', userSchema);
