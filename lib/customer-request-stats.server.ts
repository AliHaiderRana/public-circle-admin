import dbConnect from '@/lib/db';
import CustomerRequest from '@/lib/models/CustomerRequest';
import { CUSTOMER_REQUEST_STATUS, CUSTOMER_REQUEST_TYPE } from '@/lib/constants';

const CUSTOMER_REQUEST_SIDEBAR_TYPES = [
  CUSTOMER_REQUEST_TYPE.EDIT_CONTACTS_PRIMARY_KEY,
  CUSTOMER_REQUEST_TYPE.EDIT_CONTACTS_EMAIL_KEY,
  CUSTOMER_REQUEST_TYPE.EDIT_CONTACTS_FILTERS,
  CUSTOMER_REQUEST_TYPE.DEDICATED_IP_ENABLED,
  CUSTOMER_REQUEST_TYPE.DEDICATED_IP_DISABLED,
];

export async function getPendingCustomerRequestsCount(): Promise<number> {
  await dbConnect();
  return CustomerRequest.countDocuments({
    type: { $in: CUSTOMER_REQUEST_SIDEBAR_TYPES },
    requestStatus: CUSTOMER_REQUEST_STATUS.PENDING,
  });
}
