import { useEffect, useState } from "react";
import type { ReviewMedia } from "../services/review-media.server";

export function ReviewAttachments({
  reviewId,
  media,
}: {
  reviewId: string;
  media: ReviewMedia[];
}) {
  const [files, setFiles] = useState<(ReviewMedia & { url: string })[]>([]);
  const [error, setError] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    const urls: string[] = [];
    setFiles([]);
    setError(false);
    // App Bridge authenticates fetch; image/video src requests do not carry its ID token.
    Promise.all(
      media.map(async (file) => {
        const response = await fetch(
          `/app/review-media?reviewId=${encodeURIComponent(reviewId)}&media=${encodeURIComponent(file.id)}`,
          { signal: controller.signal },
        );
        if (!response.ok || response.headers.get("Content-Type") !== file.type)
          throw new Error("Attachment unavailable");
        const blob = await response.blob();
        if (controller.signal.aborted) return null;
        const url = URL.createObjectURL(blob);
        urls.push(url);
        return { ...file, url };
      }),
    )
      .then((result) => {
        if (!controller.signal.aborted)
          setFiles(
            result.filter(
              (file): file is ReviewMedia & { url: string } => file !== null,
            ),
          );
      })
      .catch(() => {
        if (!controller.signal.aborted) setError(true);
      });
    return () => {
      controller.abort();
      urls.forEach(URL.revokeObjectURL);
    };
  }, [reviewId, media]);
  return (
    <section className="review-detail-section" aria-label="Review attachments">
      <h3>Photos and videos</h3>
      {error ? (
        <p role="alert">
          Attachments could not load. Close and reopen this review to retry.
        </p>
      ) : !files.length ? (
        <p role="status">Loading attachments…</p>
      ) : (
        <div className="review-attachment-gallery">
          {files.map((file) =>
            file.type === "video/mp4" ? (
              <video key={file.id} src={file.url} controls preload="none">
                <track kind="captions" />
              </video>
            ) : (
              <a
                key={file.id}
                href={file.url}
                target="_blank"
                rel="noopener noreferrer"
              >
                <img
                  src={file.url}
                  alt="Customer review attachment"
                  loading="lazy"
                />
              </a>
            ),
          )}
        </div>
      )}
      <p className="review-field-help">
        Attachments follow the review’s publication status.
      </p>
    </section>
  );
}
