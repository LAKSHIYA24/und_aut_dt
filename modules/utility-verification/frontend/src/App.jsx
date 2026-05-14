import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, Button, Input, Label } from './components/ui.jsx';
import { Droplets } from 'lucide-react';

const API = import.meta.env.VITE_UTILITY_API || 'http://127.0.0.1:4103';

export default function App() {
  const [token, setToken] = useState(() => localStorage.getItem('autouw_utility_jwt'));
  const [appId, setAppId] = useState('');
  const [data, setData] = useState(null);
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);

  async function load() {
    setErr('');
    setLoading(true);
    const id = appId.trim();
    if (!id) {
      setErr('Application ID required');
      setLoading(false);
      return;
    }
    try {
      const r = await fetch(`${API}/api/verification/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const t = await r.text();
      const j = JSON.parse(t);
      if (!r.ok) throw new Error(j.error || t);
      setData(j);
    } catch (e) {
      setErr(e.message);
      setData(null);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-3xl px-6 py-6">
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">AutoUW</p>
          <h1 className="text-2xl font-semibold text-slate-900">Utility Verification Desk</h1>
          <p className="mt-1 text-slate-600">Review persisted utility consistency scores (REST-backed).</p>
        </div>
      </header>
      <main className="mx-auto max-w-3xl space-y-6 px-6 py-8">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Droplets className="h-5 w-5 text-govNavy" /> Lookup
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>JWT (applicant or admin)</Label>
              <Input
                value={token || ''}
                onChange={(e) => {
                  setToken(e.target.value);
                  localStorage.setItem('autouw_utility_jwt', e.target.value);
                }}
              />
            </div>
            <div className="max-w-xs">
              <Label>Application ID</Label>
              <Input value={appId} onChange={(e) => setAppId(e.target.value)} />
            </div>
            <Button onClick={load} disabled={loading}>
              {loading ? 'Loading…' : 'Load verification record'}
            </Button>
            {err && <p className="text-sm text-govRed">{err}</p>}
          </CardContent>
        </Card>
        {data && (
          <Card>
            <CardHeader>
              <CardTitle>Record</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between border-b border-slate-100 py-2">
                <span className="text-slate-500">Status</span>
                <span className="font-medium capitalize">{data.status}</span>
              </div>
              <div className="flex justify-between border-b border-slate-100 py-2">
                <span className="text-slate-500">Consistency score</span>
                <span className="font-medium">{data.consistency_score?.toFixed?.(1) ?? data.consistency_score}</span>
              </div>
              <div className="py-2">
                <p className="text-slate-500">Extracted / matched address</p>
                <p className="mt-1 text-slate-900">{data.extracted_address}</p>
              </div>
              <div className="py-2">
                <p className="text-slate-500">Notes</p>
                <p className="mt-1 text-slate-800">{data.notes}</p>
              </div>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
