import mongoose from 'mongoose';

const schema = new mongoose.Schema(
  {
    DlqLastProcessedAt: {
      type: Date,
      default: new Date(),
    },
    dlqAlertEmails: {
      type: [String],
      default: [],
    },
    dlqLastAlertedCount: {
      type: Number,
      default: 0,
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
    supportRequestsEnabled: {
      type: Boolean,
      default: true,
    },
    supportNotificationEmail: {
      type: String,
      default: null,
    },
    supportSendAlertEmail: {
      type: Boolean,
      default: true,
    },
    dlqSendAlertEmail: {
      type: Boolean,
      default: true,
    },
    dbSendAlertEmail: {
      type: Boolean,
      default: true,
    },
    /** Tracks whether the cluster is currently above the DB storage alert threshold, so the daily check emails once per crossing instead of every run. */
    dbAlertThresholdBreached: {
      type: Boolean,
      default: false,
    },
    supportSendDetailEmail: {
      type: Boolean,
      default: true,
    },
    supportSendCustomerConfirmation: {
      type: Boolean,
      default: false,
    },
    supportNotifySuperAdmins: {
      type: Boolean,
      default: true,
    },
    supportNotifyAdmins: {
      type: Boolean,
      default: true,
    },
    autoAssignSupportTicketsToReferralUsers: {
      type: Boolean,
      default: false,
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
    /** Public Circle API server base URL (managed in Integrations UI) */
    serverBaseUrl: { type: String, default: null },
  },
  { timestamps: true }
);

// In Next.js, we need to check if the model is already compiled
// Using 'app-configs' as the collection name to match existing DB
const AppConfig = mongoose.models.AppConfig || mongoose.model('AppConfig', schema, 'app-configs');

export default AppConfig;
