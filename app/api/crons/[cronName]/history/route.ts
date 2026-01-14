import { NextResponse } from 'next/server';

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3001';
const INTERNAL_API_KEY = process.env.INTERNAL_API_KEY || 'internal_admin_cron_key_2024';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ cronName: string }> }
) {
  try {
    const { searchParams } = new URL(request.url);
    const page = searchParams.get('page') || '1';
    const limit = searchParams.get('limit') || '30';
    
    const { cronName } = await params;
    
    const response = await fetch(
      `${API_BASE_URL}/crons/${cronName}/history?page=${page}&limit=${limit}`,
      {
        headers: {
          'x-internal-api-key': INTERNAL_API_KEY,
        },
      }
    );

    if (!response.ok) {
      return NextResponse.json(
        { error: 'Failed to fetch cron history' },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('[cron-history] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
