import mongoose from 'mongoose';

const changelogItemSchema = new mongoose.Schema(
  {
    text: { type: String, required: true },
    commitSha: { type: String, default: null },
    commitAuthor: { type: String, default: null },
    commitAuthorEmail: { type: String, default: null },
    commitDate: { type: String, default: null },
  },
  { _id: false }
);

const schema = new mongoose.Schema(
  {
    version: { type: String, required: true, unique: true },
    date: { type: String, required: true },
    features: { type: [changelogItemSchema], default: [] },
    fixes: { type: [changelogItemSchema], default: [] },
    improvements: { type: [changelogItemSchema], default: [] },
    isPublished: { type: Boolean, default: true },
    branch: { type: String, default: null },
    environment: { type: String, default: null },
    commitSha: { type: String, default: null },
    commitAuthor: { type: String, default: null },
    commitAuthorEmail: { type: String, default: null },
    totalCommits: { type: Number, default: null },
    deployUrl: { type: String, default: null },
    syncSource: { type: String, enum: ['auto', 'manual'], default: 'manual' },
  },
  { timestamps: true, collection: 'changelogs' }
);

export default mongoose.models.Changelog || mongoose.model('Changelog', schema);
