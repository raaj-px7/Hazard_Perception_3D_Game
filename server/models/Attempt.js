const mongoose = require('mongoose');

const schema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    employeeId: { type: String },
    attemptNo: { type: Number, required: true },
    status: { type: String, enum: ['quiz', 'inspecting', 'completed', 'abandoned'], default: 'quiz' },
    quiz: {
      questionIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Question' }],
      answers: [Number],
      correctCount: Number,
      total: Number,
      submittedAt: Date,
    },
    startedAt: Date,
    finishedAt: Date,
    // The objects drawn for this attempt (set when the quiz is submitted). oid is what the browser sees;
    // kind and ref never leave the server until the object is inspected. Old attempts have no layout.
    layout: [{ _id: false, oid: String, kind: { type: String, enum: ['hazard', 'safe'] }, ref: String, slot: String }],
    // Inspection progress, recorded click by click by the server (these hold pool ids, i.e. `ref`).
    foundHazardIds: { type: [String], default: [] },
    safeClickedIds: { type: [String], default: [] },
    events: [{ _id: false, objectId: String, kind: String, at: Number, delta: Number }],
    // Final result (percentage score), set once when the inspection ends.
    result: {
      score: Number,
      hazardsFound: Number,
      safeMistakes: Number,
      accuracy: Number,
      grade: String,
      title: String,
      qualified: Boolean,
      durationSeconds: Number,
      endReason: String, // completed | timeup | exit
      // Set only when the attempt qualified (see lib/certification.js). Older qualified attempts have none and are computed.
      certificate: { number: String, issuedAt: Date, expiresAt: Date },
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Attempt', schema);
