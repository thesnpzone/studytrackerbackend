const mongoose = require("mongoose"); // Study Tracking Schema
const studyTrackingSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'User' }, // Reference to User schema
    subject: { type: String, required: true },
    topic: { type: String, required: true },
    questionsAttempted: { type: [Number], required: true },
    questionsSolvedCorrectly: { type: [Number], required: true },
    percentage: { type: [Number], required: true },
    submittedOn: { type: [String], required: true }, // Ensure this is a string formatted as 'DD-MM-YYYY'
    submissionStatus: { type: Boolean, default: false },
});

// Create a unique index on userId and topic
studyTrackingSchema.index({ userId: 1, topic: 1, submittedOn: 1 }, { unique: true });

const StudyTracking = mongoose.model("StudyTracking", studyTrackingSchema);
module.exports = StudyTracking;