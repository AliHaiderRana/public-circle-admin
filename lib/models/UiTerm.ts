import mongoose from 'mongoose';
import { FE_CONSTANT_PATTERN, UI_TERM_KEY_PATTERN } from '@/lib/ui-term-constants';

const schema = new mongoose.Schema(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      validate: {
        validator: (v: string) => UI_TERM_KEY_PATTERN.test(v),
        message: 'Key must use dot notation (e.g. "audience.fields")',
      },
    },
    label: {
      type: String,
      required: true,
      trim: true,
    },
    feConstant: {
      type: String,
      trim: true,
      default: '',
      validate: {
        validator: (v: string) => !v || FE_CONSTANT_PATTERN.test(v),
        message: 'FE constant must be camelCase (e.g. "audienceFields")',
      },
    },
    descriptions: {
      type: Map,
      of: String,
      default: () => new Map(),
    },
  },
  { timestamps: true }
);

// Drop cached model so schema updates (enum → dot-notation validator) apply after hot reload
if (mongoose.models.UiTerm) {
  delete mongoose.models.UiTerm;
}
if (mongoose.modelNames().includes('UiTerm')) {
  mongoose.deleteModel('UiTerm');
}

const UiTerm = mongoose.model('UiTerm', schema, 'ui-terms');

export default UiTerm;
