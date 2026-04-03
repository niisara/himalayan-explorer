// src/components/grid/DataGrid.jsx
//
// Reusable data-grid component with:
//   • Column definitions with inline filter controls (search, select, date)
//   • Checkbox row selection (header + per-row)
//   • Customisable action column via renderActions render-prop
//   • Pagination bar (rows-per-page selector + page buttons)
//   • Grouping support (interleaved group-header rows)
//   • Loading overlay
//   • Empty-state message
//   • Column manager panel (⚙ cog icon — appears in top-right action header on hover):
//       - Toggle column visibility with eye icon
//       - Reorder columns via drag-and-drop or ▲/▼ buttons
//       - Pin leading or trailing columns sticky during horizontal scroll
//         Rule: only first N or last N consecutive visible columns may be pinned.
//         Pinning a middle column independently is not allowed — extend or shrink
//         the pinned group from its edge using +/− controls.
//
// ─── Column definition shape ──────────────────────────────────────────────────
//   {
//     key:           string          — unique field name, maps to row[key]
//     label:         string          — header display text
//     filterType:    'search' | 'select' | 'date'
//     filterOptions: string[]        — required when filterType === 'select'
//     minW:          string          — Tailwind min-w class e.g. 'min-w-[120px]'
//     maxW:          string          — Tailwind max-w class e.g. 'max-w-[180px]'
//     truncate:      boolean         — truncate cell text with ellipsis
//   }
//
// ─── Props ────────────────────────────────────────────────────────────────────
//   columns           ColDef[]
//   data              object[]
//   loading           boolean
//   selectedIds       (string|number)[]
//   onSelectAll       () => void
//   onSelectRow       (id) => void
//   allChecked        boolean
//   filters           { [colKey]: string }
//   onFiltersChange   (filters) => void
//   page              number (1-based)
//   totalPages        number
//   rowsPerPage       number
//   rowsPerPageOptions number[]
//   onPageChange      (page) => void
//   onRowsPerPageChange (n) => void
//   groupBy           string | null
//   renderActions     (row) => ReactNode
//   emptyMessage      string
//   rowKey            (row) => string|number   — default: row => row.id
//   isRowHighlighted  (row) => boolean
//
// ─── Usage example ────────────────────────────────────────────────────────────
//   const COLUMNS = [
//     { key: 'code',  label: 'Code',  filterType: 'search', minW: 'min-w-[120px]' },
//     { key: 'name',  label: 'Name',  filterType: 'search', minW: 'min-w-[180px]',
//       maxW: 'max-w-[180px]', truncate: true },
//     { key: 'type',  label: 'Type',  filterType: 'select', minW: 'min-w-[120px]',
//       filterOptions: ['MR','DR'] },
//     { key: 'start', label: 'Start', filterType: 'date',   minW: 'min-w-[140px]' },
//   ];
//
//   <DataGrid
//     columns={COLUMNS}
//     data={rows}
//     loading={false}
//     selectedIds={selected}    onSelectAll={toggleAll}    onSelectRow={toggleRow}
//     allChecked={allChecked}
//     filters={filters}         onFiltersChange={setFilters}
//     page={page}               totalPages={50}
//     rowsPerPage={25}          rowsPerPageOptions={[25, 50, 100]}
//     onPageChange={setPage}    onRowsPerPageChange={n => { setLimit(n); setPage(1); }}
//     groupBy={null}
//     renderActions={row => <MyActions row={row} />}
//     emptyMessage="Nothing found."
//   />

import { useState, useRef, useEffect, forwardRef } from 'react';
import { createPortal } from 'react-dom';
import {
  Search, Calendar, ChevronDown, ChevronLeft, ChevronRight, ChevronUp,
  Check, Settings2, Eye, EyeOff, GripVertical, Pin, X,
} from 'lucide-react';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Build page-button list with ellipsis markers. */
function buildPages(current, total) {
  const pages = [];
  if (current > 3) pages.push(1, '…');
  for (let i = Math.max(1, current - 1); i <= Math.min(total, current + 1); i++) pages.push(i);
  if (current < total - 2) pages.push('…', total);
  return pages;
}

/** Group flat data array into interleaved header + row items. */
function buildGroupedRows(rows, groupByKey) {
  if (!groupByKey) return rows.map(row => ({ type: 'row', row }));
  const buckets = {};
  const order   = [];
  for (const row of rows) {
    const val = row[groupByKey] ?? 'Other';
    if (!buckets[val]) { buckets[val] = []; order.push(val); }
    buckets[val].push(row);
  }
  const result = [];
  for (const key of order) {
    result.push({ type: 'header', key, count: buckets[key].length });
    for (const row of buckets[key]) result.push({ type: 'row', row });
  }
  return result;
}

/** Parse 'min-w-[Npx]' Tailwind class → pixel number (fallback: 120). */
function parseMinW(minW) {
  if (!minW) return 120;
  const m = minW.match(/\[(\d+)px\]/);
  return m ? parseInt(m[1], 10) : 120;
}

// Fixed widths (px) for non-data columns used in sticky offset calculations
const CHECKBOX_COL_W = 40;
const ACTION_COL_W   = 112;

// ─── Main Grid ────────────────────────────────────────────────────────────────

export default function DataGrid({
  columns = [],
  data = [],
  loading = false,

  // Selection
  selectedIds = [],
  onSelectAll,
  onSelectRow,
  allChecked = false,

  // Column filters
  filters = {},
  onFiltersChange,

  // Pagination
  page = 1,
  totalPages = 1,
  rowsPerPage = 25,
  rowsPerPageOptions = [25, 50, 100],
  onPageChange,
  onRowsPerPageChange,

  // Grouping
  groupBy = null,

  // Action column
  renderActions,

  // Empty state
  emptyMessage = 'No data found.',

  // Row key accessor
  rowKey = (row) => row.id,

  // Highlight predicate (e.g. comment panel open)
  isRowHighlighted,
}) {
  // ── Column manager state ────────────────────────────────────────────────
  // colOrder: all column keys in display order (hidden keys still present)
  const [colOrder, setColOrder]   = useState(() => columns.map(c => c.key));
  const [hiddenCols, setHiddenCols] = useState(new Set());
  // pinnedLeft / pinnedRight: count of leading / trailing visible cols that are sticky
  const [pinnedLeft,  setPinnedLeft]  = useState(0);
  const [pinnedRight, setPinnedRight] = useState(0);

  const [cogOpen,             setCogOpen]             = useState(false);
  const [actionHeaderHovered, setActionHeaderHovered] = useState(false);
  // Position of the cog panel (portal, fixed coords)
  const [cogPanelPos, setCogPanelPos] = useState({ top: 0, right: 0 });

  // Drag state for column reordering inside the cog panel
  const dragKeyRef   = useRef(null);
  const [dragOverKey, setDragOverKey] = useState(null);

  // Ref on the cog trigger <button> — used to measure panel position
  const cogBtnRef       = useRef(null);
  // Ref on the action <th> — used for outside-click detection
  const cogContainerRef = useRef(null);

  // Per-column header cell refs (keyed by column key) for measuring widths
  const headerCellRefs = useRef({});
  // Measured widths used for sticky left/right offset calculation
  const [colWidths, setColWidths] = useState({});

  // Sync colOrder when columns prop changes (handles added/removed keys)
  useEffect(() => {
    setColOrder(prev => {
      const prevSet = new Set(prev);
      const newKeys = columns.map(c => c.key);
      const kept    = prev.filter(k => newKeys.includes(k));
      const added   = newKeys.filter(k => !prevSet.has(k));
      return [...kept, ...added];
    });
  }, [columns]); // eslint-disable-line react-hooks/exhaustive-deps

  // Close cog panel on outside click
  useEffect(() => {
    if (!cogOpen) return;
    const handler = (e) => {
      // Allow clicks inside the cog button or the panel portal
      const panelEl = document.getElementById('datagrid-cog-panel');
      if (cogContainerRef.current?.contains(e.target)) return;
      if (panelEl?.contains(e.target)) return;
      setCogOpen(false);
      setActionHeaderHovered(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [cogOpen]);

  // Measure visible column header widths after render for sticky offset calc
  useEffect(() => {
    const measured = {};
    for (const [key, el] of Object.entries(headerCellRefs.current)) {
      if (el) measured[key] = el.offsetWidth;
    }
    setColWidths(prev => {
      const changed = Object.keys(measured).some(k => measured[k] !== prev[k]);
      return changed ? measured : prev;
    });
  });

  // ── Derived: visible columns in display order ──────────────────────────
  const colMap      = Object.fromEntries(columns.map(c => [c.key, c]));
  const visibleCols = colOrder
    .filter(k => !hiddenCols.has(k) && colMap[k])
    .map(k => colMap[k]);
  const visibleCount = visibleCols.length;

  const colCount     = visibleCount + 1 + (renderActions ? 1 : 0); // +1 checkbox
  const tableItems   = buildGroupedRows(data, groupBy);
  const visiblePages = buildPages(page, totalPages);

  function setFilter(key, value) {
    onFiltersChange?.({ ...filters, [key]: value });
  }

  // ── Sticky column helpers ───────────────────────────────────────────────
  /** Returns inline style object for a visible column at visIdx. */
  function getStickyStyle(visIdx) {
    if (visIdx < pinnedLeft) {
      let left = CHECKBOX_COL_W;
      for (let i = 0; i < visIdx; i++) {
        left += colWidths[visibleCols[i].key] ?? parseMinW(visibleCols[i].minW);
      }
      return { position: 'sticky', left, zIndex: 10 };
    }
    if (pinnedRight > 0 && visIdx >= visibleCount - pinnedRight) {
      let right = ACTION_COL_W;
      for (let i = visIdx + 1; i < visibleCount; i++) {
        right += colWidths[visibleCols[i].key] ?? parseMinW(visibleCols[i].minW);
      }
      return { position: 'sticky', right, zIndex: 10 };
    }
    return {};
  }

  function isStickyLeft(visIdx)  { return visIdx < pinnedLeft; }
  function isStickyRight(visIdx) { return pinnedRight > 0 && visIdx >= visibleCount - pinnedRight; }
  function isPinned(visIdx)      { return isStickyLeft(visIdx) || isStickyRight(visIdx); }

  // ── Column manager actions ──────────────────────────────────────────────
  function toggleVisibility(key) {
    setHiddenCols(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
    // Reset pin counts — visible indices shift after a hide/show
    setPinnedLeft(0);
    setPinnedRight(0);
  }

  function moveColUp(key) {
    setColOrder(prev => {
      const idx = prev.indexOf(key);
      if (idx <= 0) return prev;
      const next = [...prev];
      [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
      return next;
    });
    setPinnedLeft(0);
    setPinnedRight(0);
  }

  function moveColDown(key) {
    setColOrder(prev => {
      const idx = prev.indexOf(key);
      if (idx >= prev.length - 1) return prev;
      const next = [...prev];
      [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
      return next;
    });
    setPinnedLeft(0);
    setPinnedRight(0);
  }

  function handleDragStart(key) { dragKeyRef.current = key; }
  function handleDragOver(e, key) { e.preventDefault(); setDragOverKey(key); }
  function handleDrop(targetKey) {
    const fromKey = dragKeyRef.current;
    if (!fromKey || fromKey === targetKey) { setDragOverKey(null); return; }
    setColOrder(prev => {
      const next = [...prev];
      const fi = next.indexOf(fromKey);
      const ti = next.indexOf(targetKey);
      next.splice(fi, 1);
      next.splice(ti, 0, fromKey);
      return next;
    });
    setPinnedLeft(0);
    setPinnedRight(0);
    dragKeyRef.current = null;
    setDragOverKey(null);
  }
  function handleDragEnd() { dragKeyRef.current = null; setDragOverKey(null); }

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* ── Table area ──────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-auto min-h-0">
        <div className="bg-white rounded-xl border border-gray-200 relative" style={{ overflowX: 'visible' }}>
          {/* Loading overlay */}
          {loading && (
            <div className="absolute inset-0 bg-white/70 z-30 flex items-center justify-center">
              <div className="flex gap-1.5">
                {[0, 1, 2].map(i => (
                  <div
                    key={i}
                    className="w-2 h-2 bg-[#7c3aed] rounded-full animate-bounce"
                    style={{ animationDelay: `${i * 0.15}s` }}
                  />
                ))}
              </div>
            </div>
          )}

          <table className="w-full text-[12px] border-collapse">
            {/* ── Header ─────────────────────────────────────────────── */}
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                {/* Checkbox — always sticky at left:0 */}
                <th className="w-10 px-3 py-2.5 bg-gray-50 sticky left-0 z-20">
                  <Checkbox checked={allChecked} onChange={onSelectAll} />
                </th>

                {visibleCols.map((col, visIdx) => {
                  const stickyStyle = getStickyStyle(visIdx);
                  const isSticky    = isPinned(visIdx);
                  return (
                    <FilterTh
                      key={col.key}
                      ref={el => { headerCellRefs.current[col.key] = el; }}
                      label={col.label}
                      filterKey={col.key}
                      filterType={col.filterType}
                      filterOptions={col.filterOptions}
                      filters={filters}
                      setFilter={setFilter}
                      minW={col.minW}
                      style={Object.keys(stickyStyle).length ? stickyStyle : undefined}
                      extraClass={isSticky ? 'bg-gray-100 shadow-[1px_0_0_0_#e5e7eb]' : 'bg-gray-50'}
                    />
                  );
                })}

                {/* Action column header — cog icon appears on hover */}
                {renderActions && (
                  <th
                    ref={cogContainerRef}
                    className="w-[112px] px-3 py-2.5 relative bg-gray-50 border-l border-gray-200 sticky right-0 z-20"
                    onMouseEnter={() => setActionHeaderHovered(true)}
                    onMouseLeave={() => { if (!cogOpen) setActionHeaderHovered(false); }}
                  >
                    {/* Cog trigger button */}
                    {(actionHeaderHovered || cogOpen) && (
                      <button
                        ref={cogBtnRef}
                        onClick={() => {
                          if (!cogOpen) {
                            const rect = cogBtnRef.current?.getBoundingClientRect();
                            if (rect) {
                              setCogPanelPos({
                                top:   rect.bottom + 4,
                                right: window.innerWidth - rect.right,
                              });
                            }
                          }
                          setCogOpen(o => !o);
                        }}
                        title="Manage columns"
                        className={`absolute top-1/2 right-2 -translate-y-1/2 w-6 h-6 flex items-center justify-center rounded-md transition-colors ${
                          cogOpen
                            ? 'bg-[#7c3aed] text-white'
                            : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                        }`}
                      >
                        <Settings2 size={12} />
                      </button>
                    )}
                  </th>
                )}
              </tr>
            </thead>

            {/* ── Body ───────────────────────────────────────────────── */}
            <tbody>
              {data.length === 0 && !loading ? (
                <tr>
                  <td colSpan={colCount} className="px-4 py-12 text-center text-gray-400 text-[13px]">
                    {emptyMessage}
                  </td>
                </tr>
              ) : (
                tableItems.map((item, idx) =>
                  item.type === 'header' ? (
                    <GroupHeaderRow
                      key={`grp-${item.key}`}
                      label={item.key}
                      count={item.count}
                      colSpan={colCount}
                    />
                  ) : (
                    <DataRow
                      key={rowKey(item.row)}
                      row={item.row}
                      columns={visibleCols}
                      isSelected={selectedIds.includes(rowKey(item.row))}
                      onSelect={() => onSelectRow?.(rowKey(item.row))}
                      isEven={idx % 2 === 1}
                      isHighlighted={isRowHighlighted?.(item.row)}
                      renderActions={renderActions}
                      getStickyStyle={getStickyStyle}
                      isPinned={isPinned}
                    />
                  )
                )
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Column manager panel (portal — escapes overflow:hidden) ────── */}
      {cogOpen && createPortal(
        <div
          id="datagrid-cog-panel"
          style={{ position: 'fixed', top: cogPanelPos.top, right: cogPanelPos.right, zIndex: 9999 }}
        >
          <CogPanel
            colOrder={colOrder}
            colMap={colMap}
            hiddenCols={hiddenCols}
            pinnedLeft={pinnedLeft}
            pinnedRight={pinnedRight}
            visibleCount={visibleCount}
            dragOverKey={dragOverKey}
            onToggleVisibility={toggleVisibility}
            onMoveUp={moveColUp}
            onMoveDown={moveColDown}
            onPinnedLeftChange={v => setPinnedLeft(Math.max(0, Math.min(v, visibleCount - pinnedRight)))}
            onPinnedRightChange={v => setPinnedRight(Math.max(0, Math.min(v, visibleCount - pinnedLeft)))}
            onClose={() => { setCogOpen(false); setActionHeaderHovered(false); }}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            onDragEnd={handleDragEnd}
          />
        </div>,
        document.body
      )}

      {/* ── Pagination bar ──────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-white border border-gray-200 shrink-0 mt-3 rounded-xl">
        {/* Rows per page */}
        <div className="flex items-center gap-1">
          <select
            value={rowsPerPage}
            onChange={e => onRowsPerPageChange?.(Number(e.target.value))}
            className="border border-gray-200 rounded-lg h-8 px-2.5 text-[12px] text-gray-600 bg-white cursor-pointer outline-none focus:ring-1 focus:ring-[#7c3aed] appearance-none pr-6"
            style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%236b7280' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`,
              backgroundRepeat: 'no-repeat',
              backgroundPosition: 'right 6px center',
            }}
          >
            {rowsPerPageOptions.map(n => (
              <option key={n} value={n}>{n} / page</option>
            ))}
          </select>
        </div>

        {/* Page numbers */}
        <div className="flex items-center gap-1">
          <PageBtn
            onClick={() => onPageChange?.(Math.max(1, page - 1))}
            disabled={page === 1}
            aria-label="Previous"
          >
            <ChevronLeft size={13} />
          </PageBtn>

          {visiblePages.map((p, i) =>
            p === '…' ? (
              <span key={`e${i}`} className="w-8 h-8 flex items-center justify-center text-[12px] text-gray-400 select-none">···</span>
            ) : (
              <PageBtn key={p} active={page === p} onClick={() => onPageChange?.(p)}>
                {p}
              </PageBtn>
            )
          )}

          <PageBtn
            onClick={() => onPageChange?.(Math.min(totalPages, page + 1))}
            disabled={page === totalPages}
            aria-label="Next"
          >
            <ChevronRight size={13} />
          </PageBtn>
        </div>
      </div>
    </div>
  );
}

// ─── CogPanel ─────────────────────────────────────────────────────────────────
// Floating column-manager dropdown rendered inside the action column <th>.
// Provides: visibility toggle, drag-to-reorder, up/down reorder buttons,
// and +/− controls for pinning leading/trailing consecutive columns.

function CogPanel({
  colOrder, colMap, hiddenCols,
  pinnedLeft, pinnedRight, visibleCount,
  dragOverKey,
  onToggleVisibility, onMoveUp, onMoveDown,
  onPinnedLeftChange, onPinnedRightChange,
  onClose,
  onDragStart, onDragOver, onDrop, onDragEnd,
}) {
  // Max pins: left + right cannot exceed visible column count
  const maxPinLeft  = visibleCount - pinnedRight;
  const maxPinRight = visibleCount - pinnedLeft;

  return (
    <div className="absolute top-full right-0 mt-1 w-64 bg-white rounded-xl border border-gray-200 shadow-xl z-50 overflow-hidden">
      {/* Panel header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100 bg-gray-50/60">
        <span className="text-[11px] font-semibold text-gray-600 uppercase tracking-wide">Manage Columns</span>
        <button
          onClick={onClose}
          className="w-5 h-5 flex items-center justify-center rounded hover:bg-gray-200 text-gray-400 hover:text-gray-600 transition-colors"
        >
          <X size={11} />
        </button>
      </div>

      {/* Column list — drag to reorder, eye to toggle, ▲▼ to shift */}
      <div className="max-h-[260px] overflow-y-auto py-1">
        {colOrder.map((key, idx) => {
          const col      = colMap[key];
          if (!col) return null;
          const isHidden   = hiddenCols.has(key);
          const isDragOver = dragOverKey === key;

          return (
            <div
              key={key}
              draggable
              onDragStart={() => onDragStart(key)}
              onDragOver={e => onDragOver(e, key)}
              onDrop={() => onDrop(key)}
              onDragEnd={onDragEnd}
              className={`flex items-center gap-1.5 px-2 py-1.5 hover:bg-gray-50 select-none transition-colors ${
                isDragOver ? 'border-t-2 border-[#7c3aed] bg-violet-50/40' : ''
              }`}
            >
              {/* Drag handle */}
              <span className="text-gray-300 cursor-grab active:cursor-grabbing shrink-0">
                <GripVertical size={13} />
              </span>

              {/* Visibility toggle */}
              <button
                onClick={() => onToggleVisibility(key)}
                title={isHidden ? 'Show column' : 'Hide column'}
                className={`shrink-0 w-5 h-5 flex items-center justify-center rounded transition-colors ${
                  isHidden ? 'text-gray-300 hover:text-gray-500' : 'text-[#7c3aed] hover:text-violet-700'
                }`}
              >
                {isHidden ? <EyeOff size={12} /> : <Eye size={12} />}
              </button>

              {/* Column label */}
              <span className={`flex-1 text-[11px] truncate ${isHidden ? 'text-gray-400 line-through' : 'text-gray-700'}`}>
                {col.label}
              </span>

              {/* Up / Down buttons */}
              <div className="flex flex-col shrink-0 gap-px">
                <button
                  onClick={() => onMoveUp(key)}
                  disabled={idx === 0}
                  className="w-4 h-4 flex items-center justify-center rounded hover:bg-gray-200 text-gray-400 hover:text-gray-600 disabled:opacity-25 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronUp size={10} />
                </button>
                <button
                  onClick={() => onMoveDown(key)}
                  disabled={idx === colOrder.length - 1}
                  className="w-4 h-4 flex items-center justify-center rounded hover:bg-gray-200 text-gray-400 hover:text-gray-600 disabled:opacity-25 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronDown size={10} />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Sticky-pin controls ───────────────────────────────────────── */}
      {/* Only first N or last N consecutive visible columns may be pinned.  */}
      {/* Increasing left/right pin extends the group from its outer edge.   */}
      <div className="border-t border-gray-100 px-3 py-2.5 space-y-2 bg-gray-50/40">
        <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">
          Sticky columns
        </div>

        {/* Pin left */}
        <div className="flex items-center gap-2">
          <Pin size={11} className="text-gray-400 shrink-0" style={{ transform: 'rotate(-45deg)' }} />
          <span className="text-[11px] text-gray-600 flex-1">Pin left</span>
          <PinCounter
            value={pinnedLeft}
            max={maxPinLeft}
            onDecrement={() => onPinnedLeftChange(pinnedLeft - 1)}
            onIncrement={() => onPinnedLeftChange(pinnedLeft + 1)}
          />
        </div>

        {/* Pin right */}
        <div className="flex items-center gap-2">
          <Pin size={11} className="text-gray-400 shrink-0" style={{ transform: 'rotate(45deg)' }} />
          <span className="text-[11px] text-gray-600 flex-1">Pin right</span>
          <PinCounter
            value={pinnedRight}
            max={maxPinRight}
            onDecrement={() => onPinnedRightChange(pinnedRight - 1)}
            onIncrement={() => onPinnedRightChange(pinnedRight + 1)}
          />
        </div>

        <p className="text-[10px] text-gray-400 leading-snug">
          Only leading or trailing columns may be pinned consecutively.
        </p>
      </div>
    </div>
  );
}

/** +/− counter widget used in the pin controls section of CogPanel. */
function PinCounter({ value, max, onDecrement, onIncrement }) {
  return (
    <div className="flex items-center gap-1 shrink-0">
      <button
        onClick={onDecrement}
        disabled={value === 0}
        className="w-5 h-5 flex items-center justify-center border border-gray-200 rounded text-[12px] font-bold text-gray-600 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
      >
        −
      </button>
      <span className="text-[11px] text-gray-700 w-4 text-center font-medium">{value}</span>
      <button
        onClick={onIncrement}
        disabled={value >= max}
        className="w-5 h-5 flex items-center justify-center border border-gray-200 rounded text-[12px] font-bold text-gray-600 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
      >
        +
      </button>
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function Checkbox({ checked, onChange }) {
  return (
    <div
      role="checkbox"
      aria-checked={checked}
      tabIndex={0}
      onKeyDown={e => e.key === ' ' && onChange?.()}
      onClick={onChange}
      className={`w-4 h-4 rounded border flex items-center justify-center cursor-pointer transition-colors ${
        checked ? 'bg-[#1a1a1a] border-[#1a1a1a]' : 'border-gray-300 hover:border-gray-500'
      }`}
    >
      {checked && <Check size={10} className="text-white" strokeWidth={3} />}
    </div>
  );
}

/**
 * FilterTh — header cell with inline filter control.
 * Uses forwardRef so the parent can measure offsetWidth for sticky calculations.
 */
const FilterTh = forwardRef(function FilterTh(
  { label, filterKey, filterType, filterOptions, filters, setFilter, minW, style, extraClass = '' },
  ref
) {
  const value     = filters[filterKey] ?? '';
  const baseClass = `px-3 py-2 text-left font-semibold text-gray-600 whitespace-nowrap border-l border-gray-200 ${minW ?? ''} ${extraClass}`;

  if (filterType === 'select') {
    return (
      <th ref={ref} className={baseClass} style={style}>
        <div className="mb-1.5 text-[11px] uppercase tracking-wide text-gray-500">{label}</div>
        <div className="flex items-center gap-1 border border-gray-200 rounded-md h-7 px-2 bg-white font-normal">
          <select
            value={value}
            onChange={e => setFilter(filterKey, e.target.value)}
            className="flex-1 outline-none text-[11px] text-gray-600 bg-transparent appearance-none min-w-0 w-full"
          >
            <option value="" />
            {(filterOptions ?? []).map(o => <option key={o} value={o}>{o}</option>)}
          </select>
          <ChevronDown size={11} className="text-gray-400 shrink-0 pointer-events-none" />
        </div>
      </th>
    );
  }

  if (filterType === 'date') {
    return (
      <th ref={ref} className={baseClass} style={style}>
        <div className="mb-1.5 text-[11px] uppercase tracking-wide text-gray-500">{label}</div>
        <div className="flex items-center gap-1 border border-gray-200 rounded-md h-7 px-2 bg-white font-normal">
          <input
            type="text"
            value={value}
            onChange={e => setFilter(filterKey, e.target.value)}
            className="flex-1 outline-none text-[11px] text-gray-600 bg-transparent min-w-0"
            placeholder="MM/DD/YYYY"
          />
          <Calendar size={11} className="text-gray-400 shrink-0" />
        </div>
      </th>
    );
  }

  // Default: search
  return (
    <th ref={ref} className={baseClass} style={style}>
      <div className="mb-1.5 text-[11px] uppercase tracking-wide text-gray-500">{label}</div>
      <div className="flex items-center gap-1 border border-gray-200 rounded-md h-7 px-2 bg-white font-normal">
        <Search size={11} className="text-gray-400 shrink-0" />
        <input
          value={value}
          onChange={e => setFilter(filterKey, e.target.value)}
          className="flex-1 outline-none text-[11px] text-gray-600 bg-transparent min-w-0"
        />
      </div>
    </th>
  );
});

function GroupHeaderRow({ label, count, colSpan }) {
  return (
    <tr className="bg-violet-50/70 border-y border-violet-100">
      <td colSpan={colSpan} className="px-3 py-1.5">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-semibold text-[#7c3aed] uppercase tracking-wide">{label}</span>
          <span className="bg-[#7c3aed]/15 text-[#7c3aed] rounded-full text-[10px] font-semibold px-2 py-0.5 leading-none">
            {count}
          </span>
        </div>
      </td>
    </tr>
  );
}

function DataRow({
  row, columns, isSelected, onSelect, isEven, isHighlighted,
  renderActions, getStickyStyle, isPinned,
}) {
  // Determine the row's background for use on sticky cells (which need explicit bg)
  const rowBg = isHighlighted ? '#ede9fe'
              : isSelected    ? '#f5f3ff'
              : isEven        ? '#f9fafb'
              : '#ffffff';

  return (
    <tr
      className={`border-b border-gray-100 last:border-b-0 transition-colors group hover:bg-violet-50/20 ${
        isHighlighted ? 'bg-violet-50/60'
        : isSelected  ? 'bg-violet-50/40'
        : isEven      ? 'bg-gray-50/40'
        : 'bg-white'
      }`}
    >
      {/* Checkbox — always sticky left */}
      <td
        className="px-3 py-2.5 sticky left-0 z-10 group-hover:bg-violet-50/20 transition-colors"
        style={{ backgroundColor: rowBg }}
      >
        <Checkbox checked={isSelected} onChange={onSelect} />
      </td>

      {columns.map((col, visIdx) => {
        const stickyStyle = getStickyStyle(visIdx);
        const pinned      = isPinned(visIdx);
        return (
          <td
            key={col.key}
            className={`px-3 py-2.5 text-gray-700 border-l border-gray-100 ${col.maxW ?? ''} ${
              col.key === columns[0]?.key ? 'font-medium text-gray-800' : ''
            } ${pinned ? 'group-hover:bg-violet-50/20 transition-colors' : ''}`}
            style={
              pinned
                ? { ...stickyStyle, backgroundColor: rowBg }
                : Object.keys(stickyStyle).length
                ? stickyStyle
                : undefined
            }
          >
            {col.truncate ? (
              <span className="block truncate" title={row[col.key]}>
                {row[col.key] ?? ''}
              </span>
            ) : (
              row[col.key] ?? ''
            )}
          </td>
        );
      })}

      {/* Action column — sticky right */}
      {renderActions && (
        <td
          className="px-2 py-2 border-l border-gray-100 sticky right-0 z-10"
          style={{ backgroundColor: rowBg }}
        >
          {renderActions(row)}
        </td>
      )}
    </tr>
  );
}

function PageBtn({ children, active, onClick, disabled, ...rest }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      {...rest}
      className={`w-8 h-8 flex items-center justify-center rounded-lg text-[12px] font-medium border transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
        active
          ? 'bg-[#1a1a1a] text-white border-[#1a1a1a]'
          : 'border-gray-200 text-gray-600 hover:bg-gray-50'
      }`}
    >
      {children}
    </button>
  );
}

// Re-export sub-components and helpers for standalone usage
export { Checkbox, FilterTh, GroupHeaderRow, DataRow, PageBtn, buildGroupedRows, buildPages };
