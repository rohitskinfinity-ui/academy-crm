"use client";

import { useEffect, useState } from "react";
import { Panel } from "@/components/admin/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

const ROW_HEIGHT_PX = 52;

/** Pixels reserved for sidebar layout chrome (top bar, filters, padding). */
const DEFAULT_RESERVED_PX = 268;

function useSkeletonRowCount(reservedPx: number) {
  const [rowCount, setRowCount] = useState(10);

  useEffect(() => {
    function update() {
      const available = window.innerHeight - reservedPx;
      setRowCount(
        Math.max(6, Math.min(24, Math.floor(available / ROW_HEIGHT_PX))),
      );
    }
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, [reservedPx]);

  return rowCount;
}

type AdminTableSkeletonProps = {
  /** Real column titles (recommended). */
  headers?: string[];
  columnCount?: number;
  /** Space above the table panel (header + filters). Tune per page if needed. */
  reservedOffset?: number;
  showPagination?: boolean;
  /** Plain cells (no avatar/actions placeholders). */
  rowVariant?: "default" | "plain";
  className?: string;
};

export function AdminTableSkeleton({
  headers,
  columnCount = 5,
  reservedOffset = DEFAULT_RESERVED_PX,
  showPagination = true,
  rowVariant = "default",
  className,
}: AdminTableSkeletonProps) {
  const colCount = headers?.length ?? columnCount;
  const rowCount = useSkeletonRowCount(reservedOffset);

  return (
    <div
      className={cn("min-h-0", className)}
      style={{ minHeight: `calc(100dvh - ${reservedOffset}px)` }}
    >
      <Panel className="flex h-full min-h-0 flex-col">
        <div className="min-h-0 flex-1 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                {headers?.length
                  ? headers.map((h, i) => (
                      <TableHead
                        key={h || `col-${i}`}
                        className="text-muted-foreground"
                      >
                        {h}
                      </TableHead>
                    ))
                  : Array.from({ length: colCount }).map((_, i) => (
                      <TableHead key={i}>
                        <Skeleton className="h-4 w-20" />
                      </TableHead>
                    ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {Array.from({ length: rowCount }).map((_, rowIndex) => (
                <TableRow key={rowIndex}>
                  {Array.from({ length: colCount }).map((_, colIndex) => (
                    <TableCell key={colIndex}>
                      {rowVariant === "plain" ? (
                        <PlainCellSkeleton colIndex={colIndex} />
                      ) : (
                        <CellSkeleton
                          colIndex={colIndex}
                          colCount={colCount}
                        />
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        {showPagination ? (
          <div className="flex shrink-0 items-center justify-between border-t border-border px-4 py-3">
            <Skeleton className="h-4 w-28" />
            <div className="flex gap-2">
              <Skeleton className="h-8 w-[72px] rounded-lg" />
              <Skeleton className="h-8 w-[56px] rounded-lg" />
            </div>
          </div>
        ) : null}
      </Panel>
    </div>
  );
}

function PlainCellSkeleton({ colIndex }: { colIndex: number }) {
  const widths = ["max-w-[160px]", "max-w-[100px]", "max-w-[72px]", "max-w-[90px]"];
  return (
    <Skeleton
      className={cn("h-4 w-full", widths[colIndex % widths.length])}
    />
  );
}

function CellSkeleton({
  colIndex,
  colCount,
}: {
  colIndex: number;
  colCount: number;
}) {
  if (colIndex === 0) {
    return (
      <div className="flex items-center gap-3">
        <Skeleton className="size-9 shrink-0 rounded-md" />
        <div className="space-y-1.5">
          <Skeleton className="h-4 w-36" />
          <Skeleton className="h-3 w-24" />
        </div>
      </div>
    );
  }
  if (colIndex === colCount - 1) {
    return (
      <div className="flex justify-end gap-2">
        <Skeleton className="h-8 w-[72px] rounded-lg" />
        <Skeleton className="size-8 rounded-lg" />
      </div>
    );
  }
  if (colIndex === 1) {
    return <Skeleton className="h-5 w-16 rounded-full" />;
  }
  return <Skeleton className="h-4 w-full max-w-[100px]" />;
}

/** Dashboard / compact tables without full viewport height. */
export function AdminTableSkeletonCompact({
  headers,
  columnCount = 3,
  rows = 5,
}: {
  headers?: string[];
  columnCount?: number;
  rows?: number;
}) {
  const colCount = headers?.length ?? columnCount;
  return (
    <Panel>
      <Table>
        <TableHeader>
          <TableRow>
            {headers?.length
              ? headers.map((h) => <TableHead key={h}>{h}</TableHead>)
              : Array.from({ length: colCount }).map((_, i) => (
                  <TableHead key={i}>
                    <Skeleton className="h-4 w-16" />
                  </TableHead>
                ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {Array.from({ length: rows }).map((_, rowIndex) => (
            <TableRow key={rowIndex}>
              {Array.from({ length: colCount }).map((_, colIndex) => (
                <TableCell key={colIndex}>
                  <Skeleton className="h-4 w-full max-w-[140px]" />
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Panel>
  );
}

/** Live classes card grid placeholder. */
export function AdminCardGridSkeleton({
  reservedOffset = 220,
}: {
  reservedOffset?: number;
}) {
  const [count, setCount] = useState(6);

  useEffect(() => {
    function update() {
      const available = window.innerHeight - reservedOffset;
      const rows = Math.max(1, Math.floor(available / 220));
      setCount(Math.min(12, rows * 3));
    }
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, [reservedOffset]);

  return (
    <div
      className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3"
      style={{ minHeight: `calc(100dvh - ${reservedOffset}px)` }}
    >
      {Array.from({ length: count }).map((_, i) => (
        <Panel key={i} className="space-y-3 p-4">
          <Skeleton className="h-5 w-3/4" />
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-2/3" />
          <div className="flex gap-2 pt-2">
            <Skeleton className="h-8 flex-1 rounded-lg" />
            <Skeleton className="h-8 flex-1 rounded-lg" />
          </div>
        </Panel>
      ))}
    </div>
  );
}
