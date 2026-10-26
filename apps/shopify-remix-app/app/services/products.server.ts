export interface ShopifyProductItem {
  id: string;
  title: string;
  handle: string;
  featuredImageUrl?: string;
  variants: Array<{
    id: string;
    title: string;
    price: string;
  }>;
}

export async function getShopifyProducts(
  admin: any,
  first: number = 50
): Promise<ShopifyProductItem[]> {
  try {
    const response = await admin.graphql(
      `#graphql
        query getProductsList($first: Int!) {
          products(first: $first) {
            edges {
              node {
                id
                title
                handle
                featuredMedia {
                  preview {
                    image {
                      url
                    }
                  }
                }
                variants(first: 10) {
                  edges {
                    node {
                      id
                      title
                      price
                    }
                  }
                }
              }
            }
          }
        }
      `,
      {
        variables: { first },
      }
    );

    const json = await response.json();
    const edges = json?.data?.products?.edges || [];

    return edges.map(({ node }: any) => ({
      id: node.id,
      title: node.title,
      handle: node.handle,
      featuredImageUrl: node.featuredMedia?.preview?.image?.url || "",
      variants: (node.variants?.edges || []).map(({ node: v }: any) => ({
        id: v.id,
        title: v.title,
        price: v.price,
      })),
    }));
  } catch (error) {
    console.error("[Shopify GraphQL] Failed to fetch products:", error);
    return [];
  }
}
