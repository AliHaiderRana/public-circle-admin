import mongoose from 'mongoose';
import { MODELS, FEEDBACK_TYPE, FEEDBACK_STATUS } from '../constants';

const { ObjectId } = mongoose.Schema.Types;

const schema = new mongoose.Schema(
  {
    companyId: {
      type: ObjectId,
      required: true,
      index: true,
      ref: MODELS.COMPANY,
    },
    userId: {
      type: ObjectId,
      required: true,
      index: true,
      ref: MODELS.USER,
    },
    type: {
      type: String,
      enum: Object.values(FEEDBACK_TYPE),
      required: true,
      index: true,
    },
    message: {
      type: String,
      required: true,
      trim: true,
    },
    rating: {
      type: Number,
      min: 1,
      max: 5,
      default: null,
    },
    pagePath: {
      type: String,
      default: '',
      trim: true,
    },
    status: {
      type: String,
      enum: Object.values(FEEDBACK_STATUS),
      default: FEEDBACK_STATUS.NEW,
      index: true,
    },
    adminNotes: {
      type: String,
      default: '',
      trim: true,
    },
    metadata: {
      type: Object,
      default: {},
    },
  },
  { timestamps: true, collection: MODELS.PRODUCT_FEEDBACK },
);

schema.index({ createdAt: -1 });
schema.index({ status: 1, createdAt: -1 });

const Feedback =
  mongoose.models[MODELS.PRODUCT_FEEDBACK] ||
  mongoose.model(MODELS.PRODUCT_FEEDBACK, schema, MODELS.PRODUCT_FEEDBACK);

export default Feedback;
