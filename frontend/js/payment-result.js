const resultIcon = document.getElementById("result-icon");
const resultTitle = document.getElementById("result-title");
const paymentMessage = document.getElementById("payment-message");

async function verifyPayment() {
    const params = new URLSearchParams(window.location.search);

    const trackingId = params.get("OrderTrackingId");
    const token = localStorage.getItem("hostelhub_token");

    if (!trackingId) {
        showResult(
            "❌",
            "Payment Reference Missing",
            "We could not find your payment reference. Please contact support."
        );
        return;
    }

    if (!token) {
        showResult(
            "🔒",
            "Login Required",
            "Please log in to your HostelHub account to check your payment."
        );
        return;
    }

    try {
        const response = await fetch(
            `/api/payments/status/${encodeURIComponent(trackingId)}`,
            {
                method: "GET",
                headers: {
                    "Authorization": `Bearer ${token}`,
                    "Content-Type": "application/json"
                }
            }
        );

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.message || "Unable to verify payment.");
        }

        if (data.status === "Completed") {
            showResult(
                "✅",
                "Payment Successful",
                "Your payment has been confirmed. Thank you for booking with HostelHub."
            );
        } else if (data.status === "Failed") {
            showResult(
                "❌",
                "Payment Failed",
                "Your payment was not completed. Please try again."
            );
        } else {
            showResult(
                "⏳",
                "Payment Pending",
                "Your payment is still being processed. Please check again shortly."
            );
        }

    } catch (error) {
        showResult(
            "⚠️",
            "Verification Unavailable",
            error.message
        );
    }
}

function showResult(icon, title, message) {
    resultIcon.textContent = icon;
    resultTitle.textContent = title;
    paymentMessage.textContent = message;
}

verifyPayment();