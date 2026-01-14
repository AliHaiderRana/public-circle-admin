import mongoose from 'mongoose';

const schema = new mongoose.Schema(
  {
    // Unique identifier for the cron job
    name: { type: String, required: true, unique: true },
    // Human-readable display name
    displayName: { type: String, required: true },
    // Cron expression (e.g., "*/1 * * * *")
    schedule: { type: String, required: true },
    // Description of what the cron does
    description: { type: String, default: "" },
    // Last time this cron was executed
    lastRunAt: { type: Date, default: null },
    // Number of records updated in the last run
    lastRecordsUpdated: { type: Number, default: 0 },
    // Whether the cron is enabled
    isEnabled: { type: Boolean, default: true },
    // Duration of last run in milliseconds
    lastDurationMs: { type: Number, default: null },
    // Last error message (if any)
    lastError: { type: String, default: null },
  },
  { timestamps: true }
);

const CronMetadata = mongoose.models['cron-metadata'] || mongoose.model('cron-metadata', schema);

export default CronMetadata;
