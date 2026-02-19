// lib/api.ts
import { z } from "zod";

export function sanitizeText(s: string) {
  return s.replace(/\s+/g, " ").trim();
}

export function jsonError(status: number, error: string, extra?: Record<string, unknown>) {
  return new Response(JSON.stringify({ ok: false, error, ...extra }), {
    status,
    headers: { "content-type": "application/json" },
  });
}

export function jsonOk(data: any) {
  return new Response(JSON.stringify({ ok: true, ...data }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

export async function readJson<T>(req: Request, schema: z.ZodSchema<T>) {
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return { ok: false as const, status: 400, error: "BAD_REQUEST", issues: parsed.error.issues };
  }
  return { ok: true as const, data: parsed.data };
}
