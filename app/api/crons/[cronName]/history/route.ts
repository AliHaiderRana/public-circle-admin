import { NextResponse } from 'next/server';
import { getBackendApiUrl, getBackendAuthHeaders } from '@/lib/backend-api.server';

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
      `${getBackendApiUrl()}/crons/${cronName}/history?page=${page}&limit=${limit}`,
      {
        headers: await getBackendAuthHeaders(),
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
