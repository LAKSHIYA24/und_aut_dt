# AutoUW Project - Run Commands with MongoDB

## Prerequisites
- MongoDB is running on `localhost:27017`
- Database: `autodb` 
- Node.js and npm installed

## Project Structure
- **Applicant Portal Backend**: Port 4100
- **Underwriter Dashboard Backend**: Port 4102
- **Risk Engine**: Port 5100
- **Root Frontend (Admin Dashboard)**: Port 5173
- **Applicant Portal Frontend**: Port 5174
- **Underwriter Dashboard Frontend**: Port 5175

---

## Step-by-Step Run Commands

### Step 1: Start Applicant Portal Backend (Terminal 1)
```bash
cd modules/applicant-portal/backend
npm start
```
**Expected Output**: `Applicant API on 4100`

---

### Step 2: Start Underwriter Dashboard Backend (Terminal 2)
```bash
cd modules/underwriter-dashboard/backend
npm start
```
**Expected Output**: `Underwriter API on 4102`

---

### Step 3: Start Risk Engine Backend (Terminal 3)
```bash
cd modules/risk-engine
npm start
```
**Expected Output**: `Risk engine (Node) on 5100`

---

### Step 4: Start Root Frontend - Admin Dashboard (Terminal 4)
```bash
cd frontend
npm run dev
```
**Access**: `http://localhost:5173`

---

### Step 5: Start Applicant Portal Frontend (Terminal 5)
```bash
cd modules/applicant-portal/frontend
npm run dev
```
**Access**: `http://localhost:5174`

---

### Step 6: Start Underwriter Dashboard Frontend (Terminal 6)
```bash
cd modules/underwriter-dashboard/frontend
npm run dev
```
**Access**: `http://localhost:5175`

---

## MongoDB Connection Details

All services are configured to connect to:
- **Connection String**: `mongodb://127.0.0.1:27017/autodb`
- **Database**: `autodb`
- **Configured in**: Each service's `.env` file (MONGODB_URI and MONGODB_DB)

### Collections Created Automatically
When you first run the services, these MongoDB collections will be created:
- `users` - User accounts and authentication
- `applications` - Insurance applications
- `documents` - Uploaded documents (utility, GPay, income)
- `income_details` - Income information
- `gpay_history` - GPay transaction history
- `risk_assessments` - Risk evaluation results

---

## Default Admin Login

**Email**: `admin@autouw.gov`  
**Password**: `ChangeMe!Admin1`

Access admin dashboard at: `http://localhost:5173`

---

## Quick Start (All Services)

If you want to run all services at once, open multiple terminals and run these commands simultaneously:

```bash
# Terminal 1 - Applicant Backend
cd modules/applicant-portal/backend && npm start

# Terminal 2 - Underwriter Backend
cd modules/underwriter-dashboard/backend && npm start

# Terminal 3 - Risk Engine
cd modules/risk-engine && npm start

# Terminal 4 - Root Frontend
cd frontend && npm run dev

# Terminal 5 - Applicant Frontend
cd modules/applicant-portal/frontend && npm run dev

# Terminal 6 - Underwriter Frontend
cd modules/underwriter-dashboard/frontend && npm run dev
```

---

## Service Health Checks

- **Applicant API**: http://localhost:4100/health
- **Underwriter API**: http://localhost:4102/health
- **Risk Engine**: http://localhost:5100/health

---

## Workflow

1. **Applicant**: Sign up and submit application → http://localhost:5174
2. **System**: Risk engine automatically evaluates
3. **Admin**: Review cases in admin dashboard → http://localhost:5173
4. **Admin**: Make approval/rejection decisions

---

## Troubleshooting

### MongoDB Connection Issues
- Verify MongoDB is running: `mongo --eval "db.version()"`
- Check connection string in each service's `.env` file
- Ensure `MONGODB_URI=mongodb://127.0.0.1:27017/autodb`

### Port Already in Use
- Applicant Backend conflicts: Kill process on port 4100
- Underwriter Backend conflicts: Kill process on port 4102
- Risk Engine conflicts: Kill process on port 5100

### Database Reset
To reset all MongoDB data:
```bash
mongo autodb --eval "db.dropDatabase()"
```

---

## Environment Variables

Each service uses `.env` file with:
- `MONGODB_URI` - MongoDB connection string
- `MONGODB_DB` - Database name
- `JWT_SECRET` - Authentication secret
- `SERVICE_SECRET` - Inter-service authentication
- `PORT` - Service port
- `ADMIN_SEED_PASSWORD` - Admin user password

