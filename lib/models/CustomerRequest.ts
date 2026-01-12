import mongoose from 'mongoose';
import { MODELS, CUSTOMER_REQUEST_TYPE, CUSTOMER_REQUEST_STATUS } from '../constants';

const { ObjectId } = mongoose.Schema.Types;

const schema = new mongoose.Schema(
  {
    companyId: {
      type: ObjectId,
      required: true,
      index: true,
      ref: MODELS.COMPANY,
    },
    type: {
      type: String,
      enum: Object.values(CUSTOMER_REQUEST_TYPE),
      required: true,
      default: CUSTOMER_REQUEST_TYPE.DEDICATED_IP_ENABLED,
    },
    requestStatus: {
      type: String,
      enum: Object.values(CUSTOMER_REQUEST_STATUS),
      default: CUSTOMER_REQUEST_STATUS.PENDING,
    },
    reason: {
      type: String,
      default: "",
    },
    metadata: {
      type: Object,
      default: {},
    },
  },
  { timestamps: true }
);

const CustomerRequest = mongoose.models['customer-requests'] || mongoose.model(MODELS.CUSTOMER_REQUESTS, schema, MODELS.CUSTOMER_REQUESTS);

export default CustomerRequest;
