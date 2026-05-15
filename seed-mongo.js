const { MongoClient, ObjectId } = require('mongodb');

const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017';
const dbName = process.env.MONGODB_DB || 'autodb';

async function main() {
  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db(dbName);

  const users = [
    {
      _id: new ObjectId(),
      email: 'mira.patel@example.com',
      role: 'applicant',
      created_at: new Date(),
    },
    {
      _id: new ObjectId(),
      email: 'rahul.sharma@example.com',
      role: 'applicant',
      created_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 10),
    },
    {
      _id: new ObjectId(),
      email: 'neha.singh@example.com',
      role: 'applicant',
      created_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 12),
    },
    {
      _id: new ObjectId(),
      email: 'anita.kumar@example.com',
      role: 'applicant',
      created_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 8),
    },
  ];

  const applicants = [
    {
      _id: new ObjectId(),
      user_id: users[0]._id,
      applicant_email: users[0].email,
      coverage_type: 'term',
      monthly_income: 45000,
      sum_assured: 500000,
      income_type: 'salaried',
      address_line: '12 Green Valley',
      city: 'Ahmedabad',
      state: 'Gujarat',
      pincode: '380050',
      status: 'submitted',
      created_at: new Date(),
    },
    {
      _id: new ObjectId(),
      user_id: users[1]._id,
      applicant_email: users[1].email,
      coverage_type: 'health',
      monthly_income: 32000,
      sum_assured: 300000,
      income_type: 'self-employed',
      address_line: '9 Lotus Street',
      city: 'Pune',
      state: 'Maharashtra',
      pincode: '411028',
      status: 'approved',
      created_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2),
    },
    {
      _id: new ObjectId(),
      user_id: users[2]._id,
      applicant_email: users[2].email,
      coverage_type: 'family',
      monthly_income: 65000,
      sum_assured: 800000,
      income_type: 'salaried',
      address_line: '24 Palm Avenue',
      city: 'Bangalore',
      state: 'Karnataka',
      pincode: '560076',
      status: 'rejected',
      created_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 5),
    },
    {
      _id: new ObjectId(),
      user_id: users[3]._id,
      applicant_email: users[3].email,
      coverage_type: 'term',
      monthly_income: 28500,
      sum_assured: 350000,
      income_type: 'self-employed',
      address_line: '7 Jasmine Road',
      city: 'Jaipur',
      state: 'Rajasthan',
      pincode: '302015',
      status: 'referred',
      created_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 1),
    },
  ];

  const incomeDetails = [
    {
      _id: new ObjectId(),
      application_id: applicants[0]._id,
      employer_name: 'Mira Patel',
      job_title: 'Software Engineer',
      annual_income: 540000,
      notes: 'Verified salary slips and employer certificate.',
      created_at: new Date(),
    },
    {
      _id: new ObjectId(),
      application_id: applicants[1]._id,
      employer_name: 'Rahul Sharma',
      job_title: 'Freelance Consultant',
      annual_income: 408000,
      notes: 'Self-employed income validated through bank statements.',
      created_at: new Date(),
    },
  ];

  const gpayHistory = [
    {
      _id: new ObjectId(),
      application_id: applicants[0]._id,
      monthly_estimate: 42000,
      raw_text: 'Estimated from GPay summary for last 3 months.',
      created_at: new Date(),
    },
    {
      _id: new ObjectId(),
      application_id: applicants[1]._id,
      monthly_estimate: 31000,
      raw_text: 'Estimated from GPay summary for Jan.',
      created_at: new Date(),
    },
  ];

  const riskAssessments = [
    {
      _id: new ObjectId(),
      application_id: applicants[1]._id,
      risk_score: 78,
      classification: 'APPROVED',
      recommendation: 'Eligible for coverage',
      principal_amount: 300000,
      eligibility: 'High',
      explanation: 'Stable income, clean payment history, and low fraud score.',
      fraud_indicators_json: JSON.stringify([]),
      underwriter_status: 'approved',
      created_at: new Date(),
    },
    {
      _id: new ObjectId(),
      application_id: applicants[2]._id,
      risk_score: 42,
      classification: 'REJECTED',
      recommendation: 'Decline due to low payment consistency',
      principal_amount: 0,
      eligibility: 'Low',
      explanation: 'High mismatch between declared income and bank behavior.',
      fraud_indicators_json: JSON.stringify(['GPay mismatch', 'Low stability']),
      underwriter_status: 'rejected',
      created_at: new Date(),
    },
    {
      _id: new ObjectId(),
      application_id: applicants[3]._id,
      risk_score: 56,
      classification: 'REFER',
      recommendation: 'Requires manual review for additional documents',
      principal_amount: 200000,
      eligibility: 'Moderate',
      explanation: 'Self-employed income needs additional verification.',
      fraud_indicators_json: JSON.stringify(['Self-employment income variance']),
      underwriter_status: 'pending',
      created_at: new Date(),
    },
  ];

  const documents = [
    {
      _id: new ObjectId(),
      application_id: applicants[0]._id,
      doc_type: 'utility',
      original_name: 'mira_utility.pdf',
      created_at: new Date(),
    },
    {
      _id: new ObjectId(),
      application_id: applicants[1]._id,
      doc_type: 'income_proof',
      original_name: 'rahul_income.pdf',
      created_at: new Date(),
    },
  ];

  await db.collection('users').deleteMany({ role: 'applicant' });
  await db.collection('applications').deleteMany({});
  await db.collection('income_details').deleteMany({});
  await db.collection('gpay_history').deleteMany({});
  await db.collection('risk_assessments').deleteMany({});
  await db.collection('documents').deleteMany({});

  await db.collection('users').insertMany(users);
  await db.collection('applications').insertMany(applicants);
  await db.collection('income_details').insertMany(incomeDetails);
  await db.collection('gpay_history').insertMany(gpayHistory);
  await db.collection('risk_assessments').insertMany(riskAssessments);
  await db.collection('documents').insertMany(documents);

  console.log(`Seeded ${dbName} with ${applicants.length} applications and ${riskAssessments.length} risk records.`);
  await client.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
