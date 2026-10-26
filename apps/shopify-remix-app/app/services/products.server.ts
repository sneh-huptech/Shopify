import type { AdminApiContext } from "@shopify/shopify-app-remix/server";
import { ReviewInputError } from "../review-input";

export interface ShopifyProductItem {
  id: string;
  title: string;
  handle: string;
  featuredMedia?: {
    preview: { image: { url: string; altText: string | null } | null } | null;
  } | null;
  vendor?: string;
  productType?: string;
  status?: string;
}

export interface ProductPageInfo {
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  startCursor: string | null;
  endCursor: string | null;
}

export async function getShopifyProducts(
  admin: Pick<AdminApiContext, "graphql">,
  params: URLSearchParams,
) {
  const before = params.get("productsBefore");
  const after = before ? null : params.get("productsAfter");
  const response = await admin.graphql(
    `#graphql
      query reviewProducts($first: Int, $last: Int, $after: String, $before: String, $query: String) {
        products(first: $first, last: $last, after: $after, before: $before, sortKey: TITLE, query: $query) {
          nodes { id title handle vendor productType status featuredMedia { preview { image { url(transform: {maxWidth: 120, maxHeight: 120}) altText } } } }
          pageInfo { hasNextPage hasPreviousPage startCursor endCursor }
        }
      }`,
    {
      variables: {
        first: before ? null : 50,
        last: before ? 50 : null,
        after,
        before,
        query: params.get("productsSearch")?.trim() || null,
      },
    },
  );
  const result = await response.json();
  if (!result.data?.products)
    throw new Error("Products could not be loaded. Please try again.");
  return result.data.products as {
    nodes: ShopifyProductItem[];
    pageInfo: ProductPageInfo;
  };
}

export async function getReviewProduct(
  admin: Pick<AdminApiContext, "graphql">,
  id: string,
  variantId?: string,
) {
  if (!/^gid:\/\/shopify\/Product\/\d{1,20}$/.test(id))
    throw new ReviewInputError("Invalid product.");
  if (
    variantId &&
    !/^gid:\/\/shopify\/ProductVariant\/\d{1,20}$/.test(variantId)
  )
    throw new ReviewInputError("Invalid variant.");
  const response = await admin.graphql(
    `#graphql
      query reviewProduct($id: ID!, $variantId: ID!) {
        product(id: $id) { id title handle }
        productVariant(id: $variantId) { id title product { id } }
      }`,
    {
      variables: {
        id,
        variantId: variantId || "gid://shopify/ProductVariant/0",
      },
    },
  );
  const result = await response.json();
  if (!result.data)
    throw new Error("Product details could not be loaded. Please try again.");
  const product = result.data?.product as ShopifyProductItem | null;
  const variant = result.data?.productVariant;
  if (!product) throw new ReviewInputError("Product not found in this store.");
  if (variantId && (!variant || variant.product.id !== product.id))
    throw new ReviewInputError("Variant does not belong to this product.");
  return {
    productId: product.id,
    productTitle: product.title,
    productHandle: product.handle,
    variantId: variantId || "",
    variantTitle:
      variantId && variant?.title !== "Default Title" ? variant.title : "",
  };
}
