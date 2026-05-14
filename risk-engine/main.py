from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from engine import analyze_risk

app = FastAPI(title="AutoUW Risk Engine")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class ApplicationData(BaseModel):
    applicantId: str
    incomeType: str # "stable" or "gig"
    monthlyIncome: float
    healthDeclaration: bool # True if has issues
    existingLoans: float
    occupationRisk: str # "Low", "Medium", "High"
    utilityScore: float # 0 - 100
    gigWorkVolatility: float # 0 - 100 (high is more volatile)
    nightShiftPercentage: float # 0 - 100

@app.post("/analyze-risk")
async def analyze_risk_endpoint(data: ApplicationData):
    result = analyze_risk(data.model_dump())
    return result

@app.get("/health")
async def health_check():
    return {"status": "ok"}
