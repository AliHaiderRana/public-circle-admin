import mongoose from 'mongoose';

const schema = new mongoose.Schema(
  {
    sessionId: { type: String, required: true, index: true },
    type: {
      type: String,
      enum: ['SESSION_START', 'SESSION_END', 'API_REQUEST', 'CLIENT_ACTION'],
      required: true,
      index: true,
    },
    adminEmail: { type: String, required: true, index: true },
    adminName: { type: String, default: '' },
    impersonatedUserId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      index: true,
    },
    impersonatedUserEmail: { type: String, required: true },
    companyId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
    method: { type: String, default: null },
    path: { type: String, default: null },
    summary: { type: String, default: null },
    statusCode: { type: Number, default: null },
    projectId: { type: String, default: null },
    requestBody: { type: mongoose.Schema.Types.Mixed, default: null },
    query: { type: mongoose.Schema.Types.Mixed, default: null },
    metadata: { type: mongoose.Schema.Types.Mixed, default: null },
  },
  { timestamps: true, collection: 'admin-impersonation-activities' }
);

schema.index({ createdAt: -1 });

const AdminImpersonationActivity =
  mongoose.models.AdminImpersonationActivity ||
  mongoose.model('AdminImpersonationActivity', schema, 'admin-impersonation-activities');

export default AdminImpersonationActivity;
