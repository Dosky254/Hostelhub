
const axios = require("axios");

const PESAPAL_BASE_URL =
    process.env.PESAPAL_ENV === "live"
        ? "https://pay.pesapal.com/v3"
        : "https://cybqa.pesapal.com/pesapalv3";

async function getPesapalToken() {
    const response = await axios.post(
        `${PESAPAL_BASE_URL}/api/Auth/RequestToken`,
        {
            consumer_key: process.env.PESAPAL_CONSUMER_KEY,
            consumer_secret: process.env.PESAPAL_CONSUMER_SECRET
        },
        {
            headers: {
                Accept: "application/json",
                "Content-Type": "application/json"
            }
        }
    );

    if (!response.data.token) {
        throw new Error("Pesapal authentication failed.");
    }

    return response.data.token;
}

module.exports = {
    PESAPAL_BASE_URL,
    getPesapalToken
};
