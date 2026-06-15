import mongoose from 'mongoose';
import { MODELS } from '../constants';

const { ObjectId } = mongoose.Schema.Types;

export const TEMPLATE_STATUS = {
  ACTIVE: 'ACTIVE',
  ARCHIVED: 'ARCHIVED',
} as const;

export const TEMPLATE_KINDS = {
  REGULAR: 'REGULAR',
  SAMPLE: 'SAMPLE',
} as const;

export const TEMPLATE_SOURCE = {
  SCRATCH: 'SCRATCH',
  HTML_FILE_IMPORT: 'HTML_FILE_IMPORT',
  HTML_CODE_IMPORT: 'HTML_CODE_IMPORT',
  SAMPLE_TEMPLATE: 'SAMPLE_TEMPLATE',
  DUPLICATED_TEMPLATE: 'DUPLICATED_TEMPLATE',
  SAVES_AS_TEMPLATE: 'SAVES_AS_TEMPLATE',
} as const;

const schema = new mongoose.Schema(
  {
    company: {
      type: ObjectId,
      index: true,
      ref: MODELS.COMPANY,
      default: null,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      default: null,
    },
    kind: {
      type: String,
      required: true,
      enum: Object.values(TEMPLATE_KINDS),
    },
    body: {
      type: String,
      required: true,
    },
    size: {
      type: Number,
      required: true,
    },
    sizeUnit: {
      type: String,
      required: true,
      default: 'Bytes',
    },
    thumbnailURL: {
      type: String,
      required: true,
    },
    category: {
      type: ObjectId,
      ref: MODELS.TEMPLATE_CATEGORY,
      default: null,
    },
    categories: {
      type: [ObjectId],
      ref: MODELS.TEMPLATE_CATEGORY,
      default: [],
    },
    jsonTemplate: {
      type: Object,
      required: false,
      default: {},
    },
    status: {
      type: String,
      enum: Object.values(TEMPLATE_STATUS),
      default: TEMPLATE_STATUS.ACTIVE,
      required: true,
      index: true,
    },
    isDuplicate: {
      type: Boolean,
      default: false,
    },
    existingTemplateId: {
      type: ObjectId,
      ref: MODELS.TEMPLATE,
      default: null,
    },
    updatedBy: {
      type: ObjectId,
      ref: 'AdminUser',
      index: true,
      default: null,
    },
    companyGroupingId: {
      type: ObjectId,
      required: false,
      index: true,
      ref: MODELS.COMPANY_GROUPING,
      default: null,
    },
    templateSource: {
      type: String,
      enum: Object.values(TEMPLATE_SOURCE),
      default: TEMPLATE_SOURCE.SAMPLE_TEMPLATE,
    },
    deletedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

const Template =
  mongoose.models.template || mongoose.model('template', schema);

export default Template;
