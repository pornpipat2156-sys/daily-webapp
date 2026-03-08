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

        await prisma.pushSubscription.update({
          where: { endpoint: sub.endpoint },
          data: { lastUsedAt: new Date() },
        });
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

export async function sendChatMessagePush(params: {
  recipientUserIds: string[];
  projectName: string;
  authorName: string;
  messageText?: string | null;
  projectId: string;
}) {
  const preview =
    String(params.messageText || "").trim() || "คุณมีข้อความใหม่ในแชตโครงการ";

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