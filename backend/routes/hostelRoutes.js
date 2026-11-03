const express = require("express");
const router = express.Router();
const db = require("../config/db");

router.get("/", (req, res) => {
    db.query("SELECT * FROM hostels ORDER BY id DESC", (err, results) => {
        if (err) {
            return res.status(500).json({ message: "Unable to load hostels" });
        }

        res.json(results);
    });
});

module.exports = router;