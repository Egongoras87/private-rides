import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const url = request.nextUrl.clone();
  const host = request.headers.get('host') || '';

  // Tu subdominio de conductor
  const driverDomain = 'driver.privaterideslasvegas.com';

  // Verificamos si el host es el del driver
  if (host === driverDomain) {
    // Si intenta entrar a la raíz, lo forzamos al login de driver
    if (url.pathname === '/') {
      url.pathname = '/loguin-driver';
      return NextResponse.rewrite(url);
    }
  }

  return NextResponse.next();
}

// Este matcher es vital para que Vercel no ignore el subdominio
export const config = {
  matcher: [
    /*
     * Captura todas las rutas excepto archivos de sistema y api
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};