import mongoose from 'mongoose';
import { UI_TERM_KEYS } from '@/lib/ui-term-constants';

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
      type: Map,
      of: String,
      default: () => new Map(),
    },
  },
  { timestamps: true }
);

const UiTerm =
  mongoose.models.UiTerm || mongoose.model('UiTerm', schema, 'ui-terms');

export default UiTerm;
