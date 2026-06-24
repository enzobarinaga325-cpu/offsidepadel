import { cn } from "@/lib/utils";

interface OffsideLogoProps {
  className?: string;
  height?: number;
  alt?: string;
}

/**
 * Off-Side official wordmark as a pure inline SVG.
 * No external image imports, so it renders reliably on Vercel.
 */
export function OffsideLogo({
  className,
  height = 28,
  alt = "Offside",
}: OffsideLogoProps) {
  return (
    <svg
      viewBox="0 0 320 150"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label={alt}
      style={{ height, width: "auto" }}
      className={cn("shrink-0 select-none text-white", className)}
    >
      <g transform="rotate(-3.5 160 75)">
        {/* Shield / pentagon mark */}
        <g transform="translate(160, 42)">
          <path
            d="M -35,-22 L 35,-22 L 42,5 L 25,38 L 0,50 L -25,38 L -42,5 Z"
            fill="none"
            stroke="currentColor"
            strokeWidth="4"
            strokeLinejoin="round"
          />
          {/* Inner prism/detail lines */}
          <path
            d="M -35,-22 L -42,5 M 35,-22 L 42,5 M -25,38 L 0,50 L 25,38"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            opacity="0.85"
          />
          {/* Padel ball dot grid */}
          <g fill="currentColor">
            {[
              [-22, -14], [-12, -14], [-2, -14],
              [-22, -6], [-12, -6], [-2, -6],
              [-22, 2], [-12, 2], [-2, 2],
              [-17, 10], [-7, 10],
            ].map(([cx, cy], i) => (
              <circle key={i} cx={cx} cy={cy} r="2.4" />
            ))}
          </g>
          {/* Padel seam curve */}
          <path
            d="M -12,18 Q 2,30 20,12"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.8"
            strokeLinecap="round"
          />
        </g>

        {/* Wordmark border */}
        <rect
          x="32"
          y="82"
          width="256"
          height="52"
          rx="2"
          fill="none"
          stroke="currentColor"
          strokeWidth="5"
        />

        {/* Wordmark text */}
        <text
          x="160"
          y="118"
          textAnchor="middle"
          fill="currentColor"
          fontFamily="Impact, Haettenschweiler, 'Arial Narrow Bold', Arial, sans-serif"
          fontSize="46"
          fontWeight="bold"
          letterSpacing="2"
        >
          OFF-SIDE
        </text>
      </g>
    </svg>
  );
}

interface OffsideMarkProps {
  size?: number;
  className?: string;
}

/** Compact square mark for tight spaces (collapsed sidebar, avatars). */
export function OffsideMark({ size = 28, className }: OffsideMarkProps) {
  return (
    <svg
      viewBox="0 0 100 100"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="Offside"
      style={{ width: size, height: size }}
      className={cn("shrink-0 select-none text-white", className)}
    >
      <g transform="translate(50, 48)">
        <path
          d="M -28,-16 L 28,-16 L 34,5 L 20,32 L 0,42 L -20,32 L -34,5 Z"
          fill="none"
          stroke="currentColor"
          strokeWidth="5"
          strokeLinejoin="round"
        />
        <path
          d="M -28,-16 L -34,5 M 28,-16 L 34,5 M -20,32 L 0,42 L 20,32"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          opacity="0.85"
        />
        <g fill="currentColor">
          {[
            [-18, -10], [-10, -10], [-2, -10],
            [-18, -4], [-10, -4], [-2, -4],
            [-18, 2], [-10, 2], [-2, 2],
            [-14, 8], [-6, 8],
          ].map(([cx, cy], i) => (
            <circle key={i} cx={cx} cy={cy} r="1.8" />
          ))}
        </g>
        <path
          d="M -10,14 Q 0,22 14,10"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
      </g>
    </svg>
  );
}
