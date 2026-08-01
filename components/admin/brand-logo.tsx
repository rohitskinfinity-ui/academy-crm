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
      <div
        className={cn(
          "relative shrink-0 overflow-hidden rounded-full ring-2 ring-white/90 shadow-sm",
          inverted ? "ring-white/15 bg-white/5" : "bg-white",
        )}
        style={{ width: size, height: size }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/logo.jpg"
          alt="Skinfinity Academy"
          width={size}
          height={size}
          className={cn("size-full object-cover")}
        />
      </div>
      {showWordmark && (
        <div className="flex min-w-0 flex-col leading-tight">
          <span
            className={cn(
              "truncate text-sm font-semibold tracking-tight",
              inverted ? "text-white" : "text-sidebar-foreground",
            )}
          >
            Skinfinity
          </span>
          <span
            className={cn(
              "text-[10px] font-semibold tracking-[0.16em] uppercase",
              inverted ? "text-white/45" : "text-sidebar-foreground/55",
            )}
          >
            Academy CRM
          </span>
        </div>
      )}
    </div>
  );
}
