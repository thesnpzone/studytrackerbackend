// Import dependencies
const express = require("express");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const nodemailer = require("nodemailer");
const cluster = require("cluster");
const os = require("os");
const cors = require("cors");
require("dotenv").config();
const cookieParser = require("cookie-parser");
const otpEmailTemplate = require("./Mailtemplates/otpEmailTemplate.js");
const resetPasswordEmailTemplate = require("./Mailtemplates/resetPasswordEmailTemplate.js");

const moment = require("moment-timezone");

const registrationNotificationTemplate = require("./Mailtemplates/registrationNotificationTemplate.js");
const connectDB = require("./config/db.js");
const { isAuthenticated } = require("./middleware/auth");

const User = require("./models/userModel.js"); // Import the User model
const StudyTracking = require("./models/studyTrackingModel.js");

const adminRoutes = require("./routes/adminRoutes");

const CPU = os.cpus().length;
console.log(CPU);

if (cluster.isPrimary) {
    for (let i = 0; i < CPU; i++) {
        cluster.fork();
    }
} else {
    // Initialize the app
    const app = express();

    // Middleware
    app.use(
        cors({
            origin: "http://localhost:3000", // Replace with your frontend URL if it changes
            credentials: true, // Enable cookies to be sent across domains
        })
    );
    app.use(express.json()); // To handle JSON requests
    app.use(cookieParser());

    // Connect to MongoDB
    connectDB();

    // Nodemailer configuration for OTP emails
    const transporter = nodemailer.createTransport({
        service: "gmail",
        auth: {
            user: process.env.EMAIL,
            pass: process.env.EMAIL_PASSWORD,
        },
    });

    // Send registration notification email
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

    // Admin routes section
    app.use("/admin", adminRoutes);
    // Admin routes section

    // User Route

    app.get("/check-auth", (req, res) => {
        const token = req.cookies.token; // Get the JWT from the cookie
        if (!token) {
            return res.status(200).json({ authenticated: false });
        }

        try {
            jwt.verify(token, process.env.JWT_SECRET);
            return res.status(200).json({ authenticated: true });
        } catch (error) {
            return res.status(200).json({ authenticated: false });
        }
    });

    // Route to register user (send OTP)
    app.post("/register", isAuthenticated, async(req, res) => {
        const { fullName, dob, city, state, phone, email, password } = req.body;

        try {
            let user = await User.findOne({ email });
            if (user) {
                return res.status(400).json({ message: "User already exists" });
            }

            const hashedPassword = await bcrypt.hash(password, 10);
            const otp = Math.floor(1000 + Math.random() * 9000).toString();

            user = new User({
                fullName,
                dob,
                city,
                state,
                phone,
                email,
                password: hashedPassword,
                otp,
                otpVerified: false,
            });

            await user.save();

            // Send notification email for new user registration
            await sendRegistrationNotification("User", { fullName, email });

            // Send OTP via email
            const mailOptions = {
                from: process.env.EMAIL,
                to: email,
                subject: "Your Verification Code",
                // text: `Your OTP code is ${otp}`
                html: otpEmailTemplate(otp),
            };

            transporter.sendMail(mailOptions, (err, info) => {
                if (err) {
                    // // console.log(err);
                    return res.status(500).json({ message: "Failed to send OTP" });
                }
                res.status(200).json({ message: "OTP sent to your email" });
            });
        } catch (error) {
            // // console.error(error);
            res.status(500).json({ message: "Server error" });
        }
    });

    // Route to verify OTP
    app.post("/verify-otp", async(req, res) => {
        const { email, otp } = req.body;

        try {
            let user = await User.findOne({ email });

            if (!user) {
                return res.status(400).json({ message: "User not found" });
            }

            if (user.otp !== otp) {
                return res.status(400).json({ message: "Invalid OTP" });
            }

            user.otpVerified = true;
            user.otp = null; // Clear OTP after successful verification
            await user.save();

            // Generate JWT token
            const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, {
                expiresIn: "1h",
            });

            // Set token in a cookie (make sure httpOnly is false)
            res.cookie("token", token, {
                httpOnly: true,
                secure: process.env.NODE_ENV === "production", // Ensure this is true in production
                sameSite: "none",
            }); // Set cookie without httpOnly
            res.status(200).json({ message: "OTP verified successfully", token });
        } catch (error) {
            // // console.error(error);
            res.status(500).json({ message: "Server error" });
        }
    });

    // POST /login route
    app.post("/login", isAuthenticated, async(req, res) => {
        const { email, password } = req.body;

        try {
            const user = await User.findOne({ email });
            if (!user) {
                return res.status(401).json({ message: "Invalid credentials" });
            }

            // Check if login is disabled
            if (user.loginDisabled) {
                return res.status(403).json({
                    message: "Your account has been disabled. Please contact support.",
                });
            }

            const isMatch = await bcrypt.compare(password, user.password);
            if (!isMatch) {
                return res.status(401).json({ message: "Invalid credentials" });
            }

            const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET);
            res.cookie("token", token, {
                httpOnly: true,
                secure: process.env.NODE_ENV === "production", // Ensure this is true in production
                sameSite: "Strict",
            }); // Set cookie without httpOnly
            res.status(200).json({ message: "Login successful", token });
        } catch (error) {
            res.status(500).json({ message: "Server error" });
        }
    });

    // Route to fetch user details
    app.get("/user-details", async(req, res) => {
        const authorizationHeader = req.headers.authorization;

        // Check if the Authorization header exists and contains a token
        if (!authorizationHeader || !authorizationHeader.startsWith("Bearer ")) {
            return res
                .status(401)
                .json({ message: "Unauthorized: No token provided" });
        }

        // Extract the token from the Authorization header
        const token = authorizationHeader.split(" ")[1];

        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            const userId = decoded.id;

            // Fetch user details and exclude the _id field
            const userDetails = await User.findById(userId).select(
                "-_id fullName dob city state phone email"
            );

            if (!userDetails) {
                return res.status(404).json({ message: "User not found" });
            }

            res.status(200).json(userDetails);
        } catch (error) {
            // // console.error("Error fetching user details:", error);
            res.status(500).json({ message: "Server error" });
        }
    });

    // Reset Password Route (Send Reset Link)
    app.post("/send-reset-password-link", async(req, res) => {
        const token = req.cookies.token; // Get the JWT from the cookie
        // // console.log(token);

        if (!token) {
            return res.status(401).json({ message: "Unauthorized" });
        }

        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET); // Verify the token

            // Change here: Ensure the user ID is taken from decoded.id
            const user = await User.findById(decoded.id);

            if (!user) {
                return res.status(404).json({ message: "User not found" });
            }

            // Create reset token for password reset
            const resetToken = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
                expiresIn: "1h",
            });

            const mailOptions = {
                from: process.env.EMAIL,
                to: user.email,
                subject: "Password Reset Request",
                // text: `Click the link to reset your password: http://localhost:3000/reset-password/${resetToken}`,
                html: resetPasswordEmailTemplate(resetToken),
            };

            await transporter.sendMail(mailOptions);
            res
                .status(200)
                .json({ message: "Password reset link sent to your email" });
        } catch (error) {
            // // console.error("Error in Reset Password Route:", error);
            res.status(500).json({ message: "Server error" });
        }
    });

    // Route to reset password
    app.post("/reset-password/:token", async(req, res) => {
        const resetToken = req.params.token; // Get the reset token from the URL
        const { newPassword } = req.body; // Get the new password from the request body

        if (!newPassword) {
            return res.status(400).json({ message: "New password is required" });
        }

        try {
            // Verify the reset token
            const decoded = jwt.verify(resetToken, process.env.JWT_SECRET); // Ensure you use the same secret

            // Find the user by ID from decoded.id
            const user = await User.findById(decoded.id);

            if (!user) {
                return res.status(404).json({ message: "User not found" });
            }

            // Check if reset token has already been used
            if (user.resetTokenUsed) {
                return res
                    .status(400)
                    .json({ message: "Reset password link has already been used" });
            }

            // Hash the new password
            const hashedPassword = await bcrypt.hash(newPassword, 10);
            user.password = hashedPassword; // Update the user's password
            user.resetTokenUsed = true; // Mark token as used
            await user.save(); // Save the changes

            // Send confirmation email to user
            const mailOptions = {
                from: process.env.EMAIL,
                to: user.email,
                subject: "Password Updated Successfully",
                text: `Hello, your password has been successfully updated. If you did not request this change, please contact our support immediately.`,
            };

            transporter.sendMail(mailOptions, (err, info) => {
                if (err) {
                    // // console.log("Error sending confirmation email:", err);
                } else {
                    // // console.log("Password update confirmation email sent:", info.response);
                }
            });

            // Clear the token from cookies
            res.clearCookie("token"); // Clear the cookie

            res.status(200).json({ message: "Password has been reset successfully" });
        } catch (error) {
            // // console.error("Error in Reset Password Route:", error);
            res.status(500).json({ message: "Server error" });
        }
    });

    // User Route

    // Route to track study data
    app.post("/track-study", async(req, res) => {
        const token = req.cookies.token; // Retrieve token from cookies

        if (!token) {
            return res
                .status(401)
                .json({ message: "Unauthorized: No token provided" });
        }

        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            const userId = decoded.id;

            const {
                subject,
                topic,
                questionsAttempted,
                questionsSolvedCorrectly,
                percentage,
            } = req.body;

            // Get today's date in 'DD-MM-YYYY' format
            const todayDate = moment.tz("Asia/Kolkata").format("DD-MM-YYYY");

            // NEW: Simulating tomorrow's date for testing purposes REMOVE THIS AFTER TEST
            // if (process.env.TEST_TOMORROW === 'true') {
            //     todayDate = moment.tz("Asia/Kolkata").add(1, 'day').format('DD-MM-YYYY');
            // }

            // Check if an entry for the user and topic already exists
            const existingEntry = await StudyTracking.findOne({ userId, topic });

            // If no existing entry, create one
            if (!existingEntry) {
                const studyData = new StudyTracking({
                    userId,
                    subject,
                    topic,
                    questionsAttempted: [questionsAttempted], // Store as an array
                    questionsSolvedCorrectly: [questionsSolvedCorrectly], // Store as an array
                    percentage: [percentage], // Store as an array
                    submittedOn: [todayDate], // Initialize with today's date
                    submissionStatus: true,
                });

                await studyData.save();
                return res
                    .status(201)
                    .json({ message: "Study data tracked successfully", studyData });
            }

            // If the entry exists, update the existing entry's submittedOn array
            const alreadySubmitted = existingEntry.submittedOn.includes(todayDate);

            if (alreadySubmitted) {
                return res.status(400).json({
                    message: "You have already submitted this topic today. Please try again tomorrow.",
                });
            }

            // Update the submittedOn array to add today's date

            // Update the entry without deleting previous data
            existingEntry.submittedOn.push(todayDate); // Add today's date to the array
            existingEntry.questionsAttempted.push(questionsAttempted); // Add new questionsAttempted to the array
            existingEntry.questionsSolvedCorrectly.push(questionsSolvedCorrectly); // Add new questionsSolvedCorrectly to the array
            existingEntry.percentage.push(percentage); // Add new percentage to the array

            await existingEntry.save();

            res
                .status(200)
                .json({ message: "Study data updated successfully", existingEntry });
        } catch (error) {
            // // console.error("Error tracking study data:", error);
            res.status(500).json({ message: "Server error" });
        }
    });

    // Route to check if the submission button should be enabled
    app.get("/check-submission/:topic", async(req, res) => {
        const token = req.cookies.token;
        console.log(token);

        if (!token) {
            return res.status(401).json({ message: "Unauthorized" });
        }

        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            const userId = decoded.id;

            // Get today's date in 'DD-MM-YYYY' format
            const todayDate = moment.tz("Asia/Kolkata").format("DD-MM-YYYY");

            // NEW: Simulating tomorrow's date for testing purposes
            // if (process.env.TEST_TOMORROW === 'true') {
            //     todayDate = moment.tz("Asia/Kolkata").add(1, 'day').format("DD-MM-YYYY");
            // }

            const submissionEntry = await StudyTracking.findOne({
                userId,
                topic: req.params.topic,
                // topic,
                submittedOn: todayDate,
            });

            if (submissionEntry && submissionEntry.submittedOn.includes(todayDate)) {
                return res.status(200).json({ submissionStatus: true });
            } else {
                return res.status(200).json({ submissionStatus: false });
            }
        } catch (error) {
            // // console.error("Error checking submission status:", error);
            res.status(500).json({ message: "Server error" });
        }
    });

    // Route to get study tracking history for the user
    app.get("/study-history", async(req, res) => {
        const token = req.cookies.token;
        console.log("this is study  history token ", token);
        if (!token) {
            return res.status(401).json({ message: "Unauthorized" });
        }

        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            const userId = decoded.id;

            // Fetch study history for the user
            const history = await StudyTracking.find({ userId }).sort({
                submittedOn: -1,
            });
            // // // console.log("Study history:", history);
            res.status(200).json(history);
        } catch (error) {
            // // console.error("Error fetching study history:", error);
            res.status(500).json({ message: "Server error" });
        }
    });

    // Route to track study data

    // Start the server
    const PORT = process.env.PORT || 5000;
    app.listen(PORT, () => {
        console.log(`Server is running on port http://localhost:${PORT}`);
    });
}