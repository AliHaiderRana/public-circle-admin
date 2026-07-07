import mongoose from 'mongoose';

export const THIRD_PARTY_USER_SOURCE = {
  REFERRAL_APP: 'referral_app',
} as const;

export const THIRD_PARTY_PORTAL_ACCESS = {
  NONE: 'none',
  ELIGIBLE: 'eligible',
  ACTIVE: 'active',
  REVOKED: 'revoked',
} as const;

const schema = new mongoose.Schema(
  {
    source: {
      type: String,
      enum: Object.values(THIRD_PARTY_USER_SOURCE),
      default: THIRD_PARTY_USER_SOURCE.REFERRAL_APP,
      required: true,
      index: true,
    },
    referralUserId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      unique: true,
      index: true,
    },
    emailAddress: { type: String, required: true, index: true },
    firstName: { type: String, default: '' },
    lastName: { type: String, default: '' },
    phoneNumber: { type: String, default: '' },
    secondaryEmail: { type: String, default: '' },
    role: { type: String, required: true, index: true },
    status: { type: String, required: true, index: true },
    currency: { type: String, default: '' },
    country: { type: String, default: '' },
    region: { type: String, default: '' },
    city: { type: String, default: '' },
    address: { type: String, default: '' },
    postalCode: { type: String, default: '' },
    profilePicture: { type: String, default: '' },
    referralCompanyId: { type: mongoose.Schema.Types.ObjectId, default: null, index: true },
    reportingToReferralUserId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
      index: true,
    },
    isEmailVerified: { type: Boolean, default: false },
    signupStep: { type: Number, default: 0 },
    signupCompletedAt: { type: Date, default: null, index: true },
    portalAccess: {
      type: String,
      enum: Object.values(THIRD_PARTY_PORTAL_ACCESS),
      default: THIRD_PARTY_PORTAL_ACCESS.NONE,
      index: true,
    },
    referralCreatedAt: { type: Date, default: null },
    referralUpdatedAt: { type: Date, default: null },
    lastSyncedAt: { type: Date, default: null },
  },
  { timestamps: true, collection: 'third-party-users' },
);

schema.index({ emailAddress: 1, source: 1 });
schema.index({ role: 1, portalAccess: 1 });

const ThirdPartyUser =
  mongoose.models.ThirdPartyUser ||
  mongoose.model('ThirdPartyUser', schema, 'third-party-users');

export default ThirdPartyUser;
