import { Prisma } from "@prisma/client";
import webpush from "web-push";
import { prisma } from "@/lib/prisma";

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
    new Set((userIds || []).map((x) => String(x || "").trim()).filter(Boolean))
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
        .map((x) => [`${x.userId}::${x.dedupeKey}`, x])
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

export async function sendChatMessagePush(params: {
  recipientUserIds: string[];
  projectName: string;
  authorName: string;
  messageText?: string | null;
  projectId: string;
}) {
  const preview = String(params.messageText || "").trim() || "คุณมีข้อความใหม่ในแชตโครงการ";

  await sendPushToUsers(params.recipientUserIds, {
    title: `ข้อความใหม่: ${params.projectName}`,
    body: `${params.authorName}: ${preview}`,
    url: `/contact?projectId=${encodeURIComponent(params.projectId)}`,
    tag: `chat-${params.projectId}`,
  });
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
  });
}