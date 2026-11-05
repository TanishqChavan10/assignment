'use client';

import { useState, useEffect, useCallback } from 'react';

// ── Types ─────────────────────────────────────────────────
interface RosterEntry { employee_id: string; date: string; status: string }
interface AllocRow { employee_id: string; process_id: string; date: string; approved: boolean }
interface EmpRow { id: string; name: string; pod_id: string; pods?: { id: string; name: string } }
interface ProcRow { id: string; brand_id: string; name: string; brands?: { id: string; name: string } }
interface BrandRow { id: string; name: string }
interface AssignRow { employee_id: string; process_id: string; role: string; weight: number }
interface Conflict { code: string; severity: string; date: string; processId?: string; brandId?: string; employeeId?: string; message: string }
interface Candidate { employeeId: string; name: string; samePod: boolean; monthlyWorkload: number }

const STATUS_COLORS: Record<string, string> = {
  WORKING: 'bg-green-100 text-green-800',
  WEEKLY_OFF: 'bg-blue-100 text-blue-800',
  HOLIDAY: 'bg-purple-100 text-purple-800',
  LEAVE: 'bg-red-100 text-red-800',
  COMP_OFF: 'bg-orange-100 text-orange-800',
};

const STATUS_SHORT: Record<string, string> = {
  WORKING: 'W',
  WEEKLY_OFF: 'WO',
  HOLIDAY: 'H',
  LEAVE: 'L',
  COMP_OFF: 'CO',
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
  const [conflicts, setConflicts] = useState<Conflict[]>([]);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [editCell, setEditCell] = useState<{ empId: string; date: string } | null>(null);
  const [suggestions, setSuggestions] = useState<{ conflict: Conflict; candidates: Candidate[] } | null>(null);
  const [pods, setPods] = useState<{ id: string; name: string }[]>([]);

  // Load roster data
  const loadRoster = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ month, view });
      if (filterId) params.set('id', filterId);
      const res = await fetch(`/api/roster?${params}`);
      const data = await res.json();
      setEmployees(data.employees ?? []);
      setEntries(data.entries ?? []);
      setAllocations(data.allocations ?? []);
      setProcesses(data.processes ?? []);
      setBrands(data.brands ?? []);
      setAssignments(data.assignments ?? []);

      // Extract unique pods
      const podMap = new Map<string, string>();
      (data.employees ?? []).forEach((e: EmpRow) => {
        if (e.pods) podMap.set(e.pods.id, e.pods.name);
      });
      setPods(Array.from(podMap, ([id, name]) => ({ id, name })));

      // Validate
      const valRes = await fetch('/api/roster/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ month }),
      });
      const valData = await valRes.json();
      setConflicts(valData.conflicts ?? []);
    } catch {
      // silently handle
    }
    setLoading(false);
  }, [month, view, filterId]);

  useEffect(() => { loadRoster(); }, [loadRoster]);

  // Generate roster
  const handleGenerate = async () => {
    setGenerating(true);
    const res = await fetch(`/api/roster/generate?month=${month}`, { method: 'POST' });
    const data = await res.json();
    setConflicts(data.conflicts ?? []);
    setGenerating(false);
    await loadRoster();
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

  // Approve allocation
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

  // Build dates array for grid columns
  const [year, m] = month.split('-').map(Number);
  const daysInMonth = new Date(Date.UTC(year, m, 0)).getUTCDate();
  const dates = Array.from({ length: daysInMonth }, (_, i) => {
    const d = i + 1;
    return `${year}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  });

  // Get entry for employee+date
  const getEntry = (empId: string, date: string) =>
    entries.find((e) => e.employee_id === empId && e.date === date);

  // Coverage check per process per date
  const getCoverageStatus = (procId: string, date: string): 'green' | 'red' | 'amber' => {
    const procAllocs = allocations.filter((a) => a.process_id === procId && a.date === date);
    const approved = procAllocs.filter((a) => a.approved);
    const pending = procAllocs.filter((a) => !a.approved);
    if (approved.length === 0 && pending.length === 0) return 'red';
    if (pending.length > 0 && approved.length === 0) return 'amber';
    return 'green';
  };

  // Filter options based on view
  const getFilterOptions = () => {
    switch (view) {
      case 'pod': return pods.map((p) => ({ value: p.id, label: p.name }));
      case 'brand': return brands.map((b) => ({ value: b.id, label: b.name }));
      case 'process': return processes.map((p) => ({ value: p.id, label: `${p.name} (${p.brands?.name ?? ''})` }));
      case 'employee': return employees.map((e) => ({ value: e.id, label: e.name }));
      default: return [];
    }
  };

  const errors = conflicts.filter((c) => c.severity === 'error');
  const warnings = conflicts.filter((c) => c.severity === 'warning');

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b px-6 py-4">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-gray-900">Smart Roster Management</h1>
          <a href="/manage" className="px-4 py-2 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 text-sm">
            Manage Data
          </a>
        </div>
      </header>

      <main className="p-6 space-y-4">
        {/* Controls */}
        <div className="flex flex-wrap items-end gap-4 bg-white p-4 rounded-lg shadow-sm">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Month</label>
            <input
              type="month"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              className="border rounded px-3 py-1.5 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">View</label>
            <select
              value={view}
              onChange={(e) => { setView(e.target.value); setFilterId(''); }}
              className="border rounded px-3 py-1.5 text-sm"
            >
              <option value="company">Company</option>
              <option value="pod">Pod</option>
              <option value="brand">Brand</option>
              <option value="process">Process</option>
              <option value="employee">Employee</option>
            </select>
          </div>
          {view !== 'company' && (
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Filter</label>
              <select
                value={filterId}
                onChange={(e) => setFilterId(e.target.value)}
                className="border rounded px-3 py-1.5 text-sm"
              >
                <option value="">All</option>
                {getFilterOptions().map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
          )}
          <button
            onClick={handleGenerate}
            disabled={generating}
            className="px-4 py-1.5 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 disabled:opacity-50"
          >
            {generating ? 'Generating…' : 'Generate Roster'}
          </button>
        </div>

        {/* Roster Grid */}
        {loading ? (
          <div className="text-center py-12 text-gray-500">Loading…</div>
        ) : entries.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            No roster data. Click &quot;Generate Roster&quot; to create one.
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow-sm overflow-x-auto">
            <table className="text-xs border-collapse w-full">
              <thead>
                <tr className="bg-gray-50">
                  <th className="sticky left-0 bg-gray-50 px-3 py-2 text-left font-medium text-gray-600 border-b min-w-[140px] z-10">
                    Employee
                  </th>
                  {dates.map((d) => {
                    const day = new Date(d + 'T00:00:00Z');
                    const dow = day.getUTCDay();
                    const isSun = dow === 0;
                    return (
                      <th
                        key={d}
                        className={`px-1 py-2 text-center font-medium border-b min-w-[32px] ${isSun ? 'bg-gray-100 text-red-600' : 'text-gray-600'}`}
                      >
                        <div>{day.getUTCDate()}</div>
                        <div className="text-[10px]">{['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'][dow]}</div>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {employees.map((emp) => (
                  <tr key={emp.id} className="hover:bg-gray-50/50">
                    <td className="sticky left-0 bg-white px-3 py-1 border-b font-medium text-gray-800 z-10 whitespace-nowrap">
                      {emp.name}
                      <span className="text-[10px] text-gray-400 ml-1">{emp.pods?.name}</span>
                    </td>
                    {dates.map((d) => {
                      const entry = getEntry(emp.id, d);
                      const status = entry?.status ?? '';
                      const isEditing = editCell?.empId === emp.id && editCell?.date === d;
                      return (
                        <td
                          key={d}
                          className={`px-0.5 py-1 border-b text-center cursor-pointer ${STATUS_COLORS[status] ?? 'bg-gray-50 text-gray-300'}`}
                          onClick={() => setEditCell({ empId: emp.id, date: d })}
                          title={`${emp.name} | ${d} | ${status}`}
                        >
                          {isEditing ? (
                            <select
                              className="text-[10px] w-full"
                              defaultValue={status}
                              onChange={(e) => handleCellEdit(emp.id, d, e.target.value)}
                              onBlur={() => setEditCell(null)}
                              autoFocus
                            >
                              {['WORKING', 'WEEKLY_OFF', 'HOLIDAY', 'LEAVE', 'COMP_OFF'].map((s) => (
                                <option key={s} value={s}>{STATUS_SHORT[s]}</option>
                              ))}
                            </select>
                          ) : (
                            <span className="text-[11px] font-medium">{STATUS_SHORT[status] ?? '—'}</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}

                {/* Coverage rows per process (when filtered by brand/process) */}
                {(view === 'brand' || view === 'process') && filterId && (
                  <>
                    <tr><td colSpan={dates.length + 1} className="bg-gray-200 px-3 py-1 text-[10px] font-bold text-gray-500 uppercase">Coverage</td></tr>
                    {processes
                      .filter((p) => view === 'process' ? p.id === filterId : p.brand_id === filterId)
                      .map((proc) => (
                        <tr key={`cov-${proc.id}`}>
                          <td className="sticky left-0 bg-white px-3 py-1 border-b text-[11px] font-medium text-gray-600 z-10">
                            {proc.name} <span className="text-gray-400">({proc.brands?.name})</span>
                          </td>
                          {dates.map((d) => {
                            const cov = getCoverageStatus(proc.id, d);
                            const bg = cov === 'green' ? 'bg-green-400' : cov === 'red' ? 'bg-red-400' : 'bg-amber-400';
                            return (
                              <td key={d} className="px-0.5 py-1 border-b">
                                <div className={`w-4 h-4 mx-auto rounded-sm ${bg}`} />
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
        )}

        {/* Conflicts Panel */}
        {conflicts.length > 0 && (
          <div className="bg-white rounded-lg shadow-sm p-4 space-y-3">
            <h2 className="font-bold text-gray-800">
              Conflicts
              <span className="ml-2 text-sm font-normal text-gray-500">
                {errors.length} errors, {warnings.length} warnings
              </span>
            </h2>

            {errors.length > 0 && (
              <div className="space-y-1">
                <h3 className="text-xs font-semibold text-red-600 uppercase">Errors (block publish)</h3>
                {errors.map((c, i) => (
                  <div key={i} className="flex items-start gap-2 text-sm p-2 bg-red-50 rounded">
                    <span className="text-red-500 font-mono text-xs mt-0.5">{c.code}</span>
                    <span className="text-gray-700 flex-1">{c.message}</span>
                    {(c.code === 'NO_COVERAGE' || c.code === 'UNDERSTAFFED') && c.processId && (
                      <button
                        onClick={() => handleShowSuggestions(c)}
                        className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded hover:bg-blue-200 whitespace-nowrap"
                      >
                        Suggest
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}

            {warnings.length > 0 && (
              <div className="space-y-1">
                <h3 className="text-xs font-semibold text-amber-600 uppercase">Warnings</h3>
                {warnings.map((c, i) => (
                  <div key={i} className="flex items-start gap-2 text-sm p-2 bg-amber-50 rounded">
                    <span className="text-amber-500 font-mono text-xs mt-0.5">{c.code}</span>
                    <span className="text-gray-700 flex-1">{c.message}</span>
                    {c.code === 'BACKUP_PENDING' && c.processId && c.employeeId && (
                      <button
                        onClick={() =>
                          handleApprove(
                            { employeeId: c.employeeId!, name: '', samePod: false, monthlyWorkload: 0 },
                            c,
                          )
                        }
                        className="text-xs px-2 py-0.5 bg-green-100 text-green-700 rounded hover:bg-green-200 whitespace-nowrap"
                      >
                        Approve
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Suggestions Modal */}
        {suggestions && (
          <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={() => setSuggestions(null)}>
            <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4" onClick={(e) => e.stopPropagation()}>
              <h3 className="font-bold text-gray-800 mb-1">Replacement Suggestions</h3>
              <p className="text-sm text-gray-500 mb-4">{suggestions.conflict.message}</p>

              {suggestions.candidates.length === 0 ? (
                <p className="text-sm text-gray-400">No eligible candidates found.</p>
              ) : (
                <div className="space-y-2">
                  {suggestions.candidates.map((c) => (
                    <div key={c.employeeId} className="flex items-center justify-between p-3 border rounded">
                      <div>
                        <span className="font-medium text-gray-800">{c.name}</span>
                        {c.samePod && <span className="ml-2 text-[10px] bg-blue-100 text-blue-600 px-1 rounded">Same Pod</span>}
                        <span className="ml-2 text-xs text-gray-400">Workload: {c.monthlyWorkload.toFixed(1)}</span>
                      </div>
                      <button
                        onClick={() => handleApprove(c, suggestions.conflict)}
                        className="text-xs px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700"
                      >
                        Approve
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <button
                onClick={() => setSuggestions(null)}
                className="mt-4 text-sm text-gray-500 hover:text-gray-700"
              >
                Close
              </button>
            </div>
          </div>
        )}

        {/* Legend */}
        <div className="flex flex-wrap gap-3 text-xs text-gray-500">
          {Object.entries(STATUS_COLORS).map(([status, cls]) => (
            <span key={status} className={`px-2 py-0.5 rounded ${cls}`}>
              {STATUS_SHORT[status]} = {status.replace('_', ' ')}
            </span>
          ))}
        </div>
      </main>
    </div>
  );
}
