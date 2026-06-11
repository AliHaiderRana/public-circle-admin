import mongoose from 'mongoose';

const CRON_HISTORY_STATUS = {
  SUCCESS: 'SUCCESS',
  FAILED: 'FAILED',
} as const;

const schema = new mongoose.Schema(
  {
    cronName: { type: String, required: true, index: true },
    startTime: { type: Date, required: true },
    endTime: { type: Date },
    duration: { type: Number },
    recordsUpdated: { type: Number, default: 0 },
    status: {
      type: String,
      enum: Object.values(CRON_HISTORY_STATUS),
      required: true,
    },
    error: { type: String, default: null },
    errorStack: { type: String, default: null },
    metadata: { type: mongoose.Schema.Types.Mixed, default: null },
  },
  { timestamps: true, collection: 'cron-histories' }
);

schema.index({ cronName: 1, createdAt: -1 });

const CronHistory =
  mongoose.models.CronHistory ||
  mongoose.model('CronHistory', schema, 'cron-histories');

export { CRON_HISTORY_STATUS };
export default CronHistory;
