import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import {
  allowStorefrontSubmission,
  createStorefrontReview,
  listPublicReviews,
  getReviewMedia,
} from "../db/reviews.server";
import {
  MEDIA_BODY_LIMIT,
  prepareReviewMedia,
  mediaResponse,
} from "../services/review-media.server";
import { reviewInput, ReviewInputError, readReviewForm } from "../review-input";
import { getReviewProduct } from "../services/products.server";

const isId = (value: string): boolean => /^\d{1,20}$/.test(value);

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.public.appProxy(request);
  const url = new URL(request.url);
  if (session && url.searchParams.has("media")) {
    const file = await getReviewMedia(
      session.shop,
      url.searchParams.get("reviewId") || "",
      url.searchParams.get("media") || "",
    );
    return file
      ? mediaResponse(file, request)
      : new Response(null, {
          status: 404,
          headers: { "Cache-Control": "no-store" },
        });
  }
  const productId = url.searchParams.get("productId") || "";
  if (!session || !isId(productId))
    return json({ error: "Not found" }, { status: 404 });
  try {
    return json(
      await listPublicReviews(
        session.shop,
        `gid://shopify/Product/${productId}`,
        Number(url.searchParams.get("page")) || 1,
      ),
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    console.error("[Reviews] Public reviews could not be loaded");
    return json(
      { error: "Reviews could not be loaded. Please try again." },
      { status: 503 },
    );
  }
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session, admin } = await authenticate.public.appProxy(request);
  if (!session || !admin) return json({ error: "Not found" }, { status: 404 });
  try {
    const form = await readReviewForm(request, MEDIA_BODY_LIMIT);
    const productId = String(form.get("productId") || "");
    const variantId = String(form.get("variantId") || "");
    if (!isId(productId) || (variantId && !isId(variantId)))
      throw new ReviewInputError("Invalid product or variant.");
    const input = reviewInput(form);
    if (form.get("website"))
      return json(
        { error: "Submission could not be accepted." },
        { status: 400 },
      );
    if (
      !(await allowStorefrontSubmission(session.shop, input.reviewer.email))
    ) {
      return json(
        { error: "Too many attempts. Please try again later." },
        { status: 429 },
      );
    }
    const product = await getReviewProduct(
      admin,
      `gid://shopify/Product/${productId}`,
      variantId ? `gid://shopify/ProductVariant/${variantId}` : undefined,
    );
    const media = await prepareReviewMedia(form);
    const result = await createStorefrontReview(session.shop, {
      ...input,
      ...product,
      media,
    });
    if (result === "duplicate")
      return json(
        { error: "You have already submitted this review." },
        { status: 409 },
      );
    return json({ ok: true });
  } catch (error) {
    if (!(error instanceof ReviewInputError))
      console.error(
        "[Reviews] Submission failed:",
        error instanceof Error ? error.name : "Unknown error",
      );
    return json(
      {
        error:
          error instanceof ReviewInputError
            ? error.message
            : "Your review could not be saved. Please try again.",
      },
      { status: error instanceof ReviewInputError ? error.status : 503 },
    );
  }
};
