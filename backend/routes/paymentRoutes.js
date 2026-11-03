const express = require("express");
const router = express.Router();
const axios = require("axios");
const crypto = require("crypto");

const db = require("../config/db");
const { authenticate } = require("../middleware/auth");

const {
    PESAPAL_BASE_URL,
    getPesapalToken
} = require("../config/pesapal");

// Test Pesapal connection
router.get("/test", async (req, res) => {
    try {
        await getPesapalToken();

        res.json({
            success: true,
            message: "Pesapal connection successful!"
        });
    } catch (error) {
        console.error("Pesapal error:", error.response?.data || error.message);

        res.status(500).json({
            success: false,
            message: "Pesapal connection failed."
        });
    }
});

// Create Pesapal checkout
router.post("/checkout/:bookingId", authenticate, async (req, res) => {
    try {
        const bookingId = req.params.bookingId;
        const userId = req.user.id;

        db.query(
            `SELECT b.id, b.customer_name, b.email, b.phone,
                    b.user_id, b.hostel_id, h.name AS hostel_name,
                    h.price, b.status, b.payment_status
             FROM bookings b
             JOIN hostels h ON b.hostel_id = h.id
             WHERE b.id = ? AND b.user_id = ?`,
            [bookingId, userId],
            async (err, results) => {
                if (err) {
                    console.error(err);
                    return res.status(500).json({
                        success: false,
                        message: "Could not retrieve booking."
                    });
                }

                if (results.length === 0) {
                    return res.status(404).json({
                        success: false,
                        message: "Booking not found."
                    });
                }

                const booking = results[0];
                const amount = Number(booking.price);

                if (booking.status === "Rejected") {
                    return res.status(400).json({
                        success: false,
                        message: "This booking has been rejected."
                    });
                }

                if (booking.payment_status === "Paid") {
                    return res.status(409).json({
                        success: false,
                        message: "This booking has already been paid."
                    });
                }

                if (!Number.isFinite(amount) || amount <= 0) {
                    return res.status(400).json({
                        success: false,
                        message: "Invalid hostel price."
                    });
                }

                if (!booking.email && !booking.phone) {
                    return res.status(400).json({
                        success: false,
                        message: "Booking needs an email or phone number."
                    });
                }

                db.query(
                    `SELECT id FROM payments
                     WHERE booking_id = ?
                     AND status IN ('Pending', 'Completed')`,
                    [bookingId],
                    async (checkErr, existing) => {
                        if (checkErr) {
                            return res.status(500).json({
                                success: false,
                                message: "Could not check existing payments."
                            });
                        }

                        if (existing.length > 0) {
                            return res.status(409).json({
                                success: false,
                                message: "A payment already exists for this booking."
                            });
                        }

                        const merchantReference =
                            `HH-${bookingId}-${crypto.randomUUID()}`;

                        db.query(
                            `INSERT INTO payments
                             (booking_id, user_id, amount, currency,
                              merchant_reference, status)
                             VALUES (?, ?, ?, 'KES', ?, 'Pending')`,
                            [bookingId, userId, amount, merchantReference],
                            async (insertErr, insertResult) => {
                                if (insertErr) {
                                    console.error(insertErr);

                                    return res.status(500).json({
                                        success: false,
                                        message: "Could not create payment record."
                                    });
                                }

                                try {
                                    const token = await getPesapalToken();

                                    const names = booking.customer_name
                                        .trim()
                                        .split(/\s+/);

                                    const firstName = names.shift() || "Customer";
                                    const lastName = names.join(" ");

                                    const paymentRequest = {
                                        id: merchantReference,
                                        currency: "KES",
                                        amount: Number(amount.toFixed(2)),
                                        description: `Hostel booking ${bookingId}`,
                                        callback_url:
                                            `${process.env.PUBLIC_BASE_URL}/payment-result.html`,
                                        notification_id:
                                            process.env.PESAPAL_IPN_ID,
                                        billing_address: {
                                            email_address: booking.email || "",
                                            phone_number: booking.phone || "",
                                            country_code: "KE",
                                            first_name: firstName,
                                            last_name: lastName
                                        }
                                    };

                                    const response = await axios.post(
                                        `${PESAPAL_BASE_URL}/api/Transactions/SubmitOrderRequest`,
                                        paymentRequest,
                                        {
                                            headers: {
                                                Authorization: `Bearer ${token}`,
                                                Accept: "application/json",
                                                "Content-Type": "application/json"
                                            }
                                        }
                                    );

                                    const paymentData = response.data;
                                    console.log(
    "PESAPAL CHECKOUT RESPONSE:",
    JSON.stringify(paymentData, null, 2)
);

                                    if (
                                        !paymentData.redirect_url ||
                                        !paymentData.order_tracking_id
                                    ) {
                                        throw new Error(
                                            "Pesapal did not return a checkout URL."
                                        );
                                    }

                                    db.query(
                                        `UPDATE payments
                                         SET tracking_id = ?
                                         WHERE id = ?`,
                                        [
                                            paymentData.order_tracking_id,
                                            insertResult.insertId
                                        ],
                                        (trackingErr) => {
                                            if (trackingErr) {
                                                console.error(trackingErr);

                                                return res.status(500).json({
                                                    success: false,
                                                    message: "Could not save payment tracking details."
                                                });
                                            }

                                            db.query(
                                                `UPDATE bookings
                                                 SET payment_status = 'Pending'
                                                 WHERE id = ?`,
                                                [bookingId],
                                                (bookingErr) => {
                                                    if (bookingErr) {
                                                        console.error(bookingErr);

                                                        return res.status(500).json({
                                                            success: false,
                                                            message: "Could not update booking payment status."
                                                        });
                                                    }

                                                    return res.json({
                                                        success: true,
                                                        message: "Checkout created successfully.",
                                                        redirect_url: paymentData.redirect_url
                                                    });
                                                }
                                            );
                                        }
                                    );

                                } catch (paymentError) {
                                    console.error(
                                        "Checkout error:",
                                        paymentError.response?.data ||
                                        paymentError.message
                                    );

                                    return res.status(502).json({
                                        success: false,
                                        message: "Could not start Pesapal checkout."
                                    });
                                }
                            }
                        );
                    }
                );
            }
        );

    } catch (error) {
        console.error(error);

        res.status(500).json({
            success: false,
            message: "Payment request failed."
        });
    }
});

// Verify payment status directly with Pesapal
router.get("/status/:trackingId", authenticate, async (req, res) => {
    try {
        const trackingId = req.params.trackingId;
        const userId = req.user.id;

        db.query(
            `SELECT p.id, p.booking_id, p.amount, p.currency,
                    p.merchant_reference, p.status
             FROM payments p
             WHERE p.tracking_id = ? AND p.user_id = ?`,
            [trackingId, userId],
            async (err, results) => {
                if (err) {
                    console.error(err);

                    return res.status(500).json({
                        success: false,
                        message: "Could not find payment."
                    });
                }

                if (results.length === 0) {
                    return res.status(404).json({
                        success: false,
                        message: "Payment not found."
                    });
                }

                const payment = results[0];

                try {
                    const token = await getPesapalToken();

                    const response = await axios.get(
                        `${PESAPAL_BASE_URL}/api/Transactions/GetTransactionStatus`,
                        {
                            params: {
                                orderTrackingId: trackingId
                            },
                            headers: {
                                Authorization: `Bearer ${token}`,
                                Accept: "application/json",
                                "Content-Type": "application/json"
                            }
                        }
                    );

                    const transaction = response.data;

                    const pesapalStatus = (
                        transaction.payment_status_description || ""
                    ).toLowerCase();

                    const amountMatches =
                        Math.abs(
                            Number(transaction.amount) -
                            Number(payment.amount)
                        ) < 0.01;

                    const currencyMatches =
                        transaction.currency === payment.currency;

                    const referenceMatches =
                        transaction.merchant_reference ===
                        payment.merchant_reference;

                    if (pesapalStatus === "completed") {
                        if (
                            !amountMatches ||
                            !currencyMatches ||
                            !referenceMatches
                        ) {
                            return res.status(409).json({
                                success: false,
                                message: "Payment details do not match our records."
                            });
                        }

                        db.query(
                            `UPDATE payments
                             SET status = 'Completed',
                                 payment_method = ?
                             WHERE id = ?`,
                            [
                                transaction.payment_method || null,
                                payment.id
                            ],
                            (updateErr) => {
                                if (updateErr) {
                                    console.error(updateErr);

                                    return res.status(500).json({
                                        success: false,
                                        message: "Could not update payment."
                                    });
                                }

                                // Automatically approve after verified payment
                                db.query(
                                    `UPDATE bookings
                                     SET status = 'Approved',
                                         payment_status = 'Paid'
                                     WHERE id = ?`,
                                    [payment.booking_id],
                                    (bookingErr) => {
                                        if (bookingErr) {
                                            console.error(bookingErr);

                                            return res.status(500).json({
                                                success: false,
                                                message: "Payment confirmed but booking update failed."
                                            });
                                        }

                                        return res.json({
                                            success: true,
                                            status: "Completed",
                                            booking_status: "Approved",
                                            message: "Payment verified. Your booking is confirmed!"
                                        });
                                    }
                                );
                            }
                        );

                    } else if (
                        pesapalStatus === "failed" ||
                        pesapalStatus === "reversed"
                    ) {
                        db.query(
                            `UPDATE payments
                             SET status = 'Failed'
                             WHERE id = ?`,
                            [payment.id],
                            (updateErr) => {
                                if (updateErr) {
                                    return res.status(500).json({
                                        success: false,
                                        message: "Could not update payment."
                                    });
                                }

                                db.query(
                                    `UPDATE bookings
                                     SET payment_status = 'Failed'
                                     WHERE id = ?`,
                                    [payment.booking_id],
                                    () => {
                                        return res.json({
                                            success: true,
                                            status: "Failed",
                                            message: "Payment was not completed."
                                        });
                                    }
                                );
                            }
                        );

                    } else {
                        return res.json({
                            success: true,
                            status: "Pending",
                            message: "Payment is still being processed."
                        });
                    }

                } catch (pesapalError) {
                    console.error(
                        "Pesapal verification error:",
                        pesapalError.response?.data ||
                        pesapalError.message
                    );

                    return res.status(502).json({
                        success: false,
                        message: "Could not verify payment with Pesapal."
                    });
                }
            }
        );

    } catch (error) {
        console.error(error);

        res.status(500).json({
            success: false,
            message: "Payment verification failed."
        });
    }
});

// Pesapal IPN notification handler
router.get("/ipn", async (req, res) => {
    const {
        OrderTrackingId,
        OrderMerchantReference,
        OrderNotificationType
    } = req.query;

    try {
        if (
            !OrderTrackingId ||
            !OrderMerchantReference ||
            OrderNotificationType !== "IPNCHANGE"
        ) {
            return res.status(400).json({
                status: 500,
                message: "Invalid IPN notification."
            });
        }

        db.query(
            `SELECT id, booking_id, amount, currency,
                    merchant_reference
             FROM payments
             WHERE tracking_id = ? AND merchant_reference = ?`,
            [OrderTrackingId, OrderMerchantReference],
            async (err, results) => {
                if (err || results.length === 0) {
                    console.error("IPN payment lookup failed:", err);

                    return res.status(500).json({
                        status: 500,
                        message: "Payment record not found."
                    });
                }

                const payment = results[0];

                try {
                    const token = await getPesapalToken();

                    const response = await axios.get(
                        `${PESAPAL_BASE_URL}/api/Transactions/GetTransactionStatus`,
                        {
                            params: {
                                orderTrackingId: OrderTrackingId
                            },
                            headers: {
                                Authorization: `Bearer ${token}`,
                                Accept: "application/json",
                                "Content-Type": "application/json"
                            }
                        }
                    );

                    const transaction = response.data;

                    const status = (
                        transaction.payment_status_description || ""
                    ).toLowerCase();

                    const validPayment =
                        transaction.merchant_reference ===
                            payment.merchant_reference &&
                        transaction.currency === payment.currency &&
                        Math.abs(
                            Number(transaction.amount) -
                            Number(payment.amount)
                        ) < 0.01;

                    if (status === "completed" && !validPayment) {
                        console.error("IPN payment details mismatch.");

                        return res.status(500).json({
                            status: 500,
                            message: "Payment verification failed."
                        });
                    }

                    if (status === "completed") {
                        db.query(
                            `UPDATE payments
                             SET status = 'Completed',
                                 payment_method = ?
                             WHERE id = ?`,
                            [
                                transaction.payment_method || null,
                                payment.id
                            ],
                            (updateErr) => {
                                if (updateErr) {
                                    console.error(updateErr);

                                    return res.status(500).json({
                                        status: 500
                                    });
                                }

                                // Automatically approve after verified IPN payment
                                db.query(
                                    `UPDATE bookings
                                     SET status = 'Approved',
                                         payment_status = 'Paid'
                                     WHERE id = ?`,
                                    [payment.booking_id],
                                    (bookingErr) => {
                                        if (bookingErr) {
                                            console.error(bookingErr);

                                            return res.status(500).json({
                                                status: 500
                                            });
                                        }

                                        return res.json({
                                            orderNotificationType:
                                                OrderNotificationType,
                                            orderTrackingId:
                                                OrderTrackingId,
                                            orderMerchantReference:
                                                OrderMerchantReference,
                                            status: 200
                                        });
                                    }
                                );
                            }
                        );

                    } else if (
                        status === "failed" ||
                        status === "reversed"
                    ) {
                        db.query(
                            `UPDATE payments
                             SET status = 'Failed'
                             WHERE id = ?`,
                            [payment.id],
                            (updateErr) => {
                                if (updateErr) {
                                    console.error(updateErr);

                                    return res.status(500).json({
                                        status: 500
                                    });
                                }

                                db.query(
                                    `UPDATE bookings
                                     SET payment_status = 'Failed'
                                     WHERE id = ?`,
                                    [payment.booking_id],
                                    (bookingErr) => {
                                        if (bookingErr) {
                                            console.error(bookingErr);

                                            return res.status(500).json({
                                                status: 500
                                            });
                                        }

                                        return res.json({
                                            orderNotificationType:
                                                OrderNotificationType,
                                            orderTrackingId:
                                                OrderTrackingId,
                                            orderMerchantReference:
                                                OrderMerchantReference,
                                            status: 200
                                        });
                                    }
                                );
                            }
                        );

                    } else {
                        return res.json({
                            orderNotificationType:
                                OrderNotificationType,
                            orderTrackingId: OrderTrackingId,
                            orderMerchantReference:
                                OrderMerchantReference,
                            status: 200
                        });
                    }

                } catch (error) {
                    console.error(
                        "IPN verification error:",
                        error.response?.data || error.message
                    );

                    return res.status(500).json({
                        status: 500,
                        message: "Could not verify IPN."
                    });
                }
            }
        );

    } catch (error) {
        console.error("IPN error:", error);

        return res.status(500).json({
            status: 500,
            message: "IPN processing failed."
        });
    }
});

module.exports = router;
