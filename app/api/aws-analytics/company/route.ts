import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import dbConnect from '@/lib/db';
import { requireSuperAdminSession } from '@/lib/auth';
import { getCompanyAwsUsage } from '@/lib/aws-analytics.server';

export async function GET(request: Request) {
  const { error } = await requireSuperAdminSession();
  if (error) return error;

  try {
    const { searchParams } = new URL(request.url);
    const companyId = (searchParams.get('id') || '').trim();
    if (!/^[a-f0-9]{24}$/i.test(companyId)) {
      return NextResponse.json({ error: 'Invalid company id' }, { status: 400 });
    }

    await dbConnect();
    const db = mongoose.connection.db;
    if (!db) {
      return NextResponse.json({ error: 'Database connection unavailable' }, { status: 500 });
    }

    const company = await getCompanyAwsUsage(db, companyId);
    if (!company) {
      return NextResponse.json(
        { error: 'No S3 usage found for this company' },
        { status: 404 }
      );
    }

    return NextResponse.json({ company });
  } catch (err) {
    console.error('[aws-analytics/company]', err);
    return NextResponse.json({ error: 'Failed to load company AWS usage' }, { status: 500 });
  }
}
