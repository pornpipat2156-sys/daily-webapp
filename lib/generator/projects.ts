// lib/generator/projects.ts
export type OwnerPerson = {
  name: string;
  position?: string;
};

export type Project = {
  id: string;
  name: string;

  // ใช้ดึงอุณหภูมิอัตโนมัติ (เลือก lat/lon ของไซต์งาน)
  latitude: number;
  longitude: number;

  // ===== Generator-only fields (อิงกับชื่อโครงการเสมอ) =====
  contractNo: string;        // สัญญาจ้าง
  annexNo: string;           // บันทึกแนบท้ายที่
  contractStart: string;     // เริ่มสัญญา (YYYY-MM-DD)
  contractEnd: string;       // สิ้นสุดสัญญา (YYYY-MM-DD)
  contractor: string;        // ผู้รับจ้าง
  siteLocation: string;      // สถานที่ก่อสร้าง
  budgetTHB: number;         // วงเงินค่าก่อสร้าง
  procurementMethod: string; // จัดจ้างโดยวิธี
  installmentCount: number;  // จำนวนงวด
  totalDurationDays: number; // รวมเวลาก่อสร้าง (วัน)

  owners: OwnerPerson[];     // รายชื่อผู้ควบคุมงาน (OWNER) - Generator only
};

// ✅ ตัวอย่างข้อมูล (คุณแก้เพิ่ม/ลดได้เฉพาะที่นี่ = ฝั่ง Generator)
export const PROJECTS: Project[] = [
  {
    id: "cmu-001",
    name: "งานก่อสร้างอาคารบริการวิชาการชุมชน มหาวิทยาลัยเชียงใหม่",
    latitude: 18.796143,
    longitude: 98.979263,

    contractNo: "98/2560",
    annexNo: "1",
    contractStart: "2025-01-01",
    contractEnd: "2025-12-31",
    contractor: "บริษัท ตัวอย่าง จำกัด",
    siteLocation: "มหาวิทยาลัยเชียงใหม่",
    budgetTHB: 24000000,
    procurementMethod: "E-AUCTION",
    installmentCount: 4,
    totalDurationDays: 120,

    owners: [
      { name: "นายสันติภูมิ สิทธิราษฎร์", position: "ผู้ควบคุมงาน" },
      { name: "นางสาวปิยาพรรณ ศิริมาศตย์", position: "ผู้ควบคุมงาน" },
      { name: "นายชัยภูมิ กฬีแปง", position: "หัวหน้าผู้ควบคุมงาน" },
    ],
  },
];
