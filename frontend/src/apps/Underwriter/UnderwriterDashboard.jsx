import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, Badge, Button, Input } from '../../components/ui';
import { Search, Filter, ShieldAlert, CheckCircle, XCircle, Clock } from 'lucide-react';

export default function UnderwriterDashboard() {
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('ALL');
  const [search, setSearch] = useState('');

  const fetchApplications = async () => {
    try {
      const res = await fetch('http://localhost:5000/api/autouw/applications');
      const data = await res.json();
      setApplications(data);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchApplications();
    // Refresh every 5 seconds
    const interval = setInterval(fetchApplications, 5000);
    return () => clearInterval(interval);
  }, []);

  const filteredApps = applications.filter(app => {
    const matchesFilter = filter === 'ALL' || app.decision === filter;
    const matchesSearch = app.appId?.toLowerCase().includes(search.toLowerCase()) || 
                          app.name?.toLowerCase().includes(search.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-bold text-govNavy">Underwriter Admin Console</h1>
          <p className="text-gray-600">Application Queue & AI Risk Assessment Monitoring</p>
        </div>
        <div className="flex gap-2 w-full md:w-auto">
          <div className="relative flex-1 md:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input 
              placeholder="Search ID or Name" 
              className="pl-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <select 
            className="flex h-10 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-govNavy"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          >
            <option value="ALL">All Decisions</option>
            <option value="APPROVED">Approved</option>
            <option value="REJECTED">Rejected</option>
            <option value="REFER FOR REVIEW">Refer for Review</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <Card className="bg-blue-50 border-blue-100">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-blue-800 text-sm font-medium">Total Applications</p>
              <h3 className="text-2xl font-bold text-blue-900">{applications.length}</h3>
            </div>
            <div className="p-2 bg-blue-100 rounded-full"><Clock className="w-5 h-5 text-blue-600"/></div>
          </CardContent>
        </Card>
        <Card className="bg-green-50 border-green-100">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-green-800 text-sm font-medium">Auto-Approved</p>
              <h3 className="text-2xl font-bold text-green-900">
                {applications.filter(a => a.decision === 'APPROVED').length}
              </h3>
            </div>
            <div className="p-2 bg-green-100 rounded-full"><CheckCircle className="w-5 h-5 text-green-600"/></div>
          </CardContent>
        </Card>
        <Card className="bg-yellow-50 border-yellow-100">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-yellow-800 text-sm font-medium">Referred for Review</p>
              <h3 className="text-2xl font-bold text-yellow-900">
                {applications.filter(a => a.decision === 'REFER FOR REVIEW').length}
              </h3>
            </div>
            <div className="p-2 bg-yellow-100 rounded-full"><ShieldAlert className="w-5 h-5 text-yellow-600"/></div>
          </CardContent>
        </Card>
        <Card className="bg-red-50 border-red-100">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-red-800 text-sm font-medium">Rejected</p>
              <h3 className="text-2xl font-bold text-red-900">
                {applications.filter(a => a.decision === 'REJECTED').length}
              </h3>
            </div>
            <div className="p-2 bg-red-100 rounded-full"><XCircle className="w-5 h-5 text-red-600"/></div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Application Queue</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-6 py-3 text-gray-500 font-medium">App ID</th>
                  <th className="px-6 py-3 text-gray-500 font-medium">Applicant</th>
                  <th className="px-6 py-3 text-gray-500 font-medium">Category</th>
                  <th className="px-6 py-3 text-gray-500 font-medium">Risk Score</th>
                  <th className="px-6 py-3 text-gray-500 font-medium">Flags</th>
                  <th className="px-6 py-3 text-gray-500 font-medium">Decision</th>
                  <th className="px-6 py-3 text-gray-500 font-medium">Action</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan="7" className="text-center py-8 text-gray-500">Loading queue...</td></tr>
                ) : filteredApps.length === 0 ? (
                  <tr><td colSpan="7" className="text-center py-8 text-gray-500">No applications found.</td></tr>
                ) : (
                  filteredApps.slice().reverse().map((app, idx) => (
                    <tr key={idx} className="border-b hover:bg-gray-50">
                      <td className="px-6 py-4 font-mono font-medium text-gray-900">{app.appId}</td>
                      <td className="px-6 py-4">{app.name || 'Unknown'}</td>
                      <td className="px-6 py-4 capitalize">{app.incomeType}</td>
                      <td className="px-6 py-4">
                        <span className={`font-bold ${app.riskScore >= 80 ? 'text-green-600' : app.riskScore >= 50 ? 'text-yellow-600' : 'text-red-600'}`}>
                          {app.riskScore}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        {app.fraudFlags?.length > 0 ? (
                          <span className="flex items-center text-red-600 text-xs font-semibold gap-1">
                            <ShieldAlert className="w-3 h-3" /> {app.fraudFlags.length} Flags
                          </span>
                        ) : (
                          <span className="text-gray-400 text-xs">None</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <Badge variant={app.decision === 'APPROVED' ? 'success' : app.decision === 'REJECTED' ? 'danger' : 'warning'}>
                          {app.decision}
                        </Badge>
                      </td>
                      <td className="px-6 py-4">
                        <Button variant="outline" className="text-xs h-8 px-3">View Details</Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
