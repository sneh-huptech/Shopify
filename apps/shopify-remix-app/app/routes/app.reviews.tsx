import { useState, useEffect } from "react";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData, useSubmit, useNavigation, useSearchParams } from "@remix-run/react";
import { authenticate } from "../shopify.server";
import {
  listReviews,
  createReview,
  updateReviewStatus,
  deleteReview,
  REVIEW_STATUSES,
  type ReviewDocument,
  type ReviewStatus,
} from "../db/reviews.server";
import { getShopifyProducts } from "../services/products.server";
import { StarRating } from "../components/StarRating";
import { StatusBadge } from "../components/StatusBadge";
import { SummaryMetrics } from "../components/SummaryMetrics";
import { ReviewDrawer } from "../components/ReviewDrawer";
import { AddReviewModal } from "../components/AddReviewModal";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session, admin } = await authenticate.admin(request);
  const url = new URL(request.url);

  const status = url.searchParams.get("status") || "all";
  const rating = Number(url.searchParams.get("rating")) || 0;
  const productId = url.searchParams.get("productId") || "all";
  const search = url.searchParams.get("search") || "";
  const page = Number(url.searchParams.get("page")) || 1;

  const [reviewsData, products] = await Promise.all([
    listReviews(session.shop, {
      status,
      rating,
      productId,
      search,
      page,
      limit: 10,
    }),
    getShopifyProducts(admin, 50),
  ]);

  return json({
    ...reviewsData,
    products,
    currentFilters: {
      status,
      rating,
      productId,
      search,
    },
  });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const formData = await request.formData();
  const intent = formData.get("intent")?.toString();

  if (intent === "create") {
    const productId = formData.get("productId")?.toString() || "";
    const productTitle = formData.get("productTitle")?.toString() || "Product";
    const productHandle = formData.get("productHandle")?.toString() || "";
    const rating = Number(formData.get("rating"));
    const title = formData.get("title")?.toString() || "";
    const body = formData.get("body")?.toString() || "";
    const reviewerName = formData.get("reviewerName")?.toString() || "";
    const reviewerEmail = formData.get("reviewerEmail")?.toString() || "";

    if (!productId || !title.trim() || !body.trim() || !reviewerName.trim() || !reviewerEmail.trim()) {
      return json({ success: false, error: "Please fill out all required fields." }, { status: 400 });
    }
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      return json({ success: false, error: "Rating must be between 1 and 5." }, { status: 400 });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(reviewerEmail.trim())) {
      return json({ success: false, error: "Please enter a valid email address." }, { status: 400 });
    }

    await createReview(session.shop, {
      productId,
      productTitle,
      productHandle,
      rating,
      title,
      body,
      reviewer: {
        name: reviewerName,
        email: reviewerEmail,
      },
      status: "pending",
      verifiedPurchase: false,
    });

    return json({ success: true, message: "Review added successfully!" });
  }

  if (intent === "update_status") {
    const reviewId = formData.get("reviewId")?.toString() || "";
    const status = formData.get("status")?.toString() as ReviewStatus;

    if (!reviewId || !REVIEW_STATUSES.includes(status)) {
      return json({ success: false, error: "Missing parameters." }, { status: 400 });
    }

    const updated = await updateReviewStatus(session.shop, reviewId, status);
    if (!updated) {
      return json({ success: false, error: "Review not found." }, { status: 404 });
    }
    return json({ success: true, message: `Review status changed to ${status}.` });
  }

  if (intent === "delete") {
    const reviewId = formData.get("reviewId")?.toString() || "";
    if (!reviewId) {
      return json({ success: false, error: "Missing review ID." }, { status: 400 });
    }

    const deleted = await deleteReview(session.shop, reviewId);
    return json({ success: deleted, message: "Review deleted successfully." });
  }

  return json({ success: false, error: "Unknown action" }, { status: 400 });
};

export default function ReviewsPage() {
  const { reviews, total, page, totalPages, stats, products, currentFilters } =
    useLoaderData<typeof loader>();
  const submit = useSubmit();
  const navigation = useNavigation();
  const [searchParams, setSearchParams] = useSearchParams();

  const [selectedReview, setSelectedReview] = useState<ReviewDocument | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [searchInput, setSearchInput] = useState(currentFilters.search || "");

  const isLoading = navigation.state === "loading";

  // Update selected review if data changes
  useEffect(() => {
    if (selectedReview) {
      const updated = reviews.find(
        (r) => (r.id || (r._id as any)?.toString()) === (selectedReview.id || (selectedReview._id as any)?.toString())
      );
      if (updated) setSelectedReview(updated as any);
    }
  }, [reviews]);

  const handleTabChange = (status: string) => {
    const next = new URLSearchParams(searchParams);
    if (status === "all") next.delete("status");
    else next.set("status", status);
    next.delete("page");
    setSearchParams(next);
  };

  const handleRatingChange = (rating: string) => {
    const next = new URLSearchParams(searchParams);
    if (!rating || rating === "0") next.delete("rating");
    else next.set("rating", rating);
    next.delete("page");
    setSearchParams(next);
  };

  const handleProductChange = (productId: string) => {
    const next = new URLSearchParams(searchParams);
    if (!productId || productId === "all") next.delete("productId");
    else next.set("productId", productId);
    next.delete("page");
    setSearchParams(next);
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const next = new URLSearchParams(searchParams);
    if (searchInput.trim()) next.set("search", searchInput.trim());
    else next.delete("search");
    next.delete("page");
    setSearchParams(next);
  };

  const handleClearFilters = () => {
    setSearchInput("");
    setSearchParams(new URLSearchParams());
  };

  const handlePageChange = (newPage: number) => {
    const next = new URLSearchParams(searchParams);
    next.set("page", newPage.toString());
    setSearchParams(next);
  };

  const handleQuickStatus = (reviewId: string, status: ReviewStatus, e: React.MouseEvent) => {
    e.stopPropagation();
    submit(
      { intent: "update_status", reviewId, status },
      { method: "post" }
    );
  };

  const hasActiveFilters =
    currentFilters.status !== "all" ||
    currentFilters.rating > 0 ||
    currentFilters.productId !== "all" ||
    Boolean(currentFilters.search);

  return (
    <div
      style={{
        maxWidth: "1200px",
        margin: "0 auto",
        padding: "24px 20px 48px",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      }}
    >
      {/* Page Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          marginBottom: "20px",
          gap: "16px",
          flexWrap: "wrap",
        }}
      >
        <div>
          <h1
            style={{
              fontSize: "24px",
              fontWeight: 700,
              color: "#0F172A",
              margin: 0,
              letterSpacing: "-0.02em",
            }}
          >
            Reviews
          </h1>
          <p
            style={{
              fontSize: "14px",
              color: "#64748B",
              margin: "4px 0 0 0",
            }}
          >
            Manage, moderate, and organize customer feedback.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setIsAddModalOpen(true)}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "6px",
            backgroundColor: "#0F172A",
            color: "#FFFFFF",
            padding: "8px 16px",
            fontSize: "13px",
            fontWeight: 600,
            borderRadius: "8px",
            border: "none",
            cursor: "pointer",
            boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
            transition: "all 150ms ease",
          }}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M12 5v14M5 12h14" />
          </svg>
          Add Review
        </button>
      </div>

      {/* Summary Metrics */}
      <SummaryMetrics stats={stats} />

      {/* Main Container Card */}
      <div
        style={{
          backgroundColor: "#FFFFFF",
          border: "1px solid #E2E8F0",
          borderRadius: "10px",
          boxShadow: "0 1px 3px 0 rgba(0, 0, 0, 0.02)",
          overflow: "hidden",
        }}
      >
        {/* Navigation Tabs */}
        <div
          style={{
            display: "flex",
            borderBottom: "1px solid #E2E8F0",
            padding: "0 16px",
            gap: "24px",
            backgroundColor: "#F8FAFC",
            overflowX: "auto",
          }}
        >
          {[
            { id: "all", label: "All Reviews", count: stats.total },
            { id: "pending", label: "Pending", count: stats.pending },
            { id: "published", label: "Published", count: stats.published },
            { id: "rejected", label: "Rejected", count: stats.rejected },
          ].map((tab) => {
            const isActive = currentFilters.status === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => handleTabChange(tab.id)}
                style={{
                  background: "none",
                  border: "none",
                  padding: "12px 2px",
                  fontSize: "13px",
                  fontWeight: isActive ? 600 : 500,
                  color: isActive ? "#0F172A" : "#64748B",
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  position: "relative",
                  whiteSpace: "nowrap",
                }}
              >
                {tab.label}
                <span
                  style={{
                    fontSize: "11px",
                    fontWeight: 500,
                    backgroundColor: isActive ? "#E2E8F0" : "#F1F5F9",
                    color: isActive ? "#0F172A" : "#64748B",
                    padding: "1px 6px",
                    borderRadius: "10px",
                  }}
                >
                  {tab.count}
                </span>
                {isActive && (
                  <span
                    style={{
                      position: "absolute",
                      bottom: "-1px",
                      left: 0,
                      right: 0,
                      height: "2px",
                      backgroundColor: "#0F172A",
                    }}
                  />
                )}
              </button>
            );
          })}
        </div>

        {/* Filter Bar */}
        <div
          style={{
            padding: "12px 16px",
            borderBottom: "1px solid #F1F5F9",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "12px",
            flexWrap: "wrap",
          }}
        >
          {/* Search Input */}
          <form onSubmit={handleSearchSubmit} style={{ display: "flex", flex: 1, minWidth: "220px", maxWidth: "340px" }}>
            <div style={{ position: "relative", width: "100%" }}>
              <span
                style={{
                  position: "absolute",
                  left: "10px",
                  top: "50%",
                  transform: "translateY(-50%)",
                  color: "#94A3B8",
                  display: "flex",
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="11" cy="11" r="8" />
                  <path d="M21 21l-4.35-4.35" />
                </svg>
              </span>
              <input
                type="text"
                placeholder="Search reviews, customers, products..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                style={{
                  width: "100%",
                  padding: "7px 10px 7px 32px",
                  fontSize: "13px",
                  border: "1px solid #CBD5E1",
                  borderRadius: "6px",
                  outline: "none",
                  backgroundColor: "#FFFFFF",
                  boxSizing: "border-box",
                }}
              />
            </div>
          </form>

          {/* Select Filters */}
          <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
            {/* Rating Filter */}
            <select
              value={currentFilters.rating.toString()}
              onChange={(e) => handleRatingChange(e.target.value)}
              style={{
                padding: "7px 10px",
                fontSize: "13px",
                borderRadius: "6px",
                border: "1px solid #CBD5E1",
                backgroundColor: "#FFFFFF",
                color: "#334155",
                outline: "none",
              }}
            >
              <option value="0">All Ratings</option>
              <option value="5">5 Stars only</option>
              <option value="4">4 Stars</option>
              <option value="3">3 Stars</option>
              <option value="2">2 Stars</option>
              <option value="1">1 Star</option>
            </select>

            {/* Product Filter */}
            <select
              value={currentFilters.productId}
              onChange={(e) => handleProductChange(e.target.value)}
              style={{
                padding: "7px 10px",
                fontSize: "13px",
                borderRadius: "6px",
                border: "1px solid #CBD5E1",
                backgroundColor: "#FFFFFF",
                color: "#334155",
                outline: "none",
                maxWidth: "180px",
              }}
            >
              <option value="all">All Products</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title}
                </option>
              ))}
            </select>

            {/* Clear Filters */}
            {hasActiveFilters && (
              <button
                type="button"
                onClick={handleClearFilters}
                style={{
                  background: "none",
                  border: "none",
                  color: "#64748B",
                  fontSize: "12px",
                  cursor: "pointer",
                  padding: "6px 8px",
                  textDecoration: "underline",
                }}
              >
                Clear filters
              </button>
            )}
          </div>
        </div>

        {/* Loading Overlay or Table */}
        <div style={{ position: "relative", minHeight: "260px" }}>
          {isLoading && (
            <div
              style={{
                position: "absolute",
                inset: 0,
                backgroundColor: "rgba(255, 255, 255, 0.7)",
                zIndex: 10,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "13px",
                color: "#64748B",
              }}
            >
              Updating reviews...
            </div>
          )}

          {reviews.length === 0 ? (
            /* Empty State */
            <div
              style={{
                padding: "60px 20px",
                textAlign: "center",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <div
                style={{
                  width: "44px",
                  height: "44px",
                  borderRadius: "50%",
                  backgroundColor: "#F1F5F9",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  marginBottom: "12px",
                  color: "#94A3B8",
                }}
              >
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
                </svg>
              </div>

              <h3 style={{ fontSize: "16px", fontWeight: 600, color: "#0F172A", margin: "0 0 4px 0" }}>
                {hasActiveFilters ? "No matching reviews found" : "Start collecting customer feedback"}
              </h3>
              <p style={{ fontSize: "13px", color: "#64748B", maxWidth: "360px", margin: "0 0 16px 0", lineHeight: 1.4 }}>
                {hasActiveFilters
                  ? "Try resetting your search query or adjusting your filters to see more results."
                  : "Collect authentic product reviews to build trust, improve conversions, and gather product insights."}
              </p>

              {hasActiveFilters ? (
                <button
                  type="button"
                  onClick={handleClearFilters}
                  style={{
                    padding: "7px 14px",
                    fontSize: "13px",
                    fontWeight: 500,
                    backgroundColor: "#FFFFFF",
                    border: "1px solid #CBD5E1",
                    borderRadius: "6px",
                    cursor: "pointer",
                  }}
                >
                  Clear Filters
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(true)}
                  style={{
                    padding: "8px 16px",
                    fontSize: "13px",
                    fontWeight: 600,
                    backgroundColor: "#0F172A",
                    color: "#FFFFFF",
                    border: "none",
                    borderRadius: "6px",
                    cursor: "pointer",
                  }}
                >
                  Add Your First Review
                </button>
              )}
            </div>
          ) : (
            /* Reviews Table */
            <div style={{ overflowX: "auto" }}>
              <table
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  textAlign: "left",
                  fontSize: "13px",
                }}
              >
                <thead>
                  <tr
                    style={{
                      borderBottom: "1px solid #E2E8F0",
                      backgroundColor: "#F8FAFC",
                      color: "#64748B",
                      fontSize: "12px",
                      fontWeight: 600,
                      textTransform: "uppercase",
                      letterSpacing: "0.04em",
                    }}
                  >
                    <th style={{ padding: "10px 16px", width: "18%" }}>Reviewer</th>
                    <th style={{ padding: "10px 16px", width: "18%" }}>Product</th>
                    <th style={{ padding: "10px 16px", width: "12%" }}>Rating</th>
                    <th style={{ padding: "10px 16px", width: "30%" }}>Feedback</th>
                    <th style={{ padding: "10px 16px", width: "10%" }}>Status</th>
                    <th style={{ padding: "10px 16px", width: "12%", textAlign: "right" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {reviews.map((r) => {
                    const rev = r as unknown as ReviewDocument;
                    const dateFormatted = new Date(rev.createdAt).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                    });

                    return (
                      <tr
                        key={rev.id || (rev._id as any)?.toString()}
                        onClick={() => setSelectedReview(rev)}
                        style={{
                          borderBottom: "1px solid #F1F5F9",
                          cursor: "pointer",
                          transition: "background-color 100ms ease",
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = "#F8FAFC";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = "transparent";
                        }}
                      >
                        {/* Reviewer */}
                        <td style={{ padding: "12px 16px", verticalAlign: "middle" }}>
                          <div style={{ fontWeight: 600, color: "#0F172A" }}>
                            {rev.reviewer.name}
                          </div>
                          <div style={{ fontSize: "12px", color: "#64748B" }}>
                            {rev.reviewer.email}
                          </div>
                        </td>

                        {/* Product */}
                        <td style={{ padding: "12px 16px", verticalAlign: "middle" }}>
                          <div
                            style={{
                              fontWeight: 500,
                              color: "#0F172A",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                              maxWidth: "180px",
                            }}
                            title={rev.productTitle}
                          >
                            {rev.productTitle}
                          </div>
                        </td>

                        {/* Rating */}
                        <td style={{ padding: "12px 16px", verticalAlign: "middle" }}>
                          <StarRating value={rev.rating} size="sm" />
                        </td>

                        {/* Feedback (Title + Truncated body) */}
                        <td style={{ padding: "12px 16px", verticalAlign: "middle" }}>
                          <div
                            style={{
                              fontWeight: 600,
                              color: "#0F172A",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                              maxWidth: "320px",
                            }}
                          >
                            {rev.title}
                          </div>
                          <div
                            style={{
                              fontSize: "12px",
                              color: "#475569",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                              maxWidth: "320px",
                            }}
                          >
                            {rev.body}
                          </div>
                        </td>

                        {/* Status */}
                        <td style={{ padding: "12px 16px", verticalAlign: "middle" }}>
                          <StatusBadge status={rev.status} />
                        </td>

                        {/* Quick Actions */}
                        <td
                          style={{
                            padding: "12px 16px",
                            verticalAlign: "middle",
                            textAlign: "right",
                          }}
                        >
                          <div
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "6px",
                            }}
                          >
                            {rev.status !== "published" && (
                              <button
                                type="button"
                                title="Publish"
                                onClick={(e) =>
                                  handleQuickStatus(
                                    rev.id || (rev._id as any)?.toString(),
                                    "published",
                                    e
                                  )
                                }
                                style={{
                                  padding: "4px 8px",
                                  fontSize: "11px",
                                  fontWeight: 500,
                                  backgroundColor: "#ECFDF5",
                                  color: "#065F46",
                                  border: "1px solid #A7F3D0",
                                  borderRadius: "4px",
                                  cursor: "pointer",
                                }}
                              >
                                Publish
                              </button>
                            )}

                            {rev.status !== "rejected" && (
                              <button
                                type="button"
                                title="Reject"
                                onClick={(e) =>
                                  handleQuickStatus(
                                    rev.id || (rev._id as any)?.toString(),
                                    "rejected",
                                    e
                                  )
                                }
                                style={{
                                  padding: "4px 8px",
                                  fontSize: "11px",
                                  fontWeight: 500,
                                  backgroundColor: "#FEF2F2",
                                  color: "#991B1B",
                                  border: "1px solid #FECACA",
                                  borderRadius: "4px",
                                  cursor: "pointer",
                                }}
                              >
                                Reject
                              </button>
                            )}

                            <span
                              style={{
                                fontSize: "11px",
                                color: "#94A3B8",
                                marginLeft: "4px",
                              }}
                            >
                              {dateFormatted}
                            </span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Pagination Bar */}
        {totalPages > 1 && (
          <div
            style={{
              padding: "12px 16px",
              borderTop: "1px solid #E2E8F0",
              backgroundColor: "#F8FAFC",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <span style={{ fontSize: "12px", color: "#64748B" }}>
              Showing {reviews.length} of {total} reviews
            </span>
            <div style={{ display: "flex", gap: "6px" }}>
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => handlePageChange(page - 1)}
                style={{
                  padding: "5px 10px",
                  fontSize: "12px",
                  border: "1px solid #CBD5E1",
                  borderRadius: "4px",
                  backgroundColor: "#FFFFFF",
                  cursor: page <= 1 ? "not-allowed" : "pointer",
                  opacity: page <= 1 ? 0.5 : 1,
                }}
              >
                Previous
              </button>
              <span
                style={{
                  display: "flex",
                  alignItems: "center",
                  fontSize: "12px",
                  color: "#334155",
                  padding: "0 6px",
                }}
              >
                Page {page} of {totalPages}
              </span>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => handlePageChange(page + 1)}
                style={{
                  padding: "5px 10px",
                  fontSize: "12px",
                  border: "1px solid #CBD5E1",
                  borderRadius: "4px",
                  backgroundColor: "#FFFFFF",
                  cursor: page >= totalPages ? "not-allowed" : "pointer",
                  opacity: page >= totalPages ? 0.5 : 1,
                }}
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Review Detail Drawer */}
      <ReviewDrawer
        review={selectedReview}
        isOpen={Boolean(selectedReview)}
        onClose={() => setSelectedReview(null)}
      />

      {/* Add Review Modal */}
      <AddReviewModal
        products={products}
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
      />
    </div>
  );
}
