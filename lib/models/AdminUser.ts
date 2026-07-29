import mongoose from 'mongoose';

const schema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
    },
    password: {
      type: String,
      required: true,
    },
    name: {
      type: String,
      required: false,
    },
    isSuperAdmin: {
      type: Boolean,
      default: false,
    },
    notificationPreferences: {
      supportEmail: {
        type: Boolean,
        default: true,
      },
      supportAlertEmail: {
        type: Boolean,
        default: true,
      },
      dlqAlertEmail: {
        type: Boolean,
        default: true,
      },
      dbAlertEmail: {
        type: Boolean,
        default: true,
      },
      supportDetailEmail: {
        type: Boolean,
        default: true,
      },
      supportInApp: {
        type: Boolean,
        default: true,
      },
    },
  },
  { timestamps: true }
);

const AdminUser = mongoose.models.AdminUser || mongoose.model('AdminUser', schema);

export default AdminUser;
