
require("dotenv").config();

const express = require("express");
const cors = require("cors");
const path = require("path");

const app = express();

require("./config/db");

app.use(cors());
app.use(express.json());

app.use(express.static(path.join(__dirname, "../frontend")));

app.use("/api/hostels", require("./routes/hostelRoutes"));
app.use("/api/bookings", require("./routes/bookingRoutes"));
app.use("/api/auth", require("./routes/authRoutes"));
app.use("/api/users", require("./routes/userRoutes"));
app.use("/api/admin", require("./routes/adminRoutes"));
app.use("/api/payments", require("./routes/paymentRoutes"));

// Health checks
app.get("/", (req, res) => {
    res.status(200).send("HostelHub API is running!");
});

app.get("/healthz", (req, res) => {
    res.status(200).json({ status: "ok" });
});

app.get("/api", (req, res) => {
    res.json({ message: "HostelHub API is running!" });
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, "0.0.0.0", () => {
    console.log(`HostelHub running on port ${PORT}`);
});
