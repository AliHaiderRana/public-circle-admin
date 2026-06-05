import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import mongoose from 'mongoose';
import dbConnect from '@/lib/db';
import CustomerRequest from '@/lib/models/CustomerRequest';
import Company from '@/lib/models/Company';
import { CUSTOMER_REQUEST_STATUS, CUSTOMER_REQUEST_TYPE } from '@/lib/constants';
import { getServerSession, toAdminAuditSession } from '@/lib/auth';
import {
  logAdminActivity,
  ADMIN_AUDIT_ACTION,
  ADMIN_AUDIT_CATEGORY,
} from '@/lib/admin-audit';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string);

const CONTACT_UNLOCK_FIELDS: Partial<
  Record<
    (typeof CUSTOMER_REQUEST_TYPE)[keyof typeof CUSTOMER_REQUEST_TYPE],
    Record<string, boolean>
  >
> = {
  [CUSTOMER_REQUEST_TYPE.EDIT_CONTACTS_PRIMARY_KEY]: {
    isContactPrimaryKeyLocked: false,
  },
  [CUSTOMER_REQUEST_TYPE.EDIT_CONTACTS_EMAIL_KEY]: {
    isContactEmailLocked: false,
  },
  [CUSTOMER_REQUEST_TYPE.EDIT_CONTACTS_FILTERS]: {
    isContactFilterLocked: false,
  },
};

async function unlockContactConfigForCompany(
  companyId: mongoose.Types.ObjectId | string,
  type: string,
  projectId?: string | null,
) {
  const unlockFields = CONTACT_UNLOCK_FIELDS[type as keyof typeof CONTACT_UNLOCK_FIELDS];
  if (!unlockFields) return;

  const companyObjectId =
    companyId instanceof mongoose.Types.ObjectId
      ? companyId
      : new mongoose.Types.ObjectId(String(companyId));

  const projectsCollection = mongoose.connection.collection('projects');

  if (projectId && mongoose.Types.ObjectId.isValid(projectId)) {
    await projectsCollection.updateOne(
      { _id: new mongoose.Types.ObjectId(projectId), companyId: companyObjectId },
      { $set: unlockFields },
    );
  }

  const projectResult = await projectsCollection.updateMany(
    { companyId: companyObjectId },
    { $set: unlockFields },
  );

  if (projectResult.matchedCount === 0) {
    console.warn(
      `[customer-requests] No projects matched unlock for company ${String(companyId)} (${type})`,
    );
  }

  // Legacy company-level fields (pre project migration); project rows are canonical.
  await Company.updateOne({ _id: companyObjectId }, { $set: unlockFields });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
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
    void Company; void CustomerRequest; // ensure models registered

    const custRequest = await CustomerRequest.findById(id);
    if (!custRequest) {
      return NextResponse.json({ error: 'Request not found' }, { status: 404 });
    }

    const previousStatus = custRequest.requestStatus;
    custRequest.requestStatus = status;
    await custRequest.save();

    if (status === CUSTOMER_REQUEST_STATUS.COMPLETED) {
      const company = await Company.findById(custRequest.companyId);
      if (company) {
        const requestProjectId =
          typeof custRequest.metadata?.projectId === 'string'
            ? custRequest.metadata.projectId
            : null;

        switch (custRequest.type) {
          case CUSTOMER_REQUEST_TYPE.EDIT_CONTACTS_PRIMARY_KEY:
          case CUSTOMER_REQUEST_TYPE.EDIT_CONTACTS_EMAIL_KEY:
          case CUSTOMER_REQUEST_TYPE.EDIT_CONTACTS_FILTERS:
            await unlockContactConfigForCompany(
              company._id,
              custRequest.type,
              requestProjectId,
            );
            break;
          case CUSTOMER_REQUEST_TYPE.DEDICATED_IP_ENABLED:
            company.hasDedicatedIp = true;
            break;
          case CUSTOMER_REQUEST_TYPE.DEDICATED_IP_DISABLED: {
            company.hasDedicatedIp = false;
            // Remove dedicated IP add-on from Stripe and issue prorated refund
            if (company.stripeCustomerId) {
              try {
                const stripeCustomerId = company.stripeCustomerId as string;

                // Get active subscription with expanded product names
                const subscriptions = await stripe.subscriptions.list({
                  customer: stripeCustomerId,
                  status: 'active',
                  limit: 5,
                  expand: ['data.items.data.price'],
                });

                for (const sub of subscriptions.data) {
                  let dedicatedItem: any = null;
                  for (const item of sub.items.data) {
                    const productId = (item.price as any)?.product;
                    if (!productId) continue;
                    const product = await stripe.products.retrieve(productId as string);
                    if (product.name.toLowerCase().includes('dedicated')) {
                      dedicatedItem = item;
                      break;
                    }
                  }

                  if (!dedicatedItem) continue;

                  // Remove item with proration — always_invoice creates an immediate
                  // invoice so the credit lands on the customer balance right away
                  await stripe.subscriptions.update(sub.id, {
                    items: [{ id: dedicatedItem.id, deleted: true }],
                    proration_behavior: 'always_invoice',
                  });

                  // Refund the credit back to the original payment method
                  const customer = await stripe.customers.retrieve(stripeCustomerId) as any;
                  let balance: number = customer.balance ?? 0;

                  if (balance < 0) {
                    const invoices = await stripe.invoices.list({
                      subscription: sub.id,
                      status: 'paid',
                    });

                    const paidWithCharge = invoices.data.filter((inv: any) => (inv as any).charge);

                    const refunds: Promise<any>[] = [];
                    for (const invoice of paidWithCharge) {
                      if (Math.abs(balance) <= 0) break;
                      const charge = await stripe.charges.retrieve((invoice as any).charge as string) as any;
                      const refundable = charge.amount - charge.amount_refunded;
                      if (refundable > 0) {
                        const refundAmount = Math.min(refundable, Math.abs(balance));
                        refunds.push(stripe.refunds.create({ charge: charge.id, amount: refundAmount }));
                        balance += refundAmount;
                      }
                    }

                    await Promise.all(refunds);

                    // Zero out the customer balance after refunding
                    await stripe.customers.update(stripeCustomerId, { balance: 0 });
                  }

                  break;
                }
              } catch (stripeErr) {
                console.error('Stripe update failed for DEDICATED_IP_DISABLED:', stripeErr);
              }
            }
            break;
          }
        }

        // Sanitise SES status enum fields
        if (company.sesBounceStatus && !['HEALTHY', 'WARNING', 'RISK'].includes(company.sesBounceStatus)) {
          company.sesBounceStatus = 'HEALTHY';
        }
        if (company.sesComplaintStatus && !['HEALTHY', 'WARNING', 'RISK'].includes(company.sesComplaintStatus)) {
          company.sesComplaintStatus = 'HEALTHY';
        }

        await company.save();
      }
    }

    const auditSession = toAdminAuditSession(session);
    if (auditSession) {
      await logAdminActivity(auditSession, {
        action: ADMIN_AUDIT_ACTION.CUSTOMER_REQUEST_STATUS,
        category: ADMIN_AUDIT_CATEGORY.CUSTOMER_REQUEST,
        resourceType: 'customer_request',
        resourceId: id,
        details: {
          previousStatus,
          status,
          type: custRequest.type,
          companyId: String(custRequest.companyId ?? ''),
        },
      });
    }

    return NextResponse.json(custRequest);
  } catch (error) {
    console.error('Error updating customer request:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
