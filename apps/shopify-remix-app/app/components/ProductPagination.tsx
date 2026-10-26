import { useNavigation, useSearchParams } from "@remix-run/react";
import type { ProductPageInfo } from "../services/products.server";

export function ProductPagination({ pageInfo }: { pageInfo: ProductPageInfo }) {
  const [params, setParams] = useSearchParams();
  const navigation = useNavigation();
  const changePage = (key: string, cursor: string | null) => {
    const next = new URLSearchParams(params);
    next.delete("productsBefore");
    next.delete("productsAfter");
    if (cursor) next.set(key, cursor);
    setParams(next, { preventScrollReset: true });
  };
  return (
    <nav aria-label="Product catalog pages" style={{ display: "flex", flexWrap: "wrap", gap: 12, padding: "12px 0" }}>
      <button type="button" disabled={!pageInfo.hasPreviousPage || navigation.state !== "idle"} onClick={() => changePage("productsBefore", pageInfo.startCursor)}>Previous products</button>
      <button type="button" disabled={!pageInfo.hasNextPage || navigation.state !== "idle"} onClick={() => changePage("productsAfter", pageInfo.endCursor)}>Next products</button>
      {navigation.state !== "idle" && <span role="status">Loading products…</span>}
    </nav>
  );
}
