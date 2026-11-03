
const jwt = require("jsonwebtoken");

function authenticate(req, res, next) {
    const header = req.headers.authorization;

    if (!header || !header.startsWith("Bearer ")) {
        return res.status(401).json({ message: "Please log in." });
    }

    try {
        const token = header.split(" ")[1];
        req.user = jwt.verify(token, process.env.JWT_SECRET);
        next();
    } catch (error) {
        res.status(401).json({ message: "Invalid or expired session." });
    }
}

function adminOnly(req, res, next) {
    if (req.user.role !== "admin") {
        return res.status(403).json({ message: "Admin access required." });
    }

    next();
}

module.exports = { authenticate, adminOnly };
