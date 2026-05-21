import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';

const API_URL = process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8080';

async function proxy(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  const supabase = await createServerSupabase();
  const { data: { session } } = await supabase.auth.getSession();

  const upstreamUrl = `${API_URL}/coach/${path.join('/')}${req.nextUrl.search}`;

  const headers: Record<string, string> = {
    'Content-Type': req.headers.get('Content-Type') ?? 'application/json',
  };
  if (session?.access_token) {
    headers['Authorization'] = `Bearer ${session.access_token}`;
  }

  const body = ['GET', 'HEAD'].includes(req.method) ? undefined : await req.text();

  const upstream = await fetch(upstreamUrl, {
    method: req.method,
    headers,
    body,
  });

  const data = await upstream.text();
  return new NextResponse(data, {
    status: upstream.status,
    headers: { 'Content-Type': upstream.headers.get('Content-Type') ?? 'application/json' },
  });
}

export const GET = proxy;
export const POST = proxy;
export const PUT = proxy;
export const PATCH = proxy;
export const DELETE = proxy;
