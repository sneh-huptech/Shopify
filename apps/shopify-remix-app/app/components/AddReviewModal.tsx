import React, { useState, useEffect } from "react";
import { useFetcher, useNavigation, useSearchParams } from "@remix-run/react";
import { reviewInput } from "../review-input";
import { StarRating } from "./StarRating";
import { ReviewDialog } from "./ReviewDialog";
import { ProductPagination } from "./ProductPagination";
import type {
  ProductPageInfo,
  ShopifyProductItem,
} from "../services/products.server";

interface AddReviewModalProps {
  products: ShopifyProductItem[];
  productPageInfo: ProductPageInfo;
  onClose: () => void;
  onCreated: () => void;
}

export function AddReviewModal({
  products,
  productPageInfo,
  onClose,
  onCreated,
}: AddReviewModalProps) {
  const fetcher = useFetcher<{ success?: boolean; error?: string }>();

  const [selectedProduct, setSelectedProduct] =
    useState<ShopifyProductItem | null>(products[0] || null);
  const productId = selectedProduct?.id || "";
  const [params, setParams] = useSearchParams();
  const navigation = useNavigation();
  const [productSearch, setProductSearch] = useState(
    params.get("productsSearch") || "",
  );
  const [rating, setRating] = useState(5);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [reviewerName, setReviewerName] = useState("");
  const [reviewerEmail, setReviewerEmail] = useState("");
  const [formError, setFormError] = useState("");

  const searchProducts = () => {
    const next = new URLSearchParams(params);
    next.delete("productsBefore");
    next.delete("productsAfter");
    if (productSearch.trim()) next.set("productsSearch", productSearch.trim());
    else next.delete("productsSearch");
    setParams(next, { preventScrollReset: true });
  };

  const isSubmitting = fetcher.state !== "idle";

  // Close on success
  useEffect(() => {
    if (fetcher.state === "idle" && fetcher.data?.success) {
      onCreated();
    }
  }, [fetcher.state, fetcher.data, onCreated]);

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData();
    for (const [key, value] of Object.entries({
      intent: "create",
      productId,
      rating: String(rating),
      title,
      body,
      name: reviewerName,
      email: reviewerEmail,
    }))
      form.set(key, value);
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
    <ReviewDialog
      labelledBy="add-review-title"
      busy={isSubmitting}
      onClose={onClose}
      style={{
        inset: 0,
        margin: "auto",
        width: "calc(100% - 32px)",
        maxWidth: 600,
        maxHeight: "90dvh",
        display: "flex",
        flexDirection: "column",
        borderRadius: 14,
        background: "#fff",
      }}
    >
      <header className="review-dialog-header">
        <div>
          <p className="review-dialog-eyebrow">Customer feedback</p>
          <h2 id="add-review-title">Add a review</h2>
          <p>Record customer feedback. New reviews await your approval.</p>
        </div>
        <button
          className="review-dialog-close"
          type="button"
          onClick={onClose}
          disabled={isSubmitting}
          aria-label="Close add review"
        >
          ×
        </button>
      </header>
      <form
        id="add-review-form"
        className="review-dialog-body review-form"
        onSubmit={handleSubmit}
      >
        <fieldset disabled={isSubmitting}>
          {(formError || fetcher.data?.error) && (
            <div
              className="review-dialog-message review-dialog-error"
              role="alert"
            >
              {formError || fetcher.data?.error}
            </div>
          )}
          <p className="review-field-help">All fields are required.</p>
          <div className="review-field">
            <span id="review-product-label" className="review-field-label">
              Product
            </span>
            <details className="review-product-picker">
              <summary aria-labelledby="review-product-label review-selected-product">
                <span className="review-product-thumb">
                  {selectedProduct?.featuredMedia?.preview?.image ? (
                    <img
                      src={selectedProduct.featuredMedia?.preview?.image.url}
                      alt={
                        selectedProduct.featuredMedia?.preview?.image.altText ||
                        ""
                      }
                      width="48"
                      height="48"
                    />
                  ) : (
                    <span aria-hidden="true">◇</span>
                  )}
                </span>
                <span className="review-product-copy">
                  <strong id="review-selected-product">
                    {selectedProduct?.title || "Choose a product"}
                  </strong>
                  {selectedProduct && (
                    <small>
                      {[
                        selectedProduct.vendor,
                        selectedProduct.productType,
                        selectedProduct.status?.toLowerCase(),
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </small>
                  )}
                  <small>Change product ▾</small>
                </span>
              </summary>
              <div className="review-product-search">
                <label htmlFor="review-product-search">
                  Search your catalog
                </label>
                <div>
                  <input
                    id="review-product-search"
                    type="search"
                    value={productSearch}
                    onChange={(event) => setProductSearch(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        searchProducts();
                      }
                    }}
                    placeholder="Search product names or details"
                  />
                  <button
                    type="button"
                    className="review-button"
                    onClick={searchProducts}
                    disabled={navigation.state !== "idle"}
                  >
                    Search
                  </button>
                </div>
              </div>
              <ul
                className="review-product-options"
                aria-label="Choose a product"
                aria-busy={navigation.state !== "idle"}
              >
                {products.map((product) => (
                  <li key={product.id}>
                    <button
                      type="button"
                      aria-pressed={product.id === productId}
                      disabled={navigation.state !== "idle"}
                      onClick={(event) => {
                        setSelectedProduct(product);
                        const details = event.currentTarget.closest("details");
                        if (details) {
                          details.open = false;
                          details.querySelector("summary")?.focus();
                        }
                      }}
                    >
                      <span className="review-product-thumb">
                        {product.featuredMedia?.preview?.image ? (
                          <img
                            src={product.featuredMedia?.preview?.image.url}
                            alt=""
                            width="44"
                            height="44"
                            loading="lazy"
                          />
                        ) : (
                          <span aria-hidden="true">◇</span>
                        )}
                      </span>
                      <span className="review-product-copy">
                        <strong>{product.title}</strong>
                        <small>
                          {[
                            product.vendor,
                            product.productType,
                            product.status?.toLowerCase(),
                          ]
                            .filter(Boolean)
                            .join(" · ")}
                        </small>
                        <small>/{product.handle}</small>
                      </span>
                      <span aria-hidden="true">
                        {product.id === productId ? "✓" : ""}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
              <p className="review-field-help" role="status">
                {navigation.state !== "idle"
                  ? "Loading products…"
                  : products.length
                    ? `${products.length} ${products.length === 1 ? "product" : "products"} on this page. Select one to continue.`
                    : "No products found. Try another search."}
              </p>
              {(productPageInfo.hasPreviousPage ||
                productPageInfo.hasNextPage) && (
                <ProductPagination pageInfo={productPageInfo} />
              )}
            </details>
            {selectedProduct && (
              <p className="review-field-help">/{selectedProduct.handle}</p>
            )}
          </div>
          <div className="review-field">
            <span id="review-rating-label" className="review-field-label">
              Rating
            </span>
            <div
              className="review-rating-choice"
              aria-labelledby="review-rating-label"
            >
              <StarRating
                value={rating}
                interactive
                size="lg"
                onChange={setRating}
              />
              <span aria-live="polite">{rating} out of 5</span>
            </div>
          </div>
          <div className="review-field">
            <label htmlFor="review-title">Review title</label>
            <input
              id="review-title"
              type="text"
              required
              maxLength={100}
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="A short summary of the experience"
            />
          </div>
          <div className="review-field">
            <label htmlFor="review-body">Review</label>
            <textarea
              id="review-body"
              required
              minLength={10}
              maxLength={2000}
              rows={4}
              value={body}
              onChange={(event) => setBody(event.target.value)}
              aria-describedby="review-body-help"
              placeholder="What did the customer like? What could be better?"
            />
            <div
              id="review-body-help"
              className="review-field-help review-field-counter"
            >
              <span>10–2,000 characters</span>
              <span>{body.length}/2,000</span>
            </div>
          </div>
          <section
            className="review-customer-fields"
            aria-labelledby="review-customer-heading"
          >
            <h3 id="review-customer-heading">Customer information</h3>
            <div className="review-field-grid">
              <div className="review-field">
                <label htmlFor="review-name">Name</label>
                <input
                  id="review-name"
                  type="text"
                  required
                  maxLength={60}
                  value={reviewerName}
                  onChange={(event) => setReviewerName(event.target.value)}
                  autoComplete="off"
                />
              </div>
              <div className="review-field">
                <label htmlFor="review-email">Email</label>
                <input
                  id="review-email"
                  type="email"
                  required
                  maxLength={254}
                  value={reviewerEmail}
                  onChange={(event) => setReviewerEmail(event.target.value)}
                  aria-describedby="review-email-help"
                  autoComplete="off"
                />
              </div>
            </div>
            <p id="review-email-help" className="review-field-help">
              The customer’s email is never shown on your storefront.
            </p>
          </section>
        </fieldset>
      </form>
      <footer className="review-dialog-footer">
        <span className="review-field-help" role="status">
          {isSubmitting
            ? "Saving your review…"
            : "Requires approval before publishing"}
        </span>
        <div className="review-dialog-actions">
          <button
            className="review-button"
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
          >
            Cancel
          </button>
          <button
            className="review-button review-button-primary"
            type="submit"
            form="add-review-form"
            disabled={isSubmitting || !productId}
          >
            {isSubmitting ? "Saving…" : "Save review"}
          </button>
        </div>
      </footer>
    </ReviewDialog>
  );
}
