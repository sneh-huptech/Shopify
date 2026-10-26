import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import { createStorefrontReview, listPublicReviews } from "../db/reviews.server";

// Storefront entry point, reached through the Shopify app proxy (/apps/reviews).
// The proxy signature is verified by appProxy(), so the shop is never taken from the browser.

const clean = (v: FormDataEntryValue | null, max: number) =>
  String(v ?? "").replace(/<[^>]*>/g, "").replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "").trim().slice(0, max);

const isId = (v: string | null): v is string => !!v && /^\d{1,20}$/.test(v);

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.public.appProxy(request);
  const url = new URL(request.url);
  const productId = url.searchParams.get("productId");
  if (!session || !isId(productId)) return json({ error: "Not found" }, { status: 404 });

  return json(
    await listPublicReviews(
      session.shop,
      `gid://shopify/Product/${productId}`,
      Number(url.searchParams.get("page")) || 1
    ),
    { headers: { "Cache-Control": "no-store" } }
  );
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session, admin } = await authenticate.public.appProxy(request);
  if (!session || !admin) return json({ error: "Not found" }, { status: 404 });

  const form = await request.formData();
  const productNumericId = form.get("productId")?.toString() ?? null;
  const variantNumericId = form.get("variantId")?.toString() || null;
  if (!isId(productNumericId)) return json({ error: "Invalid product." }, { status: 400 });

  const rating = Number(form.get("rating"));
  const title = clean(form.get("title"), 100);
  const body = clean(form.get("body"), 2000);
  const name = clean(form.get("name"), 60);
  const email = clean(form.get("email"), 254);

  if (!Number.isInteger(rating) || rating < 1 || rating > 5) return json({ error: "Please choose a rating." }, { status: 400 });
  if (!title) return json({ error: "Please add a title." }, { status: 400 });
  if (body.length < 10) return json({ error: "Your review must be at least 10 characters." }, { status: 400 });
  if (!name) return json({ error: "Please enter your name." }, { status: 400 });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ error: "Please enter a valid email." }, { status: 400 });

  // Product details come from Shopify, never from the browser.
  const productId = `gid://shopify/Product/${productNumericId}`;
  const res = await admin.graphql(
    `#graphql
      query reviewProduct($id: ID!) {
        product(id: $id) { title handle variants(first: 100) { nodes { id title } } }
      }`,
    { variables: { id: productId } }
  );
  const product = (await res.json()).data?.product;
  if (!product) return json({ error: "Product not found." }, { status: 404 });

  const variant = isId(variantNumericId)
    ? product.variants.nodes.find((v: { id: string }) => v.id === `gid://shopify/ProductVariant/${variantNumericId}`)
    : undefined;

  const result = await createStorefrontReview(session.shop, {
    productId,
    productHandle: product.handle,
    productTitle: product.title,
    variantId: variant?.id,
    variantTitle: variant && variant.title !== "Default Title" ? variant.title : "",
    reviewer: { name, email },
    rating,
    title,
    body,
  });

  if (result === "duplicate") return json({ error: "You have already submitted this review." }, { status: 409 });
  if (result === "throttled") return json({ error: "Too many reviews submitted. Please try again later." }, { status: 429 });
  return json({ ok: true });
};
