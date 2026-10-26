import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { getDatabase, getMongoClient } from "./mongodb.server";
import {
  createReview,
  deleteCustomerReviews,
  getReview,
  createStorefrontReview,
  listPublicReviews,
  listReviews,
  updateReviewStatus,
} from "./reviews.server";

// Never use the app's database or connection URI for integration tests.
process.env.MONGODB_URI = process.env.MONGODB_TEST_URI || "mongodb://127.0.0.1:27017/?serverSelectionTimeoutMS=5000";
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
  assert.equal(await updateReviewStatus("b.myshopify.com", a.id!, "published"), false);
  assert.equal(await updateReviewStatus("a.myshopify.com", a.id!, "bogus" as any), false);
  assert.equal(await updateReviewStatus("a.myshopify.com", a.id!, "published"), true);

  // search text is literal, not a regex
  assert.equal((await listReviews("a.myshopify.com", { search: "(" })).total, 0);

  // customer redact: only that shop, case-insensitive email
  await deleteCustomerReviews("a.myshopify.com", "BOB@x.com");
  assert.equal((await listReviews("a.myshopify.com")).total, 1);
  assert.notEqual(await getReview("b.myshopify.com", b.id!), null);

  // storefront: pending by default, duplicate blocked, only published + no email in public list
  const sf = await createStorefrontReview("a.myshopify.com", { ...input("c@x.com"), body: "great product" });
  assert.ok(typeof sf === "object" && sf.status === "pending" && sf.source === "storefront");
  assert.equal(await createStorefrontReview("a.myshopify.com", { ...input("c@x.com"), body: "great product" }), "duplicate");
  let pub = await listPublicReviews("a.myshopify.com", "gid://shopify/Product/1");
  assert.equal(pub.stats.count, 0);
  await updateReviewStatus("a.myshopify.com", (sf as any).id, "published");
  pub = await listPublicReviews("a.myshopify.com", "gid://shopify/Product/1");
  assert.equal(pub.stats.count, 1);
  assert.equal(pub.stats.distribution[4], 1);
  assert.ok(!JSON.stringify(pub).includes("@"));
  assert.equal((await listPublicReviews("b.myshopify.com", "gid://shopify/Product/1")).stats.count, 0);

  console.log("ok");
} finally {
  try {
    await (await getDatabase()).dropDatabase();
  } finally {
    await client.close();
  }
}
