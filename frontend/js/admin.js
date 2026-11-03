
const token = localStorage.getItem("hostelhub_token");
const user = JSON.parse(localStorage.getItem("hostelhub_user") || "null");

if (!token || !user || user.role !== "admin") {
    window.location.href = "login.html";
}

const headers = {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${token}`
};

function logout() {
    localStorage.removeItem("hostelhub_token");
    localStorage.removeItem("hostelhub_user");
    window.location.href = "login.html";
}

function safe(value) {
    return String(value ?? "").replace(/[&<>"']/g, c => ({
        "&": "&amp;", "<": "&lt;", ">": "&gt;",
        '"': "&quot;", "'": "&#39;"
    })[c]);
}

async function loadAdminData() {
    try {
        const [bookingResponse, hostelResponse] = await Promise.all([
            fetch("/api/admin/bookings", { headers }),
            fetch("/api/hostels")
        ]);

        if (bookingResponse.status === 401 ||
            bookingResponse.status === 403) {
            logout();
            return;
        }

        if (!bookingResponse.ok || !hostelResponse.ok) {
            throw new Error("Unable to load dashboard data.");
        }

        const bookings = await bookingResponse.json();
        const hostels = await hostelResponse.json();

        document.getElementById("statistics").innerHTML = `
            <div class="hostel-card hostel-info">
                <h3>Total Bookings</h3><h2>${bookings.length}</h2>
            </div>
            <div class="hostel-card hostel-info">
                <h3>Approved</h3>
                <h2>${bookings.filter(b => b.status === "Approved").length}</h2>
            </div>
            <div class="hostel-card hostel-info">
                <h3>Pending</h3>
                <h2>${bookings.filter(b => b.status === "Pending").length}</h2>
            </div>
            <div class="hostel-card hostel-info">
                <h3>Total Hostels</h3><h2>${hostels.length}</h2>
            </div>
        `;

        const bookingContainer = document.getElementById("admin-bookings");
        bookingContainer.innerHTML = "";

        if (!bookings.length) {
            bookingContainer.textContent = "No bookings yet.";
        }

        bookings.forEach(b => {
            const card = document.createElement("div");
            card.className = "hostel-card hostel-info";

            card.innerHTML = `
                <h3>${safe(b.hostel_name)}</h3>
                <p>Customer: ${safe(b.customer_name)}</p>
                <p>Email: ${safe(b.email)}</p>
                <p>Phone: ${safe(b.phone)}</p>
                <p>Dates: ${safe(b.check_in)} – ${safe(b.check_out)}</p>
                <p>Payment: ${safe(b.payment_method)}</p>
                <p>Status: <strong>${safe(b.status)}</strong></p>
                <button class="btn" data-status="Approved"
                    data-id="${b.id}">Approve</button>
                <button class="btn" data-status="Rejected"
                    data-id="${b.id}">Reject</button>
            `;

            bookingContainer.appendChild(card);
        });

        bookingContainer.querySelectorAll("button[data-status]").forEach(button => {
            button.addEventListener("click", () =>
                updateBooking(button.dataset.id, button.dataset.status)
            );
        });

        const hostelContainer = document.getElementById("admin-hostels");
        hostelContainer.innerHTML = "";

        hostels.forEach(h => {
            const card = document.createElement("div");
            card.className = "hostel-card hostel-info";

            card.innerHTML = `
                <h3>${safe(h.name)}</h3>
                <p>${safe(h.location)}</p>
                <p>KSh ${Number(h.price).toLocaleString()} / month</p>
                <p>${safe(h.available_rooms)} rooms</p>
                <button class="btn" data-delete="${h.id}">
                    Delete Hostel
                </button>
            `;

            hostelContainer.appendChild(card);
        });

        hostelContainer.querySelectorAll("[data-delete]").forEach(button => {
            button.addEventListener("click", () =>
                deleteHostel(button.dataset.delete)
            );
        });

    } catch (error) {
        document.getElementById("admin-bookings").textContent = error.message;
    }
}

async function updateBooking(id, status) {
    try {
        const response = await fetch(`/api/admin/bookings/${id}`, {
            method: "PATCH",
            headers,
            body: JSON.stringify({ status })
        });

        const result = await response.json();
        if (!response.ok) throw new Error(result.message);

        alert(result.message);
        loadAdminData();
    } catch (error) {
        alert(error.message);
    }
}

async function deleteHostel(id) {
    if (!confirm("Are you sure you want to delete this hostel?")) return;

    try {
        const response = await fetch(`/api/admin/hostels/${id}`, {
            method: "DELETE",
            headers
        });

        const result = await response.json();
        if (!response.ok) throw new Error(result.message);

        alert(result.message);
        loadAdminData();
    } catch (error) {
        alert(error.message);
    }
}

document.getElementById("hostel-form").addEventListener("submit", async e => {
    e.preventDefault();

    const message = document.getElementById("hostel-message");
    message.textContent = "Adding hostel...";

    const data = {
        name: document.getElementById("name").value.trim(),
        location: document.getElementById("location").value.trim(),
        price: Number(document.getElementById("price").value),
        image: document.getElementById("image").value.trim(),
        available_rooms: Number(document.getElementById("rooms").value),
        description: document.getElementById("description").value.trim()
    };

    try {
        const response = await fetch("/api/admin/hostels", {
            method: "POST",
            headers,
            body: JSON.stringify(data)
        });

        const result = await response.json();
        if (!response.ok) throw new Error(result.message);

        message.textContent = result.message;
        e.target.reset();
        loadAdminData();

    } catch (error) {
        message.textContent = error.message;
    }
});

if (token && user && user.role === "admin") {
    loadAdminData();
}
