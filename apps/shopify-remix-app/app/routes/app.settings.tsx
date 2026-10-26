import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);
  return json({});
};

export default function SettingsPage() {
  return (
    <div
      style={{
        maxWidth: "800px",
        margin: "0 auto",
        padding: "24px 20px 48px",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      }}
    >
      <div style={{ marginBottom: "20px" }}>
        <h1 style={{ fontSize: "24px", fontWeight: 700, color: "#0F172A", margin: 0 }}>
          Settings
        </h1>
        <p style={{ fontSize: "14px", color: "#64748B", margin: "4px 0 0 0" }}>
          Configure review moderation rules, notifications, and display preferences.
        </p>
      </div>

      <div
        style={{
          backgroundColor: "#FFFFFF",
          border: "1px solid #E2E8F0",
          borderRadius: "10px",
          padding: "24px",
          display: "flex",
          flexDirection: "column",
          gap: "20px",
        }}
      >
        <div>
          <h2 style={{ fontSize: "16px", fontWeight: 600, color: "#0F172A", margin: "0 0 6px 0" }}>
            Moderation Workflow
          </h2>
          <p style={{ fontSize: "13px", color: "#64748B", margin: 0 }}>
            New customer submissions default to <strong>Pending</strong> status until verified and manually approved by store staff.
          </p>
        </div>

        <div style={{ borderTop: "1px solid #F1F5F9", paddingTop: "16px" }}>
          <h3 style={{ fontSize: "14px", fontWeight: 600, color: "#0F172A", margin: "0 0 4px 0" }}>
            Auto-Publish (Phase 2 Preview)
          </h3>
          <p style={{ fontSize: "13px", color: "#64748B", margin: "0 0 10px 0" }}>
            Automatically publish 4-star and 5-star reviews from verified buyers.
          </p>
          <span
            style={{
              display: "inline-block",
              padding: "3px 8px",
              fontSize: "11px",
              fontWeight: 500,
              backgroundColor: "#F1F5F9",
              color: "#64748B",
              borderRadius: "4px",
            }}
          >
            Coming in Phase 2
          </span>
        </div>

        <div style={{ borderTop: "1px solid #F1F5F9", paddingTop: "16px" }}>
          <h3 style={{ fontSize: "14px", fontWeight: 600, color: "#0F172A", margin: "0 0 4px 0" }}>
            Data Storage
          </h3>
          <p style={{ fontSize: "13px", color: "#64748B", margin: 0 }}>
            Custom reviews are securely isolated in MongoDB and tied directly to your Shopify store domain.
          </p>
        </div>
      </div>
    </div>
  );
}
