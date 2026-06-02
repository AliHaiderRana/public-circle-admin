import mongoose from 'mongoose';

const schema = new mongoose.Schema(
  {
    code: { type: String, required: true, unique: true, trim: true },
    label: { type: String, required: true, trim: true },
    short: { type: String, required: true, trim: true, maxlength: 6 },
    enabled: { type: Boolean, default: true },
    isDefault: { type: Boolean, default: false },
  },
  { timestamps: true }
);

const SupportedLocale =
  mongoose.models.SupportedLocale ||
  mongoose.model('SupportedLocale', schema, 'supported-locales');

export default SupportedLocale;
