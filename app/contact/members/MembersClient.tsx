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

  function notify(msg: string) {
    setToast(msg);
    window.clearTimeout((notify as any)._t);
    (notify as any)._t = window.setTimeout(() => setToast(null), 2500);
  }

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setLoadingProjects(true);

        const res = await fetch("/api/projects", { cache: "no-store" });
        const j = await safeJson(res);

        if (!alive) return;

        if (!j.ok) {
          notify(`โหลดโครงการไม่สำเร็จ (${j.status})`);
          setProjects([]);
          return;
        }

        const list: any[] = Array.isArray(j.data) ? j.data : j.data?.projects ?? [];
        const normalized: ProjectRow[] = list
          .map((p) => ({
            id: String(p.id),
            name: String(p.name ?? p.projectName ?? "Unnamed"),
          }))
          .filter((p) => p.id);

        setProjects(normalized);

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

  useEffect(() => {
    if (!projectId) return;

    let alive = true;
    (async () => {
      try {
        setLoadingMembers(true);
        const res = await fetch(
          `/api/chat/members?projectId=${encodeURIComponent(projectId)}`,
          {
            cache: "no-store",
          }
        );
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

      const r2 = await fetch(
        `/api/chat/members?projectId=${encodeURIComponent(projectId)}`,
        { cache: "no-store" }
      );
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
      const res = await fetch(`/api/chat/members/${encodeURIComponent(memberId)}/disable`, {
        method: "PATCH",
      });
      const j = await safeJson(res);

      if (!j.ok) {
        notify(typeof j.data === "string" ? j.data : `Disable ไม่สำเร็จ (${j.status})`);
        return;
      }

      notify("ปิดสิทธิ์สำเร็จ");
      setMembers((prev) =>
        prev.map((m) => (m.memberId === memberId ? { ...m, isActive: false } : m))
      );
    } catch {
      notify("Disable ไม่สำเร็จ");
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-slate-200/80 bg-white/90 p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950/70">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              เลือกโครงการ
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400">
              {loadingProjects ? "กำลังโหลดโครงการ..." : `${projects.length} projects`}
            </div>
          </div>

          <select
            className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none transition hover:border-slate-300 focus:border-blue-400 focus:ring-4 focus:ring-blue-100 sm:w-[360px] dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:hover:border-slate-600 dark:focus:border-blue-500 dark:focus:ring-blue-950/50"
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

        <div className="mt-3 text-xs text-slate-500 dark:text-slate-400">
          สมาชิกใช้งานได้:{" "}
          <span className="font-semibold text-slate-900 dark:text-slate-100">
            {activeCount}
          </span>{" "}
          / {members.length}
        </div>
      </div>

      {isSuperAdmin && (
        <div className="rounded-2xl border border-slate-200/80 bg-white/90 p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950/70">
          <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            เพิ่มสมาชิกเข้ากลุ่ม
          </div>
          <div className="mt-2 flex flex-col gap-2 sm:flex-row">
            <input
              className="h-10 flex-1 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none transition placeholder:text-slate-400 hover:border-slate-300 focus:border-blue-400 focus:ring-4 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500 dark:hover:border-slate-600 dark:focus:border-blue-500 dark:focus:ring-blue-950/50"
              placeholder="email เช่น someone@example.com"
              value={addEmail}
              onChange={(e) => setAddEmail(e.target.value)}
            />
            <button
              className="h-10 rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-60 dark:bg-slate-100 dark:text-slate-900"
              onClick={onAddMember}
              disabled={busyAdd}
            >
              {busyAdd ? "กำลังเพิ่ม..." : "Add"}
            </button>
          </div>
          <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">
            ทำเพื่อ: แยก AllowEmail (เข้าใช้ระบบได้) ออกจาก Member (เข้าโปรเจกต์/แชทได้จริง)
          </div>
        </div>
      )}

      <div className="rounded-2xl border border-slate-200/80 bg-white/90 p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950/70">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              สมาชิกในกลุ่ม
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400">
              {loadingMembers ? "กำลังโหลดสมาชิก..." : "แสดงตามข้อมูลจริงใน DB"}
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-slate-500 dark:text-slate-400">
              <tr className="border-b border-slate-200 dark:border-slate-800">
                <th className="py-2 pr-3">Name</th>
                <th className="py-2 pr-3">Email</th>
                <th className="py-2 pr-3">Role</th>
                <th className="py-2 pr-3">Status</th>
                {isSuperAdmin && <th className="py-2">Action</th>}
              </tr>
            </thead>
            <tbody>
              {members.map((m) => (
                <tr
                  key={m.memberId}
                  className="border-b border-slate-200 last:border-b-0 dark:border-slate-800"
                >
                  <td className="py-2 pr-3 text-slate-800 dark:text-slate-100">
                    {m.name ?? "-"}
                  </td>
                  <td className="py-2 pr-3 text-slate-700 dark:text-slate-300">
                    {m.email}
                  </td>
                  <td className="py-2 pr-3 text-slate-700 dark:text-slate-300">
                    {m.role}
                  </td>
                  <td className="py-2 pr-3">
                    <span
                      className={`rounded-lg border px-2 py-1 text-xs ${
                        m.isActive
                          ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-300"
                          : "border-slate-200 bg-slate-50 text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400"
                      }`}
                    >
                      {m.isActive ? "Active" : "Disabled"}
                    </span>
                  </td>
                  {isSuperAdmin && (
                    <td className="py-2">
                      <button
                        className="rounded-xl border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-900"
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
                  <td
                    className="py-6 text-center text-sm text-slate-500 dark:text-slate-400"
                    colSpan={isSuperAdmin ? 5 : 4}
                  >
                    ไม่พบสมาชิก (หรือคุณไม่มีสิทธิ์ดูโครงการนี้)
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {toast && (
        <div className="fixed bottom-4 right-4 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 shadow-lg dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100">
          {toast}
        </div>
      )}
    </div>
  );
}