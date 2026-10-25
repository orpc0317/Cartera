export default function LoginLayout({ children }: { children: React.ReactNode }) {
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY
  return (
    <>
      {children}
      {siteKey ? <script async src="https://challenges.cloudflare.com/turnstile/v0/api.js" /> : null}
    </>
  )
}
