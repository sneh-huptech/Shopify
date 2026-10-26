import { Binary } from "mongodb";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { getDatabase, getMongoClient } from "./mongodb.server";
import {
  createReview,
  getReviewMedia,
  deleteCustomerReviews,
  getReview,
  createStorefrontReview,
  listPublicReviews,
  listReviews,
  updateReviewStatus,
  deleteReview,
  deleteShopReviews,
  allowStorefrontSubmission,
} from "./reviews.server";

// Never use the app's database or connection URI for integration tests.
process.env.MONGODB_URI =
  process.env.MONGODB_TEST_URI ||
  "mongodb://127.0.0.1:27017/?serverSelectionTimeoutMS=5000";
process.env.MONGODB_DB_NAME = `shopify_app_test_${randomUUID().replaceAll("-", "")}`;
const client = await getMongoClient();

const input = (email: string) => ({
  productId: "gid://shopify/Product/1",
  productHandle: "p",
  productTitle: "P",
  reviewer: { name: "N", email },
  rating: 5,
  title: "t",
  body: "b",
});

try {
  const a = await createReview("a.myshopify.com", input("Bob@x.com"));
  await createReview("a.myshopify.com", input("other@x.com"));
  const b = await createReview("b.myshopify.com", input("bob@x.com"));

  // shop isolation
  assert.equal((await listReviews("b.myshopify.com")).total, 1);
  assert.equal(await getReview("b.myshopify.com", a.id!), null);
  assert.equal(
    await updateReviewStatus("b.myshopify.com", a.id!, "published"),
    false,
  );
  assert.equal(
    await updateReviewStatus("a.myshopify.com", a.id!, "bogus" as any),
    false,
  );
  assert.equal(
    await updateReviewStatus("a.myshopify.com", a.id!, "published"),
    true,
  );

  // search text is literal, not a regex
  assert.equal(
    (await listReviews("a.myshopify.com", { search: "(" })).total,
    0,
  );

  // customer redact: only that shop, case-insensitive email
  await deleteCustomerReviews("a.myshopify.com", "BOB@x.com");
  assert.equal((await listReviews("a.myshopify.com")).total, 1);
  assert.notEqual(await getReview("b.myshopify.com", b.id!), null);

  // storefront: pending by default, duplicate blocked, only published + no email in public list
  const sf = await createStorefrontReview("a.myshopify.com", {
    ...input("c@x.com"),
    body: "great product",
  });
  assert.ok(
    typeof sf === "object" &&
      sf.status === "pending" &&
      sf.source === "storefront",
  );
  assert.equal(
    await createStorefrontReview("a.myshopify.com", {
      ...input("c@x.com"),
      body: "great product",
    }),
    "duplicate",
  );
  let pub = await listPublicReviews(
    "a.myshopify.com",
    "gid://shopify/Product/1",
  );
  assert.equal(pub.stats.count, 0);
  await updateReviewStatus("a.myshopify.com", (sf as any).id, "published");
  pub = await listPublicReviews("a.myshopify.com", "gid://shopify/Product/1");
  assert.equal(pub.stats.count, 1);
  assert.equal(pub.stats.distribution[4], 1);
  assert.ok(!JSON.stringify(pub).includes("@"));
  assert.equal(
    (await listPublicReviews("b.myshopify.com", "gid://shopify/Product/1"))
      .stats.count,
    0,
  );

  // The complete moderation loop changes public visibility and ratings.
  await updateReviewStatus("a.myshopify.com", (sf as any).id, "rejected");
  assert.equal(
    (await listPublicReviews("a.myshopify.com", input("").productId)).stats
      .count,
    0,
  );
  await updateReviewStatus("a.myshopify.com", (sf as any).id, "published");
  assert.equal(await deleteReview("b.myshopify.com", (sf as any).id), false);
  assert.equal(await deleteReview("a.myshopify.com", (sf as any).id), true);
  assert.equal(
    (await listPublicReviews("a.myshopify.com", input("").productId)).stats
      .count,
    0,
  );

  // Simultaneous duplicate submissions persist exactly one document.
  const attempts = await Promise.all(
    Array.from({ length: 12 }, () =>
      createStorefrontReview("race.myshopify.com", input("race@example.com")),
    ),
  );
  assert.equal(attempts.filter((result) => result !== "duplicate").length, 1);
  assert.equal((await listReviews("race.myshopify.com")).total, 1);

  // Stable pagination and aggregate statistics, including invalid/outdated page numbers.
  for (let i = 0; i < 12; i++)
    await createReview("pages.myshopify.com", {
      ...input(`${i}@example.com`),
      title: `Review ${i}`,
      rating: i < 6 ? 5 : 1,
      status: "published",
    });
  const firstPage = await listReviews("pages.myshopify.com", { limit: 10 });
  const lastPage = await listReviews("pages.myshopify.com", {
    page: 999,
    limit: 10,
  });
  assert.equal(lastPage.page, 2);
  assert.equal(lastPage.reviews.length, 2);
  assert.equal(firstPage.stats.averageRating, 3);
  assert.equal(firstPage.stats.published, 12);
  assert.equal(
    (await listReviews("pages.myshopify.com", { page: Infinity })).page,
    1,
  );
  const publicFirst = await listPublicReviews(
    "pages.myshopify.com",
    input("").productId,
    NaN,
  );
  const publicLast = await listPublicReviews(
    "pages.myshopify.com",
    input("").productId,
    2,
  );
  assert.equal(publicFirst.reviews.length, 10);
  assert.equal(publicLast.reviews.length, 2);
  assert.equal(
    new Set(
      [...publicFirst.reviews, ...publicLast.reviews].map(
        (review) => review.title,
      ),
    ).size,
    12,
  );
  assert.equal(publicFirst.stats.average, 3);

  // Counters are atomic, scoped to the store, and bound rotating-email traffic.
  const now = Date.now() + 60 * 60 * 1000;
  const limits = await Promise.all(
    Array.from({ length: 12 }, () =>
      allowStorefrontSubmission("limit.myshopify.com", "same@example.com", now),
    ),
  );
  assert.equal(limits.filter(Boolean).length, 5);
  await deleteCustomerReviews("limit.myshopify.com", "SAME@example.com");
  assert.equal(
    await (
      await getDatabase()
    )
      .collection("review_submission_limits")
      .countDocuments({
        shopDomain: "limit.myshopify.com",
        emailHash: { $exists: true },
      }),
    0,
  );
  assert.equal(
    await allowStorefrontSubmission(
      "other.myshopify.com",
      "same@example.com",
      now,
    ),
    true,
  );
  for (let i = 0; i < 60; i++)
    assert.equal(
      await allowStorefrontSubmission(
        "shop-limit.myshopify.com",
        `${i}@example.com`,
        now,
      ),
      true,
    );
  assert.equal(
    await allowStorefrontSubmission(
      "shop-limit.myshopify.com",
      "new@example.com",
      now,
    ),
    false,
  );
  assert.equal(
    await allowStorefrontSubmission(
      "shop-limit.myshopify.com",
      "new@example.com",
      now + 60_000,
    ),
    true,
  );
  await deleteShopReviews("shop-limit.myshopify.com");
  assert.equal(
    await (
      await getDatabase()
    )
      .collection("review_submission_limits")
      .countDocuments({ shopDomain: "shop-limit.myshopify.com" }),
    0,
  );

  const attachment = {
    id: randomUUID(),
    type: "image/webp" as const,
    size: 4,
    data: new Binary(Buffer.from("test")),
  };
  const attached = await createReview("media.myshopify.com", {
    ...input("media@example.com"),
    media: [attachment],
  });
  assert.equal(
    await getReviewMedia("media.myshopify.com", attached.id!, attachment.id),
    null,
  );
  assert.equal(
    await getReviewMedia(
      "other.myshopify.com",
      attached.id!,
      attachment.id,
      true,
    ),
    null,
  );
  assert.ok(
    await getReviewMedia(
      "media.myshopify.com",
      attached.id!,
      attachment.id,
      true,
    ),
  );
  const attachmentList = await listReviews("media.myshopify.com");
  assert.equal("mediaData" in attachmentList.reviews[0], false);
  assert.equal(attachmentList.reviews[0].media[0].id, attachment.id);
  assert.equal(
    (await listPublicReviews("media.myshopify.com", attached.productId)).reviews
      .length,
    0,
  );
  await updateReviewStatus("media.myshopify.com", attached.id!, "published");
  assert.ok(
    await getReviewMedia("media.myshopify.com", attached.id!, attachment.id),
  );
  const publicAttachment = (
    await listPublicReviews("media.myshopify.com", attached.productId)
  ).reviews[0];
  assert.equal(publicAttachment.media[0].id, attachment.id);
  assert.equal("data" in publicAttachment.media[0], false);
  await updateReviewStatus("media.myshopify.com", attached.id!, "rejected");
  assert.equal(
    await getReviewMedia("media.myshopify.com", attached.id!, attachment.id),
    null,
  );
  await deleteReview("media.myshopify.com", attached.id!);
  assert.equal(
    await getReviewMedia(
      "media.myshopify.com",
      attached.id!,
      attachment.id,
      true,
    ),
    null,
  );
  const redactAttachment = await createReview("media.myshopify.com", {
    ...input("media@example.com"),
    media: [attachment],
  });
  await deleteCustomerReviews("media.myshopify.com", "media@example.com");
  assert.equal(
    await getReviewMedia(
      "media.myshopify.com",
      redactAttachment.id!,
      attachment.id,
      true,
    ),
    null,
  );
  const shopAttachment = await createReview("media.myshopify.com", {
    ...input("media@example.com"),
    media: [attachment],
  });
  await deleteShopReviews("media.myshopify.com");
  assert.equal(
    await getReviewMedia(
      "media.myshopify.com",
      shopAttachment.id!,
      attachment.id,
      true,
    ),
    null,
  );
  console.log("ok");
} finally {
  try {
    await (await getDatabase()).dropDatabase();
  } finally {
    await client.close();
  }
}
