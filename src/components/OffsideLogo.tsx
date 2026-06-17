import logo from "@/assets/offside-logo.png.asset.json";
import { cn } from "@/lib/utils";

/**
 * Off-Side official wordmark. The source asset has a black background,
 * so we invert it on dark themes (white logo on dark) and apply a
 * mix-blend-mode trick to drop the black on light themes.
 */
export function OffsideLogo({
  className,
  height = 28,
  alt = "Off-Side",
}: {
  className?: string;
  height?: number;
  alt?: string;
}) {
  return (
    <img
      src={logo.url}
      alt={alt}
      style={{ height }}
      className={cn(
        "w-auto select-none object-contain",
        // black bg PNG: in dark mode it blends perfectly; in light mode invert.
        "dark:[filter:none] [filter:invert(1)]",
        className
      )}
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
        src={logo.url}
        alt="Off-Side"
        className="w-[140%] max-w-none object-contain"
        draggable={false}
      />
    </div>
  );
}
