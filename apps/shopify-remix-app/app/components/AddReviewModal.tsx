import React, { useState, useEffect } from "react";
import { useFetcher } from "@remix-run/react";
import { reviewInput } from "../review-input";
import { StarRating } from "./StarRating";
import { ReviewDialog } from "./ReviewDialog";
import { ProductPagination } from "./ProductPagination";
import type { ProductPageInfo, ShopifyProductItem } from "../services/products.server";

interface AddReviewModalProps {
  products: ShopifyProductItem[];
  productPageInfo: ProductPageInfo;
  onClose: () => void;
  onCreated: () => void;
}

export function AddReviewModal({ products, productPageInfo, onClose, onCreated }: AddReviewModalProps) {
  const fetcher = useFetcher<{ success?: boolean; error?: string }>();

  const [productId, setProductId] = useState("");
  const [rating, setRating] = useState(5);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [reviewerName, setReviewerName] = useState("");
  const [reviewerEmail, setReviewerEmail] = useState("");
  const [formError, setFormError] = useState("");

  const isSubmitting = fetcher.state !== "idle";

  // Pre-select first product if available
  useEffect(() => {
    if (!products.some((product) => product.id === productId)) {
      setProductId(products[0]?.id || "");
    }
  }, [products, productId]);

  // Close on success
  useEffect(() => {
    if (fetcher.state === "idle" && fetcher.data?.success) {
      onCreated();
    }
  }, [fetcher.state, fetcher.data, onCreated]);

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData();
    for (const [key, value] of Object.entries({ intent: "create", productId, rating: String(rating), title, body, name: reviewerName, email: reviewerEmail })) form.set(key, value);
    try {
      if (!productId) throw new Error("Please select a product.");
      reviewInput(form);
    } catch (error) {
      setFormError((error as Error).message);
      return;
    }
    setFormError("");
    fetcher.submit(form, { method: "post" });
  };

  return (
    <>
      <ReviewDialog labelledBy="add-review-title" busy={isSubmitting} onClose={onClose}
        style={{
          position: "fixed",
          inset: 0,
          margin: "auto",
          width: "90%",
          maxWidth: "520px",
          backgroundColor: "#FFFFFF",
          borderRadius: "12px",
          boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)",
          zIndex: 999,
          display: "flex",
          flexDirection: "column",
          maxHeight: "90vh",
          overflow: "hidden",
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
          <div>
            <h2 id="add-review-title" style={{ fontSize: "16px", fontWeight: 600, color: "#0F172A", margin: 0 }}>
              Add Customer Review
            </h2>
            <p style={{ fontSize: "13px", color: "#64748B", margin: "2px 0 0 0" }}>
              Manually add a review to your store feedback catalog.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            aria-label="Close add review"
            style={{
              background: "none",
              border: "none",
              padding: "4px",
              cursor: "pointer",
              color: "#64748B",
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} style={{ overflowY: "auto", padding: "20px", display: "flex", flexDirection: "column", gap: "16px" }}>
          <fieldset disabled={isSubmitting} style={{ display: "contents", border: 0, padding: 0, margin: 0 }}>
          {(formError || fetcher.data?.error) && (
            <div role="alert"
              style={{
                padding: "10px 14px",
                backgroundColor: "#FEF2F2",
                border: "1px solid #FECACA",
                borderRadius: "6px",
                color: "#991B1B",
                fontSize: "13px",
              }}
            >
              {formError || fetcher.data?.error}
            </div>
          )}

          {/* Product Select */}
          <div>
            <label htmlFor="review-product" style={{ display: "block", fontSize: "13px", fontWeight: 500, color: "#334155", marginBottom: "4px" }}>
              Product *
            </label>
            <select id="review-product"
              value={productId}
              onChange={(e) => setProductId(e.target.value)}
              style={{
                width: "100%",
                padding: "8px 12px",
                borderRadius: "6px",
                border: "1px solid #CBD5E1",
                fontSize: "14px",
                color: "#0F172A",
                backgroundColor: "#FFFFFF",
                outline: "none",
              }}
            >
              {products.length === 0 && <option value="">No products found</option>}
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title}
                </option>
              ))}
            </select>
            <ProductPagination pageInfo={productPageInfo} />
          </div>

          {/* Rating */}
          <div>
            <label style={{ display: "block", fontSize: "13px", fontWeight: 500, color: "#334155", marginBottom: "6px" }}>
              Rating *
            </label>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
              <StarRating value={rating} interactive size="lg" onChange={setRating} />
              <span style={{ fontSize: "13px", fontWeight: 500, color: "#475569" }}>
                {rating} of 5 stars
              </span>
            </div>
          </div>

          {/* Review Title */}
          <div>
            <label htmlFor="review-title" style={{ display: "block", fontSize: "13px", fontWeight: 500, color: "#334155", marginBottom: "4px" }}>
              Review Title / Headline *
            </label>
            <input
              type="text"
              id="review-title" maxLength={100} required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Exceeded expectations! Very comfortable."
              style={{
                width: "100%",
                padding: "8px 12px",
                borderRadius: "6px",
                border: "1px solid #CBD5E1",
                fontSize: "14px",
                color: "#0F172A",
                outline: "none",
                boxSizing: "border-box",
              }}
            />
          </div>

          {/* Review Body */}
          <div>
            <label htmlFor="review-body" style={{ display: "block", fontSize: "13px", fontWeight: 500, color: "#334155", marginBottom: "4px" }}>
              Review Feedback *
            </label>
            <textarea
              id="review-body" minLength={10} maxLength={2000} required
              rows={3}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Detailed review commentary..."
              style={{
                width: "100%",
                padding: "8px 12px",
                borderRadius: "6px",
                border: "1px solid #CBD5E1",
                fontSize: "14px",
                color: "#0F172A",
                outline: "none",
                resize: "vertical",
                boxSizing: "border-box",
              }}
            />
          </div>

          {/* Customer Name & Email */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
            <div>
              <label htmlFor="review-name" style={{ display: "block", fontSize: "13px", fontWeight: 500, color: "#334155", marginBottom: "4px" }}>
                Customer Name *
              </label>
              <input
                type="text"
                id="review-name" maxLength={60} required
                value={reviewerName}
                onChange={(e) => setReviewerName(e.target.value)}
                placeholder="Jane Doe"
                style={{
                  width: "100%",
                  padding: "8px 12px",
                  borderRadius: "6px",
                  border: "1px solid #CBD5E1",
                  fontSize: "14px",
                  color: "#0F172A",
                  outline: "none",
                  boxSizing: "border-box",
                }}
              />
            </div>

            <div>
              <label htmlFor="review-email" style={{ display: "block", fontSize: "13px", fontWeight: 500, color: "#334155", marginBottom: "4px" }}>
                Customer Email *
              </label>
              <input
                type="email"
                id="review-email" maxLength={254} required
                value={reviewerEmail}
                onChange={(e) => setReviewerEmail(e.target.value)}
                placeholder="jane@example.com"
                style={{
                  width: "100%",
                  padding: "8px 12px",
                  borderRadius: "6px",
                  border: "1px solid #CBD5E1",
                  fontSize: "14px",
                  color: "#0F172A",
                  outline: "none",
                  boxSizing: "border-box",
                }}
              />
            </div>
          </div>

          {/* Footer Buttons */}
          <div
            style={{
              marginTop: "8px",
              paddingTop: "14px",
              borderTop: "1px solid #E2E8F0",
              display: "flex",
              justifyContent: "flex-end",
              gap: "8px",
            }}
          >
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              style={{
                padding: "8px 14px",
                fontSize: "13px",
                fontWeight: 500,
                backgroundColor: "#FFFFFF",
                border: "1px solid #CBD5E1",
                borderRadius: "6px",
                cursor: "pointer",
                color: "#475569",
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              style={{
                padding: "8px 16px",
                fontSize: "13px",
                fontWeight: 500,
                backgroundColor: "#0F172A",
                color: "#FFFFFF",
                border: "none",
                borderRadius: "6px",
                cursor: "pointer",
                opacity: isSubmitting ? 0.7 : 1,
              }}
            >
              {isSubmitting ? "Saving..." : "Save Review"}
            </button>
          </div>
          </fieldset>
        </form>
      </ReviewDialog>
    </>
  );
}
