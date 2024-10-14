const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const nodemailer = require("nodemailer");
const crypto = require("crypto");
const Admin = require("../models/adminModel");
const User = require("../models/userModel.js");
const StudyTracking = require("../models/studyTrackingModel.js");
const { isAdminAuthenticated } = require("../middleware/auth");
const adminPasswordEmailTemplate = require("../Mailtemplates/adminPasswordEmailTemplate.js");
const registrationNotificationTemplate = require("../Mailtemplates/registrationNotificationTemplate.js");
const router = express.Router();

// Nodemailer configuration for OTP emails
const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
        user: process.env.EMAIL,
        pass: process.env.EMAIL_PASSWORD,
    },
});

const sendRegistrationNotification = async(userType, details) => {
    const { fullName, email } = details;
    const mailOptions = {
        from: process.env.EMAIL,
        to: process.env.NOTIFICATION_EMAIL, // Set your notification email here
        subject: `New ${userType} Registration`,
        html: registrationNotificationTemplate(fullName, email),
    };

    await transporter.sendMail(mailOptions);
};

// Generate a random password
const generateRandomPassword = () => {
    return crypto.randomBytes(6).toString("hex"); // 12 character random password
};

// Admin Registration Route
router.post("/register", async(req, res) => {
    const { fullName, phone, email } = req.body;

    try {
        // Check if the admin email already exists
        let admin = await Admin.findOne({ email });
        if (admin) {
            return res
                .status(400)
                .json({ message: "Admin with this email already exists" });
        }

        // Save new admin
        admin = new Admin({ fullName, phone, email });
        await admin.save();
        await sendRegistrationNotification("Admin", { fullName, email });
        res.status(201).json({ message: "Admin registered successfully" });
    } catch (error) {
        // // console.error("Error during admin registration:", error);
        res.status(500).json({ message: "Server error" });
    }
});

// Route for email verification and sending password
router.post("/verify-email", async(req, res) => {
    const { email } = req.body;

    try {
        const admin = await Admin.findOne({ email });
        if (!admin) {
            return res.status(404).json({ message: "Admin not found" });
        }

        // Generate a new password
        const newPassword = generateRandomPassword();
        const hashedPassword = await bcrypt.hash(newPassword, 10);

        // Update admin's password
        admin.password = hashedPassword; // Ensure password is saved
        await admin.save();

        // Send email with new password
        const mailOptions = {
            from: process.env.EMAIL,
            to: admin.email,
            subject: "Your Admin Login Password",
            html: adminPasswordEmailTemplate(newPassword),
        };

        transporter.sendMail(mailOptions, (err, info) => {
            if (err) {
                // // console.error("Error sending email: ", err);
                return res.status(500).json({ message: "Failed to send email" });
            }
            res.status(200).json({ message: "Password sent to your email" });
        });
    } catch (error) {
        // // console.error("Error verifying admin email: ", error);
        res.status(500).json({ message: "Server error" });
    }
});

// Admin login route
router.post("/login", async(req, res) => {
    const { email, password } = req.body;

    try {
        const admin = await Admin.findOne({ email });
        if (!admin) {
            return res.status(404).json({ message: "Admin not found" });
        }

        const isMatch = await bcrypt.compare(password, admin.password);
        if (!isMatch) {
            return res.status(400).json({ message: "Invalid password" });
        }

        // Generate JWT token for admin
        const token = jwt.sign({ id: admin._id }, process.env.JWT_SECRET);
        res.cookie("adminToken", token, {
            httpOnly: true, // Important for security
            secure: process.env.NODE_ENV === "development",
            sameSite: "Strict",
        });

        res.status(200).json({ message: "Login successful" });
    } catch (error) {
        // // console.error("Error logging in admin: ", error);
        res.status(500).json({ message: "Server error" });
    }
});

// Route to fetch admin details
router.get("/details", isAdminAuthenticated, async(req, res) => {
    try {
        const admin = await Admin.findById(req.adminId).select(
            "-_id fullName phone email"
        );

        if (!admin) {
            return res.status(404).json({ message: "Admin not found" });
        }

        res.status(200).json(admin);
    } catch (error) {
        // // console.error("Error fetching admin details:", error);
        res.status(500).json({ message: "Server error" });
    }
});

// Route to get user count
router.get("/user-count", isAdminAuthenticated, async(req, res) => {
    try {
        const userCount = await User.countDocuments(); // Count total users
        res.status(200).json({ userCount });
    } catch (error) {
        // // console.error("Error fetching user count:", error);
        res.status(500).json({ message: "Server error" });
    }
});

// Admin route to fetch all user details
router.get("/users", isAdminAuthenticated, async(req, res) => {
    try {
        const users = await User.find().select("-password"); // Fetch all users excluding the password
        res.status(200).json(users);
    } catch (error) {
        // // console.error("Error fetching users:", error);
        res.status(500).json({ message: "Server error" });
    }
});

// Admin route to fetch a user by ID
router.get("/user/:id", isAdminAuthenticated, async(req, res) => {
    try {
        const user = await User.findById(req.params.id).select(
            "-password -otp -resetTokenUsed -otpVerified -__v -_id"
        ); // Fetch user by ID excluding password
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }
        res.status(200).json(user);
    } catch (error) {
        // // console.error("Error fetching user details:", error);
        res.status(500).json({ message: "Server error" });
    }
});

// Route to toggle user login status
router.put("/user/:id/toggle-login", async(req, res) => {
    const userId = req.params.id;
    // // console.log("Received request to toggle login for user ID:", userId);

    try {
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        // Toggle the user's login ability
        user.loginDisabled = !user.loginDisabled; // Assuming you have a loginDisabled field in your user model
        await user.save();

        res.status(200).json({
            message: "User login status updated",
            loginDisabled: user.loginDisabled,
        });
    } catch (error) {
        // // console.error("Error toggling user login status:", error);
        res.status(500).json({ message: "Server error" });
    }
});

// Route to get study data for a specific user
router.get("/user/:id/study-data", isAdminAuthenticated, async(req, res) => {
    try {
        const { id } = req.params;
        const studyData = await StudyTracking.find({ userId: id });
        if (!studyData.length) {
            return res
                .status(404)
                .json({ message: "No study data found for this user." });
        }
        res.status(200).json(studyData);
    } catch (error) {
        // // console.error("Error fetching study data:", error);
        res.status(500).json({ message: "Server error" });
    }
});

module.exports = router;