import mongoose from 'mongoose';
import { MODELS } from '../constants';

export const TEMPLATE_CATEGORY_STATUS = {
  ACTIVE: 'ACTIVE',
  ARCHIVED: 'ARCHIVED',
} as const;

const schema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    slug: {
      type: String,
      required: true,
      index: true,
      trim: true,
      lowercase: true,
    },
    description: {
      type: String,
      default: '',
    },
    isPopular: {
      type: Boolean,
      default: false,
    },
    status: {
      type: String,
      enum: Object.values(TEMPLATE_CATEGORY_STATUS),
      default: TEMPLATE_CATEGORY_STATUS.ACTIVE,
      required: true,
      index: true,
    },
    deletedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

const TemplateCategory =
  mongoose.models[MODELS.TEMPLATE_CATEGORY] ||
  mongoose.model(MODELS.TEMPLATE_CATEGORY, schema, MODELS.TEMPLATE_CATEGORY);

export default TemplateCategory;
