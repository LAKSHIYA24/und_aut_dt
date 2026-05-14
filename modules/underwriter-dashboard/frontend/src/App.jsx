import React, { useEffect, useState } from 'react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
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
  const util = detail?.utility;
  const w = detail?.worker;

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
                    <p className="font-medium">₹{app.monthly_income}</p>
                  </div>
                  <div>
                    <p className="text-slate-500">Income type</p>
                    <p className="font-medium capitalize">{app.income_type}</p>
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
                    {w?.profile && (
                      <ul className="mb-4 space-y-1 text-sm">
                        <li>
                          <span className="text-slate-500">GPay estimate: </span>
                          <span className="font-medium">₹{w.profile.gpayMonthlyEstimate}</span>
                        </li>
                        <li>
                          <span className="text-slate-500">Annual (form): </span>
                          <span className="font-medium">₹{w.profile.annualIncomeDeclared}</span>
                        </li>
                        <li>
                          <span className="text-slate-500">Employer: </span>
                          <span className="font-medium">{w.profile.employer || '—'}</span>
                        </li>
                      </ul>
                    )}
                    <div className="h-56 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={Array.isArray(w?.earnings) ? w.earnings : []}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                          <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                          <YAxis tick={{ fontSize: 12 }} />
                          <Tooltip />
                          <Bar dataKey="amount" fill="#0b2f4a" radius={[4, 4, 0, 0]} name="Amount (₹)" />
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
                    {util ? (
                      <>
                        <div className="flex justify-between">
                          <span className="text-slate-500">Status</span>
                          <span className="font-medium capitalize">{util.status}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">Score</span>
                          <span className="font-medium">{util.consistency_score}</span>
                        </div>
                        <p className="text-slate-700">{util.notes}</p>
                      </>
                    ) : (
                      <p className="text-slate-500">Utility record not available.</p>
                    )}
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
                      {w?.riskData && (
                        <div className="rounded-lg bg-slate-50 p-3 text-xs text-slate-700">
                          <p className="font-medium text-slate-900">Worker risk signals</p>
                          <pre className="mt-2 overflow-auto">{JSON.stringify(w.riskData, null, 2)}</pre>
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
