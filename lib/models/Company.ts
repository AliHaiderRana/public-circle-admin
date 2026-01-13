import mongoose from 'mongoose';
import { MODELS, SES_STATUS, USER_STATUS } from '../constants';

const schema = new mongoose.Schema(
  {
    name: { type: String, index: true, required: true },
    companySize: { type: String },
    postalCode: { type: String },
    address: { type: String },
    city: { type: String },
    province: { type: String },
    country: { type: String },
    region: { type: String, default: "" },
    stripeCustomerId: { type: String },
    contactsPrimaryKey: { type: String },
    contactsDisplayOrder: [
      {
        type: String,
      },
    ],
    contactSelectionCriteria: [
      {
        filterKey: {
          type: String,
        },
        filterValues: [{ type: String }],
      },
    ],
    isMarkingDuplicates: {
      type: Boolean,
      required: true,
      default: false,
    },
    emailKey: {
      type: String,
      default: "",
    },
    isContactFinalize: {
      type: Boolean,
      default: false,
    },
    purchasedPlan: {
      type: Array,
      default: [],
    },
    logo: {
      type: String,
      default: "",
    },
    currency: {
      type: String,
      default: "USD",
    },
    isFirstContactImport: {
      type: Boolean,
      default: true,
    },
    isContactFilterLocked: {
      type: Boolean,
      default: false,
    },
    isContactPrimaryKeyLocked: {
      type: Boolean,
      default: false,
    },
    status: {
      type: String,
      enum: Object.values(USER_STATUS),
      default: USER_STATUS.ACTIVE,
    },
    isBlockedByAdmin: {
      type: Boolean,
      default: false,
    },
    isContactEmailLocked: {
      type: Boolean,
      default: false,
    },
    isPlanBandwidthExceeded: {
      type: Boolean,
      default: false,
    },
    isPlanEmailExceeded: {
      type: Boolean,
      default: false,
    },

    testEmailLimits: {
      dailyCount: {
        type: Number,
        default: 0,
      },
      lastResetDate: {
        type: Date,
        default: Date.now,
      },
    },
    complaintRate: {
      type: Number,
      default: 0,
    },
    lastComplaintRateCheck: {
      type: Date,
      default: null,
    },
    bounceRate: {
      type: Number,
      default: 0,
    },
    lastBounceRateCheck: {
      type: Date,
      default: null,
    },
    sesComplaintStatus: {
      type: String,
      enum: Object.values(SES_STATUS),
      default: SES_STATUS.HEALTHY,
    },
    sesBounceStatus: {
      type: String,
      enum: Object.values(SES_STATUS),
      default: SES_STATUS.HEALTHY,
    },
  },
  { timestamps: true }
);

const Company = mongoose.models.companies || mongoose.model('companies', schema);

export default Company;
