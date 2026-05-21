import mongoose from 'mongoose';
import { UI_TERM_KEYS } from '@/lib/ui-term-constants';

const descriptionsSchema = new mongoose.Schema(
  {
    'en-US': { type: String, required: true, trim: true },
    'en-GB': { type: String, required: true, trim: true },
    'en-CA': { type: String, required: true, trim: true },
    fr: { type: String, required: true, trim: true },
  },
  { _id: false }
);

const schema = new mongoose.Schema(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      enum: UI_TERM_KEYS,
    },
    label: {
      type: String,
      required: true,
      trim: true,
    },
    descriptions: {
      type: descriptionsSchema,
      required: true,
    },
  },
  { timestamps: true }
);

const UiTerm =
  mongoose.models.UiTerm || mongoose.model('UiTerm', schema, 'ui-terms');

export default UiTerm;
