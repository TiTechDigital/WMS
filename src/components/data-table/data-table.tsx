"use client";

import * as React from "react";
import {
  type ColumnDef,
  type ColumnFiltersState,
  type RowSelectionState,
  type SortingState,
  type VisibilityState,
  type Row,
  flexRender,
  getCoreRowModel,
  getFacetedUniqueValues,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, ChevronsUpDown, Download, Search, Settings2, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FacetFilter, type FacetOption } from "./facet-filter";
import { EmptyState } from "@/components/shared/empty-state";
import { cn } from "@/lib/utils";
import { downloadCsv } from "@/lib/csv";
import { toast } from "sonner";

export interface Facet {
  columnId: string;
  title: string;
  options: FacetOption[];
}

export interface DataTableProps<T> {
  columns: ColumnDef<T, unknown>[];
  data: T[];
  searchPlaceholder?: string;
  /** Text extracted per row for the global search box. */
  searchText?: (row: T) => string;
  initialSearch?: string;
  facets?: Facet[];
  initialFilters?: ColumnFiltersState;
  initialSorting?: SortingState;
  initialVisibility?: VisibilityState;
  pageSize?: number;
  onRowClick?: (row: T) => void;
  getRowId?: (row: T) => string;
  selectable?: boolean;
  bulkActions?: (rows: T[], clear: () => void) => React.ReactNode;
  toolbar?: React.ReactNode;
  exportName?: string;
  exportRow?: (row: T) => Record<string, string | number>;
  rowClassName?: (row: T) => string | undefined;
  emptyTitle?: string;
  emptyDescription?: string;
  dense?: boolean;
  className?: string;
}

export function DataTable<T>({
  columns,
  data,
  searchPlaceholder = "Search…",
  searchText,
  initialSearch = "",
  facets = [],
  initialFilters = [],
  initialSorting = [],
  initialVisibility = {},
  pageSize = 15,
  onRowClick,
  getRowId,
  selectable,
  bulkActions,
  toolbar,
  exportName,
  exportRow,
  rowClassName,
  emptyTitle = "No matching records",
  emptyDescription = "Try adjusting your search or filters.",
  className,
}: DataTableProps<T>) {
  const [sorting, setSorting] = React.useState<SortingState>(initialSorting);
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>(initialFilters);
  const [visibility, setVisibility] = React.useState<VisibilityState>(initialVisibility);
  const [globalFilter, setGlobalFilter] = React.useState(initialSearch);
  const [rowSelection, setRowSelection] = React.useState<RowSelectionState>({});

  React.useEffect(() => setGlobalFilter(initialSearch), [initialSearch]);

  const allColumns = React.useMemo<ColumnDef<T, unknown>[]>(() => {
    if (!selectable) return columns;
    return [
      {
        id: "__select",
        enableSorting: false,
        enableHiding: false,
        size: 32,
        header: ({ table }) => (
          <Checkbox
            aria-label="Select all"
            checked={table.getIsAllPageRowsSelected() ? true : table.getIsSomePageRowsSelected() ? "indeterminate" : false}
            onCheckedChange={(v) => table.toggleAllPageRowsSelected(!!v)}
          />
        ),
        cell: ({ row }) => (
          <Checkbox aria-label="Select row" checked={row.getIsSelected()} onCheckedChange={(v) => row.toggleSelected(!!v)} onClick={(e) => e.stopPropagation()} />
        ),
      },
      ...columns,
    ];
  }, [columns, selectable]);

  const table = useReactTable({
    data,
    columns: allColumns,
    state: { sorting, columnFilters, columnVisibility: visibility, globalFilter, rowSelection },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setVisibility,
    onGlobalFilterChange: setGlobalFilter,
    onRowSelectionChange: setRowSelection,
    getRowId: getRowId ? (r) => getRowId(r) : undefined,
    globalFilterFn: (row: Row<T>, _id, value: string) => {
      if (!value) return true;
      const text = searchText ? searchText(row.original) : JSON.stringify(row.original);
      return text.toLowerCase().includes(String(value).toLowerCase().trim());
    },
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
    autoResetPageIndex: true,
    initialState: { pagination: { pageSize } },
  });

  const filtered = table.getFilteredRowModel().rows;
  const selected = table.getSelectedRowModel().rows.map((r) => r.original);
  const hasFilters = columnFilters.length > 0 || !!globalFilter;
  const { pageIndex, pageSize: ps } = table.getState().pagination;
  const from = filtered.length ? pageIndex * ps + 1 : 0;
  const to = Math.min(filtered.length, (pageIndex + 1) * ps);

  const doExport = () => {
    if (!exportRow) return;
    const rows = (selected.length ? selected : filtered.map((r) => r.original)).map(exportRow);
    downloadCsv(`${exportName ?? "export"}.csv`, rows);
    toast.success(`Exported ${rows.length} rows`, { description: `${exportName ?? "export"}.csv downloaded` });
  };

  return (
    <div className={cn("rounded-lg border bg-surface shadow-card", className)}>
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 border-b px-3 py-2.5">
        <div className="relative w-full sm:w-64">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input value={globalFilter} onChange={(e) => setGlobalFilter(e.target.value)} placeholder={searchPlaceholder} className="pl-8 pr-7" />
          {globalFilter && (
            <button onClick={() => setGlobalFilter("")} className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:bg-accent" aria-label="Clear search">
              <X className="size-3" />
            </button>
          )}
        </div>
        {facets.map((f) => {
          const column = table.getColumn(f.columnId);
          if (!column) return null;
          return <FacetFilter key={f.columnId} column={column} title={f.title} options={f.options} />;
        })}
        {hasFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setColumnFilters([]);
              setGlobalFilter("");
            }}
          >
            Reset <X />
          </Button>
        )}
        <div className="ml-auto flex items-center gap-2">
          {toolbar}
          {exportRow && (
            <Button variant="secondary" size="sm" onClick={doExport}>
              <Download /> Export{selected.length ? ` (${selected.length})` : ""}
            </Button>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="secondary" size="icon-sm" aria-label="Columns">
                <Settings2 />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuLabel>Visible columns</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {table
                .getAllLeafColumns()
                .filter((c) => c.getCanHide())
                .map((c) => (
                  <DropdownMenuCheckboxItem key={c.id} checked={c.getIsVisible()} onCheckedChange={(v) => c.toggleVisibility(!!v)} onSelect={(e) => e.preventDefault()}>
                    {(c.columnDef.meta as { label?: string } | undefined)?.label ?? (typeof c.columnDef.header === "string" ? c.columnDef.header : c.id)}
                  </DropdownMenuCheckboxItem>
                ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {selectable && selected.length > 0 && (
        <div className="flex items-center gap-3 border-b bg-primary-soft/60 px-3 py-2 text-xs">
          <span className="font-medium text-primary">{selected.length} selected</span>
          <div className="flex items-center gap-1.5">{bulkActions?.(selected, () => setRowSelection({}))}</div>
          <Button variant="ghost" size="sm" className="ml-auto" onClick={() => setRowSelection({})}>
            Clear selection
          </Button>
        </div>
      )}

      {/* Table */}
      <div className="scrollbar-thin overflow-x-auto">
        <table className="w-full border-collapse text-[13px]">
          <thead>
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id} className="border-b bg-subtle">
                {hg.headers.map((h) => {
                  const canSort = h.column.getCanSort();
                  const sorted = h.column.getIsSorted();
                  const align = (h.column.columnDef.meta as { align?: string } | undefined)?.align;
                  return (
                    <th
                      key={h.id}
                      style={{ width: h.column.columnDef.size !== 150 ? h.column.columnDef.size : undefined }}
                      className={cn("h-9 whitespace-nowrap px-3 text-left text-2xs font-semibold uppercase tracking-wide text-muted-foreground", align === "right" && "text-right")}
                    >
                      {h.isPlaceholder ? null : canSort ? (
                        <button
                          onClick={h.column.getToggleSortingHandler()}
                          className={cn("inline-flex items-center gap-1 uppercase hover:text-foreground", align === "right" && "flex-row-reverse", sorted && "text-foreground")}
                        >
                          {flexRender(h.column.columnDef.header, h.getContext())}
                          {sorted === "asc" ? <ArrowUp className="size-3" /> : sorted === "desc" ? <ArrowDown className="size-3" /> : <ChevronsUpDown className="size-3 opacity-40" />}
                        </button>
                      ) : (
                        flexRender(h.column.columnDef.header, h.getContext())
                      )}
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row) => (
              <tr
                key={row.id}
                onClick={onRowClick ? () => onRowClick(row.original) : undefined}
                data-state={row.getIsSelected() ? "selected" : undefined}
                className={cn(
                  "border-b transition-colors last:border-0 hover:bg-subtle data-[state=selected]:bg-primary-soft/40",
                  onRowClick && "cursor-pointer",
                  rowClassName?.(row.original)
                )}
              >
                {row.getVisibleCells().map((cell) => {
                  const align = (cell.column.columnDef.meta as { align?: string } | undefined)?.align;
                  return (
                    <td key={cell.id} className={cn("h-11 whitespace-nowrap px-3", align === "right" && "text-right tabular")}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && <EmptyState title={emptyTitle} description={emptyDescription} />}
      </div>

      {/* Pagination */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-t px-3 py-2 text-xs text-muted-foreground">
        <span>
          {from}–{to} of <span className="font-medium text-foreground tabular">{filtered.length.toLocaleString("en-US")}</span>
          {filtered.length !== data.length && <> (filtered from {data.length.toLocaleString("en-US")})</>}
        </span>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span>Rows</span>
            <Select value={String(ps)} onValueChange={(v) => table.setPageSize(Number(v))}>
              <SelectTrigger className="h-7 w-[64px] text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[10, 15, 25, 50, 100].map((n) => (
                  <SelectItem key={n} value={String(n)}>
                    {n}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <span className="tabular">
            Page {table.getPageCount() ? pageIndex + 1 : 0} of {table.getPageCount()}
          </span>
          <div className="flex items-center gap-0.5">
            <Button variant="ghost" size="icon-sm" onClick={() => table.setPageIndex(0)} disabled={!table.getCanPreviousPage()} aria-label="First page">
              <ChevronsLeft />
            </Button>
            <Button variant="ghost" size="icon-sm" onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()} aria-label="Previous page">
              <ChevronLeft />
            </Button>
            <Button variant="ghost" size="icon-sm" onClick={() => table.nextPage()} disabled={!table.getCanNextPage()} aria-label="Next page">
              <ChevronRight />
            </Button>
            <Button variant="ghost" size="icon-sm" onClick={() => table.setPageIndex(table.getPageCount() - 1)} disabled={!table.getCanNextPage()} aria-label="Last page">
              <ChevronsRight />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Filter fn for facet columns: value must be in the selected array. */
export const inArrayFilter = <T,>(row: Row<T>, id: string, value: string[]) => !value?.length || value.includes(String(row.getValue(id)));
