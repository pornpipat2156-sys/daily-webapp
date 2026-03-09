import React from "react";

export type SummaryReportType = "DAILY" | "WEEKLY" | "MONTHLY";

export type SummaryDocumentModel = {
  reportType: SummaryReportType;
  documentTitle: string;
  projectName: string;
  periodLabel: string;
  selectedDate: string;
  title?: string | null;
  summary?: string | null;
  sourceReportIds?: string[];
  projectMeta?: Record<string, unknown> | null;
  payload?: Record<string, unknown> | null;
};

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function prettyLabel(key: string) {
  return String(key || "")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isPrimitive(v: unknown) {
  return (
    v == null ||
    typeof v === "string" ||
    typeof v === "number" ||
    typeof v === "boolean"
  );
}

function formatPrimitive(v: unknown) {
  if (v == null) return "-";
  if (typeof v === "boolean") return v ? "Yes" : "No";
  if (typeof v === "number") return Number.isFinite(v) ? String(v) : "-";
  const s = String(v).trim();
  return s || "-";
}

function toRecord(v: unknown): Record<string, unknown> | null {
  if (!v || typeof v !== "object" || Array.isArray(v)) return null;
  return v as Record<string, unknown>;
}

function toArray(v: unknown): unknown[] {
  return Array.isArray(v) ? v : [];
}

function collectColumnKeys(rows: Record<string, unknown>[]) {
  const set = new Set<string>();
  for (const row of rows.slice(0, 50)) {
    Object.keys(row).forEach((k) => set.add(k));
  }
  return Array.from(set).slice(0, 8);
}

function PrimitiveBlock({
  label,
  value,
}: {
  label: string;
  value: unknown;
}) {
  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white px-4 py-3 dark:border-slate-700/80 dark:bg-slate-900">
      <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">
        {label}
      </div>
      <div className="mt-2 whitespace-pre-wrap break-words text-sm leading-relaxed text-slate-700 dark:text-slate-200">
        {formatPrimitive(value)}
      </div>
    </div>
  );
}

function ArrayTable({
  label,
  rows,
  printMode = false,
}: {
  label: string;
  rows: Record<string, unknown>[];
  printMode?: boolean;
}) {
  const columns = collectColumnKeys(rows);

  if (!columns.length) {
    return (
      <div className="rounded-2xl border border-slate-200/80 bg-white px-4 py-3 dark:border-slate-700/80 dark:bg-slate-900">
        <div className="text-sm font-semibold text-slate-800 dark:text-slate-100">
          {label}
        </div>
        <div className="mt-2 text-sm text-slate-500 dark:text-slate-400">ไม่มีข้อมูล</div>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white dark:border-slate-700/80 dark:bg-slate-900">
      <div className="border-b border-slate-200/80 px-4 py-3 text-sm font-semibold text-slate-800 dark:border-slate-700/80 dark:text-slate-100">
        {label}
      </div>

      <div className={cn("overflow-x-auto", printMode && "overflow-visible")}>
        <table className="min-w-full border-collapse text-sm">
          <thead>
            <tr className="bg-slate-50 dark:bg-slate-800/70">
              {columns.map((col) => (
                <th
                  key={col}
                  className="border-b border-slate-200/80 px-3 py-2 text-left font-semibold text-slate-600 dark:border-slate-700/80 dark:text-slate-200"
                >
                  {prettyLabel(col)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => (
              <tr
                key={idx}
                className="align-top odd:bg-white even:bg-slate-50/60 dark:odd:bg-slate-900 dark:even:bg-slate-800/35"
              >
                {columns.map((col) => (
                  <td
                    key={col}
                    className="border-b border-slate-100 px-3 py-2 text-slate-700 dark:border-slate-800 dark:text-slate-200"
                  >
                    {isPrimitive(row[col]) ? (
                      <span className="whitespace-pre-wrap break-words">
                        {formatPrimitive(row[col])}
                      </span>
                    ) : (
                      <code className="text-xs text-slate-500 dark:text-slate-400">
                        [object]
                      </code>
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function NodeRenderer({
  label,
  value,
  depth = 0,
  printMode = false,
}: {
  label: string;
  value: unknown;
  depth?: number;
  printMode?: boolean;
}) {
  if (isPrimitive(value)) {
    return <PrimitiveBlock label={label} value={value} />;
  }

  const arr = toArray(value);
  if (arr.length > 0) {
    const allPrimitive = arr.every(isPrimitive);
    const allObjects = arr.every((v) => !!toRecord(v));

    if (allPrimitive) {
      return (
        <div className="rounded-2xl border border-slate-200/80 bg-white px-4 py-3 dark:border-slate-700/80 dark:bg-slate-900">
          <div className="text-sm font-semibold text-slate-800 dark:text-slate-100">
            {label}
          </div>
          <ul className="mt-3 space-y-2">
            {arr.map((item, idx) => (
              <li
                key={idx}
                className="rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-700 dark:bg-slate-800/60 dark:text-slate-200"
              >
                {formatPrimitive(item)}
              </li>
            ))}
          </ul>
        </div>
      );
    }

    if (allObjects) {
      return (
        <ArrayTable
          label={label}
          rows={arr.map((v) => v as Record<string, unknown>)}
          printMode={printMode}
        />
      );
    }

    return (
      <div className="rounded-2xl border border-slate-200/80 bg-white px-4 py-3 dark:border-slate-700/80 dark:bg-slate-900">
        <div className="text-sm font-semibold text-slate-800 dark:text-slate-100">
          {label}
        </div>
        <pre className="mt-3 overflow-x-auto whitespace-pre-wrap break-words text-xs text-slate-600 dark:text-slate-300">
          {JSON.stringify(arr, null, 2)}
        </pre>
      </div>
    );
  }

  const obj = toRecord(value);
  if (obj) {
    const entries = Object.entries(obj);
    if (!entries.length) {
      return <PrimitiveBlock label={label} value="-" />;
    }

    return (
      <div className="rounded-2xl border border-slate-200/80 bg-white p-4 dark:border-slate-700/80 dark:bg-slate-900">
        <div className="text-sm font-semibold text-slate-800 dark:text-slate-100">
          {label}
        </div>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          {entries.map(([k, v]) => (
            <div key={`${label}-${k}`} className={cn(depth > 1 && "md:col-span-2")}>
              <NodeRenderer
                label={prettyLabel(k)}
                value={v}
                depth={depth + 1}
                printMode={printMode}
              />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return <PrimitiveBlock label={label} value={String(value)} />;
}

export function SummaryAggregatePreview({
  model,
  printMode = false,
}: {
  model: SummaryDocumentModel;
  printMode?: boolean;
}) {
  const payloadEntries = Object.entries(model.payload || {});
  const metaEntries = Object.entries(model.projectMeta || {}).filter(
    ([k, v]) => k !== "supervisors" && v != null && String(v).trim() !== ""
  );

  return (
    <div
      className={cn(
        "mx-auto w-full max-w-[794px] rounded-[28px] border border-slate-200 bg-white p-5 text-slate-900 shadow-[0_20px_60px_rgba(15,23,42,0.10)] dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 sm:p-8",
        printMode &&
          "max-w-none rounded-none border-0 bg-white p-0 text-slate-900 shadow-none dark:border-0 dark:bg-white dark:text-slate-900"
      )}
    >
      <div className="border-b border-slate-200 pb-5 dark:border-slate-800">
        <div className="text-center">
          <div className="text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-400">
            {model.reportType} Report
          </div>
          <h1 className="mt-3 text-2xl font-semibold tracking-tight">
            {model.documentTitle || "Report Preview"}
          </h1>
          <div className="mt-3 space-y-1 text-sm text-slate-600 dark:text-slate-300">
            <div>โครงการ: {model.projectName || "-"}</div>
            <div>ช่วงรายงาน: {model.periodLabel || "-"}</div>
            <div>อ้างอิงวันที่เลือก: {model.selectedDate || "-"}</div>
          </div>
        </div>
      </div>

      {(model.title || model.summary) && (
        <section className="mt-6 space-y-4">
          {model.title ? (
            <div className="rounded-2xl border border-slate-200/80 bg-slate-50 px-4 py-3 dark:border-slate-700/80 dark:bg-slate-900">
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">
                Title
              </div>
              <div className="mt-2 text-base font-semibold text-slate-800 dark:text-slate-100">
                {model.title}
              </div>
            </div>
          ) : null}

          {model.summary ? (
            <div className="rounded-2xl border border-slate-200/80 bg-slate-50 px-4 py-3 dark:border-slate-700/80 dark:bg-slate-900">
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">
                Summary
              </div>
              <div className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-slate-700 dark:text-slate-200">
                {model.summary}
              </div>
            </div>
          ) : null}
        </section>
      )}

      {metaEntries.length > 0 ? (
        <section className="mt-6">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
            Project Information
          </h2>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            {metaEntries.map(([k, v]) => (
              <PrimitiveBlock key={k} label={prettyLabel(k)} value={v} />
            ))}
          </div>
        </section>
      ) : null}

      {model.sourceReportIds?.length ? (
        <section className="mt-6">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
            Source Reports
          </h2>
          <div className="mt-3 grid gap-2">
            {model.sourceReportIds.map((id) => (
              <div
                key={id}
                className="rounded-xl border border-slate-200/80 bg-slate-50 px-3 py-2 text-sm text-slate-700 dark:border-slate-700/80 dark:bg-slate-900 dark:text-slate-200"
              >
                {id}
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <section className="mt-6">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
          Preview Data
        </h2>

        {payloadEntries.length === 0 ? (
          <div className="mt-3 rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400">
            ไม่พบ payload สำหรับแสดงผล
          </div>
        ) : (
          <div className="mt-3 grid gap-3">
            {payloadEntries.map(([k, v]) => (
              <NodeRenderer
                key={k}
                label={prettyLabel(k)}
                value={v}
                printMode={printMode}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}