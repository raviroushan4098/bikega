import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// This is a simplified example. In a real app, you'd verify a token/session.
// For this demo, we'll rely on client-side localStorage check on page load
// and this middleware as a basic guard. A robust solution would involve httpOnly cookies.

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Assume user is authenticated if they have a 'insightStreamUser' item in cookies (placeholder)
  // In a real app, this would be a session cookie check or token validation.
  const isAuthenticatedCookie = request.cookies.has('insightStreamUser-token-placeholder'); // Placeholder for actual token

  if (pathname.startsWith('/dashboard') && !isAuthenticatedCookie) {
    // If trying to access dashboard and not authenticated, redirect to login
    // For now, we rely on client-side auth context to manage this, as middleware
    // cannot easily access localStorage. This middleware is more of a conceptual guard.
    // True protection requires server-side session/token validation.
    // Let's assume client-side will handle redirection, but if a direct hit occurs,
    // this would be a place for a server-side check.
    // For this project, client-side redirection in AuthProvider/HomePage is primary.
  }

  if (pathname === '/login' && isAuthenticatedCookie) {
    // If on login page and already authenticated, redirect to dashboard
    // return NextResponse.redirect(new URL('/dashboard', request.url));
    // Similar to above, client-side will handle this.
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/dashboard/:path*', '/login'],
};
