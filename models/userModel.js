const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
    fullName: { type: String, required: true },
    dob: { type: Date, required: true },
    city: { type: String, required: true },
    state: { type: String, required: true },
    phone: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    otp: { type: String },
    otpVerified: { type: Boolean, default: false },
    resetTokenUsed: { type: Boolean, default: false }, // New field to track if reset token has been used
    loginDisabled: { type: Boolean, default: false }, // New field to track if the user is disabled from logging in
});

const User = mongoose.model("User", userSchema);
module.exports = User;