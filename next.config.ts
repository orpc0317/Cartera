import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV === 'development'

const securityHeaders = [
  // Evita que la app sea embebida en iframes (clickjacking)
  { key: 'X-Frame-Options', value: 'DENY' },
  // Evita que el navegador infiera el MIME type (MIME sniffing)
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  // No envía el Referer al navegar fuera del dominio
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  // Habilita HTTPS estricto (solo aplica en producción con HTTPS)
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  // Deshabilita acceso a APIs de hardware sensibles (geolocation, camera, mic)
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
  // CSP: permite scripts/estilos propios + Cloudflare Turnstile + Supabase
  // En desarrollo se agrega unsafe-eval porque React lo necesita para stack traces
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ''} https://challenges.cloudflare.com`,
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https://flagcdn.com https://*.supabase.co",
      "font-src 'self'",
      "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://challenges.cloudflare.com",
      "frame-src https://challenges.cloudflare.com",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join('; '),
  },
]

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'flagcdn.com' },
    ],
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: securityHeaders,
      },
    ]
  },
};

export default nextConfig;
