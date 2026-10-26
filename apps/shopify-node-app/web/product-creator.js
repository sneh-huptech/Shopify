import { GraphqlQueryError } from "@shopify/shopify-api";
import shopify from "./shopify.js";

const ADJECTIVES = [
  "autumn",
  "hidden",
  "bitter",
  "misty",
  "silent",
  "empty",
  "dry",
  "dark",
  "summer",
  "icy",
  "delicate",
  "quiet",
  "white",
  "cool",
  "spring",
  "winter",
  "patient",
  "twilight",
  "dawn",
  "crimson",
  "wispy",
  "weathered",
  "blue",
  "billowing",
  "broken",
  "cold",
  "damp",
  "falling",
  "frosty",
  "green",
  "long",
];

const NOUNS = [
  "waterfall",
  "river",
  "breeze",
  "moon",
  "rain",
  "wind",
  "sea",
  "morning",
  "snow",
  "lake",
  "sunset",
  "pine",
  "shadow",
  "leaf",
  "dawn",
  "glitter",
  "forest",
  "hill",
  "cloud",
  "meadow",
  "sun",
  "glade",
  "bird",
  "brook",
  "butterfly",
  "bush",
  "dew",
  "dust",
  "field",
  "fire",
  "flower",
];

export const DEFAULT_PRODUCTS_COUNT = 5;
const CREATE_PRODUCTS_MUTATION = `
  mutation populateProduct($product: ProductCreateInput!) {
    productCreate(product: $product) {
      product {
        id
      }
    }
  }
`;

const LEGACY_CREATE_PRODUCTS_MUTATION = `
  mutation populateProductLegacy($input: ProductInput!) {
    productCreate(input: $input) {
      product {
        id
      }
    }
  }
`;

export default async function productCreator(
  session,
  count = DEFAULT_PRODUCTS_COUNT
) {
  const client = new shopify.api.clients.Graphql({ session });

  for (let i = 0; i < count; i++) {
    const title = randomTitle();
    try {
      await client.request(CREATE_PRODUCTS_MUTATION, {
        variables: {
          product: {
            title,
          },
        },
      });
    } catch (err) {
      // Fallback for older API versions using input parameter
      try {
        await client.request(LEGACY_CREATE_PRODUCTS_MUTATION, {
          variables: {
            input: {
              title,
            },
          },
        });
      } catch (fallbackErr) {
        if (err instanceof GraphqlQueryError) {
          throw new Error(
            `${err.message}\n${JSON.stringify(err.response, null, 2)}`
          );
        } else {
          throw err;
        }
      }
    }
  }
}

function randomTitle() {
  const adjective = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  const noun = NOUNS[Math.floor(Math.random() * NOUNS.length)];
  return `${adjective} ${noun}`;
}
