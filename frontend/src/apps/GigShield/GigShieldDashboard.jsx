import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, Badge } from '../../components/ui';
import { TrendingUp, TrendingDown, IndianRupee, Clock, MapPin, Activity } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';

export default function GigShieldDashboard() {
  const [profile, setProfile] = useState(null);
  const [earnings, setEarnings] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [profileRes, earningsRes] = await Promise.all([
          fetch('http://localhost:5000/api/gig/worker/profile'),
          fetch('http://localhost:5000/api/gig/worker/earnings')
        ]);
        const profileData = await profileRes.json();
        const earningsData = await earningsRes.json();
        setProfile(profileData);
        setEarnings(earningsData);
      } catch (e) {
        console.error(e);
      }
      setLoading(false);
    };
    fetchData();
  }, []);

  if (loading) return <div className="text-center p-12 text-gray-500">Loading GigShield Ecosystem...</div>;

  const latestEarning = earnings[earnings.length - 1];
  const previousEarning = earnings[earnings.length - 2];
  const isUp = latestEarning.amount > previousEarning.amount;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end mb-8 border-b pb-4">
        <div>
          <h1 className="text-3xl font-bold text-govNavy mb-1">GigShield Worker Dashboard</h1>
          <p className="text-gray-600">Dynamic Income & Premium Protection for {profile?.name}</p>
        </div>
        <div className="text-right">
          <Badge className="text-sm bg-blue-100 text-blue-800 border border-blue-200 py-1 px-3">
            {profile?.platform}
          </Badge>
          <p className="text-sm text-gray-500 mt-2">Worker ID: {profile?.id} • Rating: {profile?.rating}★</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="bg-gradient-to-br from-govNavy to-blue-800 text-white border-none">
          <CardContent className="p-6">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-blue-200 text-sm font-medium mb-1">This Month Earnings</p>
                <h3 className="text-3xl font-bold flex items-center">
                  <IndianRupee className="w-6 h-6 mr-1" /> {latestEarning?.amount}
                </h3>
              </div>
              <div className={`p-2 rounded-full ${isUp ? 'bg-green-500/20 text-green-300' : 'bg-red-500/20 text-red-300'}`}>
                {isUp ? <TrendingUp className="w-5 h-5" /> : <TrendingDown className="w-5 h-5" />}
              </div>
            </div>
            <p className="text-blue-200 text-xs mt-4">Calculated across all connected platforms</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-gray-500 text-sm font-medium mb-1">Dynamic Premium Due</p>
                <h3 className="text-3xl font-bold text-gray-900 flex items-center">
                  <IndianRupee className="w-6 h-6 mr-1" /> {latestEarning?.premium}
                </h3>
              </div>
              <div className="p-2 rounded-full bg-orange-100 text-orange-600">
                <Activity className="w-5 h-5" />
              </div>
            </div>
            <p className="text-gray-500 text-xs mt-4 flex items-center gap-1">
              {isUp ? <TrendingUp className="w-3 h-3 text-red-500"/> : <TrendingDown className="w-3 h-3 text-green-500"/>} 
              Adjusted based on this month's income volatility
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-gray-500 text-sm font-medium mb-1">Active Hours / Trips</p>
                <h3 className="text-3xl font-bold text-gray-900">
                  184 <span className="text-lg text-gray-500 font-normal">hrs</span> / 412
                </h3>
              </div>
              <div className="p-2 rounded-full bg-green-100 text-green-600">
                <Clock className="w-5 h-5" />
              </div>
            </div>
            <p className="text-gray-500 text-xs mt-4">24% Night shift exposure detected</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold">Income History (6 Months)</CardTitle>
          </CardHeader>
          <CardContent className="h-64 pt-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={earnings}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="month" axisLine={false} tickLine={false} />
                <YAxis axisLine={false} tickLine={false} tickFormatter={(value) => `₹${value/1000}k`} />
                <Tooltip cursor={{fill: '#f4f5f7'}} formatter={(value) => [`₹${value}`, 'Earnings']} />
                <Bar dataKey="amount" fill="#002f6c" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold">Dynamic Premium Tracking</CardTitle>
          </CardHeader>
          <CardContent className="h-64 pt-4">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={earnings}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="month" axisLine={false} tickLine={false} />
                <YAxis axisLine={false} tickLine={false} domain={['dataMin - 50', 'dataMax + 50']} />
                <Tooltip formatter={(value) => [`₹${value}`, 'Premium']} />
                <Line type="monotone" dataKey="premium" stroke="#2e7d32" strokeWidth={3} dot={{r: 4, strokeWidth: 2}} activeDot={{r: 6}} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
