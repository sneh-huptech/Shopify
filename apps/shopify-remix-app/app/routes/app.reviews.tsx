import "../styles/review-admin.css";
import { useState, useEffect, useCallback } from "react";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import {
  useLoaderData,
  useFetcher,
  useNavigation,
  useSearchParams,
} from "@remix-run/react";
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
import {
  getShopifyProducts,
  getReviewProduct,
} from "../services/products.server";
import {
  reviewInput,
  ReviewInputError,
  readReviewForm,
  type ReviewActionResult,
} from "../review-input";
import { ProductPagination } from "../components/ProductPagination";
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
    getShopifyProducts(admin, url.searchParams),
  ]);

  return json({
    ...reviewsData,
    products: products.nodes,
    productPageInfo: products.pageInfo,
    currentFilters: {
      status,
      rating,
      productId,
      search,
    },
  });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session, admin } = await authenticate.admin(request);
  try {
    const form = await readReviewForm(request);
    const intent = String(form.get("intent") || "");
    if (intent === "create") {
      const input = reviewInput(form);
      const product = await getReviewProduct(
        admin,
        String(form.get("productId") || ""),
      );
      await createReview(session.shop, {
        ...input,
        ...product,
        status: "pending",
        verifiedPurchase: false,
      });
      return json<ReviewActionResult>({
        success: true,
        intent,
        message: "Review added successfully.",
      });
    }
    const reviewId = String(form.get("reviewId") || "");
    if (intent === "update_status") {
      const status = String(form.get("status") || "") as ReviewStatus;
      if (!REVIEW_STATUSES.includes(status))
        throw new ReviewInputError("Invalid review status.");
      if (!(await updateReviewStatus(session.shop, reviewId, status)))
        return json<ReviewActionResult>(
          { success: false, error: "Review not found. Refresh and try again." },
          { status: 404 },
        );
      return json<ReviewActionResult>({
        success: true,
        intent,
        reviewId,
        status,
        message: `Review marked ${status}.`,
      });
    }
    if (intent === "delete") {
      if (!(await deleteReview(session.shop, reviewId)))
        return json<ReviewActionResult>(
          { success: false, error: "Review not found. Refresh and try again." },
          { status: 404 },
        );
      return json<ReviewActionResult>({
        success: true,
        intent,
        reviewId,
        message: "Review deleted successfully.",
      });
    }
    throw new ReviewInputError("Unknown action.");
  } catch (error) {
    if (error instanceof Response) throw error;
    if (!(error instanceof ReviewInputError))
      console.error(
        "[Reviews] Save failed:",
        error instanceof Error ? error.name : "Unknown error",
      );
    return json<ReviewActionResult>(
      {
        success: false,
        error:
          error instanceof ReviewInputError
            ? error.message
            : "The change could not be saved. Please try again.",
      },
      { status: error instanceof ReviewInputError ? error.status : 503 },
    );
  }
};

export default function ReviewsPage() {
  const {
    reviews,
    total,
    page,
    totalPages,
    stats,
    products,
    productPageInfo,
    currentFilters,
  } = useLoaderData<typeof loader>();
  const moderation = useFetcher<ReviewActionResult>();
  const navigation = useNavigation();
  const [searchParams, setSearchParams] = useSearchParams();

  const [selectedReview, setSelectedReview] = useState<ReviewDocument | null>(
    null,
  );
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [notice, setNotice] = useState("");
  const [searchInput, setSearchInput] = useState(currentFilters.search || "");

  const isLoading = navigation.state === "loading";

  const closeAddModal = useCallback(() => setIsAddModalOpen(false), []);
  const closeDrawer = useCallback(() => setSelectedReview(null), []);
  const reviewCreated = useCallback(() => {
    setIsAddModalOpen(false);
    setNotice("Review added and awaiting moderation.");
  }, []);
  const reviewDeleted = useCallback(() => {
    setSelectedReview(null);
    setNotice("Review deleted successfully.");
  }, []);
  useEffect(() => {
    setSelectedReview((current) =>
      current
        ? (reviews.find(
            (review) => review.id === current.id,
          ) as unknown as ReviewDocument) || current
        : null,
    );
  }, [reviews]);
  useEffect(() => {
    setSearchInput(currentFilters.search);
  }, [currentFilters.search]);

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

  const handleQuickStatus = (
    reviewId: string,
    status: ReviewStatus,
    e: React.MouseEvent,
  ) => {
    e.stopPropagation();
    setNotice("");
    moderation.submit(
      { intent: "update_status", reviewId, status },
      { method: "post" },
    );
  };

  const hasActiveFilters =
    currentFilters.status !== "all" ||
    currentFilters.rating > 0 ||
    currentFilters.productId !== "all" ||
    Boolean(currentFilters.search);

  return (
    <main className="review-admin">
      <header className="review-page-header">
        <div>
          <p className="review-eyebrow">Customer feedback</p>
          <h1>Reviews</h1>
          <p>Listen to your customers. Choose what appears on your store.</p>
        </div>
        <button
          className="review-button review-button-primary"
          type="button"
          onClick={() => setIsAddModalOpen(true)}
        >
          Add review
        </button>
      </header>
      <SummaryMetrics stats={stats} />
      <div
        className="review-notice"
        role={!notice && moderation.data?.error ? "alert" : "status"}
        aria-live="polite"
      >
        {moderation.state !== "idle"
          ? "Saving review status…"
          : notice || moderation.data?.error || moderation.data?.message}
      </div>
      <section className="review-card" aria-label="Review management">
        <nav className="review-status-nav" aria-label="Review status">
          {[
            { id: "all", label: "All reviews", count: stats.total },
            { id: "pending", label: "Pending", count: stats.pending },
            { id: "published", label: "Published", count: stats.published },
            { id: "rejected", label: "Rejected", count: stats.rejected },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              aria-pressed={currentFilters.status === tab.id}
              onClick={() => handleTabChange(tab.id)}
            >
              {tab.label}
              <span>{tab.count}</span>
            </button>
          ))}
        </nav>
        <div className="review-filter-bar">
          <form className="review-search" onSubmit={handleSearchSubmit}>
            <label className="review-sr-only" htmlFor="review-search">
              Search reviews, customers, products
            </label>
            <input
              id="review-search"
              type="search"
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="Search reviews, customers, products"
            />
            <button
              className="review-button"
              type="submit"
              disabled={isLoading}
            >
              Search
            </button>
          </form>
          <select
            aria-label="Filter reviews by rating"
            value={currentFilters.rating.toString()}
            onChange={(event) => handleRatingChange(event.target.value)}
          >
            <option value="0">All ratings</option>
            {[5, 4, 3, 2, 1].map((rating) => (
              <option key={rating} value={rating}>
                {rating} {rating === 1 ? "star" : "stars"}
              </option>
            ))}
          </select>
          <select
            aria-label="Filter reviews by product"
            value={currentFilters.productId}
            onChange={(event) => handleProductChange(event.target.value)}
          >
            <option value="all">All products</option>
            {currentFilters.productId !== "all" &&
              !products.some(
                (product) => product.id === currentFilters.productId,
              ) && (
                <option value={currentFilters.productId}>
                  Selected product
                </option>
              )}
            {products.map((product) => (
              <option key={product.id} value={product.id}>
                {product.title}
              </option>
            ))}
          </select>
          {hasActiveFilters && (
            <button
              className="review-text-button"
              type="button"
              onClick={handleClearFilters}
            >
              Clear filters
            </button>
          )}
        </div>
        {(productPageInfo.hasPreviousPage || productPageInfo.hasNextPage) && (
          <div className="review-catalog-pages">
            <span>Browse products available in the product filter</span>
            <ProductPagination pageInfo={productPageInfo} />
          </div>
        )}
        <div className="review-results" aria-busy={isLoading}>
          {isLoading && (
            <p className="review-loading" role="status">
              Updating reviews…
            </p>
          )}
          {!reviews.length ? (
            <div className="review-empty">
              <span className="review-empty-mark" aria-hidden="true">
                ☆
              </span>
              <h2>
                {hasActiveFilters
                  ? "No reviews match this view"
                  : "Make room for your first customer story"}
              </h2>
              <p>
                {hasActiveFilters
                  ? "Try a different search, product, rating, or review status."
                  : "Customer reviews will appear here, ready for you to review and publish."}
              </p>
              <button
                className="review-button"
                type="button"
                onClick={
                  hasActiveFilters
                    ? handleClearFilters
                    : () => setIsAddModalOpen(true)
                }
              >
                {hasActiveFilters ? "Clear filters" : "Add a review"}
              </button>
            </div>
          ) : (
            <div className="review-table-scroll">
              <table className="review-table">
                <caption className="review-sr-only">
                  Customer reviews and moderation actions
                </caption>
                <thead>
                  <tr>
                    <th scope="col">Feedback</th>
                    <th scope="col">Customer</th>
                    <th scope="col">Product</th>
                    <th scope="col">Status</th>
                    <th scope="col">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {reviews.map((review) => {
                    const rev = review as unknown as ReviewDocument;
                    return (
                      <tr key={rev.id}>
                        <td>
                          <StarRating value={rev.rating} size="sm" />
                          <button
                            className="review-title-button"
                            type="button"
                            aria-label={`Open review by ${rev.reviewer.name}`}
                            onClick={() => setSelectedReview(rev)}
                          >
                            {rev.title}
                          </button>
                          <p className="review-clamp">{rev.body}</p>
                          <time
                            className="review-meta"
                            dateTime={new Date(rev.createdAt).toISOString()}
                          >
                            {new Date(rev.createdAt).toLocaleDateString(
                              "en-US",
                              {
                                month: "short",
                                day: "numeric",
                                year: "numeric",
                                timeZone: "UTC",
                              },
                            )}
                          </time>
                        </td>
                        <td>
                          <strong>{rev.reviewer.name}</strong>
                          <p className="review-meta review-email">
                            {rev.reviewer.email}
                          </p>
                        </td>
                        <td>{rev.productTitle}</td>
                        <td>
                          <StatusBadge status={rev.status} />
                        </td>
                        <td>
                          <div className="review-row-actions">
                            {rev.status !== "published" && (
                              <button
                                className="review-button"
                                type="button"
                                disabled={
                                  moderation.state !== "idle" || isLoading
                                }
                                aria-label={`Publish review by ${rev.reviewer.name}`}
                                onClick={(event) =>
                                  handleQuickStatus(rev.id!, "published", event)
                                }
                              >
                                Publish
                              </button>
                            )}
                            {rev.status !== "rejected" && (
                              <button
                                className="review-text-button"
                                type="button"
                                disabled={
                                  moderation.state !== "idle" || isLoading
                                }
                                aria-label={`Reject review by ${rev.reviewer.name}`}
                                onClick={(event) =>
                                  handleQuickStatus(rev.id!, "rejected", event)
                                }
                              >
                                Reject
                              </button>
                            )}
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
        {total > 0 && (
          <footer className="review-table-footer">
            <span>
              {total} {total === 1 ? "review" : "reviews"} in this view
            </span>
            {totalPages > 1 && (
              <nav aria-label="Review pages">
                <button
                  className="review-button"
                  type="button"
                  disabled={page <= 1 || isLoading}
                  onClick={() => handlePageChange(page - 1)}
                >
                  Previous
                </button>
                <span>
                  Page {page} of {totalPages}
                </span>
                <button
                  className="review-button"
                  type="button"
                  disabled={page >= totalPages || isLoading}
                  onClick={() => handlePageChange(page + 1)}
                >
                  Next
                </button>
              </nav>
            )}
          </footer>
        )}
      </section>
      {selectedReview && (
        <ReviewDrawer
          key={selectedReview.id}
          review={selectedReview}
          onClose={closeDrawer}
          onDeleted={reviewDeleted}
        />
      )}
      {isAddModalOpen && (
        <AddReviewModal
          products={products}
          productPageInfo={productPageInfo}
          onClose={closeAddModal}
          onCreated={reviewCreated}
        />
      )}
    </main>
  );
}
