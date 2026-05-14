def analyze_risk(data: dict) -> dict:
    score = 100
    flags = []
    
    # 1. Income Stability
    if data["incomeType"] == "gig":
        score -= (data["gigWorkVolatility"] * 0.2)  # max 20 pts deduction
        if data["gigWorkVolatility"] > 70:
            flags.append("High income volatility")
    else:
        if data["monthlyIncome"] < 15000:
            score -= 10
            
    # 2. Existing Loans Debt-to-Income (Simplified)
    if data["monthlyIncome"] > 0:
        dti = (data["existingLoans"] / data["monthlyIncome"]) * 100
        if dti > 50:
            score -= 20
            flags.append("High Debt-to-Income ratio")
        elif dti > 30:
            score -= 10
            
    # 3. Health Declaration
    if data["healthDeclaration"]:
        score -= 15
        flags.append("Pre-existing health condition declared")
        
    # 4. Occupation Risk
    if data["occupationRisk"] == "High":
        score -= 15
    elif data["occupationRisk"] == "Medium":
        score -= 5
        
    # 5. Utility Score (Residential Stability)
    if data["utilityScore"] < 50:
        score -= 10
        flags.append("Low residential stability")
        
    # 6. Night Shift Exposure (for Gig Workers)
    if data["nightShiftPercentage"] > 40:
        score -= 10
        flags.append("High night shift exposure")
        
    # Ensure score bounds
    score = max(0, min(100, score))
    
    # Determine Risk Level
    if score >= 80:
        risk_level = "Low"
        decision = "APPROVED"
    elif score >= 50:
        risk_level = "Medium"
        decision = "REFER FOR REVIEW"
    else:
        risk_level = "High"
        decision = "REJECTED"
        
    # Dynamic Premium Recommendation (Base: 500)
    base_premium = 500
    if risk_level == "Low":
        recommended_premium = base_premium
    elif risk_level == "Medium":
        recommended_premium = base_premium * 1.5
    else:
        recommended_premium = base_premium * 2.5
        
    # Gig Worker Volatility Adjustment
    if data["incomeType"] == "gig":
        if data["monthlyIncome"] > 30000:
             recommended_premium *= 1.1 # slightly higher in good months
        elif data["monthlyIncome"] < 10000:
             recommended_premium *= 0.8 # grace protection

    return {
        "riskScore": round(score),
        "riskLevel": risk_level,
        "fraudFlags": flags,
        "recommendedPremium": round(recommended_premium),
        "decision": decision
    }
