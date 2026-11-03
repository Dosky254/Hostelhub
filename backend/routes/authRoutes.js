
const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const db = require("../config/db");

const router = express.Router();

// CUSTOMER REGISTRATION
router.post("/register", async (req, res) => {
    const { full_name, email, password } = req.body;

    if (!full_name || !email || !password || password.length < 6) {
        return res.status(400).json({
            message: "Enter all details. Password must be at least 6 characters."
        });
    }

    try {
        const hashedPassword = await bcrypt.hash(password, 12);

        db.query(
            "INSERT INTO users (full_name, email, password) VALUES (?, ?, ?)",
            [full_name, email.toLowerCase().trim(), hashedPassword],
            (err, result) => {
                if (err) {
                    return res.status(400).json({
                        message: "Email may already be registered."
                    });
                }

                res.status(201).json({
                    message: "Account created successfully!",
                    userId: result.insertId
                });
            }
        );
    } catch (error) {
        res.status(500).json({ message: "Registration failed." });
    }
});

// CUSTOMER LOGIN
router.post("/login", (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ message: "Enter email and password." });
    }

    db.query(
        "SELECT * FROM users WHERE email = ?",
        [email.toLowerCase().trim()],
        async (err, results) => {
            if (err || results.length === 0) {
                return res.status(401).json({ message: "Invalid login details." });
            }

            const user = results[0];
            const valid = await bcrypt.compare(password, user.password);

            if (!valid) {
                return res.status(401).json({ message: "Invalid login details." });
            }

            const token = jwt.sign(
                { id: user.id, role: user.role },
                process.env.JWT_SECRET,
                { expiresIn: "1d" }
            );

            res.json({
                message: "Login successful!",
                token,
                user: {
                    id: user.id,
                    name: user.full_name,
                    email: user.email,
                    role: user.role
                }
            });
        }
    );
});

module.exports = router;
