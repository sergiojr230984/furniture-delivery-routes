// Resolves the app's public base URL for building auth redirect links
// (password-invite emails, etc.). Set NEXT_PUBLIC_SITE_URL in production;
// falls back to Vercel's auto-injected URL, then localhost for dev.
export function siteUrl() {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
}
