const { csrfSync } = require("csrf-sync");

const {
    csrfSynchronisedProtection: originalProtection,
    generateToken: originalGenerateToken
} = csrfSync({
    getTokenFromRequest: (req) => {
        if (req.body?.csrfToken) {
            return req.body.csrfToken;
        }
        return req.headers["x-csrf-token"];
    },
    getTokenFromSession: (req) => {
        return req.session?.csrfToken;
    },
    storeTokenInSession: (req, token) => {
        req.session.csrfToken = token;
    }
});

// DEBUG WRAPPER: I-print ang session state bago mag-check ng CSRF
const csrfSynchronisedProtection = (req, res, next) => {
    console.log("===== CSRF PROTECTION (POST side) =====");
    console.log("Method:", req.method, "URL:", req.url);
    console.log("Session ID:", req.sessionID);
    console.log("Token in session:", req.session?.csrfToken);
    console.log("Token in body:", req.body?.csrfToken);
    console.log("Token in header:", req.headers["x-csrf-token"]);
    console.log("Cookie header:", req.headers.cookie ? "present" : "MISSING");
    console.log("=======================================");
    console.log(
        "CSRF tokens match:",
        req.session?.csrfToken === req.headers["x-csrf-token"]
    );
    return originalProtection(req, res, next);
};

// Wrapper para sa generate token
const generateToken = (req) => {
    const token = originalGenerateToken(req);
    console.log("===== GENERATE TOKEN =====");
    console.log("Session ID:", req.sessionID);
    console.log("Stored token:", req.session?.csrfToken);
    console.log("==========================");
    if (req.session && typeof req.session.save === 'function') {
        req.session.save((err) => {
            if (err) console.error("Session save error:", err);
            else console.log("Session saved successfully!");
        });
    }
    return token;
};

module.exports = {
    csrfSynchronisedProtection,
    generateToken
};
