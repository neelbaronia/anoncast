import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { code } = await request.json();

    if (!code || typeof code !== 'string') {
      return NextResponse.json({ valid: false });
    }

    const validCodes = (process.env.PROMO_CODES || '')
      .split(',')
      .map(c => c.trim().toLowerCase())
      .filter(Boolean);

    const valid = validCodes.includes(code.trim().toLowerCase());

    return NextResponse.json({ valid });
  } catch {
    return NextResponse.json({ valid: false });
  }
}
