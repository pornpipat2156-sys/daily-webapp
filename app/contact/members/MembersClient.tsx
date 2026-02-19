// app/contact/members/MembersClient.tsx
"use client";

import { useEffect, useMemo, useState } from "react";

type ProjectRow = { id: string; name: string };
type MemberRow = {
  memberId: string;
  userId: string;
  email: string;
  name: string | null;
  role: string;
  isActive: boolean;
  createdAt: string;
};

async function safeJson(res: Response) {
  const text = await res.text();
  try {
    return { ok: res.ok, status: res.status, data: JSON.parse(text) };
  } catch {
    return { ok: res.ok, status: res.status, data: text };
  }
}

export default function MembersClient({ myRole }: { myRole: string }) {
  const isSuperAdmin = myRole === "SUPERADMIN";

  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [projectId, setProjectId] = useState<string>("");

  const [members, setMembers] = useState<MemberRow[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [loadingProjects, setLoadingProjects] = useState(false);

  const [addEmail, setAddEmail] = useState("");
  const [busyAdd, setBusyAdd] = useState(false);

  const [toast, setToast] = useState<string | null>(null);

  // ✅ ทำเพื่อ: แสดงข้อความสั้นๆ ไม่ให้ผู้ใช้คิดว่าเว็บค้าง
  function notify(msg: string) {
    setToast(msg);
    window.clearTimeout((notify as any)._t);
    (notify as any)._t = window.setTimeout(() => setToast(null), 2500);
  }

  // ✅ โหลดรายการโครงการ
  // ทำเพื่อ: ให้เลือก project ก่อนแล้วค่อยโหลดสมาชิก ลด query หนัก/ลด error
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setLoadingProjects(true);

        // คาดว่าโปรเจกต์คุณมี /api/projects อยู่แล้ว
        const res = await fetch("/api/projects", { cache: "no-store" });
        const j = await safeJson(res);

        if (!alive) return;

        if (!j.ok) {
          notify(`โหลดโครงการไม่สำเร็จ (${j.status})`);
          setProjects([]);
          return;
        }

        // รองรับได้หลายรูปแบบ: [{id,name}] หรือ {projects:[...]}
        const list: any[] = Array.isArray(j.data) ? j.data : j.data?.projects ?? [];
        const normalized: ProjectRow[] = list
          .map((p) => ({ id: String(p.id), name: String(p.name ?? p.projectName ?? "Unnamed") }))
          .filter((p) => p.id);

        setProjects(normalized);

        // auto select อันแรกเพื่อความเสถียร (ไม่ต้องให้ user คลิกหลายครั้ง)
        if (!projectId && normalized.length) setProjectId(normalized[0].id);
      } catch {
        if (alive) notify("โหลดโครงการไม่สำเร็จ");
      } finally {
        if (alive) setLoadingProjects(false);
      }
    })();

    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ✅ โหลดสมาชิกเมื่อเปลี่ยน project
  // ทำเพื่อ: กันคนไม่อยู่ในกลุ่มไม่ให้เห็นข้อมูล และให้ UI sync กับ DB
  useEffect(() => {
    if (!projectId) return;

    let alive = true;
    (async () => {
      try {
        setLoadingMembers(true);
        const res = await fetch(`/api/chat/members?projectId=${encodeURIComponent(projectId)}`, {
          cache: "no-store",
        });
        const j = await safeJson(res);

        if (!alive) return;

        if (!j.ok) {
          notify(typeof j.data === "string" ? j.data : `โหลดสมาชิกไม่สำเร็จ (${j.status})`);
          setMembers([]);
          return;
        }

        const list: any[] = Array.isArray(j.data) ? j.data : j.data?.members ?? [];
        const normalized: MemberRow[] = list.map((m) => ({
          memberId: String(m.memberId ?? m.id ?? ""),
          userId: String(m.userId ?? ""),
          email: String(m.email ?? ""),
          name: m.name ?? null,
          role: String(m.role ?? "USER"),
          isActive: Boolean(m.isActive ?? true),
          createdAt: String(m.createdAt ?? ""),
        }));

        setMembers(normalized);
      } catch {
        if (alive) notify("โหลดสมาชิกไม่สำเร็จ");
      } finally {
        if (alive) setLoadingMembers(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [projectId]);

  const activeCount = useMemo(() => members.filter((m) => m.isActive).length, [members]);

  async function onAddMember() {
    if (!isSuperAdmin) return;
    const email = addEmail.trim().toLowerCase();
    if (!email) return notify("กรอก email ก่อน");
    if (!projectId) return notify("ยังไม่ได้เลือกโครงการ");

    try {
      setBusyAdd(true);
      const res = await fetch("/api/chat/members", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, email }),
      });
      const j = await safeJson(res);

      if (!j.ok) {
        notify(typeof j.data === "string" ? j.data : `เพิ่มสมาชิกไม่สำเร็จ (${j.status})`);
        return;
      }

      notify("เพิ่มสมาชิกสำเร็จ");
      setAddEmail("");
      // reload members
      const r2 = await fetch(`/api/chat/members?projectId=${encodeURIComponent(projectId)}`, { cache: "no-store" });
      const j2 = await safeJson(r2);
      if (j2.ok) {
        const list: any[] = Array.isArray(j2.data) ? j2.data : j2.data?.members ?? [];
        setMembers(
          list.map((m) => ({
            memberId: String(m.memberId ?? m.id ?? ""),
            userId: String(m.userId ?? ""),
            email: String(m.email ?? ""),
            name: m.name ?? null,
            role: String(m.role ?? "USER"),
            isActive: Boolean(m.isActive ?? true),
            createdAt: String(m.createdAt ?? ""),
          }))
        );
      }
    } finally {
      setBusyAdd(false);
    }
  }

  async function onDisable(memberId: string) {
    if (!isSuperAdmin) return;
    if (!memberId) return;

    try {
      const res = await fetch(`/api/chat/members/${encodeURIComponent(memberId)}/disable`, { method: "PATCH" });
      const j = await safeJson(res);

      if (!j.ok) {
        notify(typeof j.data === "string" ? j.data : `Disable ไม่สำเร็จ (${j.status})`);
        return;
      }

      notify("ปิดสิทธิ์สำเร็จ");
      setMembers((prev) => prev.map((m) => (m.memberId === memberId ? { ...m, isActive: false } : m)));
    } catch {
      notify("Disable ไม่สำเร็จ");
    }
  }

  return (
    <div className="space-y-4">
      {/* Project selector */}
      <div className="rounded-xl border bg-card p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="text-sm font-medium">เลือกโครงการ</div>
            <div className="text-xs text-muted-foreground">
              {loadingProjects ? "กำลังโหลดโครงการ..." : `${projects.length} projects`}
            </div>
          </div>

          <select
            className="h-10 w-full rounded-lg border bg-background px-3 text-sm sm:w-[360px]"
            value={projectId}
            onChange={(e) => setProjectId(e.target.value)}
            disabled={loadingProjects || projects.length === 0}
          >
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>

        <div className="mt-3 text-xs text-muted-foreground">
          สมาชิกใช้งานได้: <span className="font-medium text-foreground">{activeCount}</span> / {members.length}
        </div>
      </div>

      {/* Add member (SuperAdmin) */}
      {isSuperAdmin && (
        <div className="rounded-xl border bg-card p-4">
          <div className="text-sm font-medium">เพิ่มสมาชิกเข้ากลุ่ม</div>
          <div className="mt-2 flex flex-col gap-2 sm:flex-row">
            <input
              className="h-10 flex-1 rounded-lg border bg-background px-3 text-sm"
              placeholder="email เช่น someone@example.com"
              value={addEmail}
              onChange={(e) => setAddEmail(e.target.value)}
            />
            <button
              className="h-10 rounded-lg border bg-background px-4 text-sm hover:bg-muted disabled:opacity-60"
              onClick={onAddMember}
              disabled={busyAdd}
            >
              {busyAdd ? "กำลังเพิ่ม..." : "Add"}
            </button>
          </div>
          <div className="mt-2 text-xs text-muted-foreground">
            ทำเพื่อ: แยก AllowEmail (เข้าใช้ระบบได้) ออกจาก Member (เข้าโปรเจกต์/แชทได้จริง)
          </div>
        </div>
      )}

      {/* Members table */}
      <div className="rounded-xl border bg-card p-4">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <div className="text-sm font-medium">สมาชิกในกลุ่ม</div>
            <div className="text-xs text-muted-foreground">
              {loadingMembers ? "กำลังโหลดสมาชิก..." : "แสดงตามข้อมูลจริงใน DB"}
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-muted-foreground">
              <tr className="border-b">
                <th className="py-2 pr-3">Name</th>
                <th className="py-2 pr-3">Email</th>
                <th className="py-2 pr-3">Role</th>
                <th className="py-2 pr-3">Status</th>
                {isSuperAdmin && <th className="py-2">Action</th>}
              </tr>
            </thead>
            <tbody>
              {members.map((m) => (
                <tr key={m.memberId} className="border-b last:border-b-0">
                  <td className="py-2 pr-3">{m.name ?? "-"}</td>
                  <td className="py-2 pr-3">{m.email}</td>
                  <td className="py-2 pr-3">{m.role}</td>
                  <td className="py-2 pr-3">
                    <span className={`rounded-md border px-2 py-1 text-xs ${m.isActive ? "" : "opacity-60"}`}>
                      {m.isActive ? "Active" : "Disabled"}
                    </span>
                  </td>
                  {isSuperAdmin && (
                    <td className="py-2">
                      <button
                        className="rounded-lg border px-3 py-1 text-xs hover:bg-muted disabled:opacity-60"
                        onClick={() => onDisable(m.memberId)}
                        disabled={!m.isActive}
                        title="Disable member (soft)"
                      >
                        Disable
                      </button>
                    </td>
                  )}
                </tr>
              ))}

              {!loadingMembers && members.length === 0 && (
                <tr>
                  <td className="py-6 text-center text-sm text-muted-foreground" colSpan={isSuperAdmin ? 5 : 4}>
                    ไม่พบสมาชิก (หรือคุณไม่มีสิทธิ์ดูโครงการนี้)
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {toast && (
        <div className="fixed bottom-4 right-4 rounded-xl border bg-background px-4 py-3 text-sm shadow">
          {toast}
        </div>
      )}
    </div>
  );
}
