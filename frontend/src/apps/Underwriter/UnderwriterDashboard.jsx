import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, Badge, Button, Input } from '../../components/ui';
import { Clock, CheckCircle, ShieldAlert, XCircle } from 'lucide-react';

const API = import.meta.env.VITE_UNDERWRITER_API || 'http://127.0.0.1:4102';

function formatNumber(value) {
  return Number(value || 0).toLocaleString('en-IN');
}

async function request(path, options = {}) {
  const token = localStorage.getItem('autouw_uw_token');
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${API}${path}`, { ...options, headers });
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = { raw: text };
  }
  if (!res.ok) throw new Error(data.error || data.message || res.statusText);
  return data;
}

export default function UnderwriterDashboard() {
  const [token, setToken] = useState(() => localStorage.getItem('autouw_uw_token'));
  const [email, setEmail] = useState('admin@autouw.gov');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [cases, setCases] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(false);

  async function login() {
    setError('');
    try {
      const data = await request('/admin/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      localStorage.setItem('autouw_uw_token', data.token);
      setToken(data.token);
      setPassword('');
    } catch (err) {
      setError(err.message);
    }
  }

  async function loadCases() {
    setLoading(true);
    setError('');
    try {
      const rows = await request('/admin/cases');
      setCases(rows);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function openCase(id) {
    setSelectedId(id);
    setError('');
    try {
      const result = await request(`/admin/cases/${id}`);
      setDetail(result);
    } catch (err) {
      setError(err.message);
      setDetail(null);
    }
  }

  useEffect(() => {
    if (token) loadCases();
  }, [token]);

  useEffect(() => {
    if (!token || selectedId === null) return;
    const interval = setInterval(() => openCase(selectedId), 15000);
    return () => clearInterval(interval);
  }, [token, selectedId]);

  function logout() {
    localStorage.removeItem('autouw_uw_token');
    setToken(null);
    setCases([]);
    setDetail(null);
    setSelectedId(null);
  }

  if (!token) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-lg">
          <CardHeader>
            <CardTitle>Underwriter Access</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-slate-600">Login with your admin credentials to review applicants and risk analytics.</p>
            <div>
              <label className="block mb-1 text-sm font-medium text-slate-700">Email</label>
              <Input value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div>
              <label className="block mb-1 text-sm font-medium text-slate-700">Password</label>
              <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <div className="flex justify-end">
              <Button onClick={login}>Sign in</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const approvedCount = cases.filter((c) => c.status === 'approved').length;
  const rejectedCount = cases.filter((c) => c.status === 'rejected').length;
  const referredCount = cases.filter((c) => c.status === 'refer').length;
  const submittedCount = cases.filter((c) => c.status === 'submitted').length;

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-6">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.2em] text-slate-500">AutoUW Admin</p>
            <h1 className="text-3xl font-semibold text-slate-900">Applicant review dashboard</h1>
            <p className="mt-1 text-slate-600">View submitted cases, risk classification, and decision counts.</p>
          </div>
          <div className="flex flex-col items-start gap-2 sm:items-end sm:flex-row sm:gap-3">
            <Button variant="outline" onClick={loadCases} disabled={loading}>
              Refresh queue
            </Button>
            <Button variant="destructive" onClick={logout}>Sign out</Button>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          <Card className="bg-slate-50 border-slate-200">
            <CardContent className="space-y-2">
              <p className="text-sm font-medium text-slate-500">Submitted</p>
              <p className="text-3xl font-semibold text-slate-900">{submittedCount}</p>
            </CardContent>
          </Card>
          <Card className="bg-emerald-50 border-emerald-200">
            <CardContent className="space-y-2">
              <p className="text-sm font-medium text-emerald-700">Approved</p>
              <p className="text-3xl font-semibold text-emerald-900">{approvedCount}</p>
            </CardContent>
          </Card>
          <Card className="bg-yellow-50 border-yellow-200">
            <CardContent className="space-y-2">
              <p className="text-sm font-medium text-yellow-700">Referred</p>
              <p className="text-3xl font-semibold text-yellow-900">{referredCount}</p>
            </CardContent>
          </Card>
          <Card className="bg-red-50 border-red-200">
            <CardContent className="space-y-2">
              <p className="text-sm font-medium text-red-700">Rejected</p>
              <p className="text-3xl font-semibold text-red-900">{rejectedCount}</p>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 xl:grid-cols-[320px_1fr]">
          <Card className="h-fit">
            <CardHeader>
              <CardTitle>Case queue</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {loading && <p className="text-sm text-slate-500">Loading cases…</p>}
              {error && <p className="text-sm text-red-600">{error}</p>}
              {cases.length === 0 && !loading ? (
                <p className="text-sm text-slate-500">No cases available yet.</p>
              ) : (
                cases.map((c) => (
                  <button
                    type="button"
                    key={c.id}
                    onClick={() => openCase(c.id)}
                    className={`w-full rounded-xl border px-4 py-3 text-left transition ${
                      selectedId === c.id ? 'border-slate-900 bg-slate-100' : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 text-sm text-slate-700">
                      <span>#{c.id}</span>
                      <span className="font-semibold capitalize">{c.status}</span>
                    </div>
                    <p className="mt-2 text-sm text-slate-500">{c.applicant_email}</p>
                  </button>
                ))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Case details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {!detail ? (
                <p className="text-sm text-slate-500">Select a case from the queue to see the latest application and risk score.</p>
              ) : (
                <>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <p className="text-sm text-slate-500">Applicant</p>
                      <p className="font-semibold text-slate-900">{detail.application?.applicant_email}</p>
                    </div>
                    <div>
                      <p className="text-sm text-slate-500">Status</p>
                      <Badge variant={detail.risk?.classification === 'APPROVED' ? 'success' : detail.risk?.classification === 'REJECTED' ? 'danger' : 'warning'}>
                        {detail.risk?.classification || detail.application?.status || 'Pending'}
                      </Badge>
                    </div>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-3">
                    <div>
                      <p className="text-sm text-slate-500">Coverage</p>
                      <p className="font-semibold text-slate-900">{detail.application?.coverage_type || '—'}</p>
                    </div>
                    <div>
                      <p className="text-sm text-slate-500">Monthly income</p>
                      <p className="font-semibold text-slate-900">₹{formatNumber(detail.application?.monthly_income)}</p>
                    </div>
                    <div>
                      <p className="text-sm text-slate-500">Sum assured</p>
                      <p className="font-semibold text-slate-900">₹{formatNumber(detail.application?.sum_assured)}</p>
                    </div>
                  </div>
                  <div className="space-y-2 rounded-2xl bg-slate-50 p-4">
                    <p className="text-sm text-slate-500">Risk score</p>
                    <p className="text-4xl font-semibold text-slate-900">{detail.risk?.risk_score ?? 'N/A'}</p>
                    <p className="text-sm text-slate-600">{detail.risk?.recommendation || 'No risk recommendation yet.'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-500">Notes</p>
                    <p className="whitespace-pre-wrap text-sm text-slate-700">{detail.risk?.explanation || 'No explanation available.'}</p>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
