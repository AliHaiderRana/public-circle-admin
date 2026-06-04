import mongoose from 'mongoose';

const schema = new mongoose.Schema(
  {
    adminId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'AdminUser',
      required: true,
      index: true,
    },
    adminEmail: { type: String, required: true, index: true },
    adminName: { type: String, default: '' },
    actorWasSuperAdmin: { type: Boolean, default: false },
    action: { type: String, required: true, index: true },
    category: { type: String, required: true, index: true },
    resourceType: { type: String, default: null },
    resourceId: { type: String, default: null },
    summary: { type: String, required: true },
    details: { type: mongoose.Schema.Types.Mixed, default: null },
  },
  { timestamps: true, collection: 'admin-activities' }
);

schema.index({ createdAt: -1 });

const AdminActivity =
  mongoose.models.AdminActivity ||
  mongoose.model('AdminActivity', schema, 'admin-activities');

export default AdminActivity;
