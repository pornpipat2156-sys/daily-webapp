import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { markNotificationsRead } from "@/lib/notifications";

export async function POST(req: NextRequest) {
  const user = await getAuthUser(req);

  if (!user) {
    return NextResponse.json({ ok: false, message: "unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const ids = Array.isArray(body?.ids) ? body.ids : [];
    const all = Boolean(body?.all);

    const result = await markNotificationsRead({
      userId: user.id,
      ids,
      all,
    });

    return NextResponse.json({
      ok: true,
      count: result.count,
    });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, message: e?.message ?? "internal error" },
      { status: 500 }
    );
  }
}