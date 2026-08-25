import mongoose, { type Document, type Model, type Types } from 'mongoose';
import { MODELS, FEEDBACK_TYPE, FEEDBACK_STATUS } from '../constants';

const { ObjectId } = mongoose.Schema.Types;

export interface IFeedback extends Document {
  _id: Types.ObjectId;
  companyId: Types.ObjectId;
  userId: Types.ObjectId;
  type: (typeof FEEDBACK_TYPE)[keyof typeof FEEDBACK_TYPE];
  message: string;
  rating: number | null;
  pagePath: string;
  status: (typeof FEEDBACK_STATUS)[keyof typeof FEEDBACK_STATUS];
  adminNotes: string;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

const schema = new mongoose.Schema<IFeedback>(
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
schema.index({ updatedAt: -1 });
schema.index({ status: 1, createdAt: -1 });
schema.index({ status: 1, updatedAt: -1 });

const Feedback: Model<IFeedback> =
  (mongoose.models[MODELS.PRODUCT_FEEDBACK] as Model<IFeedback>) ||
  mongoose.model<IFeedback>(MODELS.PRODUCT_FEEDBACK, schema, MODELS.PRODUCT_FEEDBACK);

export default Feedback;
