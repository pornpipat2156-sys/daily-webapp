"use client";

import {
  ReportPreviewForm,
  type IssueRowUnified,
  type ReportRenderModel,
} from "@/components/ReportPreviewReadonly";

function formatDateTimeThai(iso?: string) {
  if (!iso) return "-";

  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;

  return d.toLocaleString("th-TH", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function renderIssueCommentCell(issue: IssueRowUnified) {
  const comments = Array.isArray(issue?.comments) ? issue.comments : [];

  if (!comments.length) {
    return (
      <div
        style={{
          fontSize: 12,
          opacity: 0.6,
          lineHeight: 1.5,
        }}
      >
        ยังไม่มีความคิดเห็น
      </div>
    );
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 6,
      }}
    >
      {comments.map((comment) => {
        const authorName =
          comment.author?.name?.trim() ||
          comment.author?.email?.trim() ||
          "ผู้แสดงความคิดเห็น";
        const authorRole = comment.author?.role?.trim() || "";

        return (
          <div
            key={comment.id}
            style={{
              border: "1px solid #d1d5db",
              borderRadius: 8,
              padding: 6,
              fontSize: 12,
              lineHeight: 1.45,
              background: "#ffffff",
              breakInside: "avoid-page",
              pageBreakInside: "avoid",
            }}
          >
            <div
              style={{
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
              }}
            >
              {comment.comment || "-"}
            </div>

            <div
              style={{
                fontSize: 10,
                color: "#6b7280",
                marginTop: 4,
              }}
            >
              {authorName}
              {authorRole ? ` (${authorRole})` : ""} •{" "}
              {formatDateTimeThai(comment.createdAt)}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function ExportDailyPreviewClient({
  model,
}: {
  model: ReportRenderModel;
}) {
  return (
    <ReportPreviewForm
      model={model}
      renderIssueCommentCell={(issue) => renderIssueCommentCell(issue)}
    />
  );
}