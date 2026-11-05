'use client';

import { useState, useEffect } from 'react';

type Tab = 'employees' | 'pods' | 'brands' | 'processes' | 'assignments' | 'holidays' | 'leaves';

export default function ManagePage() {
  const [tab, setTab] = useState<Tab>('employees');
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // Lists for dropdowns
  const [pods, setPods] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [brands, setBrands] = useState<any[]>([]);
  const [processes, setProcesses] = useState<any[]>([]);

  const loadLists = async () => {
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
    setEmployees(e ?? []);
    setBrands(b ?? []);
    setProcesses(pr ?? []);
  };

  const loadTab = async () => {
    setLoading(true);
    const res = await fetch(`/api/${tab}`);
    const d = await res.json();
    setData(Array.isArray(d) ? d : []);
    setLoading(false);
  };

  useEffect(() => { loadLists(); }, []);
  useEffect(() => { loadTab(); }, [tab]);

  // ── Forms ──────────────────────────────────────────────
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<Record<string, any>>({});

  const handleAdd = async () => {
    let body = form;
    await fetch(`/api/${tab}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    setShowForm(false);
    setForm({});
    loadTab();
    loadLists();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this record?')) return;
    await fetch(`/api/${tab}/${id}`, { method: 'DELETE' });
    loadTab();
    loadLists();
  };

  const tabs: Tab[] = ['employees', 'pods', 'brands', 'processes', 'assignments', 'holidays', 'leaves'];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b px-6 py-4">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-gray-900">Manage Data</h1>
          <a href="/" className="px-4 py-2 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 text-sm">
            ← Back to Roster
          </a>
        </div>
      </header>

      <main className="p-6">
        {/* Tabs */}
        <div className="flex gap-1 mb-4 bg-white rounded-lg shadow-sm p-1">
          {tabs.map((t) => (
            <button
              key={t}
              onClick={() => { setTab(t); setShowForm(false); }}
              className={`px-4 py-2 rounded text-sm font-medium capitalize ${tab === t ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-100'}`}
            >
              {t}
            </button>
          ))}
        </div>

        {/* Actions */}
        <div className="flex justify-between items-center mb-3">
          <span className="text-sm text-gray-500">{data.length} records</span>
          {tab !== 'pods' && (
            <button
              onClick={() => { setShowForm(!showForm); setForm({}); }}
              className="px-4 py-1.5 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
            >
              + Add {tab.slice(0, -1)}
            </button>
          )}
        </div>

        {/* Add Form */}
        {showForm && (
          <div className="bg-white rounded-lg shadow-sm p-4 mb-4 space-y-3">
            {tab === 'employees' && (<>
              <input placeholder="Name" className="border rounded px-3 py-1.5 text-sm w-full" onChange={(e) => setForm({ ...form, name: e.target.value })} />
              <select className="border rounded px-3 py-1.5 text-sm w-full" onChange={(e) => setForm({ ...form, pod_id: e.target.value })}>
                <option value="">Select Pod</option>
                {pods.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
              <input type="number" step="0.1" placeholder="Daily Capacity (1.0)" className="border rounded px-3 py-1.5 text-sm w-full" onChange={(e) => setForm({ ...form, daily_capacity: parseFloat(e.target.value) || 1.0 })} />
              <select className="border rounded px-3 py-1.5 text-sm w-full" onChange={(e) => setForm({ ...form, preferred_off_day: e.target.value === '' ? null : parseInt(e.target.value) })}>
                <option value="">No Preference</option>
                {['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map((d, i) => <option key={i} value={i}>{d}</option>)}
              </select>
            </>)}
            {tab === 'brands' && (
              <input placeholder="Brand Name" className="border rounded px-3 py-1.5 text-sm w-full" onChange={(e) => setForm({ ...form, name: e.target.value })} />
            )}
            {tab === 'processes' && (<>
              <select className="border rounded px-3 py-1.5 text-sm w-full" onChange={(e) => setForm({ ...form, brand_id: e.target.value })}>
                <option value="">Select Brand</option>
                {brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
              <input placeholder="Process Name (CS, ACC, NDR...)" className="border rounded px-3 py-1.5 text-sm w-full" onChange={(e) => setForm({ ...form, name: e.target.value })} />
              <select className="border rounded px-3 py-1.5 text-sm w-full" onChange={(e) => setForm({ ...form, calendar_rule: e.target.value })}>
                <option value="">Calendar Rule</option>
                <option value="ALL_DAYS_365">ALL_DAYS_365</option>
                <option value="ALL_EXCEPT_HOLIDAYS">ALL_EXCEPT_HOLIDAYS</option>
                <option value="EXCEPT_SUNDAYS_AND_HOLIDAYS">EXCEPT_SUNDAYS_AND_HOLIDAYS</option>
              </select>
              <input type="number" placeholder="Min Staff (1)" className="border rounded px-3 py-1.5 text-sm w-full" onChange={(e) => setForm({ ...form, min_staff: parseInt(e.target.value) || 1 })} />
            </>)}
            {tab === 'assignments' && (<>
              <select className="border rounded px-3 py-1.5 text-sm w-full" onChange={(e) => setForm({ ...form, employee_id: e.target.value })}>
                <option value="">Select Employee</option>
                {employees.map((emp) => <option key={emp.id} value={emp.id}>{emp.name}</option>)}
              </select>
              <select className="border rounded px-3 py-1.5 text-sm w-full" onChange={(e) => setForm({ ...form, process_id: e.target.value })}>
                <option value="">Select Process</option>
                {processes.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.brands?.name ?? ''})</option>)}
              </select>
              <select className="border rounded px-3 py-1.5 text-sm w-full" onChange={(e) => setForm({ ...form, role: e.target.value })}>
                <option value="">Role</option>
                <option value="PRIMARY">PRIMARY</option>
                <option value="BACKUP">BACKUP</option>
              </select>
              <input type="number" step="0.1" placeholder="Weight (1.0)" className="border rounded px-3 py-1.5 text-sm w-full" onChange={(e) => setForm({ ...form, weight: parseFloat(e.target.value) || 1.0 })} />
            </>)}
            {tab === 'holidays' && (<>
              <input type="date" className="border rounded px-3 py-1.5 text-sm w-full" onChange={(e) => setForm({ ...form, date: e.target.value })} />
              <input placeholder="Holiday Name" className="border rounded px-3 py-1.5 text-sm w-full" onChange={(e) => setForm({ ...form, name: e.target.value })} />
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" defaultChecked onChange={(e) => setForm({ ...form, applies_to_all: e.target.checked })} />
                Applies to All Pods
              </label>
            </>)}
            {tab === 'leaves' && (<>
              <select className="border rounded px-3 py-1.5 text-sm w-full" onChange={(e) => setForm({ ...form, employee_id: e.target.value })}>
                <option value="">Select Employee</option>
                {employees.map((emp) => <option key={emp.id} value={emp.id}>{emp.name}</option>)}
              </select>
              <input type="date" className="border rounded px-3 py-1.5 text-sm w-full" onChange={(e) => setForm({ ...form, date: e.target.value })} />
              <select className="border rounded px-3 py-1.5 text-sm w-full" onChange={(e) => setForm({ ...form, type: e.target.value })}>
                <option value="LEAVE">LEAVE</option>
                <option value="COMP_OFF">COMP_OFF</option>
              </select>
            </>)}
            <div className="flex gap-2">
              <button onClick={handleAdd} className="px-4 py-1.5 bg-green-600 text-white rounded text-sm hover:bg-green-700">Save</button>
              <button onClick={() => setShowForm(false)} className="px-4 py-1.5 bg-gray-200 text-gray-700 rounded text-sm hover:bg-gray-300">Cancel</button>
            </div>
          </div>
        )}

        {/* Data Table */}
        <div className="bg-white rounded-lg shadow-sm overflow-x-auto">
          {loading ? (
            <div className="text-center py-8 text-gray-400">Loading…</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-left">
                  {tab === 'employees' && <><th className="px-4 py-2">Name</th><th className="px-4 py-2">Pod</th><th className="px-4 py-2">Capacity</th><th className="px-4 py-2">Pref Off</th><th className="px-4 py-2 w-16"></th></>}
                  {tab === 'pods' && <><th className="px-4 py-2">Name</th><th className="px-4 py-2">Lead</th></>}
                  {tab === 'brands' && <><th className="px-4 py-2">Name</th><th className="px-4 py-2 w-16"></th></>}
                  {tab === 'processes' && <><th className="px-4 py-2">Name</th><th className="px-4 py-2">Brand</th><th className="px-4 py-2">Calendar</th><th className="px-4 py-2">Min Staff</th><th className="px-4 py-2 w-16"></th></>}
                  {tab === 'assignments' && <><th className="px-4 py-2">Employee</th><th className="px-4 py-2">Process</th><th className="px-4 py-2">Brand</th><th className="px-4 py-2">Role</th><th className="px-4 py-2">Weight</th><th className="px-4 py-2 w-16"></th></>}
                  {tab === 'holidays' && <><th className="px-4 py-2">Date</th><th className="px-4 py-2">Name</th><th className="px-4 py-2">Applies To</th><th className="px-4 py-2 w-16"></th></>}
                  {tab === 'leaves' && <><th className="px-4 py-2">Employee</th><th className="px-4 py-2">Date</th><th className="px-4 py-2">Type</th><th className="px-4 py-2 w-16"></th></>}
                </tr>
              </thead>
              <tbody>
                {data.map((row: any) => (
                  <tr key={row.id} className="border-t hover:bg-gray-50">
                    {tab === 'employees' && <>
                      <td className="px-4 py-2 font-medium">{row.name}</td>
                      <td className="px-4 py-2 text-gray-500">{row.pods?.name ?? '—'}</td>
                      <td className="px-4 py-2">{row.daily_capacity}</td>
                      <td className="px-4 py-2">{row.preferred_off_day !== null ? ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][row.preferred_off_day] : '—'}</td>
                      <td className="px-4 py-2"><button onClick={() => handleDelete(row.id)} className="text-red-500 hover:text-red-700 text-xs">Delete</button></td>
                    </>}
                    {tab === 'pods' && <>
                      <td className="px-4 py-2 font-medium">{row.name}</td>
                      <td className="px-4 py-2 text-gray-500">{employees.find((e) => e.id === row.lead_employee_id)?.name ?? '—'}</td>
                    </>}
                    {tab === 'brands' && <>
                      <td className="px-4 py-2 font-medium">{row.name}</td>
                      <td className="px-4 py-2"><button onClick={() => handleDelete(row.id)} className="text-red-500 hover:text-red-700 text-xs">Delete</button></td>
                    </>}
                    {tab === 'processes' && <>
                      <td className="px-4 py-2 font-medium">{row.name}</td>
                      <td className="px-4 py-2 text-gray-500">{row.brands?.name ?? '—'}</td>
                      <td className="px-4 py-2 text-xs font-mono">{row.calendar_rule}</td>
                      <td className="px-4 py-2">{row.min_staff}</td>
                      <td className="px-4 py-2"><button onClick={() => handleDelete(row.id)} className="text-red-500 hover:text-red-700 text-xs">Delete</button></td>
                    </>}
                    {tab === 'assignments' && <>
                      <td className="px-4 py-2 font-medium">{row.employees?.name ?? row.employee_id}</td>
                      <td className="px-4 py-2">{row.processes?.name ?? row.process_id}</td>
                      <td className="px-4 py-2 text-gray-500">{row.processes?.brands?.name ?? '—'}</td>
                      <td className="px-4 py-2"><span className={`px-2 py-0.5 rounded text-xs ${row.role === 'PRIMARY' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>{row.role}</span></td>
                      <td className="px-4 py-2">{row.weight}</td>
                      <td className="px-4 py-2"><button onClick={() => handleDelete(row.id)} className="text-red-500 hover:text-red-700 text-xs">Delete</button></td>
                    </>}
                    {tab === 'holidays' && <>
                      <td className="px-4 py-2 font-medium">{row.date}</td>
                      <td className="px-4 py-2">{row.name}</td>
                      <td className="px-4 py-2 text-gray-500">{row.applies_to_all ? 'All Pods' : 'Specific'}</td>
                      <td className="px-4 py-2"><button onClick={() => handleDelete(row.id)} className="text-red-500 hover:text-red-700 text-xs">Delete</button></td>
                    </>}
                    {tab === 'leaves' && <>
                      <td className="px-4 py-2 font-medium">{row.employees?.name ?? row.employee_id}</td>
                      <td className="px-4 py-2">{row.date}</td>
                      <td className="px-4 py-2"><span className={`px-2 py-0.5 rounded text-xs ${row.type === 'LEAVE' ? 'bg-red-100 text-red-700' : 'bg-orange-100 text-orange-700'}`}>{row.type}</span></td>
                      <td className="px-4 py-2"><button onClick={() => handleDelete(row.id)} className="text-red-500 hover:text-red-700 text-xs">Delete</button></td>
                    </>}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </main>
    </div>
  );
}

