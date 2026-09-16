const crypto = require('crypto');
const ChamberMembership = require('../models/ChamberMembership');
const MembershipSequence = require('../models/MembershipSequence');
const QrCode = require('../models/QrCode');
const Notification = require('../models/Notification');

const publicAppUrl = () => (process.env.PUBLIC_APP_URL || 'http://localhost:3000').replace(/\/$/, '');
const membershipExpiry = (membership) => membership.membershipExpiryDate || membership.expiresAt;

const issueMembershipNumber = async (membership) => {
  if (membership.membershipNumber) return membership.membershipNumber;
  const year = new Date().getFullYear();
  const sequence = await MembershipSequence.findOneAndUpdate(
    { year },
    { $inc: { value: 1 } },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );
  membership.membershipNumber = `TCC-${year}-${String(sequence.value).padStart(4, '0')}`;
  return membership.membershipNumber;
};

const buildPublicUrl = (publicId) => `${publicAppUrl()}/chamber-member-profile.html?publicId=${encodeURIComponent(publicId)}`;

const ensureMembershipQr = async (membership) => {
  let qr = await QrCode.findOne({ membership: membership._id });
  if (!qr) {
    const publicId = crypto.randomUUID().replace(/-/g, '');
    qr = await QrCode.create({
      membership: membership._id,
      publicId,
      code: publicId,
      membershipNumber: membership.membershipNumber,
      qrValue: buildPublicUrl(publicId),
      status: 'active',
    });
  } else {
    qr.publicId = qr.publicId || qr.code;
    qr.membershipNumber = membership.membershipNumber;
    qr.qrValue = buildPublicUrl(qr.publicId);
    qr.status = 'active';
    await qr.save();
  }
  membership.qrCode = qr.publicId || qr.code;
  membership.qrStatus = 'active';
  return qr;
};

const expireElapsedMemberships = async () => {
  const now = new Date();
  const soon = new Date(now);
  soon.setDate(soon.getDate() + 30);
  const expired = await ChamberMembership.find({
    status: 'active',
    $or: [
      { membershipExpiryDate: { $lt: now } },
      { membershipExpiryDate: { $exists: false }, expiresAt: { $lt: now } },
    ],
  }).select('_id');
  const membershipIds = expired.map((membership) => membership._id);
  if (membershipIds.length) {
    await ChamberMembership.updateMany({ _id: { $in: membershipIds } }, { $set: { status: 'expired', qrStatus: 'disabled' } });
    await QrCode.updateMany({ membership: { $in: membershipIds } }, { $set: { status: 'disabled' } });
  }
  const expiringSoon = await ChamberMembership.find({ status: 'active', membershipExpiryDate: { $gte: now, $lte: soon } }).select('_id user');
  await Promise.all(expiringSoon.map((membership) => Notification.create({
    type: 'membership_expiring_soon',
    message: 'Your Chamber Membership is expiring soon.',
    recipient: membership.user,
    entityType: 'ChamberMembership',
    entityId: membership._id,
  }).catch((error) => { if (error.code !== 11000) throw error; })));
  return membershipIds.length;
};

module.exports = { membershipExpiry, issueMembershipNumber, buildPublicUrl, ensureMembershipQr, expireElapsedMemberships };
