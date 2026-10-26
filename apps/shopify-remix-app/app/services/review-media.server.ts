import { randomUUID } from "node:crypto";
import { execFile } from "node:child_process";
import { mkdtemp, writeFile, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import sharp from "sharp";
import ffmpeg from "ffmpeg-static";
import { Binary } from "mongodb";
import { ReviewInputError } from "../review-input";

const MB = 1024 * 1024;
export const MEDIA_BODY_LIMIT = 12 * MB + 16_384;
export interface ReviewMedia {
  id: string;
  type: "image/webp" | "video/mp4";
  size: number;
}
export interface StoredReviewMedia extends ReviewMedia {
  data: Binary;
}
let processing = 0;

export async function prepareReviewMedia(
  form: FormData,
): Promise<StoredReviewMedia[]> {
  const entries = form.getAll("media");
  if (entries.some((entry) => typeof entry === "string"))
    throw new ReviewInputError("Invalid attachment.");
  const files = (entries as File[]).filter((file) => file.size || file.name);
  if (files.length > 3)
    throw new ReviewInputError("Choose up to three photos or videos.");
  if (files.reduce((sum, file) => sum + file.size, 0) > 12 * MB)
    throw new ReviewInputError(
      "Attachments must total no more than 12 MB.",
      413,
    );
  if (!files.length) return [];
  if (processing >= 2)
    throw new ReviewInputError(
      "Uploads are busy. Please try again shortly.",
      503,
    );
  processing++;
  try {
    const media: StoredReviewMedia[] = [];
    for (const file of files) {
      const image =
        /\.(jpe?g|png|webp)$/i.test(file.name) &&
        ["image/jpeg", "image/png", "image/webp"].includes(file.type);
      const video =
        /\.(mp4|webm)$/i.test(file.name) &&
        ["video/mp4", "video/webm"].includes(file.type);
      if (!image && !video)
        throw new ReviewInputError(
          "Use JPG, PNG, WebP, MP4 or WebM files only.",
        );
      if (!file.size || file.size > (image ? 3 : 8) * MB)
        throw new ReviewInputError(
          image
            ? "Each photo must be 3 MB or smaller."
            : "Each video must be 8 MB or smaller.",
          413,
        );
      const input = Buffer.from(await file.arrayBuffer());
      let output: Buffer;
      try {
        if (image) {
          const decoder = sharp(input, {
            limitInputPixels: 16_000_000,
            failOn: "warning",
          });
          const metadata = await decoder.metadata();
          const expected = {
            "image/jpeg": "jpeg",
            "image/png": "png",
            "image/webp": "webp",
          }[file.type];
          if (metadata.format !== expected || (metadata.pages || 1) > 1)
            throw new Error("Unsupported image");
          output = await decoder
            .rotate()
            .resize({
              width: 1600,
              height: 1600,
              fit: "inside",
              withoutEnlargement: true,
            })
            .webp({ quality: 82 })
            .timeout({ seconds: 10 })
            .toBuffer();
        } else {
          const mp4 =
            input.length > 12 && input.toString("ascii", 4, 8) === "ftyp";
          const webm = input
            .subarray(0, 4)
            .equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3]));
          if (!(file.type === "video/mp4" ? mp4 : webm))
            throw new Error("Invalid video");
          const directory = await mkdtemp(join(tmpdir(), "review-media-"));
          try {
            const source = join(directory, "input");
            const destination = join(directory, "output.mp4");
            await writeFile(source, input);
            await new Promise<void>((resolve, reject) => {
              execFile(
                process.env.FFMPEG_PATH || ffmpeg || "ffmpeg",
                [
                  "-nostdin",
                  "-v",
                  "error",
                  "-protocol_whitelist",
                  "file,pipe",
                  "-max_alloc",
                  "67108864",
                  "-threads",
                  "1",
                  "-f",
                  mp4 ? "mov" : "matroska",
                  "-i",
                  source,
                  "-t",
                  "30",
                  "-map",
                  "0:v:0",
                  "-map",
                  "0:a:0?",
                  "-map_metadata",
                  "-1",
                  "-map_chapters",
                  "-1",
                  "-vf",
                  "scale=1280:720:force_original_aspect_ratio=decrease:force_divisible_by=2",
                  "-c:v",
                  "libx264",
                  "-threads",
                  "1",
                  "-preset",
                  "veryfast",
                  "-pix_fmt",
                  "yuv420p",
                  "-b:v",
                  "900k",
                  "-c:a",
                  "aac",
                  "-b:a",
                  "96k",
                  "-movflags",
                  "+faststart",
                  "-fs",
                  String(5 * MB),
                  destination,
                ],
                { timeout: 30_000, maxBuffer: 64 * 1024, windowsHide: true },
                (error) => (error ? reject(error) : resolve()),
              );
            });
            output = await readFile(destination);
          } finally {
            await rm(directory, { recursive: true, force: true });
          }
        }
      } catch {
        throw new ReviewInputError(
          "An attachment could not be processed. Choose a valid photo or video.",
        );
      }
      if (
        !output.length ||
        output.length > 5 * MB ||
        media.reduce((sum, item) => sum + item.size, output.length) > 8 * MB
      )
        throw new ReviewInputError(
          "Processed attachments are too large. Choose smaller files.",
          413,
        );
      media.push({
        id: randomUUID(),
        type: image ? "image/webp" : "video/mp4",
        size: output.length,
        data: new Binary(output),
      });
    }
    return media;
  } finally {
    processing--;
  }
}

export function mediaResponse(file: StoredReviewMedia, request: Request) {
  const data = Buffer.from(file.data.value());
  const headers = new Headers({
    "Content-Type": file.type,
    "Content-Length": String(data.length),
    "Cache-Control": "private, no-store",
    "X-Content-Type-Options": "nosniff",
    "Content-Security-Policy": "default-src 'none'; sandbox",
    "Accept-Ranges": "bytes",
    "Content-Disposition": `inline; filename="${file.id}.${file.type === "video/mp4" ? "mp4" : "webp"}"`,
  });
  const range = request.headers.get("Range");
  if (!range) return new Response(data, { headers });
  const match = /^bytes=(\d*)-(\d*)$/.exec(range);
  const suffix = match && !match[1] && match[2] ? Number(match[2]) : null;
  const start =
    suffix !== null
      ? Math.max(0, data.length - suffix)
      : match?.[1]
        ? Number(match[1])
        : NaN;
  const end =
    suffix !== null
      ? data.length - 1
      : match?.[2]
        ? Math.min(Number(match[2]), data.length - 1)
        : data.length - 1;
  if (
    !Number.isSafeInteger(start) ||
    !Number.isSafeInteger(end) ||
    start < 0 ||
    suffix === 0 ||
    start > end ||
    start >= data.length
  )
    return new Response(null, {
      status: 416,
      headers: {
        "Content-Range": `bytes */${data.length}`,
        "Cache-Control": "no-store",
      },
    });
  headers.set("Content-Range", `bytes ${start}-${end}/${data.length}`);
  headers.set("Content-Length", String(end - start + 1));
  return new Response(data.subarray(start, end + 1), { status: 206, headers });
}
