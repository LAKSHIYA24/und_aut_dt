import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, Button, Input, Label } from './components/ui.jsx';
import { Activity, IndianRupee, UserCircle2 } from 'lucide-react';

const API = import.meta.env.VITE_WORKER_API || 'http://127.0.0.1:4101';

export default function App() {
  const [token, setToken] = useState(() => localStorage.getItem('autouw_worker_jwt'));
  const [appId, setAppId] = useState('');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const [profile, setProfile] = useState(null);
  const [earnings, setEarnings] = useState(null);
  const [activity, setActivity] = useState(null);
  const [risk, setRisk] = useState(null);

  async function load() {
    setErr('');
    setLoading(true);
    const id = appId.trim();
    if (!id) {
      setErr('Enter application ID');
      setLoading(false);
      return;
    }
    const h = { Authorization: `Bearer ${token}` };
    try {
      const [p, e, a, r] = await Promise.all([
        fetch(`${API}/worker/profile?applicationId=${id}`, { headers: h }).then(async (x) => {
          if (!x.ok) throw new Error(await x.text());
          return x.json();
        }),
        fetch(`${API}/worker/earnings?applicationId=${id}`, { headers: h }).then(async (x) => {
          if (!x.ok) throw new Error(await x.text());
          return x.json();
        }),
        fetch(`${API}/worker/activity?applicationId=${id}`, { headers: h }).then(async (x) => {
          if (!x.ok) throw new Error(await x.text());
          return x.json();
        }),
        fetch(`${API}/worker/risk-data?applicationId=${id}`, { headers: h }).then(async (x) => {
          if (!x.ok) throw new Error(await x.text());
          return x.json();
        }),
      ]);
      setProfile(p);
      setEarnings(e);
      setActivity(a);
      setRisk(r);
    } catch (e) {
      setErr(e.message || 'Failed to load worker APIs');
      setProfile(null);
      setEarnings(null);
      setActivity(null);
      setRisk(null);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-5xl px-6 py-6">
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">AutoUW</p>
          <h1 className="text-2xl font-semibold text-slate-900">Worker Service Console</h1>
          <p className="mt-1 text-slate-600">Read-only view of consolidated worker signals via REST.</p>
        </div>
      </header>
      <main className="mx-auto max-w-5xl space-y-6 px-6 py-8">
        <Card>
          <CardHeader>
            <CardTitle>API access</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-slate-600">
              Paste a JWT from the Applicant Portal (same signing secret). After an application is submitted, ingest populates{' '}
              <code className="rounded bg-slate-100 px-1">/worker/profile</code>, <code className="rounded bg-slate-100 px-1">/worker/earnings</code>,{' '}
              <code className="rounded bg-slate-100 px-1">/worker/activity</code>, and <code className="rounded bg-slate-100 px-1">/worker/risk-data</code>.
            </p>
            <div>
              <Label>JWT bearer token</Label>
              <Input
                value={token || ''}
                onChange={(e) => {
                  setToken(e.target.value);
                  localStorage.setItem('autouw_worker_jwt', e.target.value);
                }}
                placeholder="eyJhbGciOi..."
              />
            </div>
            <div className="max-w-xs">
              <Label>Application ID</Label>
              <Input value={appId} onChange={(e) => setAppId(e.target.value)} placeholder="e.g. 1" />
            </div>
            <Button onClick={load} disabled={loading}>
              {loading ? 'Loading…' : 'Fetch worker bundle'}
            </Button>
            {err && <p className="text-sm text-govRed">{err}</p>}
          </CardContent>
        </Card>
        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <UserCircle2 className="h-5 w-5" /> /worker/profile
              </CardTitle>
            </CardHeader>
            <CardContent>
              <pre className="max-h-80 overflow-auto rounded-lg bg-slate-50 p-3 text-xs">{profile ? JSON.stringify(profile, null, 2) : '—'}</pre>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <IndianRupee className="h-5 w-5" /> /worker/earnings
              </CardTitle>
            </CardHeader>
            <CardContent>
              <pre className="max-h-80 overflow-auto rounded-lg bg-slate-50 p-3 text-xs">{earnings ? JSON.stringify(earnings, null, 2) : '—'}</pre>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5" /> /worker/activity
              </CardTitle>
            </CardHeader>
            <CardContent>
              <pre className="max-h-80 overflow-auto rounded-lg bg-slate-50 p-3 text-xs">{activity ? JSON.stringify(activity, null, 2) : '—'}</pre>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>/worker/risk-data</CardTitle>
            </CardHeader>
            <CardContent>
              <pre className="max-h-80 overflow-auto rounded-lg bg-slate-50 p-3 text-xs">{risk ? JSON.stringify(risk, null, 2) : '—'}</pre>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
