import assert from "node:assert/strict";
import { readReviewForm, reviewInput, reviewPage, ReviewInputError } from "./review-input";

const fields = { title: " Great product ", body: " A useful product. ", name: " Jane Doe ", email: " Jane@Example.com ", rating: "5" };
const form = () => { const value = new FormData(); for (const [key, text] of Object.entries(fields)) value.set(key, text); return value; };
assert.equal(reviewInput(form()).reviewer.email, "jane@example.com");
for (const [key, value] of [["title", "x".repeat(101)], ["body", "short"], ["body", "x".repeat(2001)], ["name", "x".repeat(61)], ["email", "invalid"], ["rating", "NaN"], ["rating", "2.5"], ["rating", "6"]]) {
  const invalid = form(); invalid.set(key, value);
  assert.throws(() => reviewInput(invalid), ReviewInputError);
}
const file = form(); file.set("title", new Blob(["hello"]));
assert.throws(() => reviewInput(file), ReviewInputError);
for (const value of [NaN, Infinity, -1, 0, 1.5, Number.MAX_SAFE_INTEGER]) assert.equal(reviewPage(value), 1);
assert.equal(reviewPage(2), 2);
const decoded = await readReviewForm(new Request("http://localhost", { method: "POST", body: form() }));
assert.deepEqual(reviewInput(decoded), reviewInput(form()));
await assert.rejects(readReviewForm(new Request("http://localhost", { method: "POST", body: "x".repeat(16_385) })), (error: unknown) => error instanceof ReviewInputError && error.status === 413);
await assert.rejects(readReviewForm(new Request("http://localhost", { method: "POST", body: "invalid", headers: { "Content-Type": "multipart/form-data" } })), ReviewInputError);
console.log("review input ok");
