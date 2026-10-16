const mongoose = require('mongoose');

// An ID issued by an admin. An employee must present an unclaimed one to register.
const schema = new mongoose.Schema(
  {
    employeeId: { type: String, required: true, unique: true, uppercase: true, trim: true },
    department: { type: String, trim: true, maxlength: 60, default: '' },
    claimedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('EmployeeId', schema);
