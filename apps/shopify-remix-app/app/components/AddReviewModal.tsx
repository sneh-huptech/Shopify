import React, { useState, useEffect } from "react";
import { useFetcher } from "@remix-run/react";
import { StarRating } from "./StarRating";
import type { ShopifyProductItem } from "../services/products.server";

interface AddReviewModalProps {
  products: ShopifyProductItem[];
  isOpen: boolean;
  onClose: () => void;
}

export function AddReviewModal({ products, isOpen, onClose }: AddReviewModalProps) {
  const fetcher = useFetcher<{ success?: boolean; error?: string }>();

  const [productId, setProductId] = useState("");
  const [rating, setRating] = useState(5);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [reviewerName, setReviewerName] = useState("");
  const [reviewerEmail, setReviewerEmail] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  const isSubmitting = fetcher.state !== "idle";

  // Pre-select first product if available
  useEffect(() => {
    if (products.length > 0 && !productId) {
      setProductId(products[0].id);
    }
  }, [products, productId]);

  // Close on success
  useEffect(() => {
    if (fetcher.data?.success) {
      setTitle("");
      setBody("");
      setReviewerName("");
      setReviewerEmail("");
      setRating(5);
      setErrors({});
      onClose();
    }
  }, [fetcher.data, onClose]);

  if (!isOpen) return null;

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (!productId) newErrors.productId = "Please select a product.";
    if (!rating || rating < 1) newErrors.rating = "Please select a star rating.";
    if (!title.trim()) newErrors.title = "Review headline is required.";
    if (!body.trim()) newErrors.body = "Review feedback text is required.";
    if (!reviewerName.trim()) newErrors.reviewerName = "Customer name is required.";
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!reviewerEmail.trim()) {
      newErrors.reviewerEmail = "Customer email is required.";
    } else if (!emailRegex.test(reviewerEmail.trim())) {
      newErrors.reviewerEmail = "Please enter a valid email address.";
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    const selectedProduct = products.find((p) => p.id === productId);

    fetcher.submit(
      {
        intent: "create",
        productId,
        productTitle: selectedProduct?.title || "Product",
        productHandle: selectedProduct?.handle || "",
        rating: rating.toString(),
        title,
        body,
        reviewerName,
        reviewerEmail,
      },
      { method: "post" }
    );
  };

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          backgroundColor: "rgba(15, 23, 42, 0.5)",
          backdropFilter: "blur(2px)",
          zIndex: 998,
        }}
      />

      {/* Modal Dialog */}
      <div
        style={{
          position: "fixed",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
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
            <h2 style={{ fontSize: "16px", fontWeight: 600, color: "#0F172A", margin: 0 }}>
              Add Customer Review
            </h2>
            <p style={{ fontSize: "13px", color: "#64748B", margin: "2px 0 0 0" }}>
              Manually add a review to your store feedback catalog.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
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
          {fetcher.data?.error && (
            <div
              style={{
                padding: "10px 14px",
                backgroundColor: "#FEF2F2",
                border: "1px solid #FECACA",
                borderRadius: "6px",
                color: "#991B1B",
                fontSize: "13px",
              }}
            >
              {fetcher.data.error}
            </div>
          )}

          {/* Product Select */}
          <div>
            <label style={{ display: "block", fontSize: "13px", fontWeight: 500, color: "#334155", marginBottom: "4px" }}>
              Product *
            </label>
            <select
              value={productId}
              onChange={(e) => setProductId(e.target.value)}
              style={{
                width: "100%",
                padding: "8px 12px",
                borderRadius: "6px",
                border: `1px solid ${errors.productId ? "#EF4444" : "#CBD5E1"}`,
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
            {errors.productId && (
              <span style={{ fontSize: "12px", color: "#DC2626", marginTop: "2px", display: "block" }}>
                {errors.productId}
              </span>
            )}
          </div>

          {/* Rating */}
          <div>
            <label style={{ display: "block", fontSize: "13px", fontWeight: 500, color: "#334155", marginBottom: "6px" }}>
              Rating *
            </label>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <StarRating value={rating} interactive size="lg" onChange={setRating} />
              <span style={{ fontSize: "13px", fontWeight: 500, color: "#475569" }}>
                {rating} of 5 stars
              </span>
            </div>
            {errors.rating && (
              <span style={{ fontSize: "12px", color: "#DC2626", marginTop: "2px", display: "block" }}>
                {errors.rating}
              </span>
            )}
          </div>

          {/* Review Title */}
          <div>
            <label style={{ display: "block", fontSize: "13px", fontWeight: 500, color: "#334155", marginBottom: "4px" }}>
              Review Title / Headline *
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Exceeded expectations! Very comfortable."
              style={{
                width: "100%",
                padding: "8px 12px",
                borderRadius: "6px",
                border: `1px solid ${errors.title ? "#EF4444" : "#CBD5E1"}`,
                fontSize: "14px",
                color: "#0F172A",
                outline: "none",
                boxSizing: "border-box",
              }}
            />
            {errors.title && (
              <span style={{ fontSize: "12px", color: "#DC2626", marginTop: "2px", display: "block" }}>
                {errors.title}
              </span>
            )}
          </div>

          {/* Review Body */}
          <div>
            <label style={{ display: "block", fontSize: "13px", fontWeight: 500, color: "#334155", marginBottom: "4px" }}>
              Review Feedback *
            </label>
            <textarea
              rows={3}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Detailed review commentary..."
              style={{
                width: "100%",
                padding: "8px 12px",
                borderRadius: "6px",
                border: `1px solid ${errors.body ? "#EF4444" : "#CBD5E1"}`,
                fontSize: "14px",
                color: "#0F172A",
                outline: "none",
                resize: "vertical",
                boxSizing: "border-box",
              }}
            />
            {errors.body && (
              <span style={{ fontSize: "12px", color: "#DC2626", marginTop: "2px", display: "block" }}>
                {errors.body}
              </span>
            )}
          </div>

          {/* Customer Name & Email */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
            <div>
              <label style={{ display: "block", fontSize: "13px", fontWeight: 500, color: "#334155", marginBottom: "4px" }}>
                Customer Name *
              </label>
              <input
                type="text"
                value={reviewerName}
                onChange={(e) => setReviewerName(e.target.value)}
                placeholder="Jane Doe"
                style={{
                  width: "100%",
                  padding: "8px 12px",
                  borderRadius: "6px",
                  border: `1px solid ${errors.reviewerName ? "#EF4444" : "#CBD5E1"}`,
                  fontSize: "14px",
                  color: "#0F172A",
                  outline: "none",
                  boxSizing: "border-box",
                }}
              />
              {errors.reviewerName && (
                <span style={{ fontSize: "12px", color: "#DC2626", marginTop: "2px", display: "block" }}>
                  {errors.reviewerName}
                </span>
              )}
            </div>

            <div>
              <label style={{ display: "block", fontSize: "13px", fontWeight: 500, color: "#334155", marginBottom: "4px" }}>
                Customer Email *
              </label>
              <input
                type="email"
                value={reviewerEmail}
                onChange={(e) => setReviewerEmail(e.target.value)}
                placeholder="jane@example.com"
                style={{
                  width: "100%",
                  padding: "8px 12px",
                  borderRadius: "6px",
                  border: `1px solid ${errors.reviewerEmail ? "#EF4444" : "#CBD5E1"}`,
                  fontSize: "14px",
                  color: "#0F172A",
                  outline: "none",
                  boxSizing: "border-box",
                }}
              />
              {errors.reviewerEmail && (
                <span style={{ fontSize: "12px", color: "#DC2626", marginTop: "2px", display: "block" }}>
                  {errors.reviewerEmail}
                </span>
              )}
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
        </form>
      </div>
    </>
  );
}
