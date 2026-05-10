import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const url = request.nextUrl.clone();
  const host = request.headers.get('host') || '';

  // 1. Definimos el dominio del driver
  const driverDomain = 'driver.privaterideslasvegas.com';

  // 2. Verificamos si la petición viene por el subdominio
  if (host === driverDomain) {
    
    // CASO A: Si el driver entra a la raíz (/), lo mandamos a su login
    if (url.pathname === '/') {
      url.pathname = '/loguin-driver';
      return NextResponse.rewrite(url);
    }

    // CASO B: Seguridad adicional
    // Si un driver intenta entrar a rutas de usuario (ej. /checkout), 
    // podrías redirigirlo aquí, pero por ahora el rewrite de la raíz es suficiente.
  }

  return NextResponse.next();
}

// 3. MEJORA DEL MATCHER
// Antes solo tenías ['/'], lo cual está bien para el login, 
// pero si quieres que todo el subdominio se comporte de forma independiente,
// es mejor dejarlo que escuche las rutas principales.
export const config = {
  matcher: [
    /*
     * Coincidir con todas las rutas excepto las que empiecen con:
     * - api (rutas de API)
     * - _next/static (archivos estáticos)
     * - _next/image (optimización de imágenes)
     * - favicon.ico (icono)
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};