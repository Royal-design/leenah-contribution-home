"use client"

import * as React from "react"
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
  type ColumnFiltersState,
  type SortingState,
  type VisibilityState,
} from "@tanstack/react-table"

import { cn } from "@/lib/utils"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

export function DataTable<TData, TValue>({
  columns,
  data,
  emptyText = "No rows found.",
  mobileCard,
  className,
}: {
  columns: ColumnDef<TData, TValue>[]
  data: TData[]
  emptyText?: string
  mobileCard?: (row: { original: TData }) => React.ReactNode
  className?: string
}) {
  const [sorting, setSorting] = React.useState<SortingState>([])
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([])
  const [columnVisibility, setColumnVisibility] =
    React.useState<VisibilityState>({})

  const table = useReactTable({
    data,
    columns,
    state: { sorting, columnFilters, columnVisibility },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    getCoreRowModel: getCoreRowModel(),
  })

  return (
    <div className="min-w-0">
      <div className="md:hidden">
        {table.getRowModel().rows.length ? (
          <div className="flex flex-col divide-y divide-border">
            {table.getRowModel().rows.map((row) => (
              <div key={row.id} className="px-4 py-3">
                {mobileCard ? (
                  mobileCard({ original: row.original })
                ) : (
                  <div className="flex flex-col gap-3">
                    {row.getVisibleCells().map((cell) => {
                      const header = cell.column.columnDef.header
                      return (
                        <div
                          key={cell.id}
                          className="flex items-start justify-between gap-3"
                        >
                          <div className="text-xs text-muted-foreground">
                            {typeof header === "function"
                              ? flexRender(header, cell.getContext() as never)
                              : header
                                ? String(header)
                                : ""}
                          </div>
                          <div className="min-w-0 max-w-[60%] text-right text-sm">
                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="py-10 text-center text-sm text-muted-foreground">
            {emptyText}
          </p>
        )}
      </div>

      <div className="hidden md:block">
        <Table className={className}>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id} className="border-b border-border/70 bg-muted/35 hover:bg-muted/35">
                {headerGroup.headers.map((header) => {
                  const canSort = header.column.getCanSort()
                  const align = header.column.columnDef.meta?.align as
                    | "left"
                    | "right"
                    | undefined
                  return (
                    <TableHead
                      key={header.id}
                      className={cn(
                        "h-11 px-4 text-xs font-semibold tracking-wide text-muted-foreground uppercase",
                        align === "right" ? "text-right" : "text-left",
                        canSort && "cursor-pointer select-none"
                      )}
                      onClick={
                        canSort
                          ? header.column.getToggleSortingHandler()
                          : undefined
                      }
                      aria-sort={
                        header.column.getIsSorted() === "asc"
                          ? "ascending"
                          : header.column.getIsSorted() === "desc"
                            ? "descending"
                            : undefined
                      }
                    >
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                          )}
                      {header.column.getIsSorted() === "asc" && (
                        <span className="ml-1 opacity-70" aria-hidden="true">
                          ↑
                        </span>
                      )}
                      {header.column.getIsSorted() === "desc" && (
                        <span className="ml-1 opacity-70" aria-hidden="true">
                          ↓
                        </span>
                      )}
                    </TableHead>
                  )
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && "selected"}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell
                      key={cell.id}
                      className={cn(
                        "px-4 py-3.5 align-middle",
                        cell.column.columnDef.meta?.align === "right" &&
                          "text-right"
                      )}
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-40 p-4 text-center text-sm text-muted-foreground"
                >
                  {emptyText}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}