import mongoose from 'mongoose';

const schema = new mongoose.Schema(
  {
    version: { type: String, required: true, unique: true },
    date: { type: String, required: true },
    features: { type: [String], default: [] },
    fixes: { type: [String], default: [] },
    improvements: { type: [String], default: [] },
    isPublished: { type: Boolean, default: true },
  },
  { timestamps: true, collection: 'changelogs' }
);

export default mongoose.models.Changelog || mongoose.model('Changelog', schema);
