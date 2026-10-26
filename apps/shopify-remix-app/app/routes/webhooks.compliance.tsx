import type { ActionFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import { deleteCustomerReviews, deleteShopReviews } from "../db/reviews.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { topic, shop, payload } = await authenticate.webhook(request);

  console.log(`Received ${topic} webhook for ${shop}`);

  switch (topic) {
    case "CUSTOMERS_REDACT":
      await deleteCustomerReviews(shop, payload.customer?.email);
      break;
    case "SHOP_REDACT":
      await deleteShopReviews(shop);
      break;
    // shortcut: data_request is only acknowledged; reviews are visible to the merchant in-app, no export yet, build before App Store submission
  }

  return new Response();
};
