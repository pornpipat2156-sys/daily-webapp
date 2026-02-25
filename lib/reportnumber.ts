// lib/reportNumbers.ts
function parseISODateOnly(iso: string) {
  // บังคับเป็นเวลาเที่ยงวันกัน timezone เพี้ยน
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1, 12, 0, 0, 0);
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function diffDaysInclusive(startISO: string, endISO: string) {
  const s = parseISODateOnly(startISO);
  const e = parseISODateOnly(endISO);
  const ms = e.getTime() - s.getTime();
  const days = Math.floor(ms / (24 * 60 * 60 * 1000)) + 1; // inclusive
  return Math.max(1, days);
}

function dayIndexFromStart(startISO: string, reportISO: string) {
  const s = parseISODateOnly(startISO);
  const r = parseISODateOnly(reportISO);
  const ms = r.getTime() - s.getTime();
  const d = Math.floor(ms / (24 * 60 * 60 * 1000)) + 1; // start day = 1
  return d;
}

export function computeAutoNos(args: {
  contractStart: string; // YYYY-MM-DD
  contractEnd: string;   // YYYY-MM-DD
  reportDate: string;    // YYYY-MM-DD
  installmentCount: number;
  annexNoFixed?: string; // ถ้าอยาก fix เช่น "1"
}) {
  const { contractStart, contractEnd, reportDate } = args;
  const installmentCount = Math.max(1, Math.floor(args.installmentCount || 1));

  const totalDays = diffDaysInclusive(contractStart, contractEnd);
  const rawDayNo = dayIndexFromStart(contractStart, reportDate);
  const dayNo = clamp(rawDayNo, 1, totalDays);

  const totalWeeks = Math.ceil(totalDays / 7);
  const weekIndex = Math.floor((dayNo - 1) / 7) + 1;

  const periodLen = totalDays / installmentCount;
  const periodIndex = clamp(Math.ceil(dayNo / periodLen), 1, installmentCount);

  const dailyReportNo = `${dayNo}/${totalDays}`;
  const weekNo = `สัปดาห์ ${weekIndex}/${totalWeeks}`;
  const periodNo = `งวด ${periodIndex}/${installmentCount}`;

  const annexNo = args.annexNoFixed ?? "1"; // ✅ ตามที่คุณต้องการ

  return {
    totalDays,
    dayNo,
    totalWeeks,
    weekIndex,
    periodIndex,
    dailyReportNo,
    weekNo,
    periodNo,
    annexNo,
  };
}
