import { ObjectId } from "mongodb";
import { getDatabase } from "./mongodb.server";

export type ReviewStatus = "pending" | "published" | "rejected";

export interface Reviewer {
  name: string;
  email: string;
}

export interface ReviewDocument {
  _id?: ObjectId | string;
  id?: string;
  shopDomain: string;
  productId: string;
  productHandle: string;
  productTitle: string;
  variantId?: string;
  variantTitle?: string;
  reviewer: Reviewer;
  rating: number;
  title: string;
  body: string;
  status: ReviewStatus;
  verifiedPurchase: boolean;
  media: string[];
  source: "manual" | "storefront" | "import";
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateReviewInput {
  productId: string;
  productHandle: string;
  productTitle: string;
  variantId?: string;
  variantTitle?: string;
  reviewer: Reviewer;
  rating: number;
  title: string;
  body: string;
  status?: ReviewStatus;
  source?: ReviewDocument["source"];
  verifiedPurchase?: boolean;
}

export interface ListReviewsFilter {
  status?: string;
  rating?: number;
  productId?: string;
  search?: string;
  page?: number;
  limit?: number;
}

export interface ReviewStats {
  total: number;
  published: number;
  pending: number;
  rejected: number;
  averageRating: number;
}

const COLLECTION_NAME = "reviews";

export const REVIEW_STATUSES: ReviewStatus[] = ["pending", "published", "rejected"];

let indexesReady: Promise<unknown> | undefined;

export async function getReviewsCollection() {
  const db = await getDatabase();
  const collection = db.collection<ReviewDocument>(COLLECTION_NAME);
  indexesReady ??= Promise.all([
    collection.createIndex({ shopDomain: 1, status: 1, createdAt: -1 }),
    collection.createIndex({ shopDomain: 1, productId: 1 }),
    collection.createIndex({ shopDomain: 1, "reviewer.email": 1 }),
  ]).catch((error) => {
    indexesReady = undefined;
    throw error;
  });
  await indexesReady;
  return collection;
}

/** Removes every review of a shop (shop/redact). */
export async function deleteShopReviews(shopDomain: string) {
  const collection = await getReviewsCollection();
  await collection.deleteMany({ shopDomain });
}

/** Removes a customer's reviews in a shop (customers/redact). */
export async function deleteCustomerReviews(shopDomain: string, email?: string) {
  if (!email) return;
  const collection = await getReviewsCollection();
  await collection.deleteMany({
    shopDomain,
    "reviewer.email": email.trim().toLowerCase(),
  });
}

/**
 * Creates a review document scoped to the authenticated shop.
 */
export async function createReview(
  shopDomain: string,
  input: CreateReviewInput
): Promise<ReviewDocument> {
  const collection = await getReviewsCollection();
  const now = new Date();

  const doc: ReviewDocument = {
    shopDomain,
    productId: input.productId,
    productHandle: input.productHandle,
    productTitle: input.productTitle,
    variantId: input.variantId || "",
    variantTitle: input.variantTitle || "",
    reviewer: {
      name: input.reviewer.name.trim(),
      email: input.reviewer.email.trim().toLowerCase(),
    },
    rating: Math.max(1, Math.min(5, Math.round(input.rating))),
    title: input.title.trim(),
    body: input.body.trim(),
    status: input.status || "pending",
    verifiedPurchase: input.verifiedPurchase ?? false,
    media: [],
    source: input.source || "manual",
    createdAt: now,
    updatedAt: now,
  };

  const result = await collection.insertOne(doc);
  return { ...doc, _id: result.insertedId, id: result.insertedId.toString() };
}

/**
 * Lists reviews with filtering, search, and pagination strictly scoped to the shop.
 */
export async function listReviews(
  shopDomain: string,
  filter: ListReviewsFilter = {}
) {
  const collection = await getReviewsCollection();
  const page = Math.max(1, Number(filter.page) || 1);
  const limit = Math.max(1, Math.min(50, Number(filter.limit) || 15));
  const skip = (page - 1) * limit;

  const query: any = { shopDomain };

  if (filter.status && filter.status !== "all") {
    query.status = filter.status;
  }

  if (filter.rating && filter.rating > 0) {
    query.rating = Number(filter.rating);
  }

  if (filter.productId && filter.productId !== "all") {
    query.productId = filter.productId;
  }

  if (filter.search && filter.search.trim()) {
    const searchRegex = new RegExp(
      filter.search.trim().slice(0, 100).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
      "i"
    );
    query.$or = [
      { "reviewer.name": searchRegex },
      { title: searchRegex },
      { body: searchRegex },
      { productTitle: searchRegex },
    ];
  }

  const [rawReviews, totalMatching, allReviewsForStats] = await Promise.all([
    collection
      .find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .toArray(),
    collection.countDocuments(query),
    collection
      .find({ shopDomain }, { projection: { status: 1, rating: 1 } })
      .toArray(),
  ]);

  const reviews = rawReviews.map((r) => ({
    ...r,
    id: r._id ? r._id.toString() : "",
  }));

  const stats: ReviewStats = {
    total: allReviewsForStats.length,
    published: 0,
    pending: 0,
    rejected: 0,
    averageRating: 0,
  };

  let totalRating = 0;
  for (const r of allReviewsForStats) {
    if (r.status === "published") stats.published += 1;
    else if (r.status === "pending") stats.pending += 1;
    else if (r.status === "rejected") stats.rejected += 1;
    totalRating += r.rating || 0;
  }

  stats.averageRating =
    stats.total > 0 ? Number((totalRating / stats.total).toFixed(1)) : 0;

  return {
    reviews,
    total: totalMatching,
    page,
    totalPages: Math.ceil(totalMatching / limit) || 1,
    stats,
  };
}

/**
 * Gets a single review by id, scoped to the authenticated shop.
 */
export async function getReview(
  shopDomain: string,
  id: string
): Promise<ReviewDocument | null> {
  if (!ObjectId.isValid(id)) return null;
  const collection = await getReviewsCollection();
  const doc = await collection.findOne({
    _id: new ObjectId(id),
    shopDomain,
  });
  if (!doc) return null;
  return { ...doc, id: doc._id ? doc._id.toString() : "" };
}

/**
 * Updates review status (publish, reject, pending) scoped to shop.
 */
export async function updateReviewStatus(
  shopDomain: string,
  id: string,
  status: ReviewStatus
): Promise<boolean> {
  if (!ObjectId.isValid(id) || !REVIEW_STATUSES.includes(status)) return false;
  const collection = await getReviewsCollection();
  const result = await collection.updateOne(
    { _id: new ObjectId(id), shopDomain },
    { $set: { status, updatedAt: new Date() } }
  );
  return result.matchedCount > 0;
}

/**
 * Deletes a review document, scoped to shop.
 */
export async function deleteReview(
  shopDomain: string,
  id: string
): Promise<boolean> {
  if (!ObjectId.isValid(id)) return false;
  const collection = await getReviewsCollection();
  const result = await collection.deleteOne({
    _id: new ObjectId(id),
    shopDomain,
  });
  return result.deletedCount > 0;
}

const PAGE_SIZE = 10;
const HOUR = 60 * 60 * 1000;

/** Published reviews + rating summary for one product. Never exposes email. */
export async function listPublicReviews(shopDomain: string, productId: string, page = 1) {
  const collection = await getReviewsCollection();
  const match = { shopDomain, productId, status: "published" as const };
  const [rows, dist] = await Promise.all([
    collection
      .find(match)
      .sort({ createdAt: -1 })
      .skip((Math.max(1, page) - 1) * PAGE_SIZE)
      .limit(PAGE_SIZE + 1)
      .toArray(),
    collection.aggregate([{ $match: match }, { $group: { _id: "$rating", n: { $sum: 1 } } }]).toArray(),
  ]);

  const distribution = [0, 0, 0, 0, 0];
  let count = 0;
  let sum = 0;
  for (const d of dist) {
    distribution[d._id - 1] = d.n;
    count += d.n;
    sum += d._id * d.n;
  }

  return {
    stats: { count, average: count ? Number((sum / count).toFixed(1)) : 0, distribution },
    reviews: rows.slice(0, PAGE_SIZE).map((r) => {
      const [first, ...rest] = r.reviewer.name.split(/\s+/);
      const last = rest.length ? ` ${rest[rest.length - 1][0]}.` : "";
      return {
        name: first + last,
        rating: r.rating,
        title: r.title,
        body: r.body,
        date: r.createdAt,
        variant: r.variantTitle || "",
      };
    }),
    hasMore: rows.length > PAGE_SIZE,
  };
}

/** Storefront submission: pending review, with duplicate and per-email throttle checks. */
export async function createStorefrontReview(
  shopDomain: string,
  input: CreateReviewInput
): Promise<ReviewDocument | "duplicate" | "throttled"> {
  const collection = await getReviewsCollection();
  const email = input.reviewer.email.trim().toLowerCase();
  const recent = await collection
    .find({ shopDomain, "reviewer.email": email, createdAt: { $gt: new Date(Date.now() - 24 * HOUR) } })
    .project({ productId: 1, body: 1, createdAt: 1 })
    .toArray();

  if (recent.some((r) => r.productId === input.productId && r.body === input.body.trim())) return "duplicate";
  if (recent.filter((r) => r.createdAt > new Date(Date.now() - HOUR)).length >= 5) return "throttled";

  return createReview(shopDomain, { ...input, status: "pending", source: "storefront" });
}
