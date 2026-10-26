import { ObjectId, MongoServerError } from "mongodb";
import { createHash } from "node:crypto";
import { getDatabase } from "./mongodb.server";
import { reviewPage } from "../review-input";
import type {
  ReviewMedia,
  StoredReviewMedia,
} from "../services/review-media.server";

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
  media: ReviewMedia[];
  mediaData?: StoredReviewMedia[];
  source: "manual" | "storefront" | "import";
  createdAt: Date;
  updatedAt: Date;
  submissionKey?: string;
}

export interface CreateReviewInput {
  media?: StoredReviewMedia[];
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
  submissionKey?: string;
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

export const REVIEW_STATUSES: ReviewStatus[] = [
  "pending",
  "published",
  "rejected",
];

let indexesReady: Promise<unknown> | undefined;

export async function getReviewsCollection() {
  const db = await getDatabase();
  const collection = db.collection<ReviewDocument>(COLLECTION_NAME);
  indexesReady ??= Promise.all([
    collection.createIndex({ shopDomain: 1, status: 1, createdAt: -1 }),
    collection.createIndex({ shopDomain: 1, productId: 1 }),
    collection.createIndex({ shopDomain: 1, "reviewer.email": 1 }),
    collection.createIndex(
      { shopDomain: 1, submissionKey: 1 },
      {
        unique: true,
        partialFilterExpression: { submissionKey: { $type: "string" } },
      },
    ),
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
  await (
    await getDatabase()
  )
    .collection("review_submission_limits")
    .deleteMany({ shopDomain });
}

/** Removes a customer's reviews in a shop (customers/redact). */
export async function deleteCustomerReviews(
  shopDomain: string,
  email?: string,
) {
  if (!email) return;
  const collection = await getReviewsCollection();
  await collection.deleteMany({
    shopDomain,
    "reviewer.email": email.trim().toLowerCase(),
  });
  const emailHash = createHash("sha256")
    .update(email.trim().toLowerCase())
    .digest("hex");
  await (
    await getDatabase()
  )
    .collection("review_submission_limits")
    .deleteMany({ shopDomain, emailHash });
}

/**
 * Creates a review document scoped to the authenticated shop.
 */
export async function createReview(
  shopDomain: string,
  input: CreateReviewInput,
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
    media: (input.media || []).map(({ id, type, size }) => ({
      id,
      type,
      size,
    })),
    ...(input.media?.length ? { mediaData: input.media } : {}),
    source: input.source || "manual",
    createdAt: now,
    updatedAt: now,
    ...(input.submissionKey ? { submissionKey: input.submissionKey } : {}),
  };

  const result = await collection.insertOne(doc);
  return { ...doc, _id: result.insertedId, id: result.insertedId.toString() };
}

/**
 * Lists reviews with filtering, search, and pagination strictly scoped to the shop.
 */
export async function listReviews(
  shopDomain: string,
  filter: ListReviewsFilter = {},
) {
  const collection = await getReviewsCollection();
  const requestedPage = reviewPage(filter.page);
  const limit = Number.isInteger(filter.limit)
    ? Math.max(1, Math.min(50, filter.limit!))
    : 15;

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
      filter.search
        .trim()
        .slice(0, 100)
        .replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
      "i",
    );
    query.$or = [
      { "reviewer.name": searchRegex },
      { title: searchRegex },
      { body: searchRegex },
      { productTitle: searchRegex },
    ];
  }

  const [totalMatching, summary] = await Promise.all([
    collection.countDocuments(query),
    collection
      .aggregate([
        { $match: { shopDomain } },
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            averageRating: { $avg: "$rating" },
            published: {
              $sum: { $cond: [{ $eq: ["$status", "published"] }, 1, 0] },
            },
            pending: {
              $sum: { $cond: [{ $eq: ["$status", "pending"] }, 1, 0] },
            },
            rejected: {
              $sum: { $cond: [{ $eq: ["$status", "rejected"] }, 1, 0] },
            },
          },
        },
      ])
      .toArray(),
  ]);
  const totalPages = Math.ceil(totalMatching / limit) || 1;
  const page = Math.min(requestedPage, totalPages);
  const rawReviews = await collection
    .find(query, { projection: { mediaData: 0 } })
    .sort({ createdAt: -1, _id: -1 })
    .skip((page - 1) * limit)
    .limit(limit)
    .toArray();

  const reviews = rawReviews.map((r) => ({
    ...r,
    id: r._id ? r._id.toString() : "",
  }));

  const stats: ReviewStats = {
    total: summary[0]?.total || 0,
    published: summary[0]?.published || 0,
    pending: summary[0]?.pending || 0,
    rejected: summary[0]?.rejected || 0,
    averageRating: Number((summary[0]?.averageRating || 0).toFixed(1)),
  };

  return {
    reviews,
    total: totalMatching,
    page,
    totalPages,
    stats,
  };
}

/**
 * Gets a single review by id, scoped to the authenticated shop.
 */
export async function getReview(
  shopDomain: string,
  id: string,
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
  status: ReviewStatus,
): Promise<boolean> {
  if (!ObjectId.isValid(id) || !REVIEW_STATUSES.includes(status)) return false;
  const collection = await getReviewsCollection();
  const result = await collection.updateOne(
    { _id: new ObjectId(id), shopDomain },
    { $set: { status, updatedAt: new Date() } },
  );
  return result.matchedCount > 0;
}

/**
 * Deletes a review document, scoped to shop.
 */
export async function deleteReview(
  shopDomain: string,
  id: string,
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
export async function listPublicReviews(
  shopDomain: string,
  productId: string,
  page = 1,
) {
  const collection = await getReviewsCollection();
  const match = { shopDomain, productId, status: "published" as const };
  const [rows, dist] = await Promise.all([
    collection
      .find(match, { projection: { mediaData: 0 } })
      .sort({ createdAt: -1, _id: -1 })
      .skip((reviewPage(page) - 1) * PAGE_SIZE)
      .limit(PAGE_SIZE + 1)
      .toArray(),
    collection
      .aggregate([
        { $match: match },
        { $group: { _id: "$rating", n: { $sum: 1 } } },
      ])
      .toArray(),
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
    stats: {
      count,
      average: count ? Number((sum / count).toFixed(1)) : 0,
      distribution,
    },
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
        reviewId: r._id.toString(),
        media: r.media || [],
      };
    }),
    hasMore: rows.length > PAGE_SIZE,
  };
}

export async function getReviewMedia(
  shopDomain: string,
  reviewId: string,
  mediaId: string,
  includePending = false,
) {
  if (!ObjectId.isValid(reviewId) || !/^[a-f0-9-]{36}$/.test(mediaId))
    return null;
  const review = await (
    await getReviewsCollection()
  ).findOne(
    {
      _id: new ObjectId(reviewId),
      shopDomain,
      ...(!includePending ? { status: "published" as const } : {}),
      "mediaData.id": mediaId,
    },
    { projection: { mediaData: { $elemMatch: { id: mediaId } } } },
  );
  return review?.mediaData?.[0] || null;
}

/** Storefront submission: pending review with atomic duplicate protection. */
export async function createStorefrontReview(
  shopDomain: string,
  input: CreateReviewInput,
): Promise<ReviewDocument | "duplicate"> {
  const collection = await getReviewsCollection();
  const email = input.reviewer.email.trim().toLowerCase();
  const duplicate = await collection.findOne({
    shopDomain,
    "reviewer.email": email,
    productId: input.productId,
    body: input.body.trim(),
    createdAt: { $gt: new Date(Date.now() - 24 * HOUR) },
  });
  if (duplicate) return "duplicate";
  const submissionKey = createHash("sha256")
    .update(
      JSON.stringify([shopDomain, input.productId, email, input.body.trim()]),
    )
    .digest("hex");
  try {
    return await createReview(shopDomain, {
      ...input,
      status: "pending",
      source: "storefront",
      submissionKey,
    });
  } catch (error) {
    if (error instanceof MongoServerError && error.code === 11000)
      return "duplicate";
    throw error;
  }
}

let limitsReady: Promise<unknown> | undefined;

/** Shared counters run before product lookup. Email changes still consume the shop limit. */
export async function allowStorefrontSubmission(
  shopDomain: string,
  email: string,
  now = Date.now(),
) {
  const limits = (await getDatabase()).collection<{
    _id: string;
    count: number;
    shopDomain: string;
    expiresAt: Date;
    emailHash?: string;
  }>("review_submission_limits");
  limitsReady ??= limits
    .createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 })
    .catch((error) => {
      limitsReady = undefined;
      throw error;
    });
  await limitsReady;
  // shortcut: fixed windows permit a boundary burst; use a sliding window if real traffic needs finer limits.
  for (const [subject, window, maximum] of [
    ["shop", 60_000, 60],
    [email.trim().toLowerCase(), HOUR, 5],
  ] as const) {
    const bucket = Math.floor(now / window);
    const id = createHash("sha256")
      .update(JSON.stringify([shopDomain, subject, window, bucket]))
      .digest("hex");
    try {
      await limits.findOneAndUpdate(
        { _id: id, count: { $lt: maximum } },
        {
          $inc: { count: 1 },
          $setOnInsert: {
            shopDomain,
            expiresAt: new Date((bucket + 1) * window),
            ...(subject !== "shop"
              ? {
                  emailHash: createHash("sha256").update(subject).digest("hex"),
                }
              : {}),
          },
        },
        { upsert: true },
      );
    } catch (error) {
      if (error instanceof MongoServerError && error.code === 11000)
        return false;
      throw error;
    }
  }
  return true;
}
