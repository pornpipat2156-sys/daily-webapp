import { Prisma } from "@prisma/client";
import webpush from "web-push";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

type DbPushSubscription = {
  id: string;
  userId: string;
  endpoint: string;
  p256dh: string;
  auth: string;
};

export type PushPayload = {
  title: string;
  body: string;
  url?: string;
  tag?: string;
  data?: Record<string, unknown>;
};

export type DedupePushInput = {
  userId: string;
  dedupeKey: string;
  channel: string;
  payload: PushPayload;
};

type SendChatMessagePushInput = {
  recipientUserIds: string[];
  projectName: string;
  authorName?: string | null;
  messageText?: string | null;
  projectId: string;
  messageId?: string | null;
};

function getVapidConfig() {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || "";
  const privateKey = process.env.VAPID_PRIVATE_KEY || "";
  const subject = process.env.VAPID_SUBJECT || "mailto:admin@example.com";

  return {
    publicKey,
    privateKey,
    subject,
    enabled: Boolean(publicKey && privateKey && subject),
  };
}

let configured = false;

function ensureWebPushConfigured() {
  if (configured) return;

  const vapid = getVapidConfig();
  if (!vapid.enabled) return;

  webpush.setVapidDetails(vapid.subject, vapid.publicKey, vapid.privateKey);
  configured = true;
}

export function isWebPushEnabled() {
  return getVapidConfig().enabled;
}

function toWebPushSubscription(sub: DbPushSubscription) {
  return {
    endpoint: sub.endpoint,
    keys: {
      p256dh: sub.p256dh,
      auth: sub.auth,
    },
  };
}

function toPayloadString(payload: PushPayload) {
  return JSON.stringify({
    title: payload.title,
    body: payload.body,
    url: payload.url || "/",
    tag: payload.tag || "daily-webapp",
    data: payload.data || {},
  });
}

function cleanText(value?: string | null) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function truncate(value: string, max = 120) {
  if (value.length <= max) return value;
  return `${value.slice(0, max - 1)}…`;
}

async function removeBrokenSubscription(endpoint: string) {
  try {
    await prisma.pushSubscription.delete({
      where: { endpoint },
    });
  } catch {
    // ignore
  }
}

async function touchSubscription(endpoint: string) {
  try {
    await prisma.pushSubscription.update({
      where: { endpoint },
      data: { lastUsedAt: new Date() },
    });
  } catch {
    // ignore
  }
}

export async function sendPushToUser(userId: string, payload: PushPayload) {
  if (!isWebPushEnabled()) return;

  ensureWebPushConfigured();

  const subs = await prisma.pushSubscription.findMany({
    where: { userId },
    select: {
      id: true,
      userId: true,
      endpoint: true,
      p256dh: true,
      auth: true,
    },
  });

  if (!subs.length) return;

  const body = toPayloadString(payload);

  await Promise.allSettled(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(toWebPushSubscription(sub), body);
        await touchSubscription(sub.endpoint);
      } catch (err: any) {
        const statusCode = Number(err?.statusCode || 0);
        if (statusCode === 404 || statusCode === 410) {
          await removeBrokenSubscription(sub.endpoint);
        }
      }
    })
  );
}

export async function sendPushToUsers(userIds: string[], payload: PushPayload) {
  const uniqueUserIds = Array.from(
    new Set(
      (userIds || [])
        .map((x) => String(x || "").trim())
        .filter(Boolean)
    )
  );

  if (!uniqueUserIds.length) return;

  await Promise.all(uniqueUserIds.map((userId) => sendPushToUser(userId, payload)));
}

export async function sendDedupedPushes(inputs: DedupePushInput[]) {
  if (!inputs.length) return;

  const uniqueInputs = Array.from(
    new Map(
      inputs
        .map((x) => ({
          userId: String(x.userId || "").trim(),
          dedupeKey: String(x.dedupeKey || "").trim(),
          channel: String(x.channel || "").trim() || "general",
          payload: x.payload,
        }))
        .filter((x) => x.userId && x.dedupeKey)
        .map((x) => [`${x.userId}::${x.dedupeKey}`, x] as const)
    ).values()
  );

  for (const input of uniqueInputs) {
    const result = await prisma.pushDeliveryLog.createMany({
      data: [
        {
          userId: input.userId,
          dedupeKey: input.dedupeKey,
          channel: input.channel,
          title: input.payload.title,
          body: input.payload.body,
          payload: {
            title: input.payload.title,
            body: input.payload.body,
            url: input.payload.url || "/",
            tag: input.payload.tag || "daily-webapp",
            data: input.payload.data || {},
          } as Prisma.InputJsonValue,
        },
      ],
      skipDuplicates: true,
    });

    if (result.count === 0) continue;
    await sendPushToUser(input.userId, input.payload);
  }
}

function buildMentionPushPayload(params: {
  unreadMentionCountInProject: number;
  projectId: string;
  projectName: string;
  authorName?: string | null;
  messageText?: string | null;
}): PushPayload {
  const unreadCount = Math.max(1, Number(params.unreadMentionCountInProject || 1));
  const projectName = cleanText(params.projectName) || "Project";
  const authorName = cleanText(params.authorName) || "Someone";
  const messageText = cleanText(params.messageText);
  const url = `/contact?projectId=${encodeURIComponent(params.projectId)}`;

  if (unreadCount > 1) {
    return {
      title: `${unreadCount} new mentions in ${projectName}`,
      body: "Open project chat to review the latest mentions.",
      url,
      tag: `mention-group:${params.projectId}`,
      data: {
        type: "MENTION",
        projectId: params.projectId,
        projectName,
        unreadMentionCountInProject: unreadCount,
      },
    };
  }

  return {
    title: `${authorName} mentioned you`,
    body: messageText
      ? `${projectName} • ${truncate(messageText, 120)}`
      : `${projectName} • You were mentioned in project chat.`,
    url,
    tag: `mention-group:${params.projectId}`,
    data: {
      type: "MENTION",
      projectId: params.projectId,
      projectName,
      unreadMentionCountInProject: unreadCount,
    },
  };
}

export async function sendChatMessagePush({
  recipientUserIds,
  projectName,
  authorName,
  messageText,
  projectId,
  messageId,
}: SendChatMessagePushInput) {
  const uniqueUserIds = Array.from(
    new Set(
      (recipientUserIds || [])
        .map((x) => String(x || "").trim())
        .filter(Boolean)
    )
  );

  if (!uniqueUserIds.length) return;

  if (!projectId) return;

  const unreadCounts = await Promise.all(
    uniqueUserIds.map(async (userId) => {
      const count = await prisma.notification.count({
        where: {
          userId,
          type: "MENTION",
          projectId,
          readAt: null,
        },
      });

      return {
        userId,
        unreadMentionCountInProject: Math.max(1, count || 1),
      };
    })
  );

  const inputs: DedupePushInput[] = unreadCounts.map(
    ({ userId, unreadMentionCountInProject }) => ({
      userId,
      dedupeKey: messageId
        ? `chat-mention-push:${messageId}:${userId}`
        : `chat-mention-push:${projectId}:${userId}:${Date.now()}`,
      channel: "webpush",
      payload: buildMentionPushPayload({
        unreadMentionCountInProject,
        projectId,
        projectName,
        authorName,
        messageText,
      }),
    })
  );

  await sendDedupedPushes(inputs);
}

export async function sendReportPendingCommentPush(params: {
  recipientUserIds: string[];
  projectName: string;
  reportDateText: string;
  projectId: string;
}) {
  await sendPushToUsers(params.recipientUserIds, {
    title: `มีรายงานรอแสดงความคิดเห็น`,
    body: `${params.projectName} • วันที่ ${params.reportDateText}`,
    url: `/commentator?projectId=${encodeURIComponent(params.projectId)}`,
    tag: `report-comment-${params.projectId}`,
    data: {
      type: "REPORT_PENDING_COMMENT",
      projectId: params.projectId,
      projectName: params.projectName,
      reportDateText: params.reportDateText,
    },
  });
}