import React from "react";
import type { ReviewStats } from "../db/reviews.server";

interface SummaryMetricsProps {
  stats: ReviewStats;
}

export function SummaryMetrics({ stats }: SummaryMetricsProps) {
  const items = [
    {
      label: "Total Reviews",
      value: stats.total,
      subtext: "Across all statuses",
    },
    {
      label: "Published",
      value: stats.published,
      color: "#059669",
      subtext: "Live on store",
    },
    {
      label: "Pending Moderation",
      value: stats.pending,
      color: stats.pending > 0 ? "#D97706" : undefined,
      subtext: "Awaiting review",
    },
    {
      label: "Average Rating",
      value: stats.averageRating > 0 ? stats.averageRating.toFixed(1) : "—",
      subtext:
        stats.total > 0 ? "Across all review statuses" : "No ratings yet",
    },
  ];

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
        backgroundColor: "#FFFFFF",
        border: "1px solid #E2E8F0",
        borderRadius: "10px",
        overflow: "hidden",
        boxShadow: "0 1px 2px 0 rgba(0, 0, 0, 0.03)",
        marginBottom: "16px",
      }}
    >
      {items.map((item, index) => (
        <div
          key={item.label}
          style={{
            padding: "20px",
            borderRight:
              index < items.length - 1 ? "1px solid #F1F5F9" : "none",
            display: "flex",
            flexDirection: "column",
            gap: "2px",
          }}
        >
          <span
            style={{
              fontSize: "12px",
              fontWeight: 500,
              color: "#64748B",
              textTransform: "uppercase",
              letterSpacing: "0.04em",
            }}
          >
            {item.label}
          </span>
          <div
            style={{
              fontSize: "28px",
              fontWeight: 600,
              color: item.color || "#0F172A",
              letterSpacing: "-0.02em",
              lineHeight: 1.2,
            }}
          >
            {item.value}
          </div>
          <span style={{ fontSize: "11px", color: "#61666A" }}>
            {item.subtext}
          </span>
        </div>
      ))}
    </div>
  );
}
