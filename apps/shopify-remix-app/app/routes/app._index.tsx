import type { LoaderFunctionArgs } from "@remix-run/node";
import { Link, useLoaderData } from "@remix-run/react";
import { authenticate } from "../shopify.server";
import { listReviews } from "../db/reviews.server";
import { SummaryMetrics } from "../components/SummaryMetrics";
import { StatusBadge } from "../components/StatusBadge";
import { StarRating } from "../components/StarRating";
import "../styles/review-admin.css";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const { stats, reviews } = await listReviews(session.shop, { limit: 5 });
  return { stats, reviews };
};

export default function Index() {
  const { stats, reviews } = useLoaderData<typeof loader>();
  return (
    <main className="review-admin">
      <header className="review-page-header">
        <div>
          <p className="review-eyebrow">Customer feedback</p>
          <h1>Overview</h1>
          <p>Turn customer experiences into confidence in your products.</p>
        </div>
        <Link className="review-button review-button-primary" to="/app/reviews">
          Manage reviews
        </Link>
      </header>
      <SummaryMetrics stats={stats} />
      <section className="review-callout" aria-labelledby="moderation-heading">
        <div>
          <span className="review-eyebrow">Moderation</span>
          <h2 id="moderation-heading">
            {stats.pending
              ? `${stats.pending} ${stats.pending === 1 ? "review needs" : "reviews need"} your attention`
              : "You’re all caught up"}
          </h2>
          <p>
            New reviews stay hidden until you approve them. Review feedback
            before it appears on your store.
          </p>
        </div>
        <Link className="review-button" to="/app/reviews?status=pending">
          View pending reviews
        </Link>
      </section>
      <div className="review-dashboard-grid">
        <section className="review-card" aria-labelledby="recent-heading">
          <div className="review-section-header">
            <div>
              <h2 id="recent-heading">Recent feedback</h2>
              <p>Your five most recent reviews, across all statuses.</p>
            </div>
            <Link to="/app/reviews">View all</Link>
          </div>
          {reviews.length ? (
            <ul className="review-activity">
              {reviews.map((review) => (
                <li key={review.id}>
                  <div className="review-activity-top">
                    <StarRating value={review.rating} size="sm" />
                    <StatusBadge status={review.status} />
                  </div>
                  <h3>{review.title}</h3>
                  <p className="review-clamp">{review.body}</p>
                  <p className="review-meta">
                    {review.reviewer.name} · {review.productTitle}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <div className="review-empty">
              <h3>Your next customer story starts here</h3>
              <p>
                Reviews submitted through your storefront will appear here for
                you to manage.
              </p>
              <Link className="review-button" to="/app/reviews">
                Open reviews
              </Link>
            </div>
          )}
        </section>
        <aside className="review-card review-guide">
          <p className="review-eyebrow">Your review workflow</p>
          <h2>From feedback to trust</h2>
          <ol>
            <li>
              <h3>Collect feedback</h3>
              <p>
                Customers share their experience through the product review
                widget.
              </p>
            </li>
            <li>
              <h3>Review and approve</h3>
              <p>Check new submissions in your pending queue.</p>
            </li>
            <li>
              <h3>Share with shoppers</h3>
              <p>
                Published reviews appear on the product page and contribute to
                its rating.
              </p>
            </li>
          </ol>
          <Link to="/app/products">Explore product reviews →</Link>
        </aside>
      </div>
    </main>
  );
}
