const jwt = require("jsonwebtoken");

// Middleware to check if admin is authenticated
const isAdminAuthenticated = (req, res, next) => {
    const token = req.cookies.adminToken;
    if (!token) {
        return res
            .status(401)
            .json({ message: "Unauthorized: Admin not logged in" });
    }
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.adminId = decoded.id;
        next();
    } catch (error) {
        return res.status(401).json({ message: "Unauthorized: Invalid token" });
    }
};

// Middleware to check if user is authenticated
const isAuthenticated = (req, res, next) => {
    const token = req.cookies.token;
    if (!token) {
        return next();
    }
    try {
        jwt.verify(token, process.env.JWT_SECRET);
        return res.status(403).json({ message: "User already logged in" }); // Deny access if token is valid
    } catch (error) {
        return next();
    }
};



module.exports = { isAuthenticated, isAdminAuthenticated };