const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(bodyParser.json());

// In-Memory Database for Mocking
const db = {
    users: [],
    applications: [],
    utilityBills: []
};

// ==========================================
// MOCK API GATEWAY
// ==========================================
app.get('/api/gateway/digilocker/verify', (req, res) => {
    const { aadhaar } = req.query;
    if (aadhaar === '123412341234') {
        return res.json({ verified: true, name: "Mock User", address: "123 Mock Street, Delhi" });
    }
    return res.json({ verified: false });
});

// ==========================================
// AUTOUW CORE PLATFORM
// ==========================================
app.post('/api/autouw/apply', async (req, res) => {
    const applicationData = req.body;
    
    // Assign Mock ID
    const appId = `APP-${Math.floor(Math.random() * 100000)}`;
    applicationData.appId = appId;
    applicationData.status = "PENDING";
    
    // Fetch Utility Score (Mock)
    applicationData.utilityScore = applicationData.utilityScore || Math.floor(Math.random() * 100);
    
    // If Gig worker, fetch gig data
    if (applicationData.incomeType === 'gig') {
        applicationData.gigWorkVolatility = Math.floor(Math.random() * 100);
        applicationData.nightShiftPercentage = Math.floor(Math.random() * 100);
    } else {
        applicationData.gigWorkVolatility = 0;
        applicationData.nightShiftPercentage = 0;
    }

    try {
        // Call Python Risk Engine
        // Use dynamic import for node-fetch to support commonjs
        const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
        const riskResponse = await fetch('http://127.0.0.1:8000/analyze-risk', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                applicantId: appId,
                incomeType: applicationData.incomeType,
                monthlyIncome: applicationData.monthlyIncome,
                healthDeclaration: applicationData.healthDeclaration,
                existingLoans: applicationData.existingLoans,
                occupationRisk: applicationData.occupationRisk,
                utilityScore: applicationData.utilityScore,
                gigWorkVolatility: applicationData.gigWorkVolatility,
                nightShiftPercentage: applicationData.nightShiftPercentage
            })
        });
        
        const riskResult = await riskResponse.json();
        
        // Save to DB
        const fullApplication = { ...applicationData, ...riskResult };
        db.applications.push(fullApplication);
        
        res.json({ success: true, application: fullApplication });
    } catch (error) {
        console.error("Error calling Risk Engine:", error);
        res.status(500).json({ error: "Failed to process application" });
    }
});

app.get('/api/autouw/applications', (req, res) => {
    res.json(db.applications);
});

// ==========================================
// GIGSHIELD WORKER APP API
// ==========================================
app.get('/api/gig/worker/profile', (req, res) => {
    res.json({
        id: "GW-1234",
        name: "Ramesh Kumar",
        platform: "Multi-Platform (Swiggy, Zomato, Uber)",
        rating: 4.8
    });
});

app.get('/api/gig/worker/earnings', (req, res) => {
    // Generate mock historical earnings
    const earnings = [
        { month: 'Jan', amount: 12000, premium: 500 },
        { month: 'Feb', amount: 15000, premium: 500 },
        { month: 'Mar', amount: 8000, premium: 400 }, // low income -> lower premium
        { month: 'Apr', amount: 28000, premium: 550 }, // high income -> higher premium
        { month: 'May', amount: 14000, premium: 500 },
        { month: 'Jun', amount: 18000, premium: 500 }
    ];
    res.json(earnings);
});

// ==========================================
// UTILITYTRUST MODULE
// ==========================================
app.post('/api/utility/upload', (req, res) => {
    // Simulate OCR delay
    setTimeout(() => {
        const mockScore = Math.floor(Math.random() * (100 - 40 + 1)) + 40; // 40-100
        res.json({
            success: true,
            extractedAddress: "456 Mock Lane, Mumbai",
            consistencyScore: mockScore,
            message: mockScore > 70 ? "Consistent Payment History" : "Irregular Payments Detected"
        });
    }, 1500);
});

app.listen(PORT, () => {
    console.log(`Backend Server running on port ${PORT}`);
});
