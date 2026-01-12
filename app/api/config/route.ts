import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import AppConfig from '@/lib/models/AppConfig';
import { getServerSession } from '@/lib/auth';

export async function GET() {
  await dbConnect();
  try {
    let config = await AppConfig.findOne();
    if (!config) {
      config = await AppConfig.create({ isSignupAllowed: true });
    }
    return NextResponse.json({
      DlqLastProcessedAt: config.DlqLastProcessedAt,
      appleRelayEmail: config.appleRelayEmail,
      deleteCompanyContactsAfterDays: config.deleteCompanyContactsAfterDays,
      isSignupAllowed: config.isSignupAllowed,
    });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch config' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  await dbConnect();
  try {
    const {
      isSignupAllowed,
      appleRelayEmail,
      deleteCompanyContactsAfterDays,
    } = await request.json();

    let config = await AppConfig.findOne();
    if (!config) {
      config = await AppConfig.create({
        ...(typeof isSignupAllowed === 'boolean' ? { isSignupAllowed } : {}),
        ...(typeof appleRelayEmail === 'string' || appleRelayEmail === null
          ? { appleRelayEmail }
          : {}),
        ...(typeof deleteCompanyContactsAfterDays === 'number'
          ? { deleteCompanyContactsAfterDays }
          : {}),
      });
    } else {
      if (typeof isSignupAllowed === 'boolean') {
        config.isSignupAllowed = isSignupAllowed;
      }
      if (typeof appleRelayEmail === 'string' || appleRelayEmail === null) {
        config.appleRelayEmail = appleRelayEmail;
      }
      if (typeof deleteCompanyContactsAfterDays === 'number') {
        config.deleteCompanyContactsAfterDays = deleteCompanyContactsAfterDays;
      }
      await config.save();
    }

    return NextResponse.json({
      DlqLastProcessedAt: config.DlqLastProcessedAt,
      appleRelayEmail: config.appleRelayEmail,
      deleteCompanyContactsAfterDays: config.deleteCompanyContactsAfterDays,
      isSignupAllowed: config.isSignupAllowed,
    });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to update config' }, { status: 500 });
  }
}

