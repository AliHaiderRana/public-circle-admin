import mongoose from 'mongoose';
import { MODELS } from '../constants';

export const ADMIN_NOTIFICATION_TYPES = {
  CUSTOMER_REQUEST_CREATED: "CUSTOMER_REQUEST_CREATED",
};

const schema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: Object.values(ADMIN_NOTIFICATION_TYPES),
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      required: true,
      trim: true,
    },
    isRead: {
      type: Boolean,
      default: false,
      index: true,
    },
    readAt: {
      type: Date,
      default: null,
    },
    metadata: {
      type: Object,
      default: {},
    },
  },
  {
    timestamps: true,
  }
);

schema.index({ createdAt: -1 });

const AdminNotification = mongoose.models['admin-notifications'] || mongoose.model('admin-notifications', schema, 'admin-notifications');

export default AdminNotification;
