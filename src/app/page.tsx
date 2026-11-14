'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';

// ── Types ─────────────────────────────────────────────────
interface RosterEntry { employee_id: string; date: string; status: string }
interface AllocRow { employee_id: string; process_id: string; date: string; approved: boolean }
interface EmpRow { id: string; name: string; pod_id: string; pods?: { id: string; name: string } }
interface ProcRow {
  id: string;
  brand_id: string;
  name: string;
  calendar_rule?: string;
  min_staff?: number;
  brands?: { id: string; name: string };
}
interface HolidayRow {
  id: string;
  date: string;
  name: string;
  applies_to_all: boolean;
  pod_ids?: string[] | null;
}
interface BrandRow { id: string; name: string }
interface AssignRow { employee_id: string; process_id: string; role: string; weight: number }
interface Conflict { code: string; severity: string; date: string; processId?: string; brandId?: string; employeeId?: string; message: string }
interface Candidate { employeeId: string; name: string; samePod: boolean; monthlyWorkload: number }

const STATUS_CONFIG: Record<string, { label: string; short: string; bg: string; text: string; border: string }> = {
  WORKING: { label: 'Working', short: 'W', bg: 'bg-emerald-50 hover:bg-emerald-100/80', text: 'text-emerald-700 font-semibold', border: 'border-emerald-200' },
  WEEKLY_OFF: { label: 'Weekly Off', short: 'WO', bg: 'bg-sky-50 hover:bg-sky-100/80', text: 'text-sky-700 font-semibold', border: 'border-sky-200' },
  HOLIDAY: { label: 'Holiday', short: 'H', bg: 'bg-purple-50 hover:bg-purple-100/80', text: 'text-purple-700 font-semibold', border: 'border-purple-200' },
  LEAVE: { label: 'Leave', short: 'L', bg: 'bg-rose-50 hover:bg-rose-100/80', text: 'text-rose-700 font-semibold', border: 'border-rose-200' },
  COMP_OFF: { label: 'Comp Off', short: 'CO', bg: 'bg-amber-50 hover:bg-amber-100/80', text: 'text-amber-700 font-semibold', border: 'border-amber-200' },
};

const POD_COLORS: Record<string, string> = {
  Alpha: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  Beta: 'bg-violet-50 text-violet-700 border-violet-200',
  Gamma: 'bg-cyan-50 text-cyan-700 border-cyan-200',
  Delta: 'bg-teal-50 text-teal-700 border-teal-200',
};

export default function RosterPage() {
  const [month, setMonth] = useState('2026-12');
  const [view, setView] = useState('company');
  const [filterId, setFilterId] = useState('');
  const [employees, setEmployees] = useState<EmpRow[]>([]);
  const [entries, setEntries] = useState<RosterEntry[]>([]);
  const [allocations, setAllocations] = useState<AllocRow[]>([]);
  const [processes, setProcesses] = useState<ProcRow[]>([]);
  const [brands, setBrands] = useState<BrandRow[]>([]);
  const [assignments, setAssignments] = useState<AssignRow[]>([]);
  const [holidays, setHolidays] = useState<HolidayRow[]>([]);
  const [conflicts, setConflicts] = useState<Conflict[]>([]);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [approvingAll, setApprovingAll] = useState(false);
  const [editCell, setEditCell] = useState<{ empId: string; date: string } | null>(null);
  const [suggestions, setSuggestions] = useState<{ conflict: Conflict; candidates: Candidate[] } | null>(null);
  const [pods, setPods] = useState<{ id: string; name: string }[]>([]);
  
  // Conflicts tab & pagination
  const [conflictTab, setConflictTab] = useState<'all' | 'errors' | 'warnings'>('all');
  const [conflictPage, setConflictPage] = useState(1);
  const pageSize = 8;

  // Load roster data
  const loadRoster = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ month, view });
      if (filterId) params.set('id', filterId);
      const res = await fetch(`/api/roster?${params}`);
      const data = await res.json();
      const currentEntries: RosterEntry[] = data.entries ?? [];
      setEmployees(data.employees ?? []);
      setEntries(currentEntries);
      setAllocations(data.allocations ?? []);
      setProcesses(data.processes ?? []);
      setBrands(data.brands ?? []);
      setAssignments(data.assignments ?? []);
      setHolidays(data.holidays ?? []);

      // Extract unique pods
      const podMap = new Map<string, string>();
      (data.employees ?? []).forEach((e: EmpRow) => {
        if (e.pods) podMap.set(e.pods.id, e.pods.name);
      });
      setPods(Array.from(podMap, ([id, name]) => ({ id, name })));

      // Only validate if a roster actually exists for this month!
      if (currentEntries.length > 0) {
        const valRes = await fetch('/api/roster/validate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ month }),
        });
        const valData = await valRes.json();
        setConflicts(valData.conflicts ?? []);
      } else {
        setConflicts([]);
      }
    } catch {
      // ignore
    }
    setLoading(false);
  }, [month, view, filterId]);

  useEffect(() => { loadRoster(); }, [loadRoster]);

  // Generate roster
  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const res = await fetch(`/api/roster/generate?month=${month}`, { method: 'POST' });
      const data = await res.json();
      setConflicts(data.conflicts ?? []);
      await loadRoster();
    } finally {
      setGenerating(false);
    }
  };

  // Edit cell
  const handleCellEdit = async (empId: string, date: string, status: string) => {
    const res = await fetch('/api/roster/cell', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ employee_id: empId, date, status }),
    });
    const data = await res.json();
    setConflicts(data.conflicts ?? []);
    setEditCell(null);
    await loadRoster();
  };

  // Get suggestions
  const handleShowSuggestions = async (conflict: Conflict) => {
    const params = new URLSearchParams({
      month,
      processId: conflict.processId ?? '',
      date: conflict.date,
      employeeId: conflict.employeeId ?? '',
    });
    const res = await fetch(`/api/roster/suggestions?${params}`);
    const data = await res.json();
    setSuggestions({ conflict, candidates: data.candidates ?? [] });
  };

  // Approve single allocation
  const handleApprove = async (candidate: Candidate, conflict: Conflict) => {
    const res = await fetch('/api/roster/approve-allocation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        employee_id: candidate.employeeId,
        process_id: conflict.processId,
        date: conflict.date,
      }),
    });
    const data = await res.json();
    setConflicts(data.conflicts ?? []);
    setSuggestions(null);
    await loadRoster();
  };

  // Approve all pending backup allocations
  const handleApproveAllPending = async () => {
    setApprovingAll(true);
    try {
      const res = await fetch('/api/roster/approve-allocation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          all: true,
          month,
          brand_id: view === 'brand' ? filterId : undefined,
        }),
      });
      const data = await res.json();
      setConflicts(data.conflicts ?? []);
      await loadRoster();
    } finally {
      setApprovingAll(false);
    }
  };

  // Jump to brand/employee when a conflict is clicked
  const handleConflictClick = (c: Conflict) => {
    if (c.brandId) {
      setView('brand');
      setFilterId(c.brandId);
    } else if (c.employeeId) {
      setView('employee');
      setFilterId(c.employeeId);
    }
  };

  // Dates in month
  const [year, m] = month.split('-').map(Number);
  const daysInMonth = new Date(Date.UTC(year, m, 0)).getUTCDate();
  const dates = useMemo(() => Array.from({ length: daysInMonth }, (_, i) => {
    const d = i + 1;
    return `${year}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  }), [year, m, daysInMonth]);

  // Entry lookup map
  const entryLookup = useMemo(() => {
    const map = new Map<string, RosterEntry>();
    for (const e of entries) {
      map.set(`${e.employee_id}|${e.date}`, e);
    }
    return map;
  }, [entries]);

  // Check if process requires coverage on date
  const isProcRequiredOnDate = useCallback((proc: ProcRow, dateStr: string): boolean => {
    const isHoliday = holidays.some((h) => h.date === dateStr);
    const dow = new Date(dateStr + 'T00:00:00Z').getUTCDay(); // 0 = Sun
    switch (proc.calendar_rule) {
      case 'ALL_DAYS_365':
        return true;
      case 'ALL_EXCEPT_HOLIDAYS':
        return !isHoliday;
      case 'EXCEPT_SUNDAYS_AND_HOLIDAYS':
        return dow !== 0 && !isHoliday;
      default:
        return true;
    }
  }, [holidays]);

  // Coverage check per process per date
  const getCoverageStatus = useCallback((proc: ProcRow, dateStr: string): 'green' | 'amber' | 'red' | 'off' => {
    if (!isProcRequiredOnDate(proc, dateStr)) return 'off';
    const procAllocs = allocations.filter((a) => a.process_id === proc.id && a.date === dateStr);
    const approved = procAllocs.filter((a) => a.approved);
    const pending = procAllocs.filter((a) => !a.approved);
    if (approved.length >= (proc.min_staff || 1)) return 'green';
    if (pending.length > 0) return 'amber';
    return 'red';
  }, [allocations, isProcRequiredOnDate]);

  // Company-wide daily coverage health
  const getCompanyDailyCoverage = useCallback((dateStr: string): { status: 'green' | 'amber' | 'red'; detail: string } => {
    let hasAmber = false;
    let hasRed = false;
    let redNames: string[] = [];
    let amberNames: string[] = [];

    for (const proc of processes) {
      const st = getCoverageStatus(proc, dateStr);
      if (st === 'red') {
        hasRed = true;
        redNames.push(proc.name);
      } else if (st === 'amber') {
        hasAmber = true;
        amberNames.push(proc.name);
      }
    }

    if (hasRed) {
      return { status: 'red', detail: `${redNames.length} line(s) uncovered: ${redNames.slice(0, 2).join(', ')}` };
    }
    if (hasAmber) {
      return { status: 'amber', detail: `${amberNames.length} line(s) backup pending approval: ${amberNames.slice(0, 2).join(', ')}` };
    }
    return { status: 'green', detail: 'All active processes fully covered' };
  }, [processes, getCoverageStatus]);

  // Filter options
  const getFilterOptions = () => {
    switch (view) {
      case 'pod': return pods.map((p) => ({ value: p.id, label: `Pod ${p.name}` }));
      case 'brand': return brands.map((b) => ({ value: b.id, label: b.name }));
      case 'process': return processes.map((p) => ({ value: p.id, label: `${p.name} • ${p.brands?.name ?? ''}` }));
      case 'employee': return employees.map((e) => ({ value: e.id, label: e.name }));
      default: return [];
    }
  };

  // Active filter label for UI badges
  const activeFilterLabel = useMemo(() => {
    if (view === 'company' || !filterId) return 'All Company';
    if (view === 'brand') return brands.find(b => b.id === filterId)?.name ?? 'Selected Brand';
    if (view === 'process') return processes.find(p => p.id === filterId)?.name ?? 'Selected Process';
    if (view === 'employee') return employees.find(e => e.id === filterId)?.name ?? 'Selected Employee';
    if (view === 'pod') return pods.find(p => p.id === filterId)?.name ?? 'Selected Pod';
    return '';
  }, [view, filterId, brands, processes, employees, pods]);

  // Toggle for scoping conflicts to active perspective
  const [filterConflictsByView, setFilterConflictsByView] = useState(true);

  // Scope conflicts to the active view perspective
  const viewScopedConflicts = useMemo(() => {
    if (!filterConflictsByView || view === 'company' || !filterId) {
      return conflicts;
    }

    if (view === 'brand') {
      const brandProcessIds = new Set(
        processes.filter((p) => p.brand_id === filterId).map((p) => p.id)
      );
      const brandEmployeeIds = new Set(
        assignments.filter((a) => brandProcessIds.has(a.process_id)).map((a) => a.employee_id)
      );

      return conflicts.filter((c) => {
        if (c.brandId === filterId) return true;
        if (c.processId && brandProcessIds.has(c.processId)) return true;
        if (c.employeeId && brandEmployeeIds.has(c.employeeId)) return true;
        return false;
      });
    }

    if (view === 'process') {
      const processEmployeeIds = new Set(
        assignments.filter((a) => a.process_id === filterId).map((a) => a.employee_id)
      );
      return conflicts.filter((c) => {
        if (c.processId === filterId) return true;
        if (c.employeeId && processEmployeeIds.has(c.employeeId)) return true;
        return false;
      });
    }

    if (view === 'employee') {
      return conflicts.filter((c) => c.employeeId === filterId);
    }

    if (view === 'pod') {
      const podEmployeeIds = new Set(
        employees.filter((e) => e.pod_id === filterId).map((e) => e.id)
      );
      return conflicts.filter((c) => c.employeeId && podEmployeeIds.has(c.employeeId));
    }

    return conflicts;
  }, [conflicts, filterConflictsByView, view, filterId, processes, assignments, employees]);

  const errors = useMemo(() => viewScopedConflicts.filter((c) => c.severity === 'error'), [viewScopedConflicts]);
  const warnings = useMemo(() => viewScopedConflicts.filter((c) => c.severity === 'warning'), [viewScopedConflicts]);

  const filteredConflicts = useMemo(() => {
    if (conflictTab === 'errors') return errors;
    if (conflictTab === 'warnings') return warnings;
    return viewScopedConflicts;
  }, [conflictTab, viewScopedConflicts, errors, warnings]);

  const totalPages = Math.max(1, Math.ceil(filteredConflicts.length / pageSize));
  const paginatedConflicts = filteredConflicts.slice((conflictPage - 1) * pageSize, conflictPage * pageSize);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      {/* ── Top Header ────────────────────────────────────────── */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-indigo-600 flex items-center justify-center text-white shadow-sm shadow-indigo-200">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-base font-bold text-slate-900 tracking-tight">Smart Roster Studio</h1>
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                    <span className="w-1.5 h-1.5 mr-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                    Live Engine
                  </span>
                </div>
                <p className="text-xs text-slate-500">Constraint-Based Coverage & Automated Scheduling</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="flex items-center bg-slate-100 p-1 rounded-lg border border-slate-200 text-xs font-medium">
                <span className="px-3 py-1 bg-white text-slate-900 rounded-md shadow-xs border border-slate-200/60 font-semibold">
                  Roster Matrix
                </span>
                <a
                  href="/manage"
                  className="px-3 py-1 text-slate-600 hover:text-slate-900 rounded-md hover:bg-slate-200/60 transition-colors"
                >
                  Manage Data
                </a>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* ── Control & Filter Card ─────────────────────────────── */}
        <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs p-4 sm:p-5">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-3">
              {/* Month Picker */}
              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Month</label>
                <div className="relative">
                  <input
                    type="month"
                    value={month}
                    onChange={(e) => setMonth(e.target.value)}
                    className="h-9 px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-sm text-slate-800 font-medium shadow-2xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  />
                </div>
              </div>

              {/* View Selector */}
              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Perspective</label>
                <select
                  value={view}
                  onChange={(e) => { setView(e.target.value); setFilterId(''); }}
                  className="h-9 px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-sm text-slate-800 font-medium shadow-2xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                >
                  <option value="company">All Company ({employees.length} Staff)</option>
                  <option value="pod">By Pod</option>
                  <option value="brand">By Brand</option>
                  <option value="process">By Process</option>
                  <option value="employee">By Individual Employee</option>
                </select>
              </div>

              {/* Dynamic Filter Dropdown */}
              {view !== 'company' && (
                <div className="flex flex-col gap-1 animate-in fade-in duration-200">
                  <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Filter Target</label>
                  <select
                    value={filterId}
                    onChange={(e) => setFilterId(e.target.value)}
                    className="h-9 px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-sm text-slate-800 font-medium shadow-2xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 min-w-[180px]"
                  >
                    <option value="">Select target...</option>
                    {getFilterOptions().map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {/* Action Button */}
            <div className="flex items-center gap-3">
              <button
                onClick={handleGenerate}
                disabled={generating}
                className="inline-flex items-center justify-center gap-2 h-10 px-5 rounded-lg bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white text-sm font-semibold shadow-sm shadow-indigo-200 transition-all disabled:opacity-50 disabled:pointer-events-none"
              >
                {generating ? (
                  <>
                    <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
                    </svg>
                    <span>Generating Roster...</span>
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4 text-indigo-200" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                    </svg>
                    <span>Generate Roster</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Quick Metrics (Only shown if roster generated) */}
          {entries.length > 0 && (
            <div className="mt-4 pt-4 border-t border-slate-100 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="bg-slate-50 rounded-lg p-2.5 border border-slate-200/60">
                <span className="text-slate-500 block text-[11px]">Employees Scheduled</span>
                <span className="text-slate-800 font-bold text-sm">{employees.length} resources</span>
              </div>
              <div className="bg-slate-50 rounded-lg p-2.5 border border-slate-200/60">
                <span className="text-slate-500 block text-[11px]">Processes Tracked</span>
                <span className="text-slate-800 font-bold text-sm">{processes.length} operational lines</span>
              </div>
              <div className={`rounded-lg p-2.5 border ${errors.length > 0 ? 'bg-rose-50 border-rose-200 text-rose-800' : 'bg-emerald-50 border-emerald-200 text-emerald-800'}`}>
                <span className="block text-[11px] opacity-80">Blocking Errors</span>
                <span className="font-bold text-sm">{errors.length} to resolve</span>
              </div>
              <div className={`rounded-lg p-2.5 border ${warnings.length > 0 ? 'bg-amber-50 border-amber-200 text-amber-800' : 'bg-slate-50 border-slate-200 text-slate-800'}`}>
                <span className="block text-[11px] opacity-80">Pending Warnings</span>
                <span className="font-bold text-sm">{warnings.length} pending approval</span>
              </div>
            </div>
          )}
        </div>

        {/* ── Main Content Area ─────────────────────────────────── */}
        {loading ? (
          <div className="bg-white rounded-xl border border-slate-200 p-12 text-center shadow-xs">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-indigo-50 text-indigo-600 mb-3 animate-pulse">
              <svg className="w-6 h-6 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
              </svg>
            </div>
            <h3 className="text-sm font-semibold text-slate-800">Loading Roster State</h3>
            <p className="text-xs text-slate-500 mt-1">Retrieving employee schedules and constraint records...</p>
          </div>
        ) : entries.length === 0 ? (
          /* Empty State */
          <div className="bg-white rounded-xl border border-slate-200/80 p-12 text-center shadow-xs">
            <div className="w-16 h-16 rounded-2xl bg-indigo-50 border border-indigo-100 text-indigo-600 mx-auto flex items-center justify-center mb-4">
              <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <h2 className="text-base font-bold text-slate-900">No Roster Generated for {month}</h2>
            <p className="text-xs text-slate-500 max-w-md mx-auto mt-1 mb-5">
              Click below to calculate constraint-based coverage, weekly-offs, and process allocations for the team.
            </p>
            <button
              onClick={handleGenerate}
              disabled={generating}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold shadow-sm transition-all"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              <span>Generate Monthly Roster</span>
            </button>
          </div>
        ) : (
          /* Roster Grid Matrix */
          <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs overflow-hidden">
            <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-slate-800">Roster Schedule Matrix</h2>
                <span className="text-xs text-slate-400">({employees.length} employees • {daysInMonth} days)</span>
              </div>
              <div className="text-[11px] text-slate-500">
                Click any cell to modify status
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-200">
                    <th className="sticky left-0 z-20 bg-slate-50 px-4 py-3 text-left font-semibold text-slate-700 min-w-[190px] border-r border-slate-200">
                      Staff Member
                    </th>
                    {dates.map((d) => {
                      const day = new Date(d + 'T00:00:00Z');
                      const dow = day.getUTCDay();
                      const isWeekend = dow === 0 || dow === 6;
                      const dayName = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'][dow];
                      return (
                        <th
                          key={d}
                          className={`px-1 py-2 text-center font-medium min-w-[34px] border-r border-slate-100 ${
                            isWeekend ? 'bg-slate-100/70 text-rose-600' : 'text-slate-600'
                          }`}
                        >
                          <div className="text-[11px] font-bold">{day.getUTCDate()}</div>
                          <div className="text-[9px] font-medium uppercase opacity-75">{dayName}</div>
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {employees.map((emp) => {
                    const podName = emp.pods?.name ?? 'General';
                    const podPillClass = POD_COLORS[podName] ?? 'bg-slate-100 text-slate-600 border-slate-200';
                    return (
                      <tr key={emp.id} className="hover:bg-slate-50/60 transition-colors">
                        <td className="sticky left-0 z-10 bg-white px-4 py-2 border-r border-slate-200 font-medium text-slate-900 whitespace-nowrap shadow-xs">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-semibold text-slate-800 truncate">{emp.name}</span>
                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium border ${podPillClass}`}>
                              {podName}
                            </span>
                          </div>
                        </td>
                        {dates.map((d) => {
                          const entry = entryLookup.get(`${emp.id}|${d}`);
                          const status = entry?.status ?? 'WORKING';
                          const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.WORKING;
                          const isEditing = editCell?.empId === emp.id && editCell?.date === d;
                          return (
                            <td
                              key={d}
                              className="p-0.5 text-center border-r border-slate-100 relative"
                              title={`${emp.name} • ${d} • ${cfg.label}`}
                            >
                              {isEditing ? (
                                <select
                                  className="text-[10px] w-full h-7 rounded border border-indigo-400 bg-white shadow-xs focus:outline-none"
                                  defaultValue={status}
                                  onChange={(e) => handleCellEdit(emp.id, d, e.target.value)}
                                  onBlur={() => setEditCell(null)}
                                  autoFocus
                                >
                                  {Object.keys(STATUS_CONFIG).map((s) => (
                                    <option key={s} value={s}>{STATUS_CONFIG[s].short} - {STATUS_CONFIG[s].label}</option>
                                  ))}
                                </select>
                              ) : (
                                <button
                                  onClick={() => setEditCell({ empId: emp.id, date: d })}
                                  className={`w-full h-7 rounded text-[11px] transition-all border ${cfg.bg} ${cfg.text} ${cfg.border} flex items-center justify-center`}
                                >
                                  {cfg.short}
                                </button>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}

                  {/* Company Overall Coverage Row */}
                  {view === 'company' && (
                    <tr className="bg-slate-100/90 border-t-2 border-slate-300">
                      <td className="sticky left-0 z-10 bg-slate-100 px-4 py-2.5 border-r border-slate-200 text-xs font-bold text-slate-800 shadow-xs">
                        <div className="flex items-center justify-between gap-1">
                          <span className="truncate">Overall Coverage Health</span>
                          <span className="text-[10px] font-normal text-slate-500 whitespace-nowrap">{brands.length} Brands</span>
                        </div>
                      </td>
                      {dates.map((d) => {
                        const cov = getCompanyDailyCoverage(d);
                        return (
                          <td key={d} className="p-1 border-r border-slate-100 text-center">
                            <div
                              className={`w-3.5 h-3.5 mx-auto rounded-full transition-transform hover:scale-125 cursor-help ${
                                cov.status === 'green'
                                  ? 'bg-emerald-500 shadow-2xs shadow-emerald-200'
                                  : cov.status === 'red'
                                  ? 'bg-rose-500 shadow-2xs shadow-rose-200 animate-pulse'
                                  : 'bg-amber-400 shadow-2xs shadow-amber-200'
                              }`}
                              title={`${d}: ${cov.detail}`}
                            />
                          </td>
                        );
                      })}
                    </tr>
                  )}

                  {/* Coverage Row per process (when filtered by brand or process) */}
                  {(view === 'brand' || view === 'process') && filterId && (
                    <>
                      <tr className="bg-slate-100/90 border-t-2 border-slate-300">
                        <td
                          colSpan={dates.length + 1}
                          className="px-4 py-2 text-[11px] font-bold text-slate-700 uppercase tracking-wider sticky left-0 z-10"
                        >
                          Process Coverage Verification Status
                        </td>
                      </tr>
                      {processes
                        .filter((p) => view === 'process' ? p.id === filterId : p.brand_id === filterId)
                        .map((proc) => (
                          <tr key={`cov-${proc.id}`} className="bg-slate-50/40">
                            <td className="sticky left-0 z-10 bg-slate-50 px-4 py-2 border-r border-slate-200 text-xs font-semibold text-slate-700">
                              <div className="flex items-center gap-1.5">
                                <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
                                <span>{proc.name}</span>
                                <span className="text-[10px] font-normal text-slate-400">({proc.brands?.name})</span>
                              </div>
                            </td>
                            {dates.map((d) => {
                              const cov = getCoverageStatus(proc, d);
                              return (
                                <td key={d} className="p-1 border-r border-slate-100 text-center">
                                  {cov === 'off' ? (
                                    <div
                                      className="w-4 h-4 mx-auto flex items-center justify-center text-slate-300 font-mono text-xs select-none"
                                      title="Operating Holiday / Off Day (No coverage required)"
                                    >
                                      —
                                    </div>
                                  ) : (
                                    <div
                                      className={`w-3.5 h-3.5 mx-auto rounded-full transition-transform hover:scale-125 cursor-help ${
                                        cov === 'green'
                                          ? 'bg-emerald-500 shadow-2xs shadow-emerald-200'
                                          : cov === 'red'
                                          ? 'bg-rose-500 shadow-2xs shadow-rose-200 animate-pulse'
                                          : 'bg-amber-400 shadow-2xs shadow-amber-200'
                                      }`}
                                      title={`${proc.name} on ${d}: ${cov.toUpperCase()}`}
                                    />
                                  )}
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                    </>
                  )}
                </tbody>
              </table>
            </div>

            {/* Bottom Status Legend */}
            <div className="px-5 py-3 border-t border-slate-100 bg-slate-50/50 flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[11px] font-semibold text-slate-500 uppercase mr-1">Legend:</span>
                {Object.entries(STATUS_CONFIG).map(([k, cfg]) => (
                  <span key={k} className={`px-2 py-0.5 rounded text-[11px] border ${cfg.bg} ${cfg.text} ${cfg.border}`}>
                    <strong className="mr-1">{cfg.short}</strong> = {cfg.label}
                  </span>
                ))}
              </div>

              <div className="flex items-center gap-3 text-[11px] text-slate-600">
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500"></span> Covered</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-400"></span> Backup Pending</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-rose-500"></span> Understaffed/No Coverage</span>
                {(view === 'brand' || view === 'process') && (
                  <span className="flex items-center gap-1 text-slate-400 font-mono text-[10px]">— Operating Holiday/Off</span>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── Conflicts & Issues Panel ──────────────────────────── */}
        {entries.length > 0 && conflicts.length > 0 && (
          <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/50">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2 flex-wrap">
                  <span>Engine Conflicts & Alerts</span>
                  {filterConflictsByView && view !== 'company' && filterId && (
                    <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-indigo-100 text-indigo-800 border border-indigo-200">
                      Scoped to {activeFilterLabel}
                    </span>
                  )}
                  <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-rose-100 text-rose-700">
                    {errors.length} Errors
                  </span>
                  {warnings.length > 0 && (
                    <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-700">
                      {warnings.length} Warnings
                    </span>
                  )}
                </h3>
                <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-500 flex-wrap">
                  <span>Errors block final schedule release. Warnings notify pending approvals.</span>
                  {view !== 'company' && filterId && (
                    <button
                      onClick={() => setFilterConflictsByView(!filterConflictsByView)}
                      className="text-indigo-600 hover:text-indigo-800 font-semibold underline transition-colors ml-1"
                    >
                      {filterConflictsByView ? `View all company alerts (${conflicts.length})` : `Filter to ${activeFilterLabel}`}
                    </button>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                {warnings.length > 0 && (
                  <button
                    onClick={handleApproveAllPending}
                    disabled={approvingAll || loading}
                    className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors disabled:opacity-50"
                  >
                    {approvingAll ? (
                      <>
                        <svg className="animate-spin h-3.5 w-3.5 text-white" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
                        </svg>
                        <span>Approving...</span>
                      </>
                    ) : (
                      <>
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        <span>Approve All Pending</span>
                      </>
                    )}
                  </button>
                )}

                {/* Conflict Filter Tabs */}
                <div className="flex items-center bg-slate-200/60 p-0.5 rounded-lg text-xs font-medium">
                  <button
                    onClick={() => { setConflictTab('all'); setConflictPage(1); }}
                    className={`px-3 py-1 rounded-md transition-all ${conflictTab === 'all' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
                  >
                    All ({viewScopedConflicts.length})
                  </button>
                  <button
                    onClick={() => { setConflictTab('errors'); setConflictPage(1); }}
                    className={`px-3 py-1 rounded-md transition-all ${conflictTab === 'errors' ? 'bg-white text-rose-700 shadow-xs font-semibold' : 'text-slate-600 hover:text-slate-900'}`}
                  >
                    Errors ({errors.length})
                  </button>
                  <button
                    onClick={() => { setConflictTab('warnings'); setConflictPage(1); }}
                    className={`px-3 py-1 rounded-md transition-all ${conflictTab === 'warnings' ? 'bg-white text-amber-700 shadow-xs font-semibold' : 'text-slate-600 hover:text-slate-900'}`}
                  >
                    Warnings ({warnings.length})
                  </button>
                </div>
              </div>
            </div>

            {/* List */}
            <div className="divide-y divide-slate-100 max-h-[380px] overflow-y-auto">
              {paginatedConflicts.length === 0 ? (
                <div className="text-center py-10 px-4 text-slate-400 text-xs flex flex-col items-center justify-center gap-2">
                  <div className="w-9 h-9 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-200">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <span className="font-bold text-slate-700 text-sm">No conflicts found for {activeFilterLabel}</span>
                  <span className="text-slate-400">All shifts, weekly-offs, and process coverage requirements are fully satisfied.</span>
                  {filterConflictsByView && view !== 'company' && filterId && (
                    <button
                      onClick={() => setFilterConflictsByView(false)}
                      className="mt-1 text-indigo-600 hover:text-indigo-800 font-semibold underline text-xs"
                    >
                      View all company alerts ({conflicts.length})
                    </button>
                  )}
                </div>
              ) : (
                paginatedConflicts.map((c, i) => {
                  const isError = c.severity === 'error';
                  return (
                    <div
                      key={i}
                      onClick={() => handleConflictClick(c)}
                      className="p-4 flex items-start justify-between gap-4 hover:bg-slate-50/80 transition-colors cursor-pointer group"
                    >
                    <div className="flex items-start gap-3">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${isError ? 'bg-rose-50 text-rose-600 border border-rose-200' : 'bg-amber-50 text-amber-600 border border-amber-200'}`}>
                        {isError ? (
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                          </svg>
                        ) : (
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        )}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase tracking-wider ${isError ? 'bg-rose-100 text-rose-800' : 'bg-amber-100 text-amber-800'}`}>
                            {c.code}
                          </span>
                          <span className="text-xs text-slate-400 font-mono">{c.date}</span>
                        </div>
                        <p className="text-xs text-slate-700 mt-1 font-medium">{c.message}</p>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="shrink-0">
                      {(c.code === 'NO_COVERAGE' || c.code === 'UNDERSTAFFED') && c.processId && (
                        <button
                          onClick={() => handleShowSuggestions(c)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-xs font-semibold shadow-2xs transition-colors"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                          </svg>
                          <span>Find Replacement</span>
                        </button>
                      )}
                      {c.code === 'BACKUP_PENDING' && c.processId && c.employeeId && (
                        <button
                          onClick={() =>
                            handleApprove(
                              { employeeId: c.employeeId!, name: '', samePod: false, monthlyWorkload: 0 },
                              c,
                            )
                          }
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 text-xs font-semibold shadow-2xs transition-colors"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                          <span>Approve Backup</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              }))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="px-5 py-3 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between text-xs text-slate-500">
                <span>
                  Showing {((conflictPage - 1) * pageSize) + 1} to {Math.min(conflictPage * pageSize, filteredConflicts.length)} of {filteredConflicts.length}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    disabled={conflictPage === 1}
                    onClick={() => setConflictPage((p) => Math.max(1, p - 1))}
                    className="px-2.5 py-1 bg-white border border-slate-200 rounded text-slate-700 hover:bg-slate-50 disabled:opacity-40"
                  >
                    Previous
                  </button>
                  <span className="font-semibold text-slate-700">Page {conflictPage} of {totalPages}</span>
                  <button
                    disabled={conflictPage === totalPages}
                    onClick={() => setConflictPage((p) => Math.min(totalPages, p + 1))}
                    className="px-2.5 py-1 bg-white border border-slate-200 rounded text-slate-700 hover:bg-slate-50 disabled:opacity-40"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Suggestions Modal ─────────────────────────────────── */}
        {suggestions && (
          <div
            className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-in fade-in duration-150"
            onClick={() => setSuggestions(null)}
          >
            <div
              className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-lg w-full overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/60">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Ranked Replacement Candidates</h3>
                  <p className="text-xs text-slate-500 mt-0.5">Filter: skills, availability & capacity • Rank: same pod → lowest workload</p>
                </div>
                <button
                  onClick={() => setSuggestions(null)}
                  className="w-7 h-7 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 flex items-center justify-center"
                >
                  ✕
                </button>
              </div>

              <div className="p-6">
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-800 mb-4">
                  <strong>Coverage Gap:</strong> {suggestions.conflict.message}
                </div>

                {suggestions.candidates.length === 0 ? (
                  <div className="text-center py-8 text-slate-400 text-xs">
                    No eligible replacement candidates found with available capacity and required skill assignment.
                  </div>
                ) : (
                  <div className="space-y-2.5 max-h-64 overflow-y-auto pr-1">
                    {suggestions.candidates.map((c, idx) => (
                      <div
                        key={c.employeeId}
                        className="flex items-center justify-between p-3.5 border border-slate-200 rounded-xl hover:border-indigo-300 hover:bg-indigo-50/30 transition-all"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 font-bold text-xs flex items-center justify-center">
                            #{idx + 1}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-slate-900">{c.name}</span>
                              {c.samePod && (
                                <span className="text-[10px] bg-indigo-100 text-indigo-700 font-semibold px-2 py-0.5 rounded-full border border-indigo-200">
                                  Same Pod
                                </span>
                              )}
                            </div>
                            <span className="text-[11px] text-slate-500">
                              Month Workload: <strong className="text-slate-700">{c.monthlyWorkload.toFixed(1)} shifts</strong>
                            </span>
                          </div>
                        </div>

                        <button
                          onClick={() => handleApprove(c, suggestions.conflict)}
                          className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors flex items-center gap-1.5"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                          <span>Approve & Slot</span>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="px-6 py-3 bg-slate-50 border-t border-slate-100 flex justify-end">
                <button
                  onClick={() => setSuggestions(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
