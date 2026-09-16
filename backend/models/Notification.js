const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema(
  {
    type: { type: String, required: true, trim: true },
    message: { type: String, required: true, trim: true },
    recipient: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    entityType: { type: String, trim: true },
    entityId: { type: mongoose.Schema.Types.ObjectId },
    readAt: { type: Date },
  },
  { timestamps: true }
);

notificationSchema.index({ recipient: 1, readAt: 1, createdAt: -1 });
notificationSchema.index({ recipient: 1, type: 1, entityType: 1, entityId: 1 });

module.exports = mongoose.model('Notification', notificationSchema);
