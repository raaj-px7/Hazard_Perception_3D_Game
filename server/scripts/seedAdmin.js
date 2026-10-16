require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const EmployeeId = require('../models/EmployeeId');
const { COMPANY } = require('../lib/company');

(async () => {
  const { MONGODB_URI, ADMIN_NAME, ADMIN_EMAIL, ADMIN_PASSWORD } = process.env;
  const adminId = (process.env.ADMIN_EMPLOYEE_ID || 'ADM-001').trim().toUpperCase();
  if (!MONGODB_URI || !ADMIN_EMAIL || !ADMIN_PASSWORD) {
    console.error('Set MONGODB_URI, ADMIN_EMAIL and ADMIN_PASSWORD in .env first.');
    process.exit(1);
  }
  await mongoose.connect(MONGODB_URI);
  const email = ADMIN_EMAIL.toLowerCase();
  let admin = await User.findOne({ email });
  if (admin) {
    // An admin created by an earlier version gets the company and ID it was missing.
    const fix = {};
    if (!admin.company) fix.company = COMPANY;
    if (!admin.employeeId) fix.employeeId = adminId;
    if (Object.keys(fix).length) { await User.updateOne({ _id: admin._id }, fix); console.log(`Updated admin ${email}:`, fix); }
    else console.log(`A user with ${email} already exists. Nothing changed.`);
    admin = await User.findById(admin._id);
  } else {
    admin = await User.create({ name: ADMIN_NAME || 'Admin', email, passwordHash: await bcrypt.hash(ADMIN_PASSWORD, 12), role: 'admin', company: COMPANY, employeeId: adminId });
    console.log(`Admin created: ${email} (${COMPANY}, ID ${adminId})`);
  }
  // Reserve the admin's ID so it can never be issued to an employee.
  await EmployeeId.updateOne({ employeeId: admin.employeeId }, { $setOnInsert: { employeeId: admin.employeeId, claimedBy: admin._id } }, { upsert: true });
  await mongoose.disconnect();
})().catch((e) => { console.error(e); process.exit(1); });
