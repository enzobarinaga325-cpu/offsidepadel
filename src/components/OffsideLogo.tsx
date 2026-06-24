import { cn } from "@/lib/utils";

interface OffsideLogoProps {
  className?: string;
  height?: number;
  alt?: string;
}

/**
 * Off-Side official logo, served as a transparent PNG from /public.
 */
export function OffsideLogo({
  className,
  height = 28,
  alt = "Offside",
}: OffsideLogoProps) {
  return (
    <img
      src="/offside-logo.png"
      alt={alt}
      draggable={false}
      style={{ height, width: "auto" }}
      className={cn("shrink-0 select-none object-contain", className)}
    />
  );
}

interface OffsideMarkProps {
  size?: number;
  className?: string;
}

/** Compact square mark — reuses the same artwork. */
export function OffsideMark({ size = 28, className }: OffsideMarkProps) {
  return (
    <img
      src="/offside-logo.png"
      alt="Offside"
      draggable={false}
      style={{ height: size, width: size }}
      className={cn("shrink-0 select-none object-contain", className)}
    />
  );
}
