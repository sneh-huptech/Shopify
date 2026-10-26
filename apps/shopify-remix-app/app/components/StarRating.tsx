import React, { useState } from "react";

interface StarRatingProps {
  value: number;
  max?: number;
  size?: "sm" | "md" | "lg";
  interactive?: boolean;
  onChange?: (rating: number) => void;
}

export function StarRating({
  value,
  max = 5,
  size = "md",
  interactive = false,
  onChange,
}: StarRatingProps) {
  const [hoverRating, setHoverRating] = useState<number | null>(null);

  const pixelSize = size === "sm" ? 14 : size === "lg" ? 22 : 17;
  const currentRating = hoverRating !== null ? hoverRating : value;

  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: size === "sm" ? "2px" : "4px",
      }}
      role={interactive ? "radiogroup" : "img"}
      aria-label={`${value} out of ${max} stars`}
    >
      {Array.from({ length: max }, (_, index) => {
        const starNumber = index + 1;
        const isFilled = starNumber <= currentRating;

        return (
          <button
            key={starNumber}
            type="button"
            disabled={!interactive}
            onClick={() => interactive && onChange && onChange(starNumber)}
            onMouseEnter={() => interactive && setHoverRating(starNumber)}
            onMouseLeave={() => interactive && setHoverRating(null)}
            style={{
              background: "none",
              border: "none",
              padding: 0,
              cursor: interactive ? "pointer" : "default",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              color: isFilled ? "#D97706" : "#E2E8F0",
              transition: "transform 120ms ease, color 120ms ease",
              transform: interactive && hoverRating === starNumber ? "scale(1.15)" : "scale(1)",
            }}
            tabIndex={interactive ? 0 : -1}
          >
            <svg
              width={pixelSize}
              height={pixelSize}
              viewBox="0 0 20 20"
              fill="currentColor"
              xmlns="http://www.w3.org/2000/svg"
              style={{ display: "block" }}
            >
              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
            </svg>
          </button>
        );
      })}
    </div>
  );
}
