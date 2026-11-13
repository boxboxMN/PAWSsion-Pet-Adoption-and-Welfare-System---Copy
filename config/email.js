// const nodemailer = require("nodemailer");

// const transporter = nodemailer.createTransport({
//     service: "gmail",
//     auth: {
//         user: process.env.EMAIL_USER,
//         pass: process.env.EMAIL_PASS
//     }
// });

// module.exports = transporter;

const { google } = require("googleapis");

const oauth2Client = new google.auth.OAuth2(
    process.env.GMAIL_OAUTH_CLIENT_ID,
    process.env.GMAIL_OAUTH_CLIENT_SECRET,
    process.env.GMAIL_OAUTH_REDIRECT_URI
);

oauth2Client.setCredentials({
    refresh_token: process.env.GMAIL_REFRESH_TOKEN
});

async function sendMail(mailOptions) {
    const gmail = google.gmail({
        version: "v1",
        auth: oauth2Client
    });

    const from = process.env.EMAIL_USER;
    const to = mailOptions.to;
    const subject = mailOptions.subject || "";
    const text = mailOptions.text || "";
    const html = mailOptions.html || "";

    const message = [
        `From: ${from}`,
        `To: ${to}`,
        `Subject: ${subject}`,
        "MIME-Version: 1.0",
        "Content-Type: text/html; charset=UTF-8",
        "",
        html || text
    ].join("\r\n");

    const encodedMessage = Buffer
        .from(message)
        .toString("base64url");

    const result = await gmail.users.messages.send({
        userId: "me",
        requestBody: {
            raw: encodedMessage
        }
    });

    return result.data;
}

module.exports = { sendMail };
