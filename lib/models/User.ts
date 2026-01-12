import mongoose from 'mongoose';
import { MODELS, USER_STATUS, USER_KIND } from '../constants';

const { ObjectId } = mongoose.Schema.Types;

const schema = new mongoose.Schema(
  {
    company: { type: ObjectId, ref: MODELS.COMPANY },
    emailAddress: { type: String, index: true, required: true },
    password: { type: String },
    profilePicture: { type: String },
    firstName: { type: String, index: true },
    lastName: { type: String, index: true },
    phoneNumber: { type: String, index: true },
    secondaryEmail: { type: String, index: true },
    lastLoginAt: { type: Date, default: Date.now },
    invalidLoginAttempts: { type: Number, default: 0 },
    isEmailVerified: { type: Boolean, default: false },
    isLoginWithEmailLocked: { type: Boolean, default: false },
    role: {
      type: ObjectId,
      ref: MODELS.ROLE,
    },
    isResetPasswordRequested: { type: Boolean, default: false },
    signUpStepsCompleted: { type: Number, min: 0, max: 8, default: 0 },
    watchTutorialStepsCompleted: { type: Number, min: 0, max: 6, default: 0 },
    referralCode: { type: ObjectId, ref: MODELS.REFERRAL_CODE },
    invalidReferralCodeAttempts: { type: Number, min: 0, default: 0 },
    kind: {
      type: String,
      required: true,
      default: USER_KIND.PRIMARY,
      enum: Object.values(USER_KIND),
    },
    status: {
      type: String,
      default: USER_STATUS.ACTIVE,
      enum: Object.values(USER_STATUS),
    },
    receiveEmailsFromPublicCircles: { type: Boolean, default: true },
    tourSteps: {
      type: Object,
      default: {},
    }
  },
  { timestamps: true }
);

const User = mongoose.models.user || mongoose.model('user', schema);

export default User;
