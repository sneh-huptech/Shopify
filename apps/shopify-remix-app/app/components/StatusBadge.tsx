import React from "react";
import type { ReviewStatus } from "../db/reviews.server";

interface StatusBadgeProps {
  status: ReviewStatus;
}

const STATUS_CONFIG: Record<
  ReviewStatus,
  { label: string; bg: string; text: string; dot: string; border: string }
> = {
  published: {
    label: "Published",
    bg: "#ECFDF5",
    text: "#065F46",
    dot: "#10B981",
    border: "#A7F3D0",
  },
  pending: {
    label: "Pending",
    bg: "#FFFBEB",
    text: "#92400E",
    dot: "#F59E0B",
    border: "#FDE68A",
  },
  rejected: {
    label: "Rejected",
    bg: "#FEF2F2",
    text: "#991B1B",
    dot: "#EF4444",
    border: "#FECACA",
  },
};

export function StatusBadge({ status }: StatusBadgeProps) {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.pending;

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "6px",
        padding: "3px 8px",
        borderRadius: "12px",
        fontSize: "12px",
        fontWeight: 500,
        backgroundColor: config.bg,
        color: config.text,
        border: `1px solid ${config.border}`,
        lineHeight: 1.2,
      }}
    >
      <span
        style={{
          width: "6px",
          height: "6px",
          borderRadius: "50%",
          backgroundColor: config.dot,
        }}
      />
      {config.label}
    </span>
  );
}
