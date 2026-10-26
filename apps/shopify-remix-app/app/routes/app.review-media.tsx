import type { LoaderFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import { getReviewMedia } from "../db/reviews.server";
import { mediaResponse } from "../services/review-media.server";

export async function loader({ request }: LoaderFunctionArgs) {
  const { session } = await authenticate.admin(request);
  const params = new URL(request.url).searchParams;
  const file = await getReviewMedia(
    session.shop,
    params.get("reviewId") || "",
    params.get("media") || "",
    true,
  );
  return file
    ? mediaResponse(file, request)
    : new Response(null, {
        status: 404,
        headers: { "Cache-Control": "no-store" },
      });
}
