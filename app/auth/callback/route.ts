import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Exchanges the invite/magic-link code Supabase appends to email links for a
// real session, then hands off to the requested next page (e.g. set-password).
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=invite_link_invalid`);
}
