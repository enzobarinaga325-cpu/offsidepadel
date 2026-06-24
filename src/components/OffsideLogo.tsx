import { cn } from "@/lib/utils";

const LOGO_URL = "/logo.png";

/**
 * Off-Side official wordmark. Served from /public so it ships with the
 * Vercel build as a static asset.
 */
export function OffsideLogo({
  className,
  height = 28,
  alt = "Offside",
}: {
  className?: string;
  height?: number;
  alt?: string;
}) {
  return (
    <img
      src={LOGO_URL}
      alt={alt}
      style={{ height }}
      className={cn("w-auto select-none object-contain", className)}
      draggable={false}
    />
  );
}

/** Compact square mark for tight spaces (sidebar collapsed, avatars). */
export function OffsideMark({ size = 28, className }: { size?: number; className?: string }) {
  return (
    <div
      className={cn(
        "flex items-center justify-center rounded-md bg-black overflow-hidden shrink-0",
        className
      )}
      style={{ width: size, height: size }}
    >
      <img
        src={LOGO_URL}
        alt="Offside"
        className="w-[140%] max-w-none object-contain"
        draggable={false}
      />
    </div>
  );
}
