import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { redirect } from "next/navigation";
import MembersClient from "./MembersClient";

export default async function MembersPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/auth/signin");

  const me = (session as any)?.user;
  const role = (me?.role as string) || "USER";

  return (
    <div className="p-4 sm:p-6">
      <div className="mb-4 rounded-2xl border border-slate-200/80 bg-white/90 p-5 shadow-sm dark:border-slate-800 dark:bg-slate-950/70">
        <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
          Project Members
        </h1>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          จัดการสมาชิกกลุ่มแชทของแต่ละโครงการ (SuperAdmin เท่านั้นที่เพิ่ม/ปิดสิทธิ์ได้)
        </p>
      </div>

      <MembersClient myRole={role} />
    </div>
  );
}