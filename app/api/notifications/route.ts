import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { getNotificationSummary } from "@/lib/notifications";

export async function GET(req: NextRequest) {
  const user = await getAuthUser(req);

  if (!user) {
    return NextResponse.json({ ok: false, message: "unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const limit = Number(searchParams.get("limit") || "20");

  try {
    const summary = await getNotificationSummary(user.id, limit);

    return NextResponse.json({
      ok: true,
      ...summary,
    });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, message: e?.message ?? "internal error" },
      { status: 500 }
    );
  }
}