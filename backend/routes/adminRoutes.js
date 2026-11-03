
const express = require("express");
const router = express.Router();
const db = require("../config/db");
const { authenticate, adminOnly } = require("../middleware/auth");

router.use(authenticate, adminOnly);

// VIEW ALL BOOKINGS
router.get("/bookings", (req, res) => {
    db.query(
        `SELECT b.*, h.name AS hostel_name
         FROM bookings b
         JOIN hostels h ON b.hostel_id = h.id
         ORDER BY b.created_at DESC`,
        (err, results) => {
            if (err) return res.status(500).json({ message: "Unable to load bookings." });
            res.json(results);
        }
    );
});

// APPROVE OR REJECT BOOKING
router.patch("/bookings/:id", (req, res) => {
    const { status } = req.body;

    if (!["Approved", "Rejected"].includes(status)) {
        return res.status(400).json({ message: "Invalid booking status." });
    }

    db.query(
        "UPDATE bookings SET status = ? WHERE id = ?",
        [status, req.params.id],
        (err, result) => {
            if (err) return res.status(500).json({ message: "Update failed." });

            if (!result.affectedRows) {
                return res.status(404).json({ message: "Booking not found." });
            }

            res.json({ message: `Booking ${status.toLowerCase()} successfully.` });
        }
    );
});

// ADD HOSTEL
router.post("/hostels", (req, res) => {
    const { name, location, price, description, image, available_rooms } = req.body;

    if (!name || !location || Number(price) <= 0 ||
        !Number.isFinite(Number(price)) ||
        !Number.isInteger(Number(available_rooms)) ||
        Number(available_rooms) < 0) {
        return res.status(400).json({ message: "Enter valid hostel details." });
    }

    db.query(
        `INSERT INTO hostels
         (name, location, price, description, image, available_rooms)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [name, location, price, description || "", image || "", available_rooms],
        (err, result) => {
            if (err) return res.status(500).json({ message: "Could not add hostel." });
            res.status(201).json({ message: "Hostel added!", id: result.insertId });
        }
    );
});

// DELETE HOSTEL
router.delete("/hostels/:id", (req, res) => {
    db.query(
        "DELETE FROM hostels WHERE id = ?",
        [req.params.id],
        (err, result) => {
            if (err) {
                return res.status(400).json({
                    message: "Cannot delete this hostel. It may have existing bookings."
                });
            }

            if (!result.affectedRows) {
                return res.status(404).json({ message: "Hostel not found." });
            }

            res.json({ message: "Hostel deleted successfully." });
        }
    );
});

module.exports = router;
