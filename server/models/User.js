const mongoose = require('mongoose');
const { COMPANY } = require('../lib/company');

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, minlength: 2, maxlength: 60 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: ['employee', 'admin'], default: 'employee', required: true },
    company: { type: String, trim: true, default: () => COMPANY },
    // Every account has an ID: employees get theirs from an admin-issued Employee ID, admins from the seed script.
    employeeId: { type: String, uppercase: true, trim: true, unique: true, sparse: true },
    department: { type: String, trim: true, maxlength: 60, default: '' },
    isActive: { type: Boolean, default: true },
    lastLoginAt: { type: Date },
  },
  { timestamps: true }
);

userSchema.methods.toPublic = function () {
  return { id: this._id, name: this.name, email: this.email, role: this.role, company: this.company || COMPANY, employeeId: this.employeeId, department: this.department };
};

module.exports = mongoose.model('User', userSchema);
