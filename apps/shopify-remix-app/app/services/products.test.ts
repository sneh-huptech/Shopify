import assert from "node:assert/strict";
import { getReviewProduct, getShopifyProducts } from "./products.server";
import { ReviewInputError } from "../review-input";

const product = {
  id: "gid://shopify/Product/51",
  title: "Real product",
  handle: "real",
};
const pageInfo = {
  hasNextPage: false,
  hasPreviousPage: true,
  startCursor: "51",
  endCursor: "51",
};
const requests: Record<string, unknown>[] = [];
let data: any = { products: { nodes: [product], pageInfo } };
const admin = {
  graphql: async (
    _query: string,
    options: { variables: Record<string, unknown> },
  ) => {
    requests.push(options.variables);
    return { json: async () => ({ data }) };
  },
} as any;
const catalog = await getShopifyProducts(
  admin,
  new URLSearchParams({ productsAfter: "50" }),
);
assert.equal(catalog.nodes[0].id, product.id);
assert.deepEqual(requests.at(-1), {
  first: 50,
  last: null,
  after: "50",
  before: null,
  query: null,
});
await getShopifyProducts(admin, new URLSearchParams({ productsBefore: "51" }));
assert.deepEqual(requests.at(-1), {
  first: null,
  last: 50,
  after: null,
  before: "51",
  query: null,
});
await getShopifyProducts(
  admin,
  new URLSearchParams({ productsSearch: "snowboard" }),
);
assert.equal(requests.at(-1)?.query, "snowboard");
data = null;
await assert.rejects(
  getShopifyProducts(admin, new URLSearchParams()),
  /could not be loaded/,
);
data = {
  product,
  productVariant: {
    id: "gid://shopify/ProductVariant/2",
    title: "Blue",
    product: { id: "gid://shopify/Product/999" },
  },
};
await assert.rejects(
  getReviewProduct(admin, product.id, "gid://shopify/ProductVariant/2"),
  ReviewInputError,
);
data.productVariant.product.id = product.id;
assert.equal(
  (await getReviewProduct(admin, product.id, "gid://shopify/ProductVariant/2"))
    .variantTitle,
  "Blue",
);
assert.equal(
  (await getReviewProduct(admin, product.id)).productTitle,
  "Real product",
);
await assert.rejects(
  getReviewProduct(admin, "gid://shopify/Product/invalid"),
  ReviewInputError,
);
data = { product: null };
await assert.rejects(getReviewProduct(admin, product.id), /not found/);
console.log("product pagination and validation ok");
