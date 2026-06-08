import mongoose from 'mongoose';

const schema = new mongoose.Schema(
  {
    DlqLastProcessedAt: {
      type: Date,
      default: new Date(),
    },
    appleRelayEmail: {
      type: String,
      default: null,
    },
    deleteCompanyContactsAfterDays: {
      type: Number,
      default: 7,
    },
    isSignupAllowed: {
      type: Boolean,
      default: true,
    },
    supportAlertEmails: {
      type: [String],
      default: [],
    },
    supportDetailEmails: {
      type: [String],
      default: [],
    },
    /** Shared with API server for admin-panel impersonation auth */
    adminJwtSecret: { type: String, default: null },
    /** Optional override for internal API routes (crons, impersonate) */
    internalApiKey: { type: String, default: null },
    /** Optional — must match API ACCESS_TOKEN_SECRET for local token minting */
    accessTokenSecret: { type: String, default: null },
  },
  { timestamps: true }
);

// In Next.js, we need to check if the model is already compiled
// Using 'app-configs' as the collection name to match existing DB
const AppConfig = mongoose.models.AppConfig || mongoose.model('AppConfig', schema, 'app-configs');

export default AppConfig;
