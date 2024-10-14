const mongoose = require('mongoose');

// Define Admin Schema
const adminSchema = new mongoose.Schema({
    fullName: { type: String, required: true },
    phone: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String }, // Add the password field here
});

const Admin = mongoose.model("Admin", adminSchema);

module.exports = Admin;