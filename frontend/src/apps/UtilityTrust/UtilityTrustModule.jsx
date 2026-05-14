import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, Button, Badge } from '../../components/ui';
import { UploadCloud, FileText, CheckCircle, ShieldAlert } from 'lucide-react';

export default function UtilityTrustModule() {
  const [file, setFile] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [result, setResult] = useState(null);

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const handleUpload = async () => {
    if (!file) return;
    setIsUploading(true);
    
    // Simulate upload and OCR delay
    try {
      const res = await fetch('http://localhost:5000/api/utility/upload', {
        method: 'POST'
      });
      const data = await res.json();
      setResult(data);
    } catch (e) {
      console.error(e);
    }
    
    setIsUploading(false);
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="text-center space-y-2 mb-8">
        <h1 className="text-3xl font-bold text-govNavy">UtilityTrust Verification</h1>
        <p className="text-gray-600">Establish residential stability through utility bill analysis.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <FileText className="w-5 h-5 text-govNavy" />
            <span>Upload Utility Bill (Electricity/Water/Internet)</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-6 space-y-6">
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-12 text-center bg-gray-50 hover:bg-gray-100 transition-colors">
            <UploadCloud className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-sm text-gray-600 mb-2">Drag and drop your bill here, or click to browse</p>
            <p className="text-xs text-gray-400 mb-4">Supported formats: PDF, JPG, PNG (Max 5MB)</p>
            
            <input 
              type="file" 
              id="file-upload" 
              className="hidden" 
              onChange={handleFileChange} 
              accept=".pdf,.jpg,.jpeg,.png" 
            />
            <Button as="label" htmlFor="file-upload" variant="outline" className="cursor-pointer">
              {file ? file.name : "Select File"}
            </Button>
          </div>

          <Button 
            onClick={handleUpload} 
            disabled={!file || isUploading} 
            className="w-full"
          >
            {isUploading ? 'Extracting & Analyzing Data...' : 'Verify Document'}
          </Button>
        </CardContent>
      </Card>

      {result && (
        <Card className="border-green-600 border-t-4">
          <CardHeader className="bg-white pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <CheckCircle className="text-green-600 w-5 h-5" /> Analysis Complete
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-gray-50 p-4 rounded border">
                <p className="text-xs text-gray-500 uppercase font-semibold">Extracted Address</p>
                <p className="text-sm font-medium mt-1 text-gray-900">{result.extractedAddress}</p>
              </div>
              <div className="bg-gray-50 p-4 rounded border">
                <p className="text-xs text-gray-500 uppercase font-semibold">Consistency Score</p>
                <div className="flex items-center gap-2 mt-1">
                  <p className="text-2xl font-bold text-gray-900">{result.consistencyScore}/100</p>
                  <Badge variant={result.consistencyScore > 70 ? 'success' : 'warning'}>
                    {result.consistencyScore > 70 ? 'High' : 'Medium'} Stability
                  </Badge>
                </div>
              </div>
            </div>
            <div className={`p-3 rounded-md text-sm flex items-center gap-2 ${result.consistencyScore > 70 ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-yellow-50 text-yellow-800 border border-yellow-200'}`}>
              <ShieldAlert className="w-4 h-4" />
              <span>{result.message}</span>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
