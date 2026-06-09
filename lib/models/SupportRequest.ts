import mongoose from 'mongoose';
import { MODELS } from '../constants';

const SUPPORT_REQUEST_CATEGORY = {
  GENERAL: 'GENERAL',
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
  PENDING_RESOLUTION: 'PENDING_RESOLUTION',
  RESOLVED: 'RESOLVED',
  CLOSED: 'CLOSED',
} as const;

const assignmentHistorySchema = new mongoose.Schema(
  {
    adminId: { type: mongoose.Schema.Types.ObjectId, required: true },
    adminName: { type: String, default: '' },
    assignedByAdminId: { type: mongoose.Schema.Types.ObjectId, required: true },
    assignedByName: { type: String, default: '' },
    previousAdminId: { type: mongoose.Schema.Types.ObjectId, default: null },
    previousAdminName: { type: String, default: '' },
    note: { type: String, default: '' },
    anchorMessageId: { type: mongoose.Schema.Types.ObjectId, default: null },
    anchorMessageAt: { type: Date, default: null },
    anchorMessagePreview: { type: String, default: '' },
    assignedAt: { type: Date, default: Date.now },
  },
  { _id: true },
);

const statusHistorySchema = new mongoose.Schema(
  {
    fromStatus: { type: String, default: null },
    toStatus: { type: String, required: true },
    actorType: { type: String, enum: ['USER', 'ADMIN', 'SYSTEM'], required: true },
    actorId: { type: mongoose.Schema.Types.ObjectId, default: null },
    actorName: { type: String, default: '' },
    note: { type: String, default: '' },
    changedAt: { type: Date, default: Date.now },
  },
  { _id: true },
);

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
    assignedAdminId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
      index: true,
    },
    assignedAdminName: {
      type: String,
      default: '',
    },
    assignmentHistory: {
      type: [assignmentHistorySchema],
      default: [],
    },
    statusHistory: {
      type: [statusHistorySchema],
      default: [],
    },
    unreadByAdmin: {
      type: Number,
      default: 0,
    },
    unreadByCompany: {
      type: Number,
      default: 0,
    },
    lastMessageAt: {
      type: Date,
      default: null,
      index: true,
    },
    lastMessagePreview: {
      type: String,
      default: '',
    },
    messageCount: {
      type: Number,
      default: 0,
    },
    lastAdminReplyName: {
      type: String,
      default: '',
    },
    lastAdminReplyAt: {
      type: Date,
      default: null,
    },
    pendingResolutionAt: {
      type: Date,
      default: null,
    },
    autoResolveAt: {
      type: Date,
      default: null,
      index: true,
    },
    lastReopenReason: {
      type: String,
      default: '',
    },
    metadata: {
      type: Object,
      default: {},
    },
  },
  { timestamps: true },
);

const SupportRequest =
  mongoose.models.SupportRequest ||
  mongoose.model('SupportRequest', schema, 'support-requests');

export { SUPPORT_REQUEST_CATEGORY, SUPPORT_REQUEST_STATUS };
export default SupportRequest;
