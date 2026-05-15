import React, { useEffect, useState } from 'react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, PieChart, Pie, Cell, Legend } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle, Button, Input, Label, Textarea, Badge } from './components/ui.jsx';
import { ClipboardList, RefreshCw, Shield } from 'lucide-react';

const API = import.meta.env.VITE_UNDERWRITER_API || 'http://127.0.0.1:4102';

async function api(path, opts = {}) {
  const token = localStorage.getItem('autouw_uw_token');
  const r = await fetch(`${API}${path}`, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(opts.headers || {}),
    },
  });
  const text = await r.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = { raw: text };
  }
  if (!r.ok) throw new Error(data.error || text || r.statusText);
  return data;
}

export default function App() {
  const [token, setToken] = useState(() => localStorage.getItem('autouw_uw_token'));
  const [email, setEmail] = useState('admin@autouw.gov');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState('');
  const [cases, setCases] = useState([]);
  const [sel, setSel] = useState(null);
  const [detail, setDetail] = useState(null);
  const [load, setLoad] = useState(false);
  const [notes, setNotes] = useState('');

  async function login() {
    setErr('');
    try {
      const data = await fetch(`${API}/admin/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      }).then(async (r) => {
        const t = await r.text();
        const j = JSON.parse(t);
        if (!r.ok) throw new Error(j.error || t);
        return j;
      });
      localStorage.setItem('autouw_uw_token', data.token);
      setToken(data.token);
    } catch (e) {
      setErr(e.message);
    }
  }

  async function loadCases() {
    if (!token) return;
    setLoad(true);
    setErr('');
    try {
      const rows = await api('/admin/cases');
      setCases(rows);
    } catch (e) {
      setErr(e.message);
    } finally {
      setLoad(false);
    }
  }

  async function openCase(id) {
    setSel(id);
    setErr('');
    try {
      const d = await api(`/admin/cases/${id}`);
      setDetail(d);
      setNotes('');
    } catch (e) {
      setErr(e.message);
      setDetail(null);
    }
  }

  useEffect(() => {
    if (token) loadCases();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  useEffect(() => {
    if (!token || !sel) return;
    const t = setInterval(() => openCase(sel), 12000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, sel]);

  async function decide(status) {
    if (!sel) return;
    setErr('');
    try {
      await api(`/admin/cases/${sel}/decision`, {
        method: 'PATCH',
        body: JSON.stringify({ status, notes }),
      });
      await loadCases();
      await openCase(sel);
    } catch (e) {
      setErr(e.message);
    }
  }

  if (!token) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" /> Underwriter sign-in
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-slate-600">Use seeded admin account (see module .env.example).</p>
            <div>
              <Label>Email</Label>
              <Input value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div>
              <Label>Password</Label>
              <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
            {err && <p className="text-sm text-govRed">{err}</p>}
            <Button className="w-full" onClick={login}>
              Sign in
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const app = detail?.application;
  const risk = detail?.risk;
  const incomeDetails = app?.income_details;
  const gpayHistory = app?.gpay_history;
  const documents = app?.documents || [];
  const monthlyIncome = app?.monthly_income ?? app?.total_monthly_income ?? '—';

  const utilityStatus = risk?.utility_status || (documents.some((d) => d.doc_type === 'utility') ? 'verified' : 'pending');
  const utilityScore = risk?.utility_consistency ?? (documents.some((d) => d.doc_type === 'utility') ? 78 : 50);

  const approvedCount = cases.filter((c) => (c.status || '').toString().toLowerCase() === 'approved').length;
  const rejectedCount = cases.filter((c) => (c.status || '').toString().toLowerCase() === 'rejected').length;
  const referredCount = cases.filter((c) => {
    const s = (c.status || '').toString().toLowerCase();
    return s === 'refer' || s === 'referred' || s === 'refer for review';
  }).length;
  const submittedCount = cases.filter((c) => (c.status || '').toString().toLowerCase() === 'submitted').length;

  const statusData = [
    { name: 'submitted', count: submittedCount },
    { name: 'approved', count: approvedCount },
    { name: 'referred', count: referredCount },
    { name: 'rejected', count: rejectedCount },
  ];

  const pieColors = ['#0b2f4a', '#16a34a', '#f59e0b', '#ef4444'];

  const classification = risk?.classification || '—';
  const badgeVariant =
    classification === 'APPROVED' ? 'success' : classification === 'REJECTED' ? 'danger' : 'warning';

  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-6 py-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">AutoUW</p>
            <h1 className="text-xl font-semibold text-slate-900">Underwriter command center</h1>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={loadCases} disabled={load}>
              <RefreshCw className={`mr-2 h-4 w-4 ${load ? 'animate-spin' : ''}`} />
              Refresh queue
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                localStorage.removeItem('autouw_uw_token');
                setToken(null);
                setCases([]);
                setSel(null);
                setDetail(null);
              }}
            >
              Sign out
            </Button>
          </div>
        </div>
      </header>
      <main className="mx-auto grid max-w-6xl gap-6 px-6 py-8 lg:grid-cols-[300px,1fr]">
        <Card className="h-fit">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ClipboardList className="h-4 w-4" /> Case queue
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {err && <p className="text-sm text-govRed">{err}</p>}
            <div className="grid gap-2 sm:grid-cols-2 mb-4">
              <div className="rounded-lg bg-slate-50 p-3 text-sm">
                <p className="text-slate-500">Submitted</p>
                <p className="text-xl font-semibold text-slate-900">{submittedCount}</p>
              </div>
              <div className="rounded-lg bg-emerald-50 p-3 text-sm">
                <p className="text-emerald-700">Approved</p>
                <p className="text-xl font-semibold text-emerald-900">{approvedCount}</p>
              </div>
              <div className="rounded-lg bg-yellow-50 p-3 text-sm">
                <p className="text-yellow-700">Referred</p>
                <p className="text-xl font-semibold text-yellow-900">{referredCount}</p>
              </div>
              <div className="rounded-lg bg-red-50 p-3 text-sm">
                <p className="text-red-700">Rejected</p>
                <p className="text-xl font-semibold text-red-900">{rejectedCount}</p>
              </div>
            </div>
            <div className="grid gap-4 lg:grid-cols-[1fr_280px] mb-4">
              <div className="h-48 rounded-3xl border border-slate-200 bg-white p-3">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={statusData} dataKey="count" nameKey="name" innerRadius={50} outerRadius={70} paddingAngle={4}>
                      {statusData.map((entry, index) => (
                        <Cell key={`pie-${entry.name}`} fill={pieColors[index % pieColors.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => [value, 'applications']} />
                    <Legend verticalAlign="bottom" height={36} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-sm text-slate-500">Risk classification summary</p>
                <p className="mt-2 text-3xl font-semibold text-slate-900">{classification}</p>
                <p className="mt-1 text-sm text-slate-600">Latest selected application</p>
              </div>
            </div>
            <div className="mb-4 h-48">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={statusData} margin={{ top: 10, right: 0, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Bar dataKey="count" fill="#0b2f4a" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            {cases.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => openCase(c.id)}
                className={`w-full rounded-lg border px-3 py-2 text-left text-sm transition ${
                  sel === c.id ? 'border-govNavy bg-slate-50' : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="font-medium">#{c.id}</div>
                <div className="text-xs text-slate-500">{c.applicant_email}</div>
                <div className="text-xs capitalize text-slate-600">{c.status}</div>
              </button>
            ))}
            {!cases.length && !load && <p className="text-sm text-slate-500">No cases yet.</p>}
          </CardContent>
        </Card>
        <div className="space-y-6">
          {!detail && <Card><CardContent className="py-12 text-center text-slate-500">Select a case to load live aggregates from worker, utility, and risk services.</CardContent></Card>}
          {detail && app && (
            <>
              <Card>
                <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-4">
                  <div>
                    <CardTitle>Applicant profile</CardTitle>
                    <p className="text-sm text-slate-600">{app.applicant_email}</p>
                  </div>
                  <Badge variant={badgeVariant}>{classification}</Badge>
                </CardHeader>
                <CardContent className="grid gap-4 md:grid-cols-2 text-sm">
                  <div>
                    <p className="text-slate-500">Coverage</p>
                    <p className="font-medium">{app.coverage_type}</p>
                  </div>
                  <div>
                    <p className="text-slate-500">Sum assured</p>
                    <p className="font-medium">₹{app.sum_assured}</p>
                  </div>
                  <div>
                    <p className="text-slate-500">Monthly income (declared)</p>
                    <p className="font-medium">₹{monthlyIncome}</p>
                  </div>
                  <div>
                    <p className="text-slate-500">Income type</p>
                    <p className="font-medium capitalize">{app.income_type || '—'}</p>
                  </div>
                  <div className="md:col-span-2">
                    <p className="text-slate-500">Address</p>
                    <p className="font-medium">
                      {[app.address_line, app.city, app.state, app.pincode].filter(Boolean).join(', ') || '—'}
                    </p>
                  </div>
                </CardContent>
              </Card>

              <div className="grid gap-6 lg:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle>Income analysis</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid gap-3 sm:grid-cols-2 text-sm">
                      <div>
                        <p className="text-slate-500">Declared monthly income</p>
                        <p className="font-semibold text-slate-900">₹{app.monthly_income ?? '—'}</p>
                      </div>
                      <div>
                        <p className="text-slate-500">Reported annual income</p>
                        <p className="font-semibold text-slate-900">₹{incomeDetails?.annual_income ?? '—'}</p>
                      </div>
                      <div>
                        <p className="text-slate-500">Employer</p>
                        <p className="font-semibold text-slate-900">{incomeDetails?.employer_name || '—'}</p>
                      </div>
                      <div>
                        <p className="text-slate-500">GPay monthly estimate</p>
                        <p className="font-semibold text-slate-900">₹{gpayHistory?.monthly_estimate ?? '—'}</p>
                      </div>
                    </div>
                    <div className="mt-4 h-56 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={gpayHistory?.monthly_estimate ? [{ month: 'GPay', amount: gpayHistory.monthly_estimate }] : []}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                          <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                          <YAxis tick={{ fontSize: 12 }} />
                          <Tooltip formatter={(value) => `₹${value}`} />
                          <Bar dataKey="amount" fill="#0b2f4a" radius={[4, 4, 0, 0]} name="GPay estimate" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Utility verification</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Status</span>
                      <span className="font-medium capitalize">{utilityStatus || 'pending'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Score</span>
                      <span className="font-medium">{utilityScore ?? '—'}</span>
                    </div>
                    <p className="text-slate-700">
                      {documents.some((d) => d.doc_type === 'utility')
                        ? 'Utility documents are attached and available for review.'
                        : 'No utility document uploaded for this application.'}
                    </p>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>Risk engine output</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 text-sm">
                  {risk ? (
                    <>
                      <div className="flex flex-wrap gap-6">
                        <div>
                          <p className="text-slate-500">Risk score</p>
                          <p className="text-2xl font-semibold text-slate-900">{risk.risk_score}</p>
                        </div>
                        <div>
                          <p className="text-slate-500">Principal limit (calc.)</p>
                          <p className="text-2xl font-semibold text-slate-900">₹{risk.principal_amount}</p>
                        </div>
                        <div>
                          <p className="text-slate-500">Eligibility</p>
                          <p className="font-medium text-slate-900">{risk.eligibility}</p>
                        </div>
                      </div>
                      <div>
                        <p className="text-slate-500">Recommendation</p>
                        <p className="mt-1 text-slate-800">{risk.recommendation}</p>
                      </div>
                      <div>
                        <p className="text-slate-500">Why this classification</p>
                        <p className="mt-1 leading-relaxed text-slate-800">{risk.explanation}</p>
                      </div>
                      <div>
                        <p className="mb-2 text-slate-500">Fraud / integrity indicators</p>
                        <ul className="list-disc space-y-1 pl-5">
                          {(risk.fraud_indicators || []).length ? (
                            risk.fraud_indicators.map((x, i) => (
                              <li key={i} className="text-amber-900">
                                {x}
                              </li>
                            ))
                          ) : (
                            <li className="text-slate-600">None flagged</li>
                          )}
                        </ul>
                      </div>
                      {risk?.source === 'db' && (
                        <div className="rounded-lg bg-slate-50 p-3 text-xs text-slate-700">
                          <p className="font-medium text-slate-900">Risk source</p>
                          <p className="mt-2">Loaded from stored assessment because the risk engine was unavailable.</p>
                        </div>
                      )}
                    </>
                  ) : (
                    <p className="text-slate-500">Risk assessment not available. Ensure risk engine completed evaluate.</p>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Manual decision</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label>Notes to file</Label>
                    <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Visible on internal record" />
                  </div>
                  <div className="flex flex-wrap gap-3">
                    <Button variant="success" onClick={() => decide('approved')}>
                      Approve
                    </Button>
                    <Button variant="destructive" onClick={() => decide('rejected')}>
                      Reject
                    </Button>
                  </div>
                  {risk?.underwriter_status && (
                    <p className="text-xs text-slate-500">
                      Last filed status: <span className="font-medium">{risk.underwriter_status}</span>
                      {risk.underwriter_notes ? ` — ${risk.underwriter_notes}` : ''}
                    </p>
                  )}
                </CardContent>
              </Card>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
