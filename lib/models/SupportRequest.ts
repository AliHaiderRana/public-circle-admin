import mongoose from 'mongoose';
import { MODELS } from '../constants';

const SUPPORT_REQUEST_CATEGORY = {
  BILLING_AND_SUBSCRIPTION: 'BILLING_AND_SUBSCRIPTION',
  CAMPAIGNS_AND_SENDING: 'CAMPAIGNS_AND_SENDING',
  CONTACTS_AND_AUDIENCE: 'CONTACTS_AND_AUDIENCE',
  TEMPLATES_AND_CONTENT: 'TEMPLATES_AND_CONTENT',
  INTEGRATIONS: 'INTEGRATIONS',
  ACCOUNT_AND_ACCESS: 'ACCOUNT_AND_ACCESS',
  TECHNICAL_ISSUE: 'TECHNICAL_ISSUE',
  OTHER: 'OTHER',
} as const;

const SUPPORT_REQUEST_STATUS = {
  OPEN: 'OPEN',
  IN_PROGRESS: 'IN_PROGRESS',
  RESOLVED: 'RESOLVED',
  CLOSED: 'CLOSED',
} as const;

const schema = new mongoose.Schema(
  {
    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      index: true,
      ref: MODELS.COMPANY,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      index: true,
      ref: MODELS.USER,
    },
    category: {
      type: String,
      enum: Object.values(SUPPORT_REQUEST_CATEGORY),
      required: true,
    },
    subject: {
      type: String,
      required: true,
      trim: true,
    },
    message: {
      type: String,
      required: true,
      trim: true,
    },
    status: {
      type: String,
      enum: Object.values(SUPPORT_REQUEST_STATUS),
      default: SUPPORT_REQUEST_STATUS.OPEN,
      index: true,
    },
    adminNotes: {
      type: String,
      default: '',
    },
    metadata: {
      type: Object,
      default: {},
    },
  },
  { timestamps: true }
);

const SupportRequest =
  mongoose.models.SupportRequest ||
  mongoose.model('SupportRequest', schema, 'support-requests');

export { SUPPORT_REQUEST_CATEGORY, SUPPORT_REQUEST_STATUS };
export default SupportRequest;
