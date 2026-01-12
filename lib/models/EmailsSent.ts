import mongoose from 'mongoose';
import { MODELS } from '../constants';

const { ObjectId } = mongoose.Schema.Types;

// Exact copy of server model
const schema = new mongoose.Schema(
  {
    company: {
      type: ObjectId,
      index: true,
      ref: MODELS.COMPANY,
    },
    campaign: {
      type: ObjectId,
      index: true,
      ref: MODELS.CAMPAIGN,
    },
    campaignRun: {
      type: ObjectId,
      index: true,
      ref: MODELS.CAMPAIGN_RUN,
    },
    kind: {
      type: String,
      required: true,
    },
    fromEmailAddress: {
      type: String,
      required: true,
    },
    toEmailAddress: {
      type: String,
      required: true,
    },
    recipientType: {
      type: String,
      default: 'TO',
    },
    emailSubject: {
      type: String,
      required: true,
    },
    size: {
      type: Number,
      required: true,
      default: 0,
    },
    sesMessageId: {
      type: String,
      default: null,
    },
    emailEvents: {
      type: Object,
      default: {},
    },
    isEmailResent: {
      type: Boolean,
      default: false,
    },
    parentEmailId: {
      type: ObjectId,
      default: null,
    },
    parentToEmailId: {
      type: ObjectId,
      default: null,
      index: true,
    },
    emailSendType: {
      type: String,
      required: true,
      default: 'PLATFORM_EMAIL',
    }
  },
  { timestamps: true }
);

// Add the exact same indexes as server
schema.index({ campaignRun: 1, createdAt: -1 });
schema.index({ campaign: 1, createdAt: -1 });
schema.index({ company: 1, createdAt: -1 });
schema.index({ createdAt: -1 });

// Use correct collection name that has data, explicitly set collection name
const EmailsSent = mongoose.models['emails-sent'] || 
  mongoose.model('emails-sent', schema, 'emails-sent');

export default EmailsSent;
