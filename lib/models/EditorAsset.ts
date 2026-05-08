import mongoose, { Document, Model, Schema, Types } from 'mongoose';

export const EDITOR_ASSET_STATUS = {
  ACTIVE: 'ACTIVE',
  INACTIVE: 'INACTIVE',
} as const;

type EditorAssetStatus = (typeof EDITOR_ASSET_STATUS)[keyof typeof EDITOR_ASSET_STATUS];

export interface IEditorAsset extends Document {
  _id: Types.ObjectId;
  name: string;
  key: string;
  url: string;
  status: EditorAssetStatus;
  createdBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const EditorAssetSchema = new Schema<IEditorAsset>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    key: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    url: {
      type: String,
      required: true,
      trim: true,
    },
    status: {
      type: String,
      enum: Object.values(EDITOR_ASSET_STATUS),
      default: EDITOR_ASSET_STATUS.INACTIVE,
      index: true,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'AdminUser',
      default: null,
    },
  },
  { timestamps: true }
);

const EditorAsset: Model<IEditorAsset> =
  (mongoose.models.EditorAsset as Model<IEditorAsset>) ||
  mongoose.model<IEditorAsset>('EditorAsset', EditorAssetSchema);

export default EditorAsset;

