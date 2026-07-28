import mongoose from 'mongoose';

const stripeSubscriptionItemSchema = new mongoose.Schema(
  {
    priceId: { type: String, default: null },
    productName: { type: String, default: null },
    amount: { type: Number, default: null },
    currency: { type: String, default: null },
    interval: { type: String, default: null },
    quantity: { type: Number, default: 1 },
  },
  { _id: false }
);

const stripeSubscriptionSchema = new mongoose.Schema(
  {
    originalSubscriptionId: { type: String, required: true },
    status: { type: String, required: true },
    items: { type: [stripeSubscriptionItemSchema], default: [] },
  },
  { _id: false }
);

const dbCollectionSchema = new mongoose.Schema(
  {
    collectionName: { type: String, required: true },
    field: { type: String, required: true },
    count: { type: Number, default: 0 },
  },
  { _id: false }
);

const schema = new mongoose.Schema(
  {
    companyId: { type: String, required: true, index: true },
    companyName: { type: String, required: true },
    companyStatus: { type: String, default: null },
    archivedAt: { type: Date, required: true },
    archivedBy: { type: String, required: true },
    backupBucket: { type: String, required: true },
    backupPrefix: { type: String, required: true },
    dbCollections: { type: [dbCollectionSchema], default: [] },
    awsObjectCount: { type: Number, default: 0 },
    awsBytes: { type: Number, default: 0 },
    stripeCustomerId: { type: String, default: null },
    stripeSubscriptions: { type: [stripeSubscriptionSchema], default: [] },
    status: {
      type: String,
      enum: ['archived', 'restored', 'restore_failed'],
      default: 'archived',
    },
    restoredAt: { type: Date, default: null },
    restoredBy: { type: String, default: null },
    restoreErrors: { type: [String], default: [] },
  },
  { timestamps: true }
);

const ArchivedCompany =
  mongoose.models.ArchivedCompany ||
  mongoose.model('ArchivedCompany', schema, 'archived-companies');

export default ArchivedCompany;
