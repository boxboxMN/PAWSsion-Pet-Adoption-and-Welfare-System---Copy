const axios = require("axios");

const FLASK_API_URL =
    process.env.FLASK_API_URL || "http://localhost:5000";

async function generateEmbedding(text) {
    try {

        console.log("========================================");
        console.log("CALLING FLASK EMBEDDING");
        console.log("FLASK URL:", `${FLASK_API_URL}/embedding`);
        console.log("TEXT:", text);
        console.log("========================================");

        const response = await axios.post(
            `${FLASK_API_URL}/embedding`,
            {
                text: text
            }
        );

        console.log("========================================");
        console.log("FLASK EMBEDDING RESPONSE");
        console.log(response.data);
        console.log("========================================");

        return {
            embedding: response.data.embedding,
            repairedText: response.data.repaired_text
        };

    } catch (error) {

        console.error("========================================");
        console.error("FLASK EMBEDDING ERROR");
        console.error("========================================");

        if (error.response) {

            console.error("Status:", error.response.status);
            console.error("Message:", error.response.data);

            const flaskError = new Error(
                error.response.data.message ||
                "Invalid behavior description."
            );

            flaskError.status = error.response.status;
            flaskError.repairedText =
                error.response.data.repaired_text;

            throw flaskError;
        }

        console.error("Error message:", error.message);
        throw error;
    }
}

module.exports = {
    generateEmbedding
};