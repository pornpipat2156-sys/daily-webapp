// lib/push-notify.ts
import webpush from "web-push";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

type PushPayload = {
  title: string;
  body: string;
  url?: string;
  tag?: string;
  data?: Record<string, unknown>;
};

type NotifyOneInput = {
  userId: string;
  dedupeKey: string;
  channel: "mention" | "approval";
  title: string;
  body: string;
  url?: string;
  tag?: string;
  data?: Record<string, unknown>;
};

type WebPushSubscriptionShape = {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
};

let vapidConfigured = false;

function ensureWebPushConfigured() {
  if (vapidConfigured) return true;

  const subject = process.env.VAPID_SUBJECT;
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;

  if (!subject || !publicKey || !privateKey) {
    return false;
  }

  webpush.setVapidDetails(subject, publicKey, privateKey);
  vapidConfigured = true;
  return true;
}

function buildPayload(input: NotifyOneInput): PushPayload {
  return {
    title: input.title,
    body: input.body,
    url: input.url,
    tag: input.tag || input.dedupeKey,
    data: {
      channel: input.channel,
      dedupeKey: input.dedupeKey,
      ...(input.data || {}),
    },
  };
}

async function markEndpointUsed(endpoint: string) {
  try {
    await prisma.pushSubscription.update({
      where: { endpoint },
      data: { lastUsedAt: new Date() },
    });
  } catch {
    // ignore
  }
}

async function removeEndpoint(endpoint: string) {
  try {
    await prisma.pushSubscription.delete({
      where: { endpoint },
    });
  } catch {
    // ignore
  }
}

export async function sendPushNotifications(inputs: NotifyOneInput[]) {
  if (!inputs.length) return;

  const canSend = ensureWebPushConfigured();
  if (!canSend) {
    return;
  }

  const uniqueInputs = Array.from(
    new Map(inputs.map((x) => [`${x.userId}::${x.dedupeKey}`, x])).values()
  );

  const userIds = Array.from(new Set(uniqueInputs.map((x) => x.userId)));

  const subscriptions = await prisma.pushSubscription.findMany({
    where: {
      userId: { in: userIds },
    },
    select: {
      id: true,
      userId: true,
      endpoint: true,
      p256dh: true,
      auth: true,
    },
  });

  const subMap = new Map<string, typeof subscriptions>();
  for (const sub of subscriptions) {
    const arr = subMap.get(sub.userId) ?? [];
    arr.push(sub);
    subMap.set(sub.userId, arr);
  }

  for (const input of uniqueInputs) {
    const logResult = await prisma.pushDeliveryLog.createMany({
      data: [
        {
          userId: input.userId,
          dedupeKey: input.dedupeKey,
          channel: input.channel,
          title: input.title,
          body: input.body,
          payload: buildPayload(input) as Prisma.InputJsonValue,
        },
      ],
      skipDuplicates: true,
    });

    // ✅ ถ้าเคยส่งแล้ว จะไม่ส่งซ้ำ
    if (logResult.count === 0) {
      continue;
    }

    const userSubs = subMap.get(input.userId) ?? [];
    if (!userSubs.length) {
      continue;
    }

    const payload = JSON.stringify(buildPayload(input));

    for (const sub of userSubs) {
      const pushSub: WebPushSubscriptionShape = {
        endpoint: sub.endpoint,
        keys: {
          p256dh: sub.p256dh,
          auth: sub.auth,
        },
      };

      try {
        await webpush.sendNotification(pushSub, payload);
        await markEndpointUsed(sub.endpoint);
      } catch (error: any) {
        const statusCode = Number(error?.statusCode || 0);

        // endpoint หมดอายุ/ใช้ไม่ได้แล้ว
        if (statusCode === 404 || statusCode === 410) {
          await removeEndpoint(sub.endpoint);
        }
      }
    }
  }
}