export class ReviewInputError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}

export async function readReviewForm(request: Request) {
  const reader = request.body?.getReader();
  if (!reader) throw new ReviewInputError("Missing review form.");
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      length += value.length;
      if (length > 16_384) {
        await reader.cancel();
        throw new ReviewInputError("Review form is too large.", 413);
      }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const body = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) { body.set(chunk, offset); offset += chunk.length; }
  try {
    return await new Response(body, { headers: { "Content-Type": request.headers.get("Content-Type") || "" } }).formData();
  } catch { throw new ReviewInputError("Invalid review form."); }
}

export interface ReviewActionResult {
  success: boolean;
  error?: string;
  message?: string;
  intent?: string;
  reviewId?: string;
  status?: "pending" | "published" | "rejected";
}

export function reviewInput(form: FormData) {
  const text = (key: string) => {
    const value = form.get(key);
    if (typeof value !== "string") throw new ReviewInputError("Please complete all review fields.");
    return value.trim();
  };
  const title = text("title");
  const body = text("body");
  const name = text("name");
  const email = text("email").toLowerCase();
  const rating = Number(text("rating"));
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) throw new ReviewInputError("Please choose a rating from 1 to 5.");
  if (!title || title.length > 100) throw new ReviewInputError("Please enter a title of 1–100 characters.");
  if (body.length < 10 || body.length > 2000) throw new ReviewInputError("Your review must be 10–2000 characters.");
  if (!name || name.length > 60) throw new ReviewInputError("Please enter a name of 1–60 characters.");
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new ReviewInputError("Please enter a valid email.");
  return { title, body, rating, reviewer: { name, email } };
}

export function reviewPage(value = 1) {
  return Number.isSafeInteger(value) && value > 0 && value <= 1_000_000 ? value : 1;
}
