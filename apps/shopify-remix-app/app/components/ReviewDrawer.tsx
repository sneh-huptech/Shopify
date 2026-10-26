import React, { useState } from "react";
import { useFetcher } from "@remix-run/react";
import { StarRating } from "./StarRating";
import { StatusBadge } from "./StatusBadge";
import type { ReviewDocument } from "../db/reviews.server";

interface ReviewDrawerProps {
  review: ReviewDocument | null;
  isOpen: boolean;
  onClose: () => void;
}

export function ReviewDrawer({ review, isOpen, onClose }: ReviewDrawerProps) {
  const fetcher = useFetcher();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  if (!isOpen || !review) return null;

  const isSubmitting = fetcher.state !== "idle";

  const handleStatusChange = (newStatus: "published" | "rejected" | "pending") => {
    fetcher.submit(
      {
        intent: "update_status",
        reviewId: review.id || (review._id as any)?.toString(),
        status: newStatus,
      },
      { method: "post" }
    );
  };

  const handleDelete = () => {
    fetcher.submit(
      {
        intent: "delete",
        reviewId: review.id || (review._id as any)?.toString(),
      },
      { method: "post" }
    );
    setShowDeleteConfirm(false);
    onClose();
  };

  const formattedDate = new Date(review.createdAt).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          backgroundColor: "rgba(15, 23, 42, 0.4)",
          backdropFilter: "blur(2px)",
          zIndex: 998,
          transition: "opacity 150ms ease",
        }}
      />

      {/* Drawer Panel */}
      <div
        style={{
          position: "fixed",
          top: 0,
          right: 0,
          bottom: 0,
          width: "100%",
          maxWidth: "480px",
          backgroundColor: "#FFFFFF",
          boxShadow: "-4px 0 24px rgba(0, 0, 0, 0.12)",
          zIndex: 999,
          display: "flex",
          flexDirection: "column",
          animation: "slideInRight 200ms cubic-bezier(0.16, 1, 0.3, 1)",
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: "16px 20px",
            borderBottom: "1px solid #E2E8F0",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <h2 style={{ fontSize: "16px", fontWeight: 600, color: "#0F172A", margin: 0 }}>
              Review Details
            </h2>
            <StatusBadge status={review.status} />
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              padding: "6px",
              cursor: "pointer",
              color: "#64748B",
              borderRadius: "6px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content Body */}
        <div style={{ flex: 1, overflowY: "auto", padding: "20px", display: "flex", flexDirection: "column", gap: "20px" }}>
          {/* Review Content Card */}
          <div
            style={{
              padding: "16px",
              backgroundColor: "#F8FAFC",
              borderRadius: "8px",
              border: "1px solid #E2E8F0",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "10px" }}>
              <StarRating value={review.rating} size="md" />
              <span style={{ fontSize: "12px", color: "#64748B" }}>{formattedDate}</span>
            </div>

            <h3 style={{ fontSize: "15px", fontWeight: 600, color: "#0F172A", margin: "0 0 8px 0" }}>
              {review.title}
            </h3>
            <p style={{ fontSize: "14px", color: "#334155", margin: 0, lineHeight: 1.5, whiteSpace: "pre-wrap" }}>
              {review.body}
            </p>
          </div>

          {/* Product Info */}
          <div>
            <span style={{ fontSize: "12px", fontWeight: 600, color: "#64748B", textTransform: "uppercase", letterSpacing: "0.04em" }}>
              Product
            </span>
            <div
              style={{
                marginTop: "6px",
                padding: "12px 14px",
                borderRadius: "8px",
                border: "1px solid #E2E8F0",
                backgroundColor: "#FFFFFF",
                display: "flex",
                flexDirection: "column",
                gap: "2px",
              }}
            >
              <span style={{ fontSize: "14px", fontWeight: 500, color: "#0F172A" }}>
                {review.productTitle}
              </span>
              <span style={{ fontSize: "12px", color: "#64748B" }}>
                Handle: {review.productHandle}
              </span>
            </div>
          </div>

          {/* Reviewer Info */}
          <div>
            <span style={{ fontSize: "12px", fontWeight: 600, color: "#64748B", textTransform: "uppercase", letterSpacing: "0.04em" }}>
              Customer Details
            </span>
            <div
              style={{
                marginTop: "6px",
                padding: "12px 14px",
                borderRadius: "8px",
                border: "1px solid #E2E8F0",
                backgroundColor: "#FFFFFF",
                display: "flex",
                flexDirection: "column",
                gap: "6px",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: "14px", fontWeight: 500, color: "#0F172A" }}>
                  {review.reviewer.name}
                </span>
                {review.verifiedPurchase && (
                  <span
                    style={{
                      fontSize: "11px",
                      fontWeight: 500,
                      color: "#047857",
                      backgroundColor: "#D1FAE5",
                      padding: "2px 6px",
                      borderRadius: "4px",
                    }}
                  >
                    Verified Purchase
                  </span>
                )}
              </div>
              <span style={{ fontSize: "13px", color: "#64748B" }}>
                {review.reviewer.email}
              </span>
              <span style={{ fontSize: "11px", color: "#94A3B8" }}>
                Source: {review.source === "storefront" ? "Storefront" : "Manual"}
              </span>
            </div>
          </div>

          {/* Delete Confirmation Warning */}
          {showDeleteConfirm && (
            <div
              style={{
                padding: "14px",
                backgroundColor: "#FEF2F2",
                border: "1px solid #FCA5A5",
                borderRadius: "8px",
                display: "flex",
                flexDirection: "column",
                gap: "10px",
              }}
            >
              <div style={{ fontSize: "13px", fontWeight: 500, color: "#991B1B" }}>
                Are you sure you want to delete this review? This action cannot be undone.
              </div>
              <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(false)}
                  style={{
                    padding: "6px 12px",
                    fontSize: "12px",
                    fontWeight: 500,
                    backgroundColor: "#FFFFFF",
                    border: "1px solid #D1D5DB",
                    borderRadius: "6px",
                    cursor: "pointer",
                  }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={isSubmitting}
                  style={{
                    padding: "6px 12px",
                    fontSize: "12px",
                    fontWeight: 500,
                    backgroundColor: "#DC2626",
                    color: "#FFFFFF",
                    border: "none",
                    borderRadius: "6px",
                    cursor: "pointer",
                  }}
                >
                  Confirm Delete
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Action Footer */}
        <div
          style={{
            padding: "16px 20px",
            borderTop: "1px solid #E2E8F0",
            backgroundColor: "#F8FAFC",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <button
            type="button"
            onClick={() => setShowDeleteConfirm(true)}
            disabled={isSubmitting}
            style={{
              padding: "7px 12px",
              fontSize: "13px",
              fontWeight: 500,
              color: "#DC2626",
              backgroundColor: "transparent",
              border: "1px solid #FCA5A5",
              borderRadius: "6px",
              cursor: "pointer",
            }}
          >
            Delete
          </button>

          <div style={{ display: "flex", gap: "8px" }}>
            {review.status !== "published" && (
              <button
                type="button"
                onClick={() => handleStatusChange("published")}
                disabled={isSubmitting}
                style={{
                  padding: "7px 14px",
                  fontSize: "13px",
                  fontWeight: 500,
                  backgroundColor: "#059669",
                  color: "#FFFFFF",
                  border: "none",
                  borderRadius: "6px",
                  cursor: "pointer",
                }}
              >
                Publish
              </button>
            )}

            {review.status !== "rejected" && (
              <button
                type="button"
                onClick={() => handleStatusChange("rejected")}
                disabled={isSubmitting}
                style={{
                  padding: "7px 14px",
                  fontSize: "13px",
                  fontWeight: 500,
                  backgroundColor: "#FFFFFF",
                  color: "#B91C1C",
                  border: "1px solid #FCA5A5",
                  borderRadius: "6px",
                  cursor: "pointer",
                }}
              >
                Reject
              </button>
            )}

            {review.status !== "pending" && (
              <button
                type="button"
                onClick={() => handleStatusChange("pending")}
                disabled={isSubmitting}
                style={{
                  padding: "7px 14px",
                  fontSize: "13px",
                  fontWeight: 500,
                  backgroundColor: "#FFFFFF",
                  color: "#475569",
                  border: "1px solid #CBD5E1",
                  borderRadius: "6px",
                  cursor: "pointer",
                }}
              >
                Mark Pending
              </button>
            )}
          </div>
        </div>
      </div>

      <style>{`
        @keyframes slideInRight {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
      `}</style>
    </>
  );
}
