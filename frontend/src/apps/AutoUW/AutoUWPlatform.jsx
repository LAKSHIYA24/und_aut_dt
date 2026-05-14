import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, Button, Input, Label, Badge } from '../../components/ui';
import { FileText, CheckCircle, ShieldAlert } from 'lucide-react';

export default function AutoUWPlatform() {
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    name: '',
    aadhaar: '',
    incomeType: 'stable',
    monthlyIncome: '',
    existingLoans: '',
    healthDeclaration: false,
    occupationRisk: 'Low'
  });
  const [isVerifying, setIsVerifying] = useState(false);
  const [kycStatus, setKycStatus] = useState(null);
  const [applicationResult, setApplicationResult] = useState(null);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const verifyKYC = async () => {
    setIsVerifying(true);
    try {
      const res = await fetch(`http://localhost:5000/api/gateway/digilocker/verify?aadhaar=${formData.aadhaar}`);
      const data = await res.json();
      setKycStatus(data.verified ? 'success' : 'failed');
      if (data.verified) {
        setFormData(prev => ({ ...prev, name: data.name }));
        setTimeout(() => setStep(2), 1000);
      }
    } catch (e) {
      setKycStatus('failed');
    }
    setIsVerifying(false);
  };

  const submitApplication = async () => {
    setIsVerifying(true);
    try {
      const payload = {
        ...formData,
        monthlyIncome: Number(formData.monthlyIncome),
        existingLoans: Number(formData.existingLoans)
      };
      const res = await fetch('http://localhost:5000/api/autouw/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      setApplicationResult(data.application);
      setStep(3);
    } catch (e) {
      console.error(e);
    }
    setIsVerifying(false);
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="text-center space-y-2 mb-8">
        <h1 className="text-3xl font-bold text-govNavy">National Underwriting Portal</h1>
        <p className="text-gray-600">Secure, AI-powered policy issuance for all workers.</p>
      </div>

      {step === 1 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <ShieldAlert className="w-5 h-5 text-govNavy" />
              <span>Step 1: Aadhaar eKYC Verification</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 pt-6">
            <div className="space-y-2">
              <Label>Aadhaar Number (Try 123412341234)</Label>
              <Input name="aadhaar" value={formData.aadhaar} onChange={handleChange} placeholder="Enter 12-digit Aadhaar" />
            </div>
            {kycStatus === 'failed' && <p className="text-sm text-red-600">Verification failed. Please check Aadhaar number.</p>}
            {kycStatus === 'success' && <p className="text-sm text-green-600 flex items-center gap-1"><CheckCircle className="w-4 h-4"/> Verification successful!</p>}
            <Button onClick={verifyKYC} disabled={isVerifying || !formData.aadhaar} className="w-full">
              {isVerifying ? 'Verifying with UIDAI...' : 'Proceed with eKYC'}
            </Button>
          </CardContent>
        </Card>
      )}

      {step === 2 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <FileText className="w-5 h-5 text-govNavy" />
              <span>Step 2: Financial & Health Declaration</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6 pt-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Applicant Name</Label>
                <Input value={formData.name} disabled className="bg-gray-50" />
              </div>
              <div className="space-y-2">
                <Label>Income Type</Label>
                <select name="incomeType" value={formData.incomeType} onChange={handleChange} className="flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-govNavy">
                  <option value="stable">Stable / Salaried</option>
                  <option value="gig">Gig / Informal Worker</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label>Monthly Income (₹)</Label>
                <Input name="monthlyIncome" type="number" value={formData.monthlyIncome} onChange={handleChange} placeholder="e.g. 25000" />
              </div>
              <div className="space-y-2">
                <Label>Existing EMI / Loans (₹)</Label>
                <Input name="existingLoans" type="number" value={formData.existingLoans} onChange={handleChange} placeholder="e.g. 5000" />
              </div>
              <div className="space-y-2">
                <Label>Occupation Risk</Label>
                <select name="occupationRisk" value={formData.occupationRisk} onChange={handleChange} className="flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-govNavy">
                  <option value="Low">Low (Office, Desk job)</option>
                  <option value="Medium">Medium (Field sales, Light manual)</option>
                  <option value="High">High (Delivery rider, Construction)</option>
                </select>
              </div>
            </div>
            
            <div className="flex items-center space-x-2 border p-4 rounded-md bg-gray-50">
              <input type="checkbox" id="healthDeclaration" name="healthDeclaration" checked={formData.healthDeclaration} onChange={handleChange} className="w-4 h-4 text-govNavy focus:ring-govNavy border-gray-300 rounded" />
              <Label htmlFor="healthDeclaration">I declare that I have pre-existing health conditions.</Label>
            </div>

            <Button onClick={submitApplication} disabled={isVerifying || !formData.monthlyIncome} className="w-full">
              {isVerifying ? 'Analyzing Risk Profile...' : 'Submit Application'}
            </Button>
          </CardContent>
        </Card>
      )}

      {step === 3 && applicationResult && (
        <Card className="border-govNavy border-t-4">
          <CardHeader className="bg-white">
            <CardTitle className="text-xl text-center">Application Submitted Successfully</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6 text-center">
            <div className="py-4">
              <p className="text-sm text-gray-500 mb-1">Application ID</p>
              <p className="text-2xl font-mono font-bold text-gray-900">{applicationResult.appId}</p>
            </div>
            
            <div className="grid grid-cols-2 gap-4 text-left">
              <div className="p-4 bg-gray-50 rounded-md border">
                <p className="text-sm text-gray-500">Decision</p>
                <Badge variant={applicationResult.decision === 'APPROVED' ? 'success' : applicationResult.decision === 'REJECTED' ? 'danger' : 'warning'} className="mt-1 text-sm px-3 py-1">
                  {applicationResult.decision}
                </Badge>
              </div>
              <div className="p-4 bg-gray-50 rounded-md border">
                <p className="text-sm text-gray-500">Recommended Premium</p>
                <p className="text-xl font-bold text-gray-900 mt-1">₹{applicationResult.recommendedPremium} / mo</p>
              </div>
              <div className="p-4 bg-gray-50 rounded-md border">
                <p className="text-sm text-gray-500">Risk Score</p>
                <p className="text-xl font-bold text-gray-900 mt-1">{applicationResult.riskScore}/100</p>
              </div>
              <div className="p-4 bg-gray-50 rounded-md border">
                <p className="text-sm text-gray-500">Income Category</p>
                <p className="text-lg font-medium text-gray-900 mt-1 capitalize">{applicationResult.incomeType}</p>
              </div>
            </div>

            {applicationResult.fraudFlags && applicationResult.fraudFlags.length > 0 && (
              <div className="bg-red-50 border border-red-200 text-red-800 p-4 rounded-md text-left">
                <p className="font-semibold text-sm mb-2 flex items-center gap-1"><ShieldAlert className="w-4 h-4"/> Risk Flags Detected:</p>
                <ul className="list-disc list-inside text-sm space-y-1">
                  {applicationResult.fraudFlags.map((flag, idx) => <li key={idx}>{flag}</li>)}
                </ul>
              </div>
            )}

            <Button onClick={() => setStep(1)} variant="outline" className="mt-4">Start New Application</Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
