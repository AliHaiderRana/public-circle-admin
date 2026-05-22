import mongoose from 'mongoose';

const schema = new mongoose.Schema(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },
    values: {
      type: Map,
      of: String,
      required: true,
    },
  },
  { timestamps: true }
);

const Translation =
  mongoose.models.Translation ||
  mongoose.model('Translation', schema, 'translations');

export default Translation;
