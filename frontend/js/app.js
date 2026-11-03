const API = "/api";

const hostelList = document.getElementById("hostel-list");
const hostelSelect = document.getElementById("hostel_id");
const bookingForm = document.getElementById("booking-form");
const message = document.getElementById("booking-message");

function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, char => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    })[char]);
}

// Load available hostels
async function loadHostels() {
    if (!hostelList && !hostelSelect) return;

    try {
        const response = await fetch(`${API}/hostels`);

        if (response.status === 401) {
            window.location.href = "login.html";
            return;
        }

        if (!response.ok) throw new Error("Failed to load hostels.");

        const hostels = await response.json();

        if (hostelList) hostelList.innerHTML = "";
        if (hostelSelect) {
            hostelSelect.innerHTML = '<option value="">Select Hostel</option>';
        }

        if (!hostels.length) {
            if (hostelList) hostelList.textContent = "No hostels available.";
            return;
        }

        hostels.forEach(hostel => {

            if (hostelList) {
                const card = document.createElement("div");
                card.className = "hostel-card";

                card.innerHTML = `
                    <img src="${escapeHTML(hostel.image)}"
                         alt="${escapeHTML(hostel.name)}"
                         onerror="this.style.display='none'">

                    <div class="hostel-info">
                        <h3>${escapeHTML(hostel.name)}</h3>
                        <p>📍 ${escapeHTML(hostel.location)}</p>
                        <p>${escapeHTML(hostel.description)}</p>
                        <p><strong>KSh ${Number(hostel.price).toLocaleString()}</strong> / semester</p>
                        <p>${escapeHTML(hostel.available_rooms)} rooms available</p>

                        <a href="booking.html?hostel_id=${encodeURIComponent(hostel.id)}"
                           class="btn">
                            Book Now
                        </a>
                    </div>
                `;

                hostelList.appendChild(card);
            }

            if (hostelSelect) {
                const option = document.createElement("option");
                option.value = hostel.id;
                option.textContent = hostel.name;
                hostelSelect.appendChild(option);
            }
        });

        // Preselect hostel when coming from the Hostels page
        if (hostelSelect) {
            const selectedHostel = new URLSearchParams(window.location.search)
                .get("hostel_id");

            if (selectedHostel) {
                hostelSelect.value = selectedHostel;
            }
        }

    } catch (error) {
        if (hostelList) {
            hostelList.textContent = "Unable to load hostels. Check your server.";
        }
        console.error(error);
    }
}

// Submit booking
if (bookingForm) {
    bookingForm.addEventListener("submit", async event => {
        event.preventDefault();

        message.textContent = "Submitting booking...";

        const booking = {
            customer_name: document.getElementById("customer_name").value,
            email: document.getElementById("email").value,
            phone: document.getElementById("phone").value,
            hostel_id: hostelSelect.value,
            check_in: document.getElementById("check_in").value,
            check_out: document.getElementById("check_out").value,
            payment_method: document.getElementById("payment_method").value
        };

        try {
            const response = await fetch(`${API}/bookings`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${localStorage.getItem("hostelhub_token")}`
                },
                body: JSON.stringify(booking)
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.message || "Booking failed.");
            }

            message.textContent =
                `Booking submitted! Reference #${result.bookingId}.`;

            bookingForm.reset();

        } catch (error) {
            message.textContent = error.message;
        }
    });
}

loadHostels();
