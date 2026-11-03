
const token = localStorage.getItem("hostelhub_token");
const user = JSON.parse(localStorage.getItem("hostelhub_user") || "null");

if (!token || !user) {
    window.location.href = "login.html";
}

if (user) {
    document.getElementById("welcome").textContent =
        `Welcome, ${user.name || user.full_name}!`;
}

async function loadBookings() {
    const container = document.getElementById("my-bookings");

    try {
        const response = await fetch("/api/users/bookings", {
            headers: { Authorization: `Bearer ${token}` }
        });

        if (response.status === 401) {
            logout();
            return;
        }

        if (!response.ok) throw new Error("Unable to load bookings.");

        const bookings = await response.json();

        if (!bookings.length) {
            container.textContent = "You have no bookings yet.";
            return;
        }

        container.innerHTML = "";

        bookings.forEach(booking => {
            const card = document.createElement("div");
            card.className = "hostel-card";

            const paymentStatus = booking.payment_status || "Unpaid";

            card.innerHTML = `
                <div class="hostel-info">
                    <h3>${escapeHTML(booking.hostel_name)}</h3>
                    <p>Location: ${escapeHTML(booking.location)}</p>
                    <p>Semester Price: KES ${escapeHTML(booking.price)}</p>
                    <p>Check-in: ${escapeHTML(booking.check_in)}</p>
                    <p>Check-out: ${escapeHTML(booking.check_out)}</p>
                    <p>Payment Method: ${escapeHTML(booking.payment_method)}</p>
                    <p>Booking #${booking.id}</p>
                    <p>Booking Status:
                        <strong>${escapeHTML(booking.status)}</strong>
                    </p>
                    <p>Payment Status:
                        <strong>${escapeHTML(paymentStatus)}</strong>
                    </p>

                    <div class="payment-action"></div>
                </div>
            `;

            const action = card.querySelector(".payment-action");

           if (booking.status === "Rejected") {
    action.innerHTML = "<p>This booking was rejected. Payment is unavailable.</p>";
} else if (paymentStatus === "Paid") {
    action.innerHTML = "<p>Payment completed successfully.</p>";
} else if (paymentStatus === "Pending") {
    action.innerHTML = "<p>Your payment is being processed.</p>";
} else {
    addPayButton(action, booking.id);
}

            container.appendChild(card);
        });

    } catch (error) {
        container.textContent = error.message;
    }
}

function addPayButton(container, bookingId) {
    const button = document.createElement("button");
    button.textContent = "Pay Now";
    button.className = "btn";
    button.type = "button";

    button.addEventListener("click", () => {
        startPayment(bookingId, button);
    });

    container.appendChild(button);
}

async function startPayment(bookingId, button) {
    button.disabled = true;
    button.textContent = "Connecting to Pesapal...";

    try {
        const response = await fetch(
            `/api/payments/checkout/${bookingId}`,
            {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "application/json"
                }
            }
        );

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.message || "Unable to start payment.");
        }

        if (!data.redirect_url) {
            throw new Error("Pesapal checkout link was not returned.");
        }

        window.location.href = data.redirect_url;

    } catch (error) {
        alert(error.message);
        button.disabled = false;
        button.textContent = "Pay Now";
    }
}

function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, c => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    })[c]);
}

function logout() {
    localStorage.removeItem("hostelhub_token");
    localStorage.removeItem("hostelhub_user");
    window.location.href = "login.html";
}

if (token && user) loadBookings();
