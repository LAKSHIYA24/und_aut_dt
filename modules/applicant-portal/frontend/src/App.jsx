import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, Button, Input, Label, Textarea } from './components/ui.jsx';
import { FileText, LogIn, ShieldCheck, UploadCloud } from 'lucide-react';

const API = import.meta.env.VITE_API_URL || 'http://127.0.0.1:4100';

const AuthCtx = createContext(null);

async function api(path, opts = {}) {
  const token = localStorage.getItem('autouw_applicant_token');
  const headers = { ...(opts.headers || {}) };
  if (!(opts.body instanceof FormData)) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;
  const r = await fetch(`${API}${path}`, { ...opts, headers });
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

function useAuth() {
  return useContext(AuthCtx);
}

function App() {
  const [token, setToken] = useState(() => localStorage.getItem('autouw_applicant_token'));
  const [user, setUser] = useState(null);
  const [boot, setBoot] = useState(!!token);

  useEffect(() => {
    if (!token) {
      setUser(null);
      setBoot(false);
      return;
    }
    (async () => {
      try {
        const me = await api('/auth/me');
        setUser(me);
      } catch {
        localStorage.removeItem('autouw_applicant_token');
        setToken(null);
      } finally {
        setBoot(false);
      }
    })();
  }, [token]);

  const auth = useMemo(
    () => ({
      token,
      user,
      login: async (email, password) => {
        const data = await api('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });
        localStorage.setItem('autouw_applicant_token', data.token);
        setToken(data.token);
        setUser(data.user);
      },
      signup: async (email, password) => {
        const data = await api('/auth/signup', { method: 'POST', body: JSON.stringify({ email, password }) });
        localStorage.setItem('autouw_applicant_token', data.token);
        setToken(data.token);
        setUser(data.user);
      },
      logout: () => {
        localStorage.removeItem('autouw_applicant_token');
        setToken(null);
        setUser(null);
      },
    }),
    [token, user]
  );

  if (boot) {
    return (
      <div className="flex min-h-screen items-center justify-center text-slate-600">
        Restoring session…
      </div>
    );
  }

  if (!token) {
    return (
      <AuthCtx.Provider value={auth}>
        <AuthScreen />
      </AuthCtx.Provider>
    );
  }

  return (
    <AuthCtx.Provider value={auth}>
      <PortalShell user={user} onLogout={auth.logout} />
    </AuthCtx.Provider>
  );
}

function AuthScreen() {
  const { login, signup } = useAuth();
  const [mode, setMode] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit() {
    setErr('');
    setLoading(true);
    try {
      if (mode === 'login') await login(email, password);
      else await signup(email, password);
    } catch (e) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-govGray px-4 py-16">
      <div className="mx-auto max-w-md">
        <div className="mb-10 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-govNavy text-white shadow-md">
            <ShieldCheck className="h-7 w-7" />
          </div>
          <h1 className="text-3xl font-semibold text-slate-900">AutoUW Applicant Portal</h1>
          <p className="mt-2 text-slate-600">Secure access for insurance intake and document submission.</p>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>{mode === 'login' ? 'Sign in' : 'Create account'}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Email</Label>
              <Input value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
            </div>
            <div>
              <Label>Password (min 8 characters)</Label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              />
            </div>
            {err && <p className="text-sm text-govRed">{err}</p>}
            <Button className="w-full" disabled={loading} onClick={submit}>
              <LogIn className="mr-2 h-4 w-4" />
              {loading ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Create account'}
            </Button>
            <button type="button" className="w-full text-center text-sm text-govNavy underline" onClick={() => setMode(mode === 'login' ? 'signup' : 'login')}>
              {mode === 'login' ? 'Need an account? Sign up' : 'Have an account? Sign in'}
            </button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function PortalShell({ user, onLogout }) {
  const [apps, setApps] = useState([]);
  const [sel, setSel] = useState(null);
  const [load, setLoad] = useState(true);
  const [err, setErr] = useState('');

  async function refresh() {
    setErr('');
    setLoad(true);
    try {
      const rows = await api('/applications');
      setApps(rows);
      if (sel) {
        const d = await api(`/applications/${sel.id}`);
        setSel(d);
      }
    } catch (e) {
      setErr(e.message);
    } finally {
      setLoad(false);
    }
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function createApp() {
    const { id } = await api('/applications', { method: 'POST' });
    await refresh();
    const d = await api(`/applications/${id}`);
    setSel(d);
  }

  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div>
            <p className="text-xs uppercase tracking-widest text-slate-500">AutoUW</p>
            <h1 className="text-xl font-semibold text-slate-900">Applicant Portal</h1>
            <p className="text-sm text-slate-600">{user?.email}</p>
          </div>
          <Button variant="outline" onClick={onLogout}>
            Sign out
          </Button>
        </div>
      </header>
      <main className="mx-auto grid max-w-6xl gap-6 px-6 py-8 lg:grid-cols-[320px,1fr]">
        <Card className="h-fit">
          <CardHeader>
            <CardTitle>Applications</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button className="w-full" onClick={createApp}>
              New application
            </Button>
            {load && <p className="text-sm text-slate-500">Loading…</p>}
            {err && <p className="text-sm text-govRed">{err}</p>}
            <ul className="space-y-2">
              {apps.map((a) => (
                <li key={a.id}>
                  <button
                    type="button"
                    onClick={async () => {
                      const d = await api(`/applications/${a.id}`);
                      setSel(d);
                    }}
                    className={`w-full rounded-lg border px-3 py-2 text-left text-sm transition ${
                      sel?.id === a.id ? 'border-govNavy bg-slate-50' : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="font-medium">Case #{a.id}</div>
                    <div className="text-xs text-slate-500">{a.status}</div>
                  </button>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
        <div>{sel ? <ApplicationWorkspace data={sel} onRefresh={refresh} /> : <EmptyState />}</div>
      </main>
    </div>
  );
}

function EmptyState() {
  return (
    <Card className="border-dashed">
      <CardContent className="py-16 text-center text-slate-600">
        Select or create an application to begin intake.
      </CardContent>
    </Card>
  );
}

function ApplicationWorkspace({ data, onRefresh }) {
  const [tab, setTab] = useState('insurance');
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(false);

  const form = useFormState(data);

  async function saveInsurance() {
    setLoading(true);
    setMsg('');
    try {
      await api(`/applications/${data.id}/insurance`, {
        method: 'PATCH',
        body: JSON.stringify(form.values),
      });
      setMsg('Insurance details saved.');
      await onRefresh();
    } catch (e) {
      setMsg(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function upload(docType, file) {
    if (!file) return;
    setLoading(true);
    setMsg('');
    try {
      const fd = new FormData();
      fd.append('file', file);
      await fetch(`${API}/applications/${data.id}/documents/${docType}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${localStorage.getItem('autouw_applicant_token')}` },
        body: fd,
      }).then(async (r) => {
        const t = await r.text();
        if (!r.ok) throw new Error(JSON.parse(t).error || t);
      });
      setMsg(`${docType} uploaded.`);
      await onRefresh();
    } catch (e) {
      setMsg(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function saveIncome() {
    setLoading(true);
    setMsg('');
    try {
      await api(`/applications/${data.id}/income-details`, {
        method: 'POST',
        body: JSON.stringify(form.income),
      });
      setMsg('Income details saved.');
      await onRefresh();
    } catch (e) {
      setMsg(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function saveGpay() {
    setLoading(true);
    setMsg('');
    try {
      await api(`/applications/${data.id}/gpay-history`, {
        method: 'POST',
        body: JSON.stringify(form.gpay),
      });
      setMsg('GPay / UPI history saved.');
      await onRefresh();
    } catch (e) {
      setMsg(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function submit() {
    setLoading(true);
    setMsg('');
    try {
      await api(`/applications/${data.id}/submit`, { method: 'POST', body: '{}' });
      setMsg('Submitted for underwriting. Worker and risk services have been notified.');
      await onRefresh();
    } catch (e) {
      setMsg(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <div>
            <CardTitle>Case #{data.id}</CardTitle>
            <p className="text-sm text-slate-600">Status: {data.status}</p>
          </div>
          <div className="flex gap-2">
            {['insurance', 'documents', 'income', 'review'].map((t) => (
              <Button key={t} variant={tab === t ? 'default' : 'outline'} className="capitalize" onClick={() => setTab(t)}>
                {t}
              </Button>
            ))}
          </div>
        </CardHeader>
        <CardContent>
          {msg && <p className="mb-4 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-800">{msg}</p>}
          {tab === 'insurance' && (
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Coverage type" value={form.values.coverage_type} onChange={(v) => form.set('coverage_type', v)} />
              <Field label="Sum assured (₹)" type="number" value={form.values.sum_assured} onChange={(v) => form.set('sum_assured', v)} />
              <Field label="Tenure (months)" type="number" value={form.values.tenure_months} onChange={(v) => form.set('tenure_months', v)} />
              <Field label="Monthly income (₹)" type="number" value={form.values.monthly_income} onChange={(v) => form.set('monthly_income', v)} />
              <div>
                <Label>Income type</Label>
                <select
                  className="mt-1 h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm"
                  value={form.values.income_type || 'stable'}
                  onChange={(e) => form.set('income_type', e.target.value)}
                >
                  <option value="stable">Stable / salaried</option>
                  <option value="gig">Gig / variable</option>
                </select>
              </div>
              <div>
                <Label>Occupation risk</Label>
                <select
                  className="mt-1 h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm"
                  value={form.values.occupation_risk || 'Low'}
                  onChange={(e) => form.set('occupation_risk', e.target.value)}
                >
                  <option>Low</option>
                  <option>Medium</option>
                  <option>High</option>
                </select>
              </div>
              <Field label="Existing loans EMI (₹)" type="number" value={form.values.existing_loans} onChange={(v) => form.set('existing_loans', v)} />
              <div className="flex items-center gap-2 md:col-span-2">
                <input id="health" type="checkbox" checked={!!form.values.health_declaration} onChange={(e) => form.set('health_declaration', e.target.checked)} />
                <Label htmlFor="health" className="mb-0">
                  Health conditions declared
                </Label>
              </div>
              <div className="md:col-span-2">
                <Label>Address line</Label>
                <Input value={form.values.address_line || ''} onChange={(e) => form.set('address_line', e.target.value)} />
              </div>
              <Field label="City" value={form.values.city} onChange={(v) => form.set('city', v)} />
              <Field label="State" value={form.values.state} onChange={(v) => form.set('state', v)} />
              <Field label="PIN code" value={form.values.pincode} onChange={(v) => form.set('pincode', v)} />
              <div className="md:col-span-2">
                <Button disabled={loading} onClick={saveInsurance}>
                  Save insurance profile
                </Button>
              </div>
            </div>
          )}
          {tab === 'documents' && (
            <div className="grid gap-6 md:grid-cols-3">
              {['utility', 'gpay', 'income'].map((t) => (
                <Card key={t}>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base capitalize">
                      <UploadCloud className="h-4 w-4" /> {t} document
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <input type="file" disabled={loading} onChange={(e) => upload(t, e.target.files?.[0])} />
                    <p className="text-xs text-slate-500">
                      {data.documents?.filter((d) => d.doc_type === t).length ? 'Uploaded' : 'Required before submit'}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
          {tab === 'income' && (
            <div className="grid gap-6 md:grid-cols-2">
              <div>
                <Label>Employer / source</Label>
                <Input value={form.income.employer_name} onChange={(e) => form.setIncome('employer_name', e.target.value)} />
              </div>
              <div>
                <Label>Role / title</Label>
                <Input value={form.income.job_title} onChange={(e) => form.setIncome('job_title', e.target.value)} />
              </div>
              <div>
                <Label>Annual income (₹)</Label>
                <Input type="number" value={form.income.annual_income} onChange={(e) => form.setIncome('annual_income', e.target.value)} />
              </div>
              <div className="md:col-span-2">
                <Label>Notes</Label>
                <Textarea value={form.income.notes} onChange={(e) => form.setIncome('notes', e.target.value)} />
              </div>
              <Button disabled={loading} onClick={saveIncome}>
                Save income details
              </Button>
              <div className="md:col-span-2 border-t border-slate-100 pt-6">
                <Label>GPay / UPI narrative (paste summary)</Label>
                <Textarea value={form.gpay.raw_text} onChange={(e) => form.setGpay('raw_text', e.target.value)} />
                <div className="mt-3 max-w-xs">
                  <Label>Estimated monthly from UPI (₹)</Label>
                  <Input type="number" value={form.gpay.monthly_estimate} onChange={(e) => form.setGpay('monthly_estimate', e.target.value)} />
                </div>
                <Button className="mt-3" disabled={loading} onClick={saveGpay}>
                  Save UPI summary
                </Button>
              </div>
            </div>
          )}
          {tab === 'review' && (
            <div className="space-y-4">
              <Card className="bg-slate-50">
                <CardContent className="py-4 text-sm text-slate-700">
                  <div className="flex items-start gap-3">
                    <FileText className="mt-0.5 h-5 w-5 text-govNavy" />
                    <div>
                      <p className="font-medium">Submission checklist</p>
                      <ul className="mt-2 list-disc space-y-1 pl-5">
                        <li>Insurance profile completed</li>
                        <li>Utility bill, UPI history, and income document uploaded</li>
                        <li>Income and UPI forms saved</li>
                      </ul>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Button disabled={loading || data.status === 'submitted'} onClick={submit}>
                {data.status === 'submitted' ? 'Already submitted' : 'Submit for automated underwriting'}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Field({ label, value, onChange, type = 'text' }) {
  return (
    <div>
      <Label>{label}</Label>
      <Input type={type} value={value ?? ''} onChange={(e) => onChange(type === 'number' ? e.target.value : e.target.value)} />
    </div>
  );
}

function useFormState(data) {
  const [values, setValues] = useState({
    coverage_type: data.coverage_type || '',
    sum_assured: data.sum_assured || '',
    tenure_months: data.tenure_months || '',
    monthly_income: data.monthly_income || '',
    income_type: data.income_type || 'stable',
    health_declaration: !!data.health_declaration,
    existing_loans: data.existing_loans || '',
    occupation_risk: data.occupation_risk || 'Low',
    address_line: data.address_line || '',
    city: data.city || '',
    state: data.state || '',
    pincode: data.pincode || '',
  });
  const [income, setIncome] = useState({
    employer_name: data.income_details?.employer_name || '',
    job_title: data.income_details?.job_title || '',
    annual_income: data.income_details?.annual_income || '',
    notes: data.income_details?.notes || '',
  });
  const [gpay, setGpay] = useState({
    raw_text: data.gpay_history?.raw_text || '',
    monthly_estimate: data.gpay_history?.monthly_estimate || '',
  });

  React.useEffect(() => {
    setValues({
      coverage_type: data.coverage_type || '',
      sum_assured: data.sum_assured || '',
      tenure_months: data.tenure_months || '',
      monthly_income: data.monthly_income || '',
      income_type: data.income_type || 'stable',
      health_declaration: !!data.health_declaration,
      existing_loans: data.existing_loans || '',
      occupation_risk: data.occupation_risk || 'Low',
      address_line: data.address_line || '',
      city: data.city || '',
      state: data.state || '',
      pincode: data.pincode || '',
    });
    setIncome({
      employer_name: data.income_details?.employer_name || '',
      job_title: data.income_details?.job_title || '',
      annual_income: data.income_details?.annual_income || '',
      notes: data.income_details?.notes || '',
    });
    setGpay({
      raw_text: data.gpay_history?.raw_text || '',
      monthly_estimate: data.gpay_history?.monthly_estimate || '',
    });
  }, [data]);

  return {
    values,
    income,
    gpay,
    set: (k, v) => setValues((s) => ({ ...s, [k]: v })),
    setIncome: (k, v) => setIncome((s) => ({ ...s, [k]: v })),
    setGpay: (k, v) => setGpay((s) => ({ ...s, [k]: v })),
  };
}

export default App;
