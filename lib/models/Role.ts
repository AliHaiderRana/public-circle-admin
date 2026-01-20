import mongoose from 'mongoose';
import { MODELS } from '../constants';

const schema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    description: { type: String },
    permissions: [{ type: String }],
  },
  { timestamps: true }
);

const Role = mongoose.models.role || mongoose.model(MODELS.ROLE, schema);

export default Role;
