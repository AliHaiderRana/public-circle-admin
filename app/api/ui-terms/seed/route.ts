import { NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth';
import dbConnect from '@/lib/db';
import { seedUiTermsDefaults } from '@/lib/ui-term-defaults';

export async function POST() {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    await dbConnect();
    const terms = await seedUiTermsDefaults();
    return NextResponse.json({ terms, message: 'UI hints saved to MongoDB.' });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to seed UI hints';
    return NextResponse.json(
      {
        error: message,
        hint: 'Check MONGODB_URI in admin/.env matches your database.',
      },
      { status: 500 }
    );
  }
}
