import { NextRequest, NextResponse } from "next/server";
import { readStoredFile, verifyFileToken, contentTypeForKey } from "@/lib/storage";

export async function GET(req: NextRequest, { params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  const exp = Number(req.nextUrl.searchParams.get("exp"));
  const sig = req.nextUrl.searchParams.get("sig") ?? "";

  if (!verifyFileToken(key, exp, sig)) {
    return NextResponse.json({ error: "Link expired or invalid" }, { status: 403 });
  }

  try {
    const buf = await readStoredFile(key);
    return new NextResponse(buf as unknown as BodyInit, {
      headers: {
        "Content-Type": contentTypeForKey(key),
        "Cache-Control": "private, max-age=60",
      },
    });
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}
