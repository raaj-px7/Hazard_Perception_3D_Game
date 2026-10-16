const mongoose = require('mongoose');

const schema = new mongoose.Schema(
  {
    text: { type: String, required: true, unique: true, trim: true },
    options: { type: [String], validate: (v) => v.length === 4, required: true },
    correctIndex: { type: Number, min: 0, max: 3, required: true },
    explanation: { type: String, default: '' },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Question', schema);
