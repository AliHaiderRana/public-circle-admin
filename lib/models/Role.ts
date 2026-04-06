import mongoose from 'mongoose';
import { MODELS } from '../constants';

const schema = new mongoose.Schema(
  {
    name: { type: String, index: true, required: true },
    description: { type: String },
    permissions: [{ type: String }],
    status: { type: String, default: 'ACTIVE' },
  },
  { timestamps: true }
);

const Role = mongoose.models[MODELS.ROLE] || mongoose.model(MODELS.ROLE, schema);

export default Role;
