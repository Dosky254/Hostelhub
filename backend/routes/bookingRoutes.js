
const express = require("express");
const router = express.Router();
const db = require("../config/db");
const { authenticate } = require("../middleware/auth");

// CREATE BOOKING
router.post("/", authenticate, (req, res) => {
    const {
        customer_name, email, phone, hostel_id,
        check_in, check_out, payment_method
    } = req.body;

    if (!customer_name || !email || !phone || !hostel_id ||
        !check_in || !check_out || !payment_method) {
        return res.status(400).json({ message: "Complete all fields." });
    }

    if (!["M-Pesa", "Card"].includes(payment_method)) {
        return res.status(400).json({ message: "Invalid payment method." });
    }

    const start = new Date(check_in);
    const end = new Date(check_out);

    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) ||
        end <= start) {
        return res.status(400).json({ message: "Invalid booking dates." });
    }

    db.query(
        "SELECT id, available_rooms FROM hostels WHERE id = ?",
        [hostel_id],
        (err, hostels) => {
            if (err) return res.status(500).json({ message: "Database error." });

            if (!hostels.length || hostels[0].available_rooms < 1) {
                return res.status(400).json({ message: "No rooms available." });
            }

            db.query(
                `INSERT INTO bookings
                (customer_name, email, phone, hostel_id, check_in,
                 check_out, payment_method, user_id)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    customer_name, email, phone, hostel_id,
                    check_in, check_out, payment_method, req.user.id
                ],
                (insertError, result) => {
                    if (insertError) {
                        return res.status(500).json({ message: "Booking failed." });
                    }

                    res.status(201).json({
                        message: "Booking submitted successfully.",
                        bookingId: result.insertId
                    });
                }
            );
        }
    );
});

module.exports = router;
