import assert from "node:assert/strict";
import { promisify } from "node:util";
import { execFile } from "node:child_process";
import { mkdtemp, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import sharp from "sharp";
import ffmpeg from "ffmpeg-static";
import {
  prepareReviewMedia,
  mediaResponse,
  MEDIA_BODY_LIMIT,
} from "./review-media.server";
import { readReviewForm, ReviewInputError } from "../review-input";

function form(data: Uint8Array, name: string, type: string, count = 1) {
  const value = new FormData();
  for (let i = 0; i < count; i++)
    value.append("media", new Blob([data as BlobPart], { type }), name);
  return value;
}
const png = await sharp({
  create: { width: 40, height: 30, channels: 3, background: "#8844aa" },
})
  .png()
  .toBuffer();
for (const [bytes, name, type] of [
  [png, "photo.png", "image/png"],
  [await sharp(png).jpeg().toBuffer(), "photo.jpg", "image/jpeg"],
  [await sharp(png).webp().toBuffer(), "photo.webp", "image/webp"],
] as const) {
  const media = await prepareReviewMedia(form(bytes, name, type));
  assert.equal(media[0].type, "image/webp");
  assert.equal(
    (await sharp(Buffer.from(media[0].data.value())).metadata()).format,
    "webp",
  );
  assert.equal(
    (await sharp(Buffer.from(media[0].data.value())).metadata()).exif,
    undefined,
  );
}
await assert.rejects(
  prepareReviewMedia(
    form(Buffer.from("<svg onload='alert(1)'/>"), "fake.png", "image/png"),
  ),
  ReviewInputError,
);
await assert.rejects(
  prepareReviewMedia(form(png, "fake.jpg", "image/jpeg")),
  ReviewInputError,
);
await assert.rejects(
  prepareReviewMedia(form(png, "photo.svg", "image/svg+xml")),
  ReviewInputError,
);
await assert.rejects(
  prepareReviewMedia(form(png, "photo.png", "image/png", 4)),
  /three/,
);
await assert.rejects(
  prepareReviewMedia(
    form(new Uint8Array(3 * 1024 * 1024 + 1), "large.jpg", "image/jpeg"),
  ),
  /3 MB/,
);
await assert.rejects(
  prepareReviewMedia(
    form(new Uint8Array(8 * 1024 * 1024), "large.mp4", "video/mp4", 2),
  ),
  /12 MB/,
);
const huge = await sharp({
  create: { width: 4001, height: 4001, channels: 3, background: "white" },
})
  .png()
  .toBuffer();
await assert.rejects(
  prepareReviewMedia(form(huge, "pixels.png", "image/png")),
  ReviewInputError,
);
const malformed = Buffer.concat([
  Buffer.from([0, 0, 0, 24]),
  Buffer.from("ftyp"),
  Buffer.alloc(24),
]);
await assert.rejects(
  prepareReviewMedia(form(malformed, "bad.mp4", "video/mp4")),
  ReviewInputError,
);
assert.deepEqual(await prepareReviewMedia(new FormData()), []);
const parsed = await readReviewForm(
  new Request("http://localhost", {
    method: "POST",
    body: form(png, "image.png", "image/png"),
  }),
  MEDIA_BODY_LIMIT,
);
assert.equal((await prepareReviewMedia(parsed)).length, 1);
const directory = await mkdtemp(join(tmpdir(), "review-media-test-"));
try {
  const run = promisify(execFile);
  for (const extension of ["mp4", "webm"]) {
    const source = join(directory, `input.${extension}`);
    await run(
      process.env.FFMPEG_PATH || ffmpeg!,
      [
        "-v",
        "error",
        "-f",
        "lavfi",
        "-i",
        "color=c=blue:s=320x180:d=0.3",
        "-an",
        "-c:v",
        extension === "mp4" ? "libx264" : "libvpx-vp9",
        "-threads",
        "1",
        source,
      ],
      { windowsHide: true, timeout: 30_000 },
    );
    const [video] = await prepareReviewMedia(
      form(await readFile(source), `clip.${extension}`, `video/${extension}`),
    );
    assert.equal(video.type, "video/mp4");
    assert(video.size < 5 * 1024 * 1024);
    const output = join(directory, `normalized-${extension}.mp4`);
    await writeFile(output, Buffer.from(video.data.value()));
    await run(
      process.env.FFMPEG_PATH || ffmpeg!,
      ["-v", "error", "-i", output, "-f", "null", "-"],
      { windowsHide: true, timeout: 30_000 },
    );
    const partial = mediaResponse(
      video,
      new Request("http://localhost", { headers: { Range: "bytes=0-9" } }),
    );
    assert.equal(partial.status, 206);
    assert.equal((await partial.arrayBuffer()).byteLength, 10);
    assert.equal(partial.headers.get("X-Content-Type-Options"), "nosniff");
    assert.equal(partial.headers.get("Cache-Control"), "private, no-store");
    assert.equal(
      mediaResponse(
        video,
        new Request("http://localhost", {
          headers: { Range: "bytes=999999999-" },
        }),
      ).status,
      416,
    );
    assert.equal(
      (
        await mediaResponse(
          video,
          new Request("http://localhost", { headers: { Range: "bytes=-5" } }),
        ).arrayBuffer()
      ).byteLength,
      5,
    );
  }
} finally {
  await rm(directory, { recursive: true, force: true });
}
console.log(
  "media decoding, upload bounds, video normalization and byte ranges passed",
);
