import React, { useState, useEffect } from "react";
import { useFetcher } from "@remix-run/react";
import { ReviewAttachments } from "./ReviewAttachments";
import { ReviewDialog } from "./ReviewDialog";
import type { ReviewActionResult } from "../review-input";
import { StarRating } from "./StarRating";
import { StatusBadge } from "./StatusBadge";
import type { ReviewDocument } from "../db/reviews.server";

interface ReviewDrawerProps {
  review: ReviewDocument;
  onClose: () => void;
  onDeleted: () => void;
}

export function ReviewDrawer({
  review,
  onClose,
  onDeleted,
}: ReviewDrawerProps) {
  const fetcher = useFetcher<ReviewActionResult>();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [currentStatus, setCurrentStatus] = useState(review.status);

  useEffect(() => {
    setCurrentStatus(review.status);
  }, [review.status]);

  useEffect(() => {
    if (
      fetcher.state === "idle" &&
      fetcher.data?.success &&
      fetcher.data.intent === "delete"
    )
      onDeleted();
    if (
      fetcher.state === "idle" &&
      fetcher.data?.success &&
      fetcher.data.status
    )
      setCurrentStatus(fetcher.data.status);
  }, [fetcher.state, fetcher.data, onDeleted]);

  const isSubmitting = fetcher.state !== "idle";

  const handleStatusChange = (
    newStatus: "published" | "rejected" | "pending",
  ) => {
    fetcher.submit(
      {
        intent: "update_status",
        reviewId: review.id || (review._id as any)?.toString(),
        status: newStatus,
      },
      { method: "post" },
    );
  };

  const handleDelete = () => {
    fetcher.submit(
      {
        intent: "delete",
        reviewId: review.id || (review._id as any)?.toString(),
      },
      { method: "post" },
    );
  };

  const formattedDate = new Date(review.createdAt).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <ReviewDialog
      labelledBy="review-details-title"
      busy={isSubmitting}
      onClose={onClose}
      style={{
        top: 0,
        right: 0,
        bottom: 0,
        margin: "0 0 0 auto",
        height: "100dvh",
        maxHeight: "100dvh",
        width: "100%",
        maxWidth: 540,
        display: "flex",
        flexDirection: "column",
        background: "#fff",
      }}
    >
      <header className="review-dialog-header">
        <div>
          <p className="review-dialog-eyebrow">Customer feedback</p>
          <h2 id="review-details-title">Review details</h2>
        </div>
        <button
          className="review-dialog-close"
          type="button"
          onClick={onClose}
          disabled={isSubmitting}
          aria-label="Close review details"
        >
          ×
        </button>
      </header>
      {(isSubmitting || fetcher.data?.error || fetcher.data?.message) && (
        <div
          className={`review-dialog-message${!isSubmitting && fetcher.data?.error ? " review-dialog-error" : ""}`}
          role={!isSubmitting && fetcher.data?.error ? "alert" : "status"}
          aria-live="polite"
        >
          {isSubmitting
            ? "Saving review…"
            : fetcher.data?.error || fetcher.data?.message}
        </div>
      )}
      <div className="review-dialog-body review-detail-body">
        <section
          className="review-detail-status"
          aria-label="Publication status"
        >
          <StatusBadge status={currentStatus} />
          <p>
            {currentStatus === "published"
              ? "Visible on the product page and included in its rating."
              : currentStatus === "pending"
                ? "Awaiting approval. Hidden from your storefront."
                : "Rejected. Hidden from your storefront."}
          </p>
        </section>
        <section
          className="review-feedback-card"
          aria-labelledby="review-feedback-title"
        >
          <div className="review-feedback-meta">
            <StarRating value={review.rating} size="md" />
            <span>{review.rating} out of 5</span>
          </div>
          <h3 id="review-feedback-title">{review.title}</h3>
          <p>{review.body}</p>
          <time dateTime={new Date(review.createdAt).toISOString()}>
            {formattedDate}
          </time>
        </section>
        {review.media?.length > 0 && (
          <ReviewAttachments reviewId={review.id || ""} media={review.media} />
        )}
        <section
          className="review-detail-section"
          aria-labelledby="review-detail-product"
        >
          <h3 id="review-detail-product">Product</h3>
          <p className="review-detail-value">{review.productTitle}</p>
          {review.variantTitle && <p>{review.variantTitle}</p>}
          <p className="review-field-help">{review.productHandle}</p>
        </section>
        <section
          className="review-detail-section"
          aria-labelledby="review-detail-customer"
        >
          <h3 id="review-detail-customer">Customer</h3>
          <p className="review-detail-value">{review.reviewer.name}</p>
          <p>{review.reviewer.email}</p>
          {review.verifiedPurchase && (
            <p className="review-verified">Verified purchase</p>
          )}
          <p className="review-field-help">
            Email is private and never displayed on your storefront.
          </p>
        </section>
        <section className="review-detail-section" aria-label="Review source">
          <h3>Source</h3>
          <p>
            {review.source === "storefront"
              ? "Submitted on your storefront"
              : review.source === "import"
                ? "Imported review"
                : "Added manually"}
          </p>
        </section>
      </div>
      <footer className="review-dialog-footer review-drawer-footer">
        {showDeleteConfirm ? (
          <div
            className="review-delete-confirm"
            role="group"
            aria-labelledby="review-delete-heading"
          >
            <h3 id="review-delete-heading">Permanently delete this review?</h3>
            <p>
              This removes the review and its rating. This action cannot be
              undone.
            </p>
            <div className="review-dialog-actions">
              <button
                className="review-button"
                type="button"
                onClick={() => setShowDeleteConfirm(false)}
                disabled={isSubmitting}
              >
                Keep review
              </button>
              <button
                className="review-button review-button-danger"
                type="button"
                onClick={handleDelete}
                disabled={isSubmitting}
              >
                {isSubmitting ? "Deleting…" : "Delete permanently"}
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="review-dialog-actions">
              {currentStatus !== "published" && (
                <button
                  className="review-button review-button-primary"
                  type="button"
                  onClick={() => handleStatusChange("published")}
                  disabled={isSubmitting}
                >
                  Publish review
                </button>
              )}
              {currentStatus !== "rejected" && (
                <button
                  className="review-button"
                  type="button"
                  onClick={() => handleStatusChange("rejected")}
                  disabled={isSubmitting}
                >
                  Reject review
                </button>
              )}
              {currentStatus !== "pending" && (
                <button
                  className="review-button"
                  type="button"
                  onClick={() => handleStatusChange("pending")}
                  disabled={isSubmitting}
                >
                  Mark pending
                </button>
              )}
            </div>
            <button
              className="review-delete-link"
              type="button"
              onClick={() => setShowDeleteConfirm(true)}
              disabled={isSubmitting}
            >
              Delete review
            </button>
          </>
        )}
      </footer>
    </ReviewDialog>
  );
}
