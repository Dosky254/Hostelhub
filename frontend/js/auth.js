
const API = "/api/auth";

// REGISTRATION
const registerForm = document.getElementById("register-form");

if (registerForm) {
    registerForm.addEventListener("submit", async (e) => {
        e.preventDefault();

        const message = document.getElementById("message");
        message.textContent = "Creating your account...";

        const data = {
            full_name: document.getElementById("full_name").value.trim(),
            email: document.getElementById("email").value.trim(),
            password: document.getElementById("password").value
        };

        try {
            const response = await fetch(`${API}/register`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(data)
            });

            const result = await response.json();

            if (!response.ok) throw new Error(result.message);

            message.textContent = "Account created! Redirecting to login...";

            setTimeout(() => {
                window.location.href = "login.html";
            }, 1200);

        } catch (error) {
            message.textContent = error.message || "Registration failed.";
        }
    });
}

// LOGIN
const loginForm = document.getElementById("login-form");

if (loginForm) {
    loginForm.addEventListener("submit", async (e) => {
        e.preventDefault();

        const message = document.getElementById("message");
        message.textContent = "Signing in...";

        const data = {
            email: document.getElementById("email").value.trim(),
            password: document.getElementById("password").value
        };

        try {
            const response = await fetch(`${API}/login`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(data)
            });

            const result = await response.json();

            if (!response.ok) throw new Error(result.message);

            localStorage.setItem("hostelhub_token", result.token);
            localStorage.setItem("hostelhub_user", JSON.stringify(result.user));

            message.textContent = "Login successful!";

            setTimeout(() => {
                window.location.href =
                    result.user.role === "admin"
                    ? "admin.html"
                    : "dashboard.html";
            }, 700);

        } catch (error) {
            message.textContent = error.message || "Login failed.";
        }
    });
}
