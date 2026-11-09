'use client';

import { useState, useEffect } from 'react';

type Tab = 'employees' | 'pods' | 'brands' | 'processes' | 'assignments' | 'holidays' | 'leaves';

export default function ManagePage() {
  const [tab, setTab] = useState<Tab>('employees');
  const [data, setData] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);

  // Dropdown data
  const [pods, setPods] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [brands, setBrands] = useState<any[]>([]);
  const [processes, setProcesses] = useState<any[]>([]);

  const loadLists = async () => {
    try {
      const [p, e, b, pr] = await Promise.all([
        fetch('/api/roster?month=2026-12&view=company').then((r) => r.json()),
        fetch('/api/employees').then((r) => r.json()),
        fetch('/api/brands').then((r) => r.json()),
        fetch('/api/processes').then((r) => r.json()),
      ]);
      const podMap = new Map<string, string>();
      (p.employees ?? []).forEach((emp: any) => {
        if (emp.pods) podMap.set(emp.pods.id, emp.pods.name);
      });
      setPods(Array.from(podMap, ([id, name]) => ({ id, name })));
      setEmployees(Array.isArray(e) ? e : []);
      setBrands(Array.isArray(b) ? b : []);
      setProcesses(Array.isArray(pr) ? pr : []);
    } catch {
      // ignore
    }
  };

  const loadTab = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/${tab}`);
      const d = await res.json();
      setData(Array.isArray(d) ? d : []);
    } catch {
      setData([]);
    }
    setLoading(false);
  };

  useEffect(() => { loadLists(); }, []);
  useEffect(() => { loadTab(); }, [tab]);

  // Form State
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<Record<string, any>>({});
  const [saving, setSaving] = useState(false);

  const handleAdd = async () => {
    setSaving(true);
    try {
      await fetch(`/api/${tab}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      setShowForm(false);
      setForm({});
      await loadTab();
      await loadLists();
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this record?')) return;
    await fetch(`/api/${tab}/${id}`, { method: 'DELETE' });
    loadTab();
    loadLists();
  };

  const tabLabels: Record<Tab, { name: string; countSuffix: string }> = {
    employees: { name: 'Staff Members', countSuffix: 'employees' },
    pods: { name: 'Pods & Leads', countSuffix: 'pods' },
    brands: { name: 'Brands', countSuffix: 'brands' },
    processes: { name: 'Processes & Calendars', countSuffix: 'processes' },
    assignments: { name: 'Staff Assignments', countSuffix: 'assignments' },
    holidays: { name: 'Holidays', countSuffix: 'holidays' },
    leaves: { name: 'Leaves & Comp-Offs', countSuffix: 'records' },
  };

  const tabs: Tab[] = ['employees', 'pods', 'brands', 'processes', 'assignments', 'holidays', 'leaves'];

  const filteredData = data.filter((row: any) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    const str = JSON.stringify(row).toLowerCase();
    return str.includes(q);
  });

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      {/* ── Top Header ────────────────────────────────────────── */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-indigo-600 flex items-center justify-center text-white shadow-sm shadow-indigo-200">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16m-7 6h7" />
                </svg>
              </div>
              <div>
                <h1 className="text-base font-bold text-slate-900 tracking-tight">Master Data Management</h1>
                <p className="text-xs text-slate-500">Configure Staff, Pods, Calendars, Assignments & Leaves</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="flex items-center bg-slate-100 p-1 rounded-lg border border-slate-200 text-xs font-medium">
                <a
                  href="/"
                  className="px-3 py-1 text-slate-600 hover:text-slate-900 rounded-md hover:bg-slate-200/60 transition-colors"
                >
                  ← Roster Matrix
                </a>
                <span className="px-3 py-1 bg-white text-slate-900 rounded-md shadow-xs border border-slate-200/60 font-semibold">
                  Manage Data
                </span>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* ── Tabs Navigation ───────────────────────────────────── */}
        <div className="flex flex-wrap items-center gap-1.5 bg-white p-1.5 rounded-xl border border-slate-200 shadow-xs">
          {tabs.map((t) => {
            const isActive = tab === t;
            return (
              <button
                key={t}
                onClick={() => { setTab(t); setShowForm(false); }}
                className={`px-3.5 py-2 rounded-lg text-xs font-semibold transition-all ${
                  isActive
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                {tabLabels[t].name}
              </button>
            );
          })}
        </div>

        {/* ── Subheader Card ────────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-bold text-slate-800">{tabLabels[tab].name}</h2>
            <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-600 border border-slate-200">
              {filteredData.length} of {data.length} {tabLabels[tab].countSuffix}
            </span>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative">
              <input
                type="text"
                placeholder={`Search ${tab}...`}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-8.5 px-3 pl-8 bg-white border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 w-48 sm:w-60 shadow-2xs"
              />
              <svg className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>

            {tab !== 'pods' && (
              <button
                onClick={() => { setShowForm(!showForm); setForm({}); }}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-xs transition-colors shrink-0"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                <span>{showForm ? 'Close Form' : `Add ${tab.slice(0, -1)}`}</span>
              </button>
            )}
          </div>
        </div>

        {/* ── Add Form Card ─────────────────────────────────────── */}
        {showForm && (
          <div className="bg-white rounded-xl border border-indigo-200 shadow-sm p-5 space-y-4 animate-in fade-in duration-150">
            <div className="border-b border-slate-100 pb-2">
              <h3 className="text-xs font-bold text-indigo-900 uppercase tracking-wider">New {tab.slice(0, -1)} entry</h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
              {tab === 'employees' && (
                <>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-500 mb-1">Full Name</label>
                    <input
                      placeholder="e.g. John Doe"
                      className="w-full h-9 px-3 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-500 mb-1">Pod Assignment</label>
                    <select
                      className="w-full h-9 px-3 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                      onChange={(e) => setForm({ ...form, pod_id: e.target.value })}
                    >
                      <option value="">Select Pod...</option>
                      {pods.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-500 mb-1">Daily Capacity</label>
                    <input
                      type="number"
                      step="0.1"
                      defaultValue={1.0}
                      className="w-full h-9 px-3 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                      onChange={(e) => setForm({ ...form, daily_capacity: parseFloat(e.target.value) || 1.0 })}
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-500 mb-1">Preferred Weekly Off</label>
                    <select
                      className="w-full h-9 px-3 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                      onChange={(e) => setForm({ ...form, preferred_off_day: e.target.value === '' ? null : parseInt(e.target.value) })}
                    >
                      <option value="">No Preference</option>
                      {['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map((d, i) => (
                        <option key={i} value={i}>{d}</option>
                      ))}
                    </select>
                  </div>
                </>
              )}

              {tab === 'brands' && (
                <div className="sm:col-span-2">
                  <label className="block text-[11px] font-semibold text-slate-500 mb-1">Brand Name</label>
                  <input
                    placeholder="e.g. Brand Omega"
                    className="w-full h-9 px-3 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                  />
                </div>
              )}

              {tab === 'processes' && (
                <>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-500 mb-1">Owning Brand</label>
                    <select
                      className="w-full h-9 px-3 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                      onChange={(e) => setForm({ ...form, brand_id: e.target.value })}
                    >
                      <option value="">Select Brand...</option>
                      {brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-500 mb-1">Process Name</label>
                    <input
                      placeholder="e.g. Customer Support"
                      className="w-full h-9 px-3 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-500 mb-1">Calendar Rule</label>
                    <select
                      className="w-full h-9 px-3 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                      onChange={(e) => setForm({ ...form, calendar_rule: e.target.value })}
                    >
                      <option value="">Select Rule...</option>
                      <option value="ALL_DAYS_365">ALL_DAYS_365 (Never Closes)</option>
                      <option value="ALL_EXCEPT_HOLIDAYS">ALL_EXCEPT_HOLIDAYS</option>
                      <option value="EXCEPT_SUNDAYS_AND_HOLIDAYS">EXCEPT_SUNDAYS_AND_HOLIDAYS</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-500 mb-1">Min Staff Required</label>
                    <input
                      type="number"
                      defaultValue={1}
                      className="w-full h-9 px-3 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                      onChange={(e) => setForm({ ...form, min_staff: parseInt(e.target.value) || 1 })}
                    />
                  </div>
                </>
              )}

              {tab === 'assignments' && (
                <>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-500 mb-1">Employee</label>
                    <select
                      className="w-full h-9 px-3 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                      onChange={(e) => setForm({ ...form, employee_id: e.target.value })}
                    >
                      <option value="">Select Staff...</option>
                      {employees.map((emp) => <option key={emp.id} value={emp.id}>{emp.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-500 mb-1">Process</label>
                    <select
                      className="w-full h-9 px-3 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                      onChange={(e) => setForm({ ...form, process_id: e.target.value })}
                    >
                      <option value="">Select Process...</option>
                      {processes.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.brands?.name ?? ''})</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-500 mb-1">Role Designation</label>
                    <select
                      className="w-full h-9 px-3 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                      onChange={(e) => setForm({ ...form, role: e.target.value })}
                    >
                      <option value="PRIMARY">PRIMARY</option>
                      <option value="BACKUP">BACKUP</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-500 mb-1">Workload Weight (0-1.0)</label>
                    <input
                      type="number"
                      step="0.1"
                      defaultValue={1.0}
                      className="w-full h-9 px-3 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                      onChange={(e) => setForm({ ...form, weight: parseFloat(e.target.value) || 1.0 })}
                    />
                  </div>
                </>
              )}

              {tab === 'holidays' && (
                <>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-500 mb-1">Date</label>
                    <input
                      type="date"
                      className="w-full h-9 px-3 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                      onChange={(e) => setForm({ ...form, date: e.target.value })}
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-[11px] font-semibold text-slate-500 mb-1">Holiday Title</label>
                    <input
                      placeholder="e.g. Christmas Day"
                      className="w-full h-9 px-3 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                    />
                  </div>
                  <div className="flex items-center pt-5">
                    <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
                      <input
                        type="checkbox"
                        defaultChecked
                        className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                        onChange={(e) => setForm({ ...form, applies_to_all: e.target.checked })}
                      />
                      Applies to All Pods
                    </label>
                  </div>
                </>
              )}

              {tab === 'leaves' && (
                <>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-500 mb-1">Employee</label>
                    <select
                      className="w-full h-9 px-3 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                      onChange={(e) => setForm({ ...form, employee_id: e.target.value })}
                    >
                      <option value="">Select Employee...</option>
                      {employees.map((emp) => <option key={emp.id} value={emp.id}>{emp.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-500 mb-1">Date</label>
                    <input
                      type="date"
                      className="w-full h-9 px-3 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                      onChange={(e) => setForm({ ...form, date: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-500 mb-1">Leave Type</label>
                    <select
                      className="w-full h-9 px-3 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                      onChange={(e) => setForm({ ...form, type: e.target.value })}
                    >
                      <option value="LEAVE">LEAVE (Standard)</option>
                      <option value="COMP_OFF">COMP_OFF (Earned)</option>
                    </select>
                  </div>
                </>
              )}
            </div>

            <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
              <button
                onClick={handleAdd}
                disabled={saving}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Save Record'}
              </button>
              <button
                onClick={() => setShowForm(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* ── Table Card ────────────────────────────────────────── */}
        <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs overflow-hidden">
          {loading ? (
            <div className="text-center py-12 text-slate-400 text-xs">Loading records...</div>
          ) : data.length === 0 ? (
            <div className="text-center py-12 text-slate-400 text-xs">No records found.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left divide-y divide-slate-100">
                <thead className="bg-slate-50/80 border-b border-slate-200 text-slate-600 uppercase font-semibold text-[10px] tracking-wider">
                  <tr>
                    {tab === 'employees' && (
                      <>
                        <th className="px-5 py-3">Full Name</th>
                        <th className="px-5 py-3">Pod Assignment</th>
                        <th className="px-5 py-3">Daily Capacity</th>
                        <th className="px-5 py-3">Preferred Off</th>
                        <th className="px-5 py-3 text-right">Actions</th>
                      </>
                    )}
                    {tab === 'pods' && (
                      <>
                        <th className="px-5 py-3">Pod Name</th>
                        <th className="px-5 py-3">Designated Lead Employee</th>
                      </>
                    )}
                    {tab === 'brands' && (
                      <>
                        <th className="px-5 py-3">Brand Name</th>
                        <th className="px-5 py-3 text-right">Actions</th>
                      </>
                    )}
                    {tab === 'processes' && (
                      <>
                        <th className="px-5 py-3">Process Name</th>
                        <th className="px-5 py-3">Brand</th>
                        <th className="px-5 py-3">Calendar Coverage Rule</th>
                        <th className="px-5 py-3">Min Staff</th>
                        <th className="px-5 py-3 text-right">Actions</th>
                      </>
                    )}
                    {tab === 'assignments' && (
                      <>
                        <th className="px-5 py-3">Employee</th>
                        <th className="px-5 py-3">Process</th>
                        <th className="px-5 py-3">Brand</th>
                        <th className="px-5 py-3">Role</th>
                        <th className="px-5 py-3">Weight</th>
                        <th className="px-5 py-3 text-right">Actions</th>
                      </>
                    )}
                    {tab === 'holidays' && (
                      <>
                        <th className="px-5 py-3">Date</th>
                        <th className="px-5 py-3">Holiday Name</th>
                        <th className="px-5 py-3">Applicability</th>
                        <th className="px-5 py-3 text-right">Actions</th>
                      </>
                    )}
                    {tab === 'leaves' && (
                      <>
                        <th className="px-5 py-3">Employee</th>
                        <th className="px-5 py-3">Date</th>
                        <th className="px-5 py-3">Type</th>
                        <th className="px-5 py-3 text-right">Actions</th>
                      </>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredData.map((row: any) => (
                    <tr key={row.id} className="hover:bg-slate-50/60 transition-colors">
                      {tab === 'employees' && (
                        <>
                          <td className="px-5 py-3 font-semibold text-slate-800">{row.name}</td>
                          <td className="px-5 py-3 text-slate-600">
                            <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-slate-100 border border-slate-200">
                              {row.pods?.name ?? '—'}
                            </span>
                          </td>
                          <td className="px-5 py-3 font-mono text-slate-700">{row.daily_capacity}</td>
                          <td className="px-5 py-3 text-slate-600">
                            {row.preferred_off_day !== null ? ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][row.preferred_off_day] : '—'}
                          </td>
                          <td className="px-5 py-3 text-right">
                            <button onClick={() => handleDelete(row.id)} className="text-rose-600 hover:text-rose-800 font-semibold text-[11px]">Delete</button>
                          </td>
                        </>
                      )}
                      {tab === 'pods' && (
                        <>
                          <td className="px-5 py-3 font-semibold text-slate-800">Pod {row.name}</td>
                          <td className="px-5 py-3 text-slate-700 font-medium">
                            {employees.find((e) => e.id === row.lead_employee_id)?.name ?? '—'}
                          </td>
                        </>
                      )}
                      {tab === 'brands' && (
                        <>
                          <td className="px-5 py-3 font-semibold text-slate-800">{row.name}</td>
                          <td className="px-5 py-3 text-right">
                            <button onClick={() => handleDelete(row.id)} className="text-rose-600 hover:text-rose-800 font-semibold text-[11px]">Delete</button>
                          </td>
                        </>
                      )}
                      {tab === 'processes' && (
                        <>
                          <td className="px-5 py-3 font-semibold text-slate-800">{row.name}</td>
                          <td className="px-5 py-3 text-slate-600 font-medium">{row.brands?.name ?? '—'}</td>
                          <td className="px-5 py-3 font-mono text-[11px] text-indigo-700 font-medium">{row.calendar_rule}</td>
                          <td className="px-5 py-3 text-slate-800 font-semibold">{row.min_staff}</td>
                          <td className="px-5 py-3 text-right">
                            <button onClick={() => handleDelete(row.id)} className="text-rose-600 hover:text-rose-800 font-semibold text-[11px]">Delete</button>
                          </td>
                        </>
                      )}
                      {tab === 'assignments' && (
                        <>
                          <td className="px-5 py-3 font-semibold text-slate-800">{row.employees?.name ?? row.employee_id}</td>
                          <td className="px-5 py-3 font-medium text-slate-700">{row.processes?.name ?? row.process_id}</td>
                          <td className="px-5 py-3 text-slate-500">{row.processes?.brands?.name ?? '—'}</td>
                          <td className="px-5 py-3">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${row.role === 'PRIMARY' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200'}`}>
                              {row.role}
                            </span>
                          </td>
                          <td className="px-5 py-3 font-mono text-slate-700">{row.weight}</td>
                          <td className="px-5 py-3 text-right">
                            <button onClick={() => handleDelete(row.id)} className="text-rose-600 hover:text-rose-800 font-semibold text-[11px]">Delete</button>
                          </td>
                        </>
                      )}
                      {tab === 'holidays' && (
                        <>
                          <td className="px-5 py-3 font-mono text-slate-700 font-semibold">{row.date}</td>
                          <td className="px-5 py-3 font-medium text-slate-800">{row.name}</td>
                          <td className="px-5 py-3">
                            <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium border ${row.applies_to_all ? 'bg-purple-50 text-purple-700 border-purple-200' : 'bg-blue-50 text-blue-700 border-blue-200'}`}>
                              {row.applies_to_all ? 'All Pods' : 'Specific Pods'}
                            </span>
                          </td>
                          <td className="px-5 py-3 text-right">
                            <button onClick={() => handleDelete(row.id)} className="text-rose-600 hover:text-rose-800 font-semibold text-[11px]">Delete</button>
                          </td>
                        </>
                      )}
                      {tab === 'leaves' && (
                        <>
                          <td className="px-5 py-3 font-semibold text-slate-800">{row.employees?.name ?? row.employee_id}</td>
                          <td className="px-5 py-3 font-mono text-slate-700 font-semibold">{row.date}</td>
                          <td className="px-5 py-3">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${row.type === 'LEAVE' ? 'bg-rose-50 text-rose-700 border-rose-200' : 'bg-amber-50 text-amber-700 border-amber-200'}`}>
                              {row.type}
                            </span>
                          </td>
                          <td className="px-5 py-3 text-right">
                            <button onClick={() => handleDelete(row.id)} className="text-rose-600 hover:text-rose-800 font-semibold text-[11px]">Delete</button>
                          </td>
                        </>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
