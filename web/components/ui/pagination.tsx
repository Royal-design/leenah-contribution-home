import { ChevronLeft, ChevronRight } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

function getPageItems(current: number, total: number, siblings = 1) {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1)
  }
  const pages: Array<number | "ellipsis-start" | "ellipsis-end"> = []
  const leftBound = Math.max(2, current - siblings)
  const rightBound = Math.min(total - 1, current + siblings)
  pages.push(1)
  if (leftBound > 2) pages.push("ellipsis-start")
  for (let i = leftBound; i <= rightBound; i += 1) pages.push(i)
  if (rightBound < total - 1) pages.push("ellipsis-end")
  pages.push(total)
  return pages
}

export function Pagination({
  page,
  totalPages,
  onPageChange,
  className,
}: {
  page: number
  totalPages: number
  onPageChange: (page: number) => void
  className?: string
}) {
  if (totalPages <= 1) {
    return null
  }

  const items = getPageItems(page, totalPages)

  return (
    <nav
      aria-label="Pagination"
      className={cn("flex items-center justify-center gap-1", className)}
    >
      <Button
        variant="outline"
        size="icon-sm"
        aria-label="Previous page"
        disabled={page <= 1}
        onClick={() => onPageChange(page - 1)}
      >
        <ChevronLeft />
      </Button>

      {items.map((item, index) => {
        if (item === "ellipsis-start") {
          return (
            <span
              key={`${item}-${index}`}
              className="px-1 text-sm text-muted-foreground"
              aria-hidden="true"
            >
              …
            </span>
          )
        }
        if (item === "ellipsis-end") {
          return (
            <span
              key={`${item}-${index}`}
              className="px-1 text-sm text-muted-foreground"
              aria-hidden="true"
            >
              …
            </span>
          )
        }
        return (
          <Button
            key={item}
            variant={item === page ? "default" : "outline"}
            size="icon-sm"
            aria-label={`Page ${item}`}
            aria-current={item === page ? "page" : undefined}
            disabled={item === page}
            onClick={() => onPageChange(item)}
            className={cn(
              item === page &&
                "bg-primary text-primary-foreground hover:bg-primary/90"
            )}
          >
            {item}
          </Button>
        )
      })}

      <Button
        variant="outline"
        size="icon-sm"
        aria-label="Next page"
        disabled={page >= totalPages}
        onClick={() => onPageChange(page + 1)}
      >
        <ChevronRight />
      </Button>
    </nav>
  )
}

export function TableLoader({ rows = 6 }: { rows?: number }) {
  return (
    <div className="flex flex-col gap-2 p-4">
      {Array.from({ length: rows }, (_, index) => (
        <Skeleton key={index} className="h-12 rounded-lg" />
      ))}
    </div>
  )
}