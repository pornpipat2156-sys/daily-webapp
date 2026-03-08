import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type AppNotificationType = "MENTION" | "APPROVAL" | "SYSTEM";

export type CreateNotificationInput = {
  userId: string;
  type: AppNotificationType;
  title: string;
  body: string;
  url?: string | null;
  sourceKey?: string | null;
  groupKey?: string | null;
  projectId?: string | null;
  meta?: Record<string, unknown> | null;
};

function asJson(value: Record<string, unknown> | null | undefined) {
  return (value ?? null) as
    | Prisma.InputJsonValue
    | Prisma.NullableJsonNullValueInput;
}

export async function createNotifications(inputs: CreateNotificationInput[]) {
  const rows = (inputs || [])
    .map((x) => ({
      userId: String(x.userId || "").trim(),
      type: x.type,
      title: String(x.title || "").trim(),
      body: String(x.body || "").trim(),
      url: x.url ? String(x.url) : null,
      sourceKey: x.sourceKey ? String(x.sourceKey) : null,
      groupKey: x.groupKey ? String(x.groupKey) : null,
      projectId: x.projectId ? String(x.projectId) : null,
      meta: asJson(x.meta),
    }))
    .filter((x) => x.userId && x.title);

  if (!rows.length) return { count: 0 };

  return prisma.notification.createMany({
    data: rows,
    skipDuplicates: true,
  });
}

export async function getNotificationSummary(userId: string, limit = 20) {
  const safeLimit = Math.max(1, Math.min(100, Number(limit || 20)));

  const [items, unreadCount, unreadMentions, unreadApprovals] =
    await Promise.all([
      prisma.notification.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        take: safeLimit,
        select: {
          id: true,
          type: true,
          title: true,
          body: true,
          url: true,
          sourceKey: true,
          groupKey: true,
          projectId: true,
          readAt: true,
          meta: true,
          createdAt: true,
        },
      }),
      prisma.notification.count({
        where: { userId, readAt: null },
      }),
      prisma.notification.count({
        where: { userId, readAt: null, type: "MENTION" },
      }),
      prisma.notification.count({
        where: { userId, readAt: null, type: "APPROVAL" },
      }),
    ]);

  return {
    unreadCount,
    unreadMentions,
    unreadApprovals,
    items: items.map((x) => ({
      ...x,
      createdAt: x.createdAt.toISOString(),
      readAt: x.readAt ? x.readAt.toISOString() : null,
    })),
  };
}

export async function markNotificationsRead(params: {
  userId: string;
  ids?: string[];
  all?: boolean;
  type?: AppNotificationType;
  projectId?: string;
}) {
  const {
    userId,
    ids = [],
    all = false,
    type,
    projectId,
  } = params;

  if (all) {
    const result = await prisma.notification.updateMany({
      where: {
        userId,
        readAt: null,
      },
      data: {
        readAt: new Date(),
      },
    });

    return { count: result.count };
  }

  const cleanIds = ids
    .map((x) => String(x || "").trim())
    .filter(Boolean);

  if (cleanIds.length > 0) {
    const result = await prisma.notification.updateMany({
      where: {
        userId,
        id: { in: cleanIds },
        readAt: null,
      },
      data: {
        readAt: new Date(),
      },
    });

    return { count: result.count };
  }

  if (type || projectId) {
    const result = await prisma.notification.updateMany({
      where: {
        userId,
        readAt: null,
        ...(type ? { type } : {}),
        ...(projectId ? { projectId } : {}),
      },
      data: {
        readAt: new Date(),
      },
    });

    return { count: result.count };
  }

  return { count: 0 };
}