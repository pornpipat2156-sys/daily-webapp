import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import {
  markNotificationsRead,
  type AppNotificationType,
} from "@/lib/notifications";

function normalizeType(value: unknown): AppNotificationType | undefined {
  const text = String(value || "").trim().toUpperCase();

  if (text === "MENTION") return "MENTION";
  if (text === "APPROVAL") return "APPROVAL";
  if (text === "SYSTEM") return "SYSTEM";

  return undefined;
}

export async function POST(req: NextRequest) {
  const user = await getAuthUser(req);

  if (!user) {
    return NextResponse.json(
      { ok: false, message: "unauthorized" },
      { status: 401 }
    );
  }

  try {
    const body = await req.json().catch(() => ({}));

    const ids = Array.isArray(body?.ids) ? body.ids : [];
    const all = Boolean(body?.all);
    const type = normalizeType(body?.type);
    const projectId =
      body?.projectId == null ? undefined : String(body.projectId || "").trim();

    const result = await markNotificationsRead({
      userId: user.id,
      ids,
      all,
      type,
      projectId: projectId || undefined,
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