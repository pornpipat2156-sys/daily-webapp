"use client";

import { useMemo } from "react";

export type WeeklyProjectSummary = {
  projectName: string;
  contractNo: string;
  installmentLabel: string;
  contractorName: string;
  siteLocation: string;
  contractStart: string;
  contractEnd: string;
  contractValue: string;
  procurementMethod?: string;
  periodNo?: string;
};

export type WeeklyTimeSummary = {
  contractDays: number;
  previousUsedDays: number;
  currentWeekDays: number;
  accumulatedDays: number;
  remainingDays: number;
  plannedDays?: number | null;
  varianceDays?: number | null;
};

export type WeeklyWorkItem = {
  id: string;
  description: string;
  qty?: number | null;
  unit?: string | null;
  location?: string | null;
  remark?: string | null;
};

export type WeeklyProblemItem = {
  id: string;
  topic: string;
  impact?: string | null;
  solution?: string | null;
};

export type WeeklySafetySummary = {
  note: string;
  accidentCount?: number | null;
  injuredCount?: number | null;
  lostTimeCount?: number | null;
};

export type WeeklyProgressItem = {
  id: string;
  category: string;
  weightPercent: number;
  previousPercent: number;
  weeklyPercent: number;
  accumulatedPercent: number;
  remainingPercent: number;
  variancePercent?: number | null;
  plannedPercent?: number | null;
  amountTotal?: number | null;
  amountAccumulated?: number | null;
  amountRemaining?: number | null;
};

export type WeeklySupervisor = {
  name: string;
  role: string;
};

export type WeeklyReportModel = {
  id: string;
  projectId: string;
  year: number;
  weekNo: number;
  startDate: string;
  endDate: string;
  title: string;
  summary: WeeklyProjectSummary;
  timeSummary: WeeklyTimeSummary;
  workPerformedWeekly: WeeklyWorkItem[];
  comments: string;
  problemsAndObstacles: WeeklyProblemItem[];
  safety: WeeklySafetySummary;
  progressByCategory: WeeklyProgressItem[];
  supervisors: WeeklySupervisor[];
  createdAt?: string;
  updatedAt?: string;
};

type Props = {
  model: WeeklyReportModel | null;
  loading?: boolean;
  error?: string;
};

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function formatDateThai(input?: string | null) {
  if (!input) return "-";
  const d = new Date(input);
  if (Number.isNaN(d.getTime())) return input;
  return `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}/${d.getFullYear() + 543}`;
}

function formatNumber(value?: number | null, digits = 2) {
  if (value == null || Number.isNaN(Number(value))) return "-";
  return Number(value).toLocaleString("th-TH", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

function formatInteger(value?: number | null) {
  if (value == null || Number.isNaN(Number(value))) return "-";
  return Number(value).toLocaleString("th-TH", {
    maximumFractionDigits: 0,
  });
}

function textOrDash(value?: string | null) {
  const v = String(value ?? "").trim();
  return v || "-";
}

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function Section({
  title,
  children,
  className,
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cx(
        "rounded-[28px] border border-slate-200/70 bg-white/90 p-5 shadow-[0_20px_50px_rgba(15,23,42,0.08)] dark:border-white/10 dark:bg-slate-950/50",
        className
      )}
    >
      <div className="mb-4">
        <div className="text-[11px] font-semibold uppercase tracking-[0.32em] text-slate-500 dark:text-slate-400">
          {title}
        </div>
      </div>
      {children}
    </section>
  );
}

function InfoField({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-slate-200/70 bg-slate-50/80 px-4 py-3 dark:border-white/10 dark:bg-white/[0.03]">
      <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.28em] text-slate-500 dark:text-slate-400">
        {label}
      </div>
      <div className="text-sm font-medium text-slate-800 dark:text-slate-100">{value}</div>
    </div>
  );
}

function Signatures({ items }: { items: WeeklySupervisor[] }) {
  const rows = useMemo(() => {
    const clean = (items || []).filter((x) => x?.name?.trim() || x?.role?.trim());
    const chunked: WeeklySupervisor[][] = [];
    for (let i = 0; i < clean.length; i += 3) {
      chunked.push(clean.slice(i, i + 3));
    }
    return chunked;
  }, [items]);

  if (!rows.length) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 px-4 py-6 text-sm text-slate-500 dark:border-white/10 dark:text-slate-400">
        ยังไม่มีข้อมูลผู้ลงนาม
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {rows.map((row, rowIndex) => (
        <div key={rowIndex} className="grid gap-4 md:grid-cols-3">
          {row.map((item, index) => (
            <div
              key={`${item.name}-${item.role}-${index}`}
              className="rounded-2xl border border-slate-200/70 bg-slate-50/70 px-4 py-5 text-center dark:border-white/10 dark:bg-white/[0.03]"
            >
              <div className="mb-8 text-sm text-slate-600 dark:text-slate-300">
                ลงชื่อ .........................................
              </div>
              <div className="text-base font-semibold text-slate-900 dark:text-white">
                ({textOrDash(item.name)})
              </div>
              <div className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                {textOrDash(item.role)}
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

export function WeeklyReportForm({ model, loading, error }: Props) {
  if (loading) {
    return (
      <div className="rounded-[32px] border border-slate-200/70 bg-white/90 p-8 shadow-[0_24px_80px_rgba(15,23,42,0.10)] dark:border-white/10 dark:bg-slate-950/70">
        <div className="animate-pulse space-y-4">
          <div className="h-4 w-40 rounded bg-slate-200 dark:bg-white/10" />
          <div className="h-10 w-80 rounded bg-slate-200 dark:bg-white/10" />
          <div className="h-28 rounded-3xl bg-slate-200 dark:bg-white/10" />
          <div className="grid gap-4 md:grid-cols-2">
            <div className="h-48 rounded-3xl bg-slate-200 dark:bg-white/10" />
            <div className="h-48 rounded-3xl bg-slate-200 dark:bg-white/10" />
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-[32px] border border-rose-200 bg-rose-50 px-6 py-5 text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300">
        {error}
      </div>
    );
  }

  if (!model) {
    return (
      <div className="rounded-[32px] border border-dashed border-slate-300 bg-white/70 px-6 py-10 text-center text-slate-500 dark:border-white/10 dark:bg-slate-950/40 dark:text-slate-400">
        กรุณาเลือกโครงการและรายงานประจำสัปดาห์
      </div>
    );
  }

  const totalWeight = model.progressByCategory.reduce(
    (sum, item) => sum + Number(item.weightPercent || 0),
    0
  );
  const totalPrev = model.progressByCategory.reduce(
    (sum, item) => sum + Number(item.previousPercent || 0),
    0
  );
  const totalWeekly = model.progressByCategory.reduce(
    (sum, item) => sum + Number(item.weeklyPercent || 0),
    0
  );
  const totalAccum = model.progressByCategory.reduce(
    (sum, item) => sum + Number(item.accumulatedPercent || 0),
    0
  );
  const totalRemain = model.progressByCategory.reduce(
    (sum, item) => sum + Number(item.remainingPercent || 0),
    0
  );

  return (
    <div className="rounded-[36px] border border-slate-200/70 bg-white/95 p-4 shadow-[0_30px_90px_rgba(15,23,42,0.12)] dark:border-white/10 dark:bg-[#071225]/95 md:p-7">
      <div className="rounded-[32px] border border-slate-200/70 bg-[linear-gradient(180deg,rgba(248,250,252,0.96),rgba(255,255,255,0.92))] px-4 py-7 dark:border-white/10 dark:bg-[linear-gradient(180deg,rgba(10,20,40,0.98),rgba(8,15,28,0.96))] md:px-8 md:py-10">
        <div className="mx-auto max-w-6xl space-y-6">
          <header className="rounded-[28px] border border-slate-200/70 bg-slate-50/70 px-5 py-8 text-center dark:border-white/10 dark:bg-white/[0.03]">
            <div className="text-xs font-semibold uppercase tracking-[0.42em] text-slate-500 dark:text-slate-400">
              Weekly Report
            </div>
            <h1 className="mt-4 text-3xl font-bold tracking-tight text-slate-900 dark:text-white md:text-5xl">
              {textOrDash(model.title)}
            </h1>
            <div className="mt-5 space-y-2 text-base text-slate-700 dark:text-slate-200 md:text-xl">
              <div>โครงการ: {textOrDash(model.summary.projectName)}</div>
              <div>
                ช่วงรายงาน: {formatDateThai(model.startDate)} ถึง {formatDateThai(model.endDate)}
              </div>
              <div>
                อ้างอิงสัปดาห์ที่: {model.weekNo} / ปี {model.year}
              </div>
            </div>
          </header>

          <div className="grid gap-6 xl:grid-cols-[1.08fr_0.92fr]">
            <Section title="Title">
              <div className="text-2xl font-semibold text-slate-900 dark:text-white">
                {textOrDash(model.title)}
              </div>
            </Section>

            <Section title="Period & metadata">
              <div className="grid gap-3 sm:grid-cols-2">
                <InfoField label="Week No." value={model.weekNo} />
                <InfoField label="Year" value={model.year} />
                <InfoField
                  label="Start Date"
                  value={formatDateThai(model.startDate)}
                />
                <InfoField label="End Date" value={formatDateThai(model.endDate)} />
              </div>
            </Section>
          </div>

          <Section title="Summary">
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              <InfoField label="โครงการ" value={textOrDash(model.summary.projectName)} />
              <InfoField label="เลขที่สัญญา" value={textOrDash(model.summary.contractNo)} />
              <InfoField label="งวดงาน" value={textOrDash(model.summary.installmentLabel)} />
              <InfoField label="ผู้รับจ้าง" value={textOrDash(model.summary.contractorName)} />
              <InfoField label="สถานที่ก่อสร้าง" value={textOrDash(model.summary.siteLocation)} />
              <InfoField label="มูลค่าสัญญา" value={textOrDash(model.summary.contractValue)} />
              <InfoField label="วันเริ่มสัญญา" value={formatDateThai(model.summary.contractStart)} />
              <InfoField label="วันสิ้นสุดสัญญา" value={formatDateThai(model.summary.contractEnd)} />
              <InfoField
                label="วิธีการจัดซื้อจัดจ้าง"
                value={textOrDash(model.summary.procurementMethod)}
              />
            </div>
          </Section>

          <Section title="Time summary">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <InfoField
                label="ระยะเวลาตามสัญญา (วัน)"
                value={formatInteger(model.timeSummary.contractDays)}
              />
              <InfoField
                label="ใช้ไปแล้วสัปดาห์ก่อน (วัน)"
                value={formatInteger(model.timeSummary.previousUsedDays)}
              />
              <InfoField
                label="สัปดาห์นี้ (วัน)"
                value={formatInteger(model.timeSummary.currentWeekDays)}
              />
              <InfoField
                label="สะสม (วัน)"
                value={formatInteger(model.timeSummary.accumulatedDays)}
              />
              <InfoField
                label="คงเหลือ (วัน)"
                value={formatInteger(model.timeSummary.remainingDays)}
              />
              <InfoField
                label="แผน (วัน)"
                value={formatInteger(model.timeSummary.plannedDays ?? null)}
              />
              <InfoField
                label="คลาดเคลื่อน (วัน)"
                value={formatInteger(model.timeSummary.varianceDays ?? null)}
              />
            </div>
          </Section>

          <Section title="Work performed weekly">
            {model.workPerformedWeekly.length ? (
              <div className="overflow-x-auto">
                <table className="min-w-full border-separate border-spacing-0 overflow-hidden rounded-2xl">
                  <thead>
                    <tr className="bg-slate-100 text-left text-xs uppercase tracking-[0.2em] text-slate-600 dark:bg-white/[0.05] dark:text-slate-300">
                      <th className="px-4 py-3">ลำดับ</th>
                      <th className="px-4 py-3">รายการงาน</th>
                      <th className="px-4 py-3">ตำแหน่ง</th>
                      <th className="px-4 py-3">ปริมาณ</th>
                      <th className="px-4 py-3">หน่วย</th>
                      <th className="px-4 py-3">หมายเหตุ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {model.workPerformedWeekly.map((item, index) => (
                      <tr
                        key={item.id}
                        className="align-top odd:bg-white even:bg-slate-50/60 dark:odd:bg-transparent dark:even:bg-white/[0.025]"
                      >
                        <td className="border-t border-slate-200/70 px-4 py-3 text-sm dark:border-white/10">
                          {index + 1}
                        </td>
                        <td className="border-t border-slate-200/70 px-4 py-3 text-sm text-slate-900 dark:border-white/10 dark:text-slate-100">
                          {textOrDash(item.description)}
                        </td>
                        <td className="border-t border-slate-200/70 px-4 py-3 text-sm dark:border-white/10">
                          {textOrDash(item.location)}
                        </td>
                        <td className="border-t border-slate-200/70 px-4 py-3 text-sm dark:border-white/10">
                          {item.qty == null ? "-" : formatNumber(item.qty, 2)}
                        </td>
                        <td className="border-t border-slate-200/70 px-4 py-3 text-sm dark:border-white/10">
                          {textOrDash(item.unit)}
                        </td>
                        <td className="border-t border-slate-200/70 px-4 py-3 text-sm dark:border-white/10">
                          {textOrDash(item.remark)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-300 px-4 py-6 text-sm text-slate-500 dark:border-white/10 dark:text-slate-400">
                ยังไม่มีรายการงานประจำสัปดาห์
              </div>
            )}
          </Section>

          <div className="grid gap-6 xl:grid-cols-2">
            <Section title="Comments">
              <div className="min-h-40 whitespace-pre-wrap rounded-2xl border border-slate-200/70 bg-slate-50/70 px-4 py-4 text-sm leading-7 text-slate-800 dark:border-white/10 dark:bg-white/[0.03] dark:text-slate-200">
                {textOrDash(model.comments)}
              </div>
            </Section>

            <Section title="Safety">
              <div className="grid gap-3 sm:grid-cols-3">
                <InfoField
                  label="Accident"
                  value={formatInteger(model.safety.accidentCount ?? 0)}
                />
                <InfoField
                  label="Injured"
                  value={formatInteger(model.safety.injuredCount ?? 0)}
                />
                <InfoField
                  label="Lost Time"
                  value={formatInteger(model.safety.lostTimeCount ?? 0)}
                />
              </div>
              <div className="mt-4 min-h-40 whitespace-pre-wrap rounded-2xl border border-slate-200/70 bg-slate-50/70 px-4 py-4 text-sm leading-7 text-slate-800 dark:border-white/10 dark:bg-white/[0.03] dark:text-slate-200">
                {textOrDash(model.safety.note)}
              </div>
            </Section>
          </div>

          <Section title="Problems and obstacles">
            {model.problemsAndObstacles.length ? (
              <div className="space-y-4">
                {model.problemsAndObstacles.map((item, index) => (
                  <div
                    key={item.id}
                    className="rounded-2xl border border-slate-200/70 bg-slate-50/70 p-4 dark:border-white/10 dark:bg-white/[0.03]"
                  >
                    <div className="mb-2 text-sm font-semibold text-slate-900 dark:text-white">
                      {index + 1}. {textOrDash(item.topic)}
                    </div>
                    <div className="grid gap-3 md:grid-cols-2">
                      <InfoField label="ผลกระทบ" value={textOrDash(item.impact)} />
                      <InfoField label="แนวทางแก้ไข" value={textOrDash(item.solution)} />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-300 px-4 py-6 text-sm text-slate-500 dark:border-white/10 dark:text-slate-400">
                ไม่มีปัญหาและอุปสรรค
              </div>
            )}
          </Section>

          <Section title="Progress summary">
            {model.progressByCategory.length ? (
              <div className="overflow-x-auto">
                <table className="min-w-full border-separate border-spacing-0 overflow-hidden rounded-2xl">
                  <thead>
                    <tr className="bg-slate-100 text-left text-xs uppercase tracking-[0.18em] text-slate-600 dark:bg-white/[0.05] dark:text-slate-300">
                      <th className="px-4 py-3">หมวดงาน</th>
                      <th className="px-4 py-3">น้ำหนัก (%)</th>
                      <th className="px-4 py-3">ก่อนหน้า (%)</th>
                      <th className="px-4 py-3">สัปดาห์นี้ (%)</th>
                      <th className="px-4 py-3">สะสม (%)</th>
                      <th className="px-4 py-3">คงเหลือ (%)</th>
                      <th className="px-4 py-3">แผน (%)</th>
                      <th className="px-4 py-3">คลาดเคลื่อน (%)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {model.progressByCategory.map((item) => (
                      <tr
                        key={item.id}
                        className="odd:bg-white even:bg-slate-50/60 dark:odd:bg-transparent dark:even:bg-white/[0.025]"
                      >
                        <td className="border-t border-slate-200/70 px-4 py-3 text-sm font-medium text-slate-900 dark:border-white/10 dark:text-slate-100">
                          {textOrDash(item.category)}
                        </td>
                        <td className="border-t border-slate-200/70 px-4 py-3 text-sm dark:border-white/10">
                          {formatNumber(item.weightPercent)}
                        </td>
                        <td className="border-t border-slate-200/70 px-4 py-3 text-sm dark:border-white/10">
                          {formatNumber(item.previousPercent)}
                        </td>
                        <td className="border-t border-slate-200/70 px-4 py-3 text-sm dark:border-white/10">
                          {formatNumber(item.weeklyPercent)}
                        </td>
                        <td className="border-t border-slate-200/70 px-4 py-3 text-sm dark:border-white/10">
                          {formatNumber(item.accumulatedPercent)}
                        </td>
                        <td className="border-t border-slate-200/70 px-4 py-3 text-sm dark:border-white/10">
                          {formatNumber(item.remainingPercent)}
                        </td>
                        <td className="border-t border-slate-200/70 px-4 py-3 text-sm dark:border-white/10">
                          {formatNumber(item.plannedPercent ?? null)}
                        </td>
                        <td className="border-t border-slate-200/70 px-4 py-3 text-sm dark:border-white/10">
                          {formatNumber(item.variancePercent ?? null)}
                        </td>
                      </tr>
                    ))}

                    <tr className="bg-slate-100/80 font-semibold dark:bg-white/[0.06]">
                      <td className="border-t border-slate-200/70 px-4 py-3 text-sm text-slate-900 dark:border-white/10 dark:text-white">
                        รวม
                      </td>
                      <td className="border-t border-slate-200/70 px-4 py-3 text-sm dark:border-white/10">
                        {formatNumber(totalWeight)}
                      </td>
                      <td className="border-t border-slate-200/70 px-4 py-3 text-sm dark:border-white/10">
                        {formatNumber(totalPrev)}
                      </td>
                      <td className="border-t border-slate-200/70 px-4 py-3 text-sm dark:border-white/10">
                        {formatNumber(totalWeekly)}
                      </td>
                      <td className="border-t border-slate-200/70 px-4 py-3 text-sm dark:border-white/10">
                        {formatNumber(totalAccum)}
                      </td>
                      <td className="border-t border-slate-200/70 px-4 py-3 text-sm dark:border-white/10">
                        {formatNumber(totalRemain)}
                      </td>
                      <td className="border-t border-slate-200/70 px-4 py-3 text-sm dark:border-white/10">
                        -
                      </td>
                      <td className="border-t border-slate-200/70 px-4 py-3 text-sm dark:border-white/10">
                        -
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-300 px-4 py-6 text-sm text-slate-500 dark:border-white/10 dark:text-slate-400">
                ยังไม่มีตารางสรุปความก้าวหน้า
              </div>
            )}
          </Section>

          <Section title="Approvals">
            <Signatures items={model.supervisors} />
          </Section>
        </div>
      </div>
    </div>
  );
}

export default WeeklyReportForm;