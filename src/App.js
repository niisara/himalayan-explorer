import { useState, useMemo } from 'react';
import towns from './data/towns.json';
import DataGrid from './components/grid/DataGrid';
import './App.css';

// ── Constants ──────────────────────────────────────────────────────────────────

const TYPE_COLORS = {
  hindu:    { bg: 'bg-orange-50',  text: 'text-orange-700',  border: 'border-orange-200',  dot: 'bg-orange-400'  },
  buddhist: { bg: 'bg-blue-50',    text: 'text-blue-700',    border: 'border-blue-200',    dot: 'bg-blue-400'    },
  muslim:   { bg: 'bg-green-50',   text: 'text-green-700',   border: 'border-green-200',   dot: 'bg-green-400'   },
  other:    { bg: 'bg-gray-50',    text: 'text-gray-600',    border: 'border-gray-200',    dot: 'bg-gray-400'    },
};

const STATES = [...new Set(towns.map(t => t.s))].sort();

const COLUMNS = [
  { key: 'n',      label: 'Town',       filterType: 'search', minW: 'min-w-[160px]', maxW: 'max-w-[160px]', truncate: true },
  { key: 's',      label: 'State',      filterType: 'select', minW: 'min-w-[150px]', filterOptions: STATES },
  { key: 'alt',    label: 'Alt (m)',    filterType: 'search', minW: 'min-w-[90px]'  },
  { key: 'type',   label: 'Type',       filterType: 'select', minW: 'min-w-[100px]', filterOptions: ['hindu','buddhist','muslim','other'] },
  { key: 'wifi',   label: 'WiFi',       filterType: 'search', minW: 'min-w-[70px]'  },
  { key: 'spirit', label: 'Spirit',     filterType: 'search', minW: 'min-w-[70px]'  },
  { key: 'park',   label: 'Parking',    filterType: 'search', minW: 'min-w-[80px]'  },
  { key: 'ev',     label: 'EV',         filterType: 'search', minW: 'min-w-[60px]'  },
  { key: 'rent',   label: 'Rent/mo',    filterType: 'search', minW: 'min-w-[90px]'  },
  { key: 'fiber',  label: 'Fiber',      filterType: 'select', minW: 'min-w-[80px]',  filterOptions: ['Yes','No'] },
  { key: 'net',    label: 'Network',    filterType: 'search', minW: 'min-w-[180px]', maxW: 'max-w-[200px]', truncate: true },
  { key: 'crowd',  label: 'Crowd',      filterType: 'search', minW: 'min-w-[75px]'  },
  { key: 'desc',   label: 'Description',filterType: 'search', minW: 'min-w-[300px]', maxW: 'max-w-[320px]', truncate: true },
];

// ── Score helpers ──────────────────────────────────────────────────────────────

function Stars({ value, max = 5, color = 'text-amber-400' }) {
  return (
    <span className="inline-flex gap-0.5">
      {Array.from({ length: max }).map((_, i) => (
        <svg key={i} className={`w-3 h-3 ${i < value ? color : 'text-gray-200'}`} viewBox="0 0 20 20" fill="currentColor">
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
      ))}
    </span>
  );
}

// ── Town Card ──────────────────────────────────────────────────────────────────

function TownCard({ town }) {
  const tc = TYPE_COLORS[town.type] || TYPE_COLORS.other;
  return (
    <div className={`rounded-2xl border ${tc.border} bg-white shadow-sm hover:shadow-md transition-shadow overflow-hidden flex flex-col`}>
      {/* Header band */}
      <div className={`${tc.bg} px-4 py-3 flex items-start justify-between gap-2`}>
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            {town.top === 1 && (
              <span className="inline-flex items-center gap-1 bg-amber-100 text-amber-700 text-[10px] font-semibold px-1.5 py-0.5 rounded-full border border-amber-200 shrink-0">
                ★ Top Pick
              </span>
            )}
          </div>
          <h3 className="font-bold text-gray-900 text-[14px] leading-tight mt-0.5 truncate">{town.n}</h3>
          <p className={`text-[11px] font-medium ${tc.text} mt-0.5`}>{town.s}</p>
        </div>
        <div className="text-right shrink-0">
          <div className="text-[18px] font-bold text-gray-800">{town.alt.toLocaleString()}</div>
          <div className="text-[10px] text-gray-500">m alt</div>
        </div>
      </div>

      {/* Body */}
      <div className="px-4 py-3 flex flex-col gap-3 flex-1">
        {/* Description */}
        <p className="text-[11px] text-gray-600 leading-relaxed line-clamp-3">{town.desc}</p>

        {/* Ratings grid */}
        <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-[11px]">
          <div className="flex items-center justify-between gap-2">
            <span className="text-gray-500">WiFi</span>
            <Stars value={town.wifi} color="text-violet-400" />
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-gray-500">Spirit</span>
            <Stars value={town.spirit} color="text-orange-400" />
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-gray-500">Parking</span>
            <Stars value={town.park} color="text-green-400" />
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-gray-500">EV</span>
            <Stars value={town.ev} color="text-blue-400" />
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-gray-500">Crowd</span>
            <Stars value={town.crowd} color="text-red-400" />
          </div>
        </div>

        {/* Footer row */}
        <div className="flex items-center justify-between pt-1 border-t border-gray-100 mt-auto">
          <div className="flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full ${tc.dot}`} />
            <span className={`text-[10px] font-semibold capitalize ${tc.text}`}>{town.type}</span>
            {town.fiber === 1 && (
              <span className="bg-violet-100 text-violet-700 text-[10px] font-semibold px-1.5 py-0.5 rounded-full border border-violet-200 ml-1">
                Fiber
              </span>
            )}
          </div>
          <span className="text-[11px] font-semibold text-gray-700">₹{town.rent}/mo</span>
        </div>

        {/* Network */}
        <p className="text-[10px] text-gray-400 truncate">{town.net}</p>
      </div>
    </div>
  );
}

// ── Main App ──────────────────────────────────────────────────────────────────

const ROWS_PER_PAGE_OPTIONS = [25, 50, 100];

export default function App() {
  const [view, setView]           = useState('grid'); // 'grid' | 'cards'
  const [filters, setFilters]     = useState({});
  const [selected, setSelected]   = useState([]);
  const [page, setPage]           = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(25);

  // Normalise towns for the grid (fiber as "Yes"/"No", add id)
  const tableData = useMemo(() =>
    towns.map((t, i) => ({ ...t, id: i, fiber: t.fiber === 1 ? 'Yes' : 'No' })),
  []);

  // Apply filters
  const filtered = useMemo(() => {
    return tableData.filter(row => {
      for (const [key, val] of Object.entries(filters)) {
        if (!val) continue;
        const cell = String(row[key] ?? '').toLowerCase();
        if (!cell.includes(val.toLowerCase())) return false;
      }
      return true;
    });
  }, [tableData, filters]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / rowsPerPage));
  const pageData   = filtered.slice((page - 1) * rowsPerPage, page * rowsPerPage);

  // Card view uses raw towns (no fiber transform)
  const cardFiltered = useMemo(() => {
    return towns.filter(town => {
      for (const [key, val] of Object.entries(filters)) {
        if (!val) continue;
        let cell;
        if (key === 'fiber') cell = (town.fiber === 1 ? 'Yes' : 'No').toLowerCase();
        else cell = String(town[key] ?? '').toLowerCase();
        if (!cell.includes(val.toLowerCase())) return false;
      }
      return true;
    });
  }, [filters]);

  function toggleRow(id) {
    setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  }
  function toggleAll() {
    const pageIds = pageData.map(r => r.id);
    const allSelected = pageIds.every(id => selected.includes(id));
    setSelected(prev =>
      allSelected ? prev.filter(id => !pageIds.includes(id)) : [...new Set([...prev, ...pageIds])]
    );
  }
  const allChecked = pageData.length > 0 && pageData.every(r => selected.includes(r.id));

  function handleFiltersChange(f) {
    setFilters(f);
    setPage(1);
  }

  const topCount = cardFiltered.filter(t => t.top === 1).length;

  return (
    <div className="min-h-screen bg-gray-100">
      {/* ── Top bar ──────────────────────────────────────────────────────── */}
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Himalayan Explorer</h1>
          <p className="text-[12px] text-gray-500 mt-0.5">
            {filtered.length} towns across {[...new Set(cardFiltered.map(t => t.s))].length} states
            {topCount > 0 && <span className="ml-2 text-amber-600 font-medium">· {topCount} top picks</span>}
          </p>
        </div>

        {/* View toggle */}
        <div className="flex items-center bg-gray-100 rounded-lg p-1 gap-1">
          <button
            onClick={() => setView('grid')}
            className={`px-3 py-1.5 rounded-md text-[12px] font-medium transition-colors ${
              view === 'grid' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Grid
          </button>
          <button
            onClick={() => setView('cards')}
            className={`px-3 py-1.5 rounded-md text-[12px] font-medium transition-colors ${
              view === 'cards' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Cards
          </button>
        </div>
      </header>

      {/* ── Filter bar (shared for both views) ───────────────────────────── */}
      <div className="bg-white border-b border-gray-200 px-6 py-3 flex items-center gap-3 flex-wrap">
        {/* Quick search */}
        <div className="flex items-center gap-2 border border-gray-200 rounded-lg px-3 h-8 bg-gray-50 flex-1 min-w-[200px] max-w-[280px]">
          <svg className="w-3.5 h-3.5 text-gray-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>
          </svg>
          <input
            value={filters.n ?? ''}
            onChange={e => handleFiltersChange({ ...filters, n: e.target.value })}
            placeholder="Search town..."
            className="flex-1 text-[12px] outline-none bg-transparent text-gray-700"
          />
        </div>

        {/* State */}
        <select
          value={filters.s ?? ''}
          onChange={e => handleFiltersChange({ ...filters, s: e.target.value })}
          className="border border-gray-200 rounded-lg h-8 px-3 text-[12px] text-gray-600 bg-gray-50 outline-none focus:ring-1 focus:ring-violet-400"
        >
          <option value="">All States</option>
          {STATES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>

        {/* Type */}
        <select
          value={filters.type ?? ''}
          onChange={e => handleFiltersChange({ ...filters, type: e.target.value })}
          className="border border-gray-200 rounded-lg h-8 px-3 text-[12px] text-gray-600 bg-gray-50 outline-none focus:ring-1 focus:ring-violet-400"
        >
          <option value="">All Types</option>
          {['hindu','buddhist','muslim','other'].map(t => <option key={t} value={t} className="capitalize">{t}</option>)}
        </select>

        {/* Fiber */}
        <select
          value={filters.fiber ?? ''}
          onChange={e => handleFiltersChange({ ...filters, fiber: e.target.value })}
          className="border border-gray-200 rounded-lg h-8 px-3 text-[12px] text-gray-600 bg-gray-50 outline-none focus:ring-1 focus:ring-violet-400"
        >
          <option value="">Fiber: All</option>
          <option value="Yes">Fiber: Yes</option>
          <option value="No">Fiber: No</option>
        </select>

        {Object.values(filters).some(v => v) && (
          <button
            onClick={() => handleFiltersChange({})}
            className="text-[11px] text-violet-600 hover:text-violet-800 font-medium"
          >
            Clear filters
          </button>
        )}
      </div>

      {/* ── Content ───────────────────────────────────────────────────────── */}
      <main className="p-6">
        {view === 'grid' ? (
          <div className="flex flex-col" style={{ height: 'calc(100vh - 180px)' }}>
            <DataGrid
              columns={COLUMNS}
              data={pageData}
              loading={false}
              selectedIds={selected}
              onSelectAll={toggleAll}
              onSelectRow={toggleRow}
              allChecked={allChecked}
              filters={filters}
              onFiltersChange={handleFiltersChange}
              page={page}
              totalPages={totalPages}
              rowsPerPage={rowsPerPage}
              rowsPerPageOptions={ROWS_PER_PAGE_OPTIONS}
              onPageChange={setPage}
              onRowsPerPageChange={n => { setRowsPerPage(n); setPage(1); }}
              groupBy={null}
              emptyMessage="No towns match your filters."
              rowKey={row => row.id}
            />
          </div>
        ) : (
          <>
            {/* Top picks section */}
            {cardFiltered.filter(t => t.top === 1).length > 0 && (
              <section className="mb-8">
                <h2 className="text-[13px] font-bold text-amber-700 uppercase tracking-wide mb-3 flex items-center gap-2">
                  <span>★</span> Top Picks
                  <span className="bg-amber-100 text-amber-700 text-[10px] font-semibold px-2 py-0.5 rounded-full border border-amber-200">
                    {cardFiltered.filter(t => t.top === 1).length}
                  </span>
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {cardFiltered.filter(t => t.top === 1).map((town, i) => (
                    <TownCard key={`top-${i}`} town={town} />
                  ))}
                </div>
              </section>
            )}

            {/* All towns by state */}
            {STATES.filter(state => cardFiltered.some(t => t.s === state)).map(state => (
              <section key={state} className="mb-8">
                <h2 className="text-[13px] font-bold text-gray-700 uppercase tracking-wide mb-3 flex items-center gap-2">
                  {state}
                  <span className="bg-gray-100 text-gray-500 text-[10px] font-semibold px-2 py-0.5 rounded-full border border-gray-200">
                    {cardFiltered.filter(t => t.s === state).length}
                  </span>
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {cardFiltered.filter(t => t.s === state).map((town, i) => (
                    <TownCard key={`${state}-${i}`} town={town} />
                  ))}
                </div>
              </section>
            ))}

            {cardFiltered.length === 0 && (
              <div className="text-center py-24 text-gray-400 text-[14px]">No towns match your filters.</div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
