import type { NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

export function proxy(request: NextRequest) {
  return updateSession(request)
}

export const config = {
  matcher: [
    // Excluir archivos estáticos, optimización de imágenes y favicon
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
