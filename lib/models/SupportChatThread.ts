import mongoose from 'mongoose';
import { MODELS } from '../constants';
import { SUPPORT_CHAT_SENDER_TYPE } from '../constants';

const schema = new mongoose.Schema(
  {
    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: MODELS.COMPANY,
      required: true,
      unique: true,
      index: true,
    },
    lastMessageAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    lastMessagePreview: {
      type: String,
      default: '',
    },
    unreadByAdmin: {
      type: Number,
      default: 0,
    },
    unreadByCompany: {
      type: Number,
      default: 0,
    },
    messageCount: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true },
);

const SupportChatThread =
  mongoose.models.SupportChatThread ||
  mongoose.model('SupportChatThread', schema, 'support-chat-threads');

const supportChatMessageSchema = new mongoose.Schema(
  {
    threadId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'SupportChatThread',
      required: true,
      index: true,
    },
    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: MODELS.COMPANY,
      required: true,
      index: true,
    },
    senderType: {
      type: String,
      enum: Object.values(SUPPORT_CHAT_SENDER_TYPE),
      required: true,
    },
    senderUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: MODELS.USER,
      default: null,
    },
    senderAdminId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },
    senderName: {
      type: String,
      required: true,
      trim: true,
    },
    message: {
      type: String,
      required: true,
      trim: true,
    },
  },
  { timestamps: true },
);

supportChatMessageSchema.index({ companyId: 1, createdAt: -1 });

const SupportChatMessage =
  mongoose.models.SupportChatMessage ||
  mongoose.model('SupportChatMessage', supportChatMessageSchema, 'support-chat-messages');

export default SupportChatThread;
export { SupportChatMessage };
