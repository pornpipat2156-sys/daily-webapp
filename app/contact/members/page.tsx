// app/contact/members/page.tsx
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
      <div className="mb-4">
        <h1 className="text-xl font-semibold">Project Members</h1>
        <p className="text-sm text-muted-foreground">
          จัดการสมาชิกกลุ่มแชทของแต่ละโครงการ (SuperAdmin เท่านั้นที่เพิ่ม/ปิดสิทธิ์ได้)
        </p>
      </div>

      <MembersClient myRole={role} />
    </div>
  );
}
