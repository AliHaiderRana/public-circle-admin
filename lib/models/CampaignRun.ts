import mongoose from 'mongoose';
import { MODELS } from '../constants';

const { ObjectId } = mongoose.Schema.Types;

const schema = new mongoose.Schema(
  {
    campaign: { type: ObjectId, ref: MODELS.CAMPAIGN, required: true },
    company: { type: ObjectId, ref: MODELS.COMPANY, required: true },
    isDataStoredOnWarehouse: { type: Boolean, required: true, default: false },
  },
  { timestamps: true }
);

const CampaignRun = mongoose.models['campaign-run'] || mongoose.model(MODELS.CAMPAIGN_RUN, schema);

export default CampaignRun;
