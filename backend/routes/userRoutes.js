
const express = require("express");
const router = express.Router();
const db = require("../config/db");
const { authenticate } = require("../middleware/auth");

router.get("/bookings", authenticate, (req, res) => {
    db.query(
        `SELECT b.*, h.name AS hostel_name, h.location, h.price
         FROM bookings b
         JOIN hostels h ON b.hostel_id = h.id
         WHERE b.user_id = ?
         ORDER BY b.created_at DESC`,
        [req.user.id],
        (err, results) => {
            if (err) {
                return res.status(500).json({ message: "Unable to load bookings." });
            }
            res.json(results);
        }
    );
});

module.exports = router;
