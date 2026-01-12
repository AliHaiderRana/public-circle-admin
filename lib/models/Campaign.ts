import mongoose from 'mongoose';
import { MODELS } from '../constants';

const { ObjectId } = mongoose.Schema.Types;

// Exact copy of server model
const schema = new mongoose.Schema(
  {
    company: {
      type: ObjectId,
      required: true,
      index: true,
      ref: MODELS.COMPANY,
    },
    segments: [{ type: ObjectId, ref: MODELS.SEGMENT }],
    sourceEmailAddress: {
      type: String,
      required: true,
    },
    emailSubject: {
      type: String,
      required: true,
    },
    emailTemplate: {
      type: ObjectId,
      required: true,
      ref: MODELS.TEMPLATE,
    },
    runMode: {
      type: String,
      required: true,
    },
    runSchedule: {
      type: Date,
    },
    isRecurring: {
      type: Boolean,
      default: false,
    },
    isOnGoing: {
      type: Boolean,
      default: false,
    },
    recurringPeriod: {
      type: String,
    },
    cronStatus: {
      type: String,
      default: 'PENDING',
    },
    lastProcessed: {
      type: Date,
    },
    processedCount: {
      type: Number,
      default: 0,
    },
    history: [{ type: Object }],
    frequency: {
      type: String,
      required: true,
      default: 'ONE_TIME',
    },
    status: {
      type: String,
      default: 'ACTIVE',
      required: true,
    },
    campaignCompanyId: {
      type: String,
      default: null,
    },
    campaignName: {
      type: String,
      required: true,
      default: null,
    },
    description: {
      type: String,
      default: null,
    },
    companyGroupingId: {
      type: ObjectId,
      required: true,
      index: true,
      ref: MODELS.COMPANY_GROUPING,
    },
    isArchived: {
      type: Boolean,
      default: false,
    },
    attachments: [{
      type: ObjectId,
      ref: MODELS.ATTACHMENT,
    }],
    cc: [{ type: String }],
    bcc: [{ type: String }],
  },
  { timestamps: true }
);

// Use exact same model creation as server (no explicit collection name)
const Campaign = mongoose.models.campaign || 
  mongoose.model('campaign', schema);

export default Campaign;
