import mongoose from 'mongoose';
import { MODELS } from '../constants';

export const PLAN_COLLECTION = 'plans';

export type PlanQuota = {
  project: number;
  email: number;
  bandwidth: number;
  contact: number;
};

const toQuotaNumber = (value: unknown): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const quotaSchema = new mongoose.Schema(
  {
    project: { type: Number, required: true, default: 2 },
    email: { type: Number, required: true, default: 0 },
    // Stored as string in some legacy docs (e.g. "5000000000")
    bandwidth: { type: mongoose.Schema.Types.Mixed, required: true, default: 0 },
    contact: { type: Number, required: true, default: 0 },
  },
  { _id: false },
);

const schema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    quota: { type: quotaSchema, required: true },
    bundles: { type: mongoose.Schema.Types.Mixed },
    priceInSmallestUnit: { type: Number },
    currency: { type: String },
    currencySymbol: { type: String },
  },
  { timestamps: true },
);

const existing = mongoose.models[MODELS.PLAN] as mongoose.Model<unknown> | undefined;
if (existing && existing.collection.name !== PLAN_COLLECTION) {
  delete mongoose.models[MODELS.PLAN];
}

const Plan =
  mongoose.models[MODELS.PLAN] ||
  mongoose.model(MODELS.PLAN, schema, PLAN_COLLECTION);

export function normalizePlanQuota(quota: Record<string, unknown> | null | undefined): PlanQuota {
  return {
    project: toQuotaNumber(quota?.project),
    email: toQuotaNumber(quota?.email),
    bandwidth: toQuotaNumber(quota?.bandwidth),
    contact: toQuotaNumber(quota?.contact),
  };
}

export default Plan;
