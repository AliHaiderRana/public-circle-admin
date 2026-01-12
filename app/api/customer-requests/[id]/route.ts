import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import CustomerRequest from '@/lib/models/CustomerRequest';
import Company from '@/lib/models/Company';
import { CUSTOMER_REQUEST_STATUS, CUSTOMER_REQUEST_TYPE } from '@/lib/constants';
import { getServerSession } from '@/lib/auth';

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const { status } = await request.json();

  if (!Object.values(CUSTOMER_REQUEST_STATUS).includes(status)) {
    return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
  }

  await dbConnect();

  try {
    // Ensure models are registered
    const _Company = Company;
    const _CustomerRequest = CustomerRequest;

    const custRequest = await CustomerRequest.findById(id);
    if (!custRequest) {
      return NextResponse.json({ error: 'Request not found' }, { status: 404 });
    }

    custRequest.requestStatus = status;
    await custRequest.save();

    if (status === CUSTOMER_REQUEST_STATUS.COMPLETED) {
      const company = await Company.findById(custRequest.companyId);
      if (company) {
        switch (custRequest.type) {
          case CUSTOMER_REQUEST_TYPE.EDIT_CONTACTS_PRIMARY_KEY:
            company.isContactPrimaryKeyLocked = false;
            break;
          case CUSTOMER_REQUEST_TYPE.EDIT_CONTACTS_EMAIL_KEY:
            company.isContactEmailLocked = false;
            break;
          case CUSTOMER_REQUEST_TYPE.EDIT_CONTACTS_FILTERS:
            company.isContactFilterLocked = false;
            break;
        }
        
        // Handle validation for SES status fields - set to HEALTHY if invalid value exists
        if (company.sesBounceStatus && !['HEALTHY', 'WARNING', 'RISK'].includes(company.sesBounceStatus)) {
          company.sesBounceStatus = 'HEALTHY';
        }
        if (company.sesComplaintStatus && !['HEALTHY', 'WARNING', 'RISK'].includes(company.sesComplaintStatus)) {
          company.sesComplaintStatus = 'HEALTHY';
        }
        
        await company.save();
      }
    }

    return NextResponse.json(custRequest);
  } catch (error) {
    console.error('Error updating customer request:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
