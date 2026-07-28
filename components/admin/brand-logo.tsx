import { cn } from "@/lib/utils";

type BrandLogoProps = {
  size?: number;
  className?: string;
  showWordmark?: boolean;
  inverted?: boolean;
};

export function BrandLogo({
  size = 40,
  className,
  showWordmark = false,
  inverted = false,
}: BrandLogoProps) {
  return (
    <div className={cn("flex items-center gap-3", className)}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/logo.svg"
        alt="Skinfinity Academy"
        width={size}
        height={size}
        className={cn(
          "rounded-full object-cover",
          inverted && "brightness-0 invert",
        )}
      />
      {showWordmark && (
        <div className="flex flex-col leading-tight">
          <span
            className={cn(
              "text-sm font-semibold tracking-tight",
              inverted ? "text-white" : "text-foreground",
            )}
          >
            Skinfinity
          </span>
          <span
            className={cn(
              "text-[11px] font-medium tracking-[0.14em] uppercase",
              inverted ? "text-white/55" : "text-muted-foreground",
            )}
          >
            Academy
          </span>
        </div>
      )}
    </div>
  );
}
