import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData, Link } from "@remix-run/react";
import { authenticate } from "../shopify.server";
import { getShopifyProducts } from "../services/products.server";
import { getReviewsCollection } from "../db/reviews.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session, admin } = await authenticate.admin(request);
  const products = await getShopifyProducts(admin, 50);

  const collection = await getReviewsCollection();
  const reviewCounts = await collection
    .aggregate([
      { $match: { shopDomain: session.shop } },
      { $group: { _id: "$productId", count: { $sum: 1 }, avgRating: { $avg: "$rating" } } },
    ])
    .toArray();

  const countsMap = new Map(
    reviewCounts.map((r: any) => [r._id, { count: r.count, avgRating: Number(r.avgRating.toFixed(1)) }])
  );

  const productStats = products.map((p) => {
    const stats = countsMap.get(p.id) || { count: 0, avgRating: 0 };
    return {
      ...p,
      reviewCount: stats.count,
      avgRating: stats.avgRating,
    };
  });

  return json({ products: productStats });
};

export default function ProductsPage() {
  const { products } = useLoaderData<typeof loader>();

  return (
    <div
      style={{
        maxWidth: "1200px",
        margin: "0 auto",
        padding: "24px 20px 48px",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      }}
    >
      <div style={{ marginBottom: "20px" }}>
        <h1 style={{ fontSize: "24px", fontWeight: 700, color: "#0F172A", margin: 0 }}>
          Products
        </h1>
        <p style={{ fontSize: "14px", color: "#64748B", margin: "4px 0 0 0" }}>
          Track and manage customer reviews by product catalog item.
        </p>
      </div>

      <div
        style={{
          backgroundColor: "#FFFFFF",
          border: "1px solid #E2E8F0",
          borderRadius: "10px",
          boxShadow: "0 1px 3px 0 rgba(0, 0, 0, 0.02)",
          overflow: "hidden",
        }}
      >
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
          <thead>
            <tr
              style={{
                borderBottom: "1px solid #E2E8F0",
                backgroundColor: "#F8FAFC",
                color: "#64748B",
                fontSize: "12px",
                fontWeight: 600,
                textTransform: "uppercase",
                letterSpacing: "0.04em",
                textAlign: "left",
              }}
            >
              <th style={{ padding: "12px 16px", width: "45%" }}>Product Title</th>
              <th style={{ padding: "12px 16px", width: "20%" }}>Reviews</th>
              <th style={{ padding: "12px 16px", width: "20%" }}>Avg Rating</th>
              <th style={{ padding: "12px 16px", width: "15%", textAlign: "right" }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {products.length === 0 ? (
              <tr>
                <td colSpan={4} style={{ padding: "40px", textAlign: "center", color: "#64748B" }}>
                  No Shopify products found. Create products in your store to begin collecting reviews.
                </td>
              </tr>
            ) : (
              products.map((p) => (
                <tr
                  key={p.id}
                  style={{
                    borderBottom: "1px solid #F1F5F9",
                  }}
                >
                  <td style={{ padding: "12px 16px", fontWeight: 600, color: "#0F172A" }}>
                    {p.title}
                    <div style={{ fontSize: "12px", fontWeight: 400, color: "#64748B" }}>
                      Handle: {p.handle}
                    </div>
                  </td>
                  <td style={{ padding: "12px 16px", color: "#334155" }}>
                    {p.reviewCount} {p.reviewCount === 1 ? "review" : "reviews"}
                  </td>
                  <td style={{ padding: "12px 16px", color: "#334155" }}>
                    {p.avgRating > 0 ? `★ ${p.avgRating} / 5.0` : "—"}
                  </td>
                  <td style={{ padding: "12px 16px", textAlign: "right" }}>
                    <Link
                      to={`/app/reviews?productId=${encodeURIComponent(p.id)}`}
                      style={{
                        fontSize: "12px",
                        color: "#0F172A",
                        fontWeight: 500,
                        textDecoration: "underline",
                      }}
                    >
                      View Reviews
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
