// ===================================
// REGEX VALIDATORS
// ===================================
const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#]).{8,}$/;
const phoneRegex = /^09\d{9}$/;
const emailValidatorRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Names: letters and spaces only, 2–50 characters
const nameRegex = /^[A-Za-zÀ-ÖØ-öø-ÿ ]{2,50}$/;

// Occupation: letters, numbers, spaces, and common punctuation
const occupationRegex = /^[A-Za-zÀ-ÖØ-öø-ÿ0-9'.,&()\/ -]{2,100}$/;

// Street address: allows numbers, letters, spaces, and common address characters
const streetAddressRegex = /^[A-Za-zÀ-ÖØ-öø-ÿ0-9 .,#()\/-]{5,150}$/;
// ===================================
// DOM ELEMENTS
// ===================================
// Steps
const step1 = document.getElementById('step1');
const step2 = document.getElementById('step2');
const step3 = document.getElementById('step3');
const ind1 = document.getElementById('stepIndicator1');
const ind2 = document.getElementById('stepIndicator2');
const ind3 = document.getElementById('stepIndicator3');

// Inputs Step 1
const firstName = document.getElementById('firstName');
const lastName = document.getElementById('lastName');
const birthdayInput = document.getElementById('birthday');
const birthdayHelper = document.getElementById('birthdayHelper');
const nextToStep2 = document.getElementById('nextToStep2');

// Inputs Step 2
const streetAddress = document.getElementById('streetAddress');
const regionSelect = document.getElementById('region');
const provinceSelect = document.getElementById('province');
const citySelect = document.getElementById('city');
const barangaySelect = document.getElementById('barangay');
const zipCode = document.getElementById('zipCode');
const zipRegex = /^\d{4}$/;
const zipHelper = document.getElementById('zipHelper');
const nextToStep3 = document.getElementById('nextToStep3');

// ===================================
// GEOAPIFY ADDRESS VERIFICATION
// ===================================
let verifiedStreetAddress = null;
let addressSearchTimer = null;

const addressSuggestions =
    document.getElementById("addressSuggestions");

// ===================================
// ENABLE ADDRESS FIELDS AFTER LOCATION
// ===================================

function updateAddressFieldsState() {
    const cityLocationComplete =
        regionSelect.value.trim() !== "" &&
        provinceSelect.value.trim() !== "" &&
        citySelect.value.trim() !== "";

    const addressLocationComplete =
        cityLocationComplete &&
        barangaySelect.value.trim() !== "";

    // Street Address needs Barangay
    streetAddress.disabled = !addressLocationComplete;

    // ZIP Code only needs Province + City
    zipCode.disabled = !cityLocationComplete;

    if (!cityLocationComplete) {
        streetAddress.value = "";
        zipCode.value = "";

        verifiedStreetAddress = null;

        addressSuggestions.hidden = true;
        addressSuggestions.innerHTML = "";

        zipHelper.className = "input-helper-text";
        zipHelper.innerHTML = "";
    }
}

function resetAddressVerification(clearZip = true) {
    clearTimeout(addressSearchTimer);

    verifiedStreetAddress = null;

    streetAddress.value = "";

    if (clearZip) {
        zipCode.value = "";

        zipHelper.className = "input-helper-text";
        zipHelper.innerHTML = "";
    }

    addressSuggestions.hidden = true;
    addressSuggestions.innerHTML = "";

    streetAddressHelper.className = "input-helper-text";
    streetAddressHelper.innerHTML = "";
}

[regionSelect, provinceSelect, citySelect, barangaySelect].forEach((select) => {
    select.addEventListener("change", () => {
        const isBarangayChange = select === barangaySelect;

        resetAddressVerification(!isBarangayChange);
        updateAddressFieldsState();
    });
});

updateAddressFieldsState();

// Inputs Step 3
const form = document.getElementById('createAccountForm');
const emailInput = document.getElementById('email');
const emailHelper = document.getElementById('emailHelper');
const manualOtpSection = document.getElementById("manualOtpSection");
const otpInputSection = document.getElementById("otpInputSection");
const otpModal = document.getElementById("otpModal");
const closeOtpModalButton = document.getElementById("closeOtpModal");
const emailOtpInput = document.getElementById("emailOtp");
const otpHelper = document.getElementById("otpHelper");
const sendOtpButton = document.getElementById("sendOtpButton");
const verifyOtpButton = document.getElementById("verifyOtpButton");
const emailOtpStatus = document.getElementById("emailOtpStatus");
const openOtpModalButton = document.getElementById("openOtpModalButton");
const changeEmailButton = document.getElementById("changeEmailButton");
const resendOtpButton = document.getElementById("resendOtpButton");

let resendCountdownTimer = null;

function updateManualOtpVisibility() {
    const emailIsEmpty = emailInput.value.trim() === "";
    const emailIsUnavailable = !isEmailValidAndAvailable;

    manualOtpSection.hidden =
        emailInput.readOnly || emailIsEmpty || emailIsUnavailable;

    if (emailInput.readOnly || emailIsEmpty || emailIsUnavailable) {
        emailOtpInput.value = "";
        otpHelper.textContent = "";
    }
}

closeOtpModalButton.addEventListener("click", () => {
    otpModal.hidden = true;
});

changeEmailButton.addEventListener("click", () => {
    clearInterval(resendCountdownTimer);
    resendCountdownTimer = null;

    emailInput.readOnly = false;
    emailInput.value = "";
    emailInput.focus();
    
    isRegistrationEmailOtpVerified = false;
    isEmailValidAndAvailable = false;

    updateSignUpButtonState();

    emailHelper.className = "input-helper-text";
    emailHelper.textContent = "";

    emailOtpStatus.className = "input-helper-text";
    emailOtpStatus.textContent = "";

    changeEmailButton.hidden = true;

    updateManualOtpVisibility();
});

openOtpModalButton.addEventListener("click", async () => {
    const email = emailInput.value.trim().toLowerCase();

    if (!emailValidatorRegex.test(email)) {
        emailHelper.className = "input-helper-text error";
        emailHelper.textContent = "Please enter a valid email address.";
        return;
    }

    await verifyEmailUniqueness();

    if (!isEmailValidAndAvailable) {
        return;
    }

    // Reset OTP modal to its initial state
    clearInterval(resendCountdownTimer);
    resendCountdownTimer = null;

    isRegistrationEmailOtpVerified = false;

    otpHelper.className = "input-helper-text";
    otpHelper.textContent = "";
    emailOtpInput.value = "";
    emailOtpInput.disabled = false;

    sendOtpButton.hidden = false;
    sendOtpButton.disabled = false;
    sendOtpButton.textContent = "Send Code";

    otpInputSection.hidden = true;

    verifyOtpButton.hidden = false;
    verifyOtpButton.disabled = true;
    verifyOtpButton.textContent = "Verify Code";

    resendOtpButton.hidden = true;
    resendOtpButton.disabled = true;
    resendOtpButton.textContent = "Resend Code";

    otpModal.hidden = false;
});

function startResendCountdown(seconds = 60) {
    clearInterval(resendCountdownTimer);

    resendOtpButton.hidden = false;
    resendOtpButton.disabled = true;

    let remaining = seconds;

    resendOtpButton.textContent = `Resend Code in ${remaining}s`;

    resendCountdownTimer = setInterval(() => {
        remaining--;

        if (remaining <= 0) {
            clearInterval(resendCountdownTimer);
            resendCountdownTimer = null;

            resendOtpButton.disabled = false;
            resendOtpButton.textContent = "Resend Code";
            return;
        }

        resendOtpButton.textContent = `Resend Code in ${remaining}s`;
    }, 1000);
}

sendOtpButton.addEventListener("click", async () => {
    const email = emailInput.value.trim().toLowerCase();

    if (emailInput.readOnly) {
        return;
    }

    if (!emailValidatorRegex.test(email)) {
        otpHelper.className = "input-helper-text error";
        otpHelper.textContent = "Please enter a valid email address first.";
        return;
    }

    // Recheck email availability before requesting a code.
    await verifyEmailUniqueness();

    if (!isEmailValidAndAvailable) {
        otpHelper.className = "input-helper-text error";
        otpHelper.textContent = "Please use an available email address.";
        return;
    }

    const csrfToken = form.querySelector('input[name="csrfToken"]')?.value;

    if (!csrfToken) {
        otpHelper.className = "input-helper-text error";
        otpHelper.textContent = "Security token missing. Please reload the page.";
        return;
    }

    sendOtpButton.disabled = true;
    sendOtpButton.textContent = "Sending...";
    otpHelper.className = "input-helper-text";
    otpHelper.textContent = "";

    try {
        const response = await fetch("/auth/registration/send-otp", {
            method: "POST",
            credentials: "same-origin",
            headers: {
                "Content-Type": "application/json",
                "X-CSRF-Token": csrfToken
            },
            body: JSON.stringify({ email })
        });

        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.message || "Could not send the verification code.");
        }
        sendOtpButton.hidden = true;

        otpInputSection.hidden = false;
        otpHelper.className = "input-helper-text success";
        otpHelper.textContent = result.message || "Code sent. Check your email.";

        emailOtpInput.value = "";
        emailOtpInput.disabled = false;

        verifyOtpButton.hidden = false;
        verifyOtpButton.disabled = true;
        verifyOtpButton.textContent = "Verify Code";

        resendOtpButton.hidden = false;
        resendOtpButton.disabled = true;

        startResendCountdown(60);

        emailOtpInput.focus();

    } catch (error) {
        otpHelper.className = "input-helper-text error";
        otpHelper.textContent = error.message || "Unable to send the code. Please try again.";
    } finally {
        sendOtpButton.disabled = false;
        sendOtpButton.textContent = "Send Code";
    }
});

resendOtpButton.addEventListener("click", async () => {
    const email = emailInput.value.trim().toLowerCase();

    if (resendOtpButton.disabled) {
        return;
    }

    const csrfToken = form.querySelector('input[name="csrfToken"]')?.value;

    if (!csrfToken) {
        otpHelper.className = "input-helper-text error";
        otpHelper.textContent = "Security token missing. Please reload the page.";
        return;
    }

    resendOtpButton.disabled = true;
    resendOtpButton.textContent = "Sending...";

    try {
        const response = await fetch("/auth/registration/send-otp", {
            method: "POST",
            credentials: "same-origin",
            headers: {
                "Content-Type": "application/json",
                "X-CSRF-Token": csrfToken
            },
            body: JSON.stringify({ email })
        });

        const result = await response.json();

        if (!response.ok) {
            throw new Error(
                result.message || "Could not resend the verification code."
            );
        }

        isRegistrationEmailOtpVerified = false;

        otpHelper.className = "input-helper-text success";
        otpHelper.textContent =
            result.message || "A new verification code has been sent.";

        emailOtpInput.value = "";
        verifyOtpButton.disabled = true;

        startResendCountdown(60);

        emailOtpInput.focus();

    } catch (error) {
        otpHelper.className = "input-helper-text error";
        otpHelper.textContent =
            error.message || "Unable to resend the code. Please try again.";

        resendOtpButton.disabled = false;
        resendOtpButton.textContent = "Resend Code";
    }
});

emailOtpInput.addEventListener("input", () => {
    const otp = emailOtpInput.value.trim();

    // Allow numbers only
    emailOtpInput.value = otp.replace(/\D/g, "").slice(0, 6);

    // Enable only when exactly 6 digits are entered
    verifyOtpButton.disabled = emailOtpInput.value.length !== 6;
});

verifyOtpButton.addEventListener("click", async () => {
    const email = emailInput.value.trim().toLowerCase();
    const otp = emailOtpInput.value.trim();

    if (!/^\d{6}$/.test(otp)) {
        otpHelper.className = "input-helper-text error";
        otpHelper.textContent = "Please enter the 6-digit code.";
        return;
    }

    const csrfToken = form.querySelector('input[name="csrfToken"]')?.value;

    if (!csrfToken) {
        otpHelper.className = "input-helper-text error";
        otpHelper.textContent = "Security token missing. Please refresh the page.";
        return;
    }

    verifyOtpButton.disabled = true;
    verifyOtpButton.textContent = "Verifying...";

    try {
        const response = await fetch("/auth/registration/verify-otp", {
            method: "POST",
            credentials: "same-origin",
            headers: {
                "Content-Type": "application/json",
                "X-CSRF-Token": csrfToken
            },
            body: JSON.stringify({ email, otp })
        });

        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.message || "Could not verify the code.");
        }

        isRegistrationEmailOtpVerified = true;

        emailInput.readOnly = true;
        changeEmailButton.hidden = false;

        updateManualOtpVisibility();
        updateSignUpButtonState();

        otpHelper.className = "input-helper-text success";
        otpHelper.textContent = result.message || "Email verified successfully.";

        emailOtpInput.value = "";
        emailOtpInput.disabled = true;
        verifyOtpButton.disabled = true;
        verifyOtpButton.textContent = "Verified";

        emailOtpStatus.className = "input-helper-text success";
        emailOtpStatus.textContent = result.message || "Email verified successfully.";

        setTimeout(() => {
            otpModal.hidden = true;

            // Reset modal controls for a future attempt, if needed
            emailOtpInput.disabled = false;
            verifyOtpButton.disabled = false;
            verifyOtpButton.textContent = "Verify Code";
            otpHelper.textContent = "";
        }, 1800);
    } catch (error) {
        otpHelper.className = "input-helper-text error";
        otpHelper.textContent = error.message || "Verification failed. Please try again.";
    } finally {
        if (!isRegistrationEmailOtpVerified) {
            verifyOtpButton.disabled = false;
            verifyOtpButton.textContent = "Verify Code";
        }
    }
});

const phoneInput = document.getElementById('phoneNumber');
const phoneHelper = document.getElementById('phoneHelper');
const passwordInput = document.getElementById('password');
const confirmPasswordInput = document.getElementById('confirmPassword');
const termsAgreement = document.getElementById('termsAgreement');


const passwordRequirements = document.getElementById('passwordRequirements');
const reqLength = document.getElementById('reqLength');
const reqUppercase = document.getElementById('reqUppercase');
const reqLowercase = document.getElementById('reqLowercase');
const reqNumber = document.getElementById('reqNumber');
const reqSpecial = document.getElementById('reqSpecial');
const reqMatch = document.getElementById('reqMatch');

// Custom Modal Engine Elements
const alertOverlay = document.getElementById("customAlertOverlay");
const alertIcon = document.getElementById("customAlertIcon");
const alertMessage = document.getElementById("customAlertMessage");
const alertBtn = document.getElementById("customAlertBtn");

const firstNameHelper = document.getElementById("firstNameHelper");
const lastNameHelper = document.getElementById("lastNameHelper");
const occupationInput = document.getElementById("occupation");
const occupationHelper = document.getElementById("occupationHelper");
const streetAddressHelper = document.getElementById("streetAddressHelper");

let currentAlertCallback = null;
let isEmailValidAndAvailable = false;
let isRegistrationEmailOtpVerified = false;

// ===================================
// GEOAPIFY ADDRESS AUTOCOMPLETE
// ===================================

async function searchAddressSuggestions() {
    const street = streetAddress.value.trim();
    const barangay = barangaySelect.value.trim();
    const city = citySelect.value.trim();
    const province = provinceSelect.value.trim();

    // Clear suggestions when there is not enough information
    if (street.length < 2 || !barangay || !city || !province) {
        addressSuggestions.hidden = true;
        addressSuggestions.innerHTML = "";
        return;
    }

    try {
        const searchText = `${street}, ${barangay}, ${city}, ${province}, Philippines`;

        console.log("Address search:", {
            street,
            barangay,
            city,
            province,
            searchText
        });

        const params = new URLSearchParams({
            text: street,
            barangay: barangay,
            city: city,
            province: province
        });

        const response = await fetch(
            `/api/address/search?${params.toString()}`,
            {
                credentials: "same-origin"
            }
        );

        const data = await response.json();

        console.log("Address API response:", data);
        
        if (!response.ok) {
            throw new Error(
                data.error || "Unable to search addresses."
            );
        }

        renderAddressSuggestions(data.results || []);

    } catch (error) {
        console.error("Address autocomplete error:", error);

        addressSuggestions.hidden = true;
        addressSuggestions.innerHTML = "";
    }
}

function renderAddressSuggestions(results) {
    addressSuggestions.innerHTML = "";

    const addressResults = results.filter(result =>
        String(result.street || "").trim() !== "" ||
        String(result.name || "").trim() !== ""
    );

    if (!addressResults.length) {
        addressSuggestions.hidden = true;
        return;
    }

    addressSuggestions.hidden = false;

    addressResults.forEach((result) => {
        const item = document.createElement("div");

        item.className = "address-suggestion-item";

        const title = document.createElement("div");
        title.className = "address-suggestion-title";

        title.textContent =
            result.street ||
            result.name ||
            "Address result";

        const details = document.createElement("div");
        details.className = "address-suggestion-details";

        const detailsParts = [
            result.suburb,
            result.district,
            result.city,
            result.state,
            result.postcode
        ].filter(Boolean);

        details.textContent =
            detailsParts.join(", ");

        item.appendChild(title);
        item.appendChild(details);

        item.addEventListener("mousedown", (event) => {
            event.preventDefault();
            selectAddressSuggestion(result);
        });

        addressSuggestions.appendChild(item);
    });
}

function selectAddressSuggestion(result) {
    const addressName = String(
        result.street ||
        result.name ||
        ""
    ).trim();

    if (!addressName) {
        return;
    }

    /*
     * Keep the user's typed house number / address text.
     * The selected Geoapify result verifies the street and
     * provides the postcode.
     */
    const currentValue = streetAddress.value.trim();

    const houseNumberMatch =
        currentValue.match(/^\s*(\d+[A-Za-z0-9-]*)\s+/);

    if (houseNumberMatch) {
        streetAddress.value =
            `${houseNumberMatch[1]} ${addressName}`;
    } else {
        streetAddress.value = addressName;
    }

    verifiedStreetAddress = {
        street: addressName,
        city: result.city || "",
        province: result.state || "",
        postcode: result.postcode || "",
        formatted: result.formatted || "",
        placeId: result.place_id || null
    };

    streetAddressHelper.className =
        "input-helper-text success";

    streetAddressHelper.innerHTML =
        "<i class='fa-solid fa-circle-check'></i> " +
        "Address verified.";

    addressSuggestions.hidden = true;
    addressSuggestions.innerHTML = "";

    validateStep2();
}

// Search while typing
streetAddress.addEventListener("input", function () {
    // Any manual edit invalidates the previous selection
    verifiedStreetAddress = null;

    clearTimeout(addressSearchTimer);

    const value = this.value.trim();

    if (value.length < 2) {
        addressSuggestions.hidden = true;
        addressSuggestions.innerHTML = "";
        return;
    }

    addressSearchTimer = setTimeout(() => {
        searchAddressSuggestions();
    }, 100);
});

const signUpButton = form.querySelector(".submit-btn");

function updateSignUpButtonState() {
    const emailIsVerified =
        emailInput.readOnly || isRegistrationEmailOtpVerified;

    signUpButton.disabled = !emailIsVerified;
}

updateSignUpButtonState();

let isBirthdayValid = false;
let regionsData = [];
let provincesData = [];
let citiesData = [];
let barangaysData = [];
let zipCodesData = [];

// ===================================
// ZIP CODE LOOKUP
// ===================================

async function loadZipCodes() {
    if (zipCodesData.length > 0) {
        return;
    }

    try {
        const res = await fetch('/data/zip_codes.json');

        if (!res.ok) {
            throw new Error("ZIP code file not found");
        }

        zipCodesData = await res.json();

    } catch (err) {
        console.error("Error loading ZIP codes:", err);
        zipCodesData = [];
    }
}

function normalizeLocation(value) {
    return String(value || "")
        .toLowerCase()
        .replace(/[.,'’()\-]/g, " ")
        .replace(/\bthe\b/g, " ")
        .replace(/\bcity\s+of\b/g, " ")
        .replace(/\bcity\b/g, " ")
        .replace(/\bmunicipality\s+of\b/g, " ")
        .replace(/\bmunicipality\b/g, " ")
        .replace(/\bmunicipal\b/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}

async function updateZipCodeFromLocation() {
    const province = provinceSelect.value.trim();
    const city = citySelect.value.trim();

    if (!province || !city) {
        zipCode.value = "";
        zipCode.readOnly = true;

        zipHelper.className = "input-helper-text";
        zipHelper.innerHTML = "";

        validateStep2();
        return;
    }

    // Keep ZIP locked while retrieving the correct value
    zipCode.readOnly = true;

    try {
        const response = await fetch(
            `/api/address/zip?province=${encodeURIComponent(province)}&city=${encodeURIComponent(city)}`,
            {
                credentials: "same-origin"
            }
        );

        const data = await response.json();

        if (!response.ok && response.status !== 404) {
            throw new Error(
                data.message || "Unable to retrieve ZIP code."
            );
        }

        if (data.found && data.zip_code) {
            zipCode.value = String(data.zip_code);
            zipCode.readOnly = true;

            zipHelper.className =
                "input-helper-text success";

            zipHelper.innerHTML =
                "<i class='fa-solid fa-circle-check'></i> " +
                "ZIP code automatically filled.";
        } else {
            zipCode.value = "";
            zipCode.readOnly = false;

            zipHelper.className =
                "input-helper-text error";

            zipHelper.innerHTML =
                "<i class='fa-solid fa-circle-xmark'></i> " +
                "No ZIP code was found for the selected city. " +
                "Please enter your ZIP code manually.";
        }

        validateStep2();

    } catch (error) {
        console.error("ZIP API error:", error);

        zipCode.value = "";
        zipCode.readOnly = false;

        zipHelper.className =
            "input-helper-text error";

        zipHelper.innerHTML =
            "<i class='fa-solid fa-circle-xmark'></i> " +
            "Unable to retrieve ZIP code. " +
            "Please enter it manually.";

        validateStep2();
    }
}

function validateAgeAndBirthday() {
    const value = birthdayInput.value;
    if (!value) {
        birthdayHelper.innerHTML = "";
        isBirthdayValid = false;
        return false;
    }

    const birthDate = new Date(value);
    const today = new Date();

    if (isNaN(birthDate.getTime())) {
        birthdayHelper.className = "input-helper-text error";
        birthdayHelper.innerHTML = "<i class='fa-solid fa-circle-xmark'></i> Please enter a valid date.";
        isBirthdayValid = false;
        return false;
    }

    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
        age--;
    }

    if (birthDate > today) {
        birthdayHelper.className = "input-helper-text error";
        birthdayHelper.innerHTML = "<i class='fa-solid fa-circle-xmark'></i> Birthday cannot be in the future.";
        isBirthdayValid = false;
        return false;
    } else if (age < 18) {
        birthdayHelper.className = "input-helper-text error";
        birthdayHelper.innerHTML = "<i class='fa-solid fa-circle-xmark'></i> You must be at least 18 years old to register.";
        isBirthdayValid = false;
        return false;
    } else if (age > 120) {
        birthdayHelper.className = "input-helper-text error";
        birthdayHelper.innerHTML = "<i class='fa-solid fa-circle-xmark'></i> Please enter a valid birth date.";
        isBirthdayValid = false;
        return false;
    } else {
        birthdayHelper.className = "input-helper-text success";
        birthdayHelper.innerHTML = "<i class='fa-solid fa-circle-check'></i> Age verified (" + age + " years old).";
        isBirthdayValid = true;
        return true;
    }
}

// ===================================
// NAME VALIDATION
// ===================================
function validateName(input, helper, fieldName) {
    const value = input.value.trim();

    if (value === "") {
        helper.textContent = `${fieldName} is required.`;
        helper.className = "input-helper-text error";
        return false;
    }

    if (value.length > 50) {
        helper.textContent = `${fieldName} must not exceed 50 characters.`;
        helper.className = "input-helper-text error";
        return false;
    }

    if (!nameRegex.test(value)) {
        helper.textContent =
            `${fieldName} can only contain letters and spaces. Numbers and special characters are not allowed.`;
        helper.className = "input-helper-text error";
        return false;
    }

    helper.textContent = "";
    helper.className = "input-helper-text success";
    return true;
}
// ===================================
// OCCUPATION VALIDATION
// ===================================

function validateOccupation() {

    const value = occupationInput.value.trim();

    // Optional field
    if (value === "") {
        occupationHelper.innerHTML = "";
        return true;
    }

    if (value.length < 2) {
        occupationHelper.className = "input-helper-text error";
        occupationHelper.innerHTML =
            "<i class='fa-solid fa-circle-xmark'></i> " +
            "Occupation must be at least 2 characters.";

        return false;
    }

    if (value.length > 100) {
        occupationHelper.className = "input-helper-text error";
        occupationHelper.innerHTML =
            "<i class='fa-solid fa-circle-xmark'></i> " +
            "Occupation must not exceed 100 characters.";

        return false;
    }

    if (!occupationRegex.test(value)) {
        occupationHelper.className = "input-helper-text error";
        occupationHelper.innerHTML =
            "<i class='fa-solid fa-circle-xmark'></i> " +
            "Occupation contains invalid characters.";

        return false;
    }

    occupationHelper.className = "input-helper-text success";
    occupationHelper.innerHTML =
        "<i class='fa-solid fa-circle-check'></i> Valid occupation.";

    return true;
}
// ===================================
// STREET ADDRESS VALIDATION
// ===================================
function validateStreetAddress() {

    const value = streetAddress.value.trim();

    if (value === "") {
        verifiedStreetAddress = null;
        addressSuggestions.hidden = true;
        addressSuggestions.innerHTML = "";

        streetAddressHelper.className = "input-helper-text";
        streetAddressHelper.innerHTML = "";

        return true;
    }

    if (value.length < 5) {
        streetAddressHelper.className =
            "input-helper-text error";

        streetAddressHelper.innerHTML =
            "<i class='fa-solid fa-circle-xmark'></i> " +
            "Please enter a complete street address.";

        return false;
    }

    if (value.length > 150) {
        streetAddressHelper.className =
            "input-helper-text error";

        streetAddressHelper.innerHTML =
            "<i class='fa-solid fa-circle-xmark'></i> " +
            "Street address must not exceed 150 characters.";

        return false;
    }

    if (!streetAddressRegex.test(value)) {
        streetAddressHelper.className =
            "input-helper-text error";

        streetAddressHelper.innerHTML =
            "<i class='fa-solid fa-circle-xmark'></i> " +
            "Street address can only contain letters, numbers, spaces, " +
            "and common address characters such as . , # / and -.";

        return false;
    }

    const hasVowel = /[aeiouáéíóúàèìòù]/i.test(value);

    if (!hasVowel) {
        streetAddressHelper.className =
            "input-helper-text error";

        streetAddressHelper.innerHTML =
            "<i class='fa-solid fa-circle-xmark'></i> " +
            "Please enter a valid street or area name.";

        return false;
    }

    // Must contain at least one letter
    if (!/[A-Za-zÀ-ÖØ-öø-ÿ]/.test(value)) {
        streetAddressHelper.className =
            "input-helper-text error";

        streetAddressHelper.innerHTML =
            "<i class='fa-solid fa-circle-xmark'></i> " +
            "Please enter a valid street or area name.";

        return false;
    }

    // Reject obvious repeated-character gibberish
    if (/(.)\1{4,}/i.test(value)) {
        streetAddressHelper.className =
            "input-helper-text error";

        streetAddressHelper.innerHTML =
            "<i class='fa-solid fa-circle-xmark'></i> " +
            "The street address appears to contain invalid or repeated text.";

        return false;
    }

    // Reject common keyboard-pattern gibberish
    const normalizedValue = value
        .toLowerCase()
        .replace(/\s+/g, "");

    const obviousGibberishPatterns = [
        "asdf",
        "asdfgh",
        "qwer",
        "qwerty",
        "zxcv",
        "zxcvb",
        "poiuy",
        "lkjh",
        "mnbv"
    ];

    if (
        obviousGibberishPatterns.some(pattern =>
            normalizedValue.includes(pattern)
        )
    ) {
        streetAddressHelper.className =
            "input-helper-text error";

        streetAddressHelper.innerHTML =
            "<i class='fa-solid fa-circle-xmark'></i> " +
            "Please enter a valid street or area name.";

        return false;
    }

    const compactLetters = value
    .toLowerCase()
    .replace(/[^a-zà-öø-ÿñ]/gi, "");

    if (/(.{2,3})\1{2,}/i.test(compactLetters)) {
        streetAddressHelper.className =
            "input-helper-text error";

        streetAddressHelper.innerHTML =
            "<i class='fa-solid fa-circle-xmark'></i> " +
            "The street address appears to contain invalid or repeated text.";

        return false;
    }

    // Geoapify-selected address
    if (verifiedStreetAddress) {
        streetAddressHelper.className =
            "input-helper-text success";

        streetAddressHelper.innerHTML =
            "<i class='fa-solid fa-circle-check'></i> " +
            "Address verified.";

        return true;
    }

    // Valid manual address entry
    streetAddressHelper.className =
        "input-helper-text success";

    streetAddressHelper.innerHTML =
        "<i class='fa-solid fa-circle-check'></i> " +
        "Street address entered manually.";

    return true;
}

function validateStep1() {

    const firstNameValid =
        validateName(firstName, firstNameHelper, "First Name");

    const lastNameValid =
        validateName(lastName, lastNameHelper, "Last Name");

    const occupationValid =
        validateOccupation();

    nextToStep2.disabled =
        !(firstNameValid &&
          lastNameValid &&
          occupationValid &&
          isBirthdayValid);
}

birthdayInput.addEventListener('input', () => {
    validateAgeAndBirthday();
    validateStep1();
});
birthdayInput.addEventListener('change', () => {
    validateAgeAndBirthday();
    validateStep1();
});

[firstName, lastName, occupationInput].forEach(el => {
    el.addEventListener("input", validateStep1);
});

function validateStep2() {

    const isStreetValid =
        validateStreetAddress();

    const isZipValid =
        zipRegex.test(zipCode.value.trim());

    const isComplete =
        isStreetValid &&
        regionSelect.value.trim().length > 0 &&
        provinceSelect.value.trim().length > 0 &&
        citySelect.value.trim().length > 0 &&
        barangaySelect.value.trim().length > 0 &&
        isZipValid;

    nextToStep3.disabled = !isComplete;
}

[streetAddress, zipCode].forEach(el =>
    el.addEventListener('input', validateStep2)
);
[regionSelect, provinceSelect, citySelect, barangaySelect].forEach(el => el.addEventListener('change', validateStep2));


document.getElementById('nextToStep2').addEventListener('click', () => {
    step1.classList.remove('active');
    step2.classList.add('active');
    ind2.classList.add('active');
});

document.getElementById('prevToStep1').addEventListener('click', () => {
    step2.classList.remove('active');
    step1.classList.add('active');
    ind2.classList.remove('active');
});

document.getElementById('nextToStep3').addEventListener('click', () => {
    step2.classList.remove('active');
    step3.classList.add('active');
    ind3.classList.add('active');
});

document.getElementById('prevToStep2').addEventListener('click', () => {
    step3.classList.remove('active');
    step2.classList.add('active');
    ind3.classList.remove('active');
});


function showCustomAlert(message, type = "error", callback = null) {
    alertMessage.textContent = message;
    currentAlertCallback = callback;

    if (type === "success") {
        alertIcon.className = "custom-alert-icon success-icon";
        alertIcon.innerHTML = '<i class="fa-solid fa-circle-check"></i>';
        alertBtn.style.background = "#2ecc71";
    } else {
        alertIcon.className = "custom-alert-icon";
        alertIcon.innerHTML = '<i class="fa-solid fa-circle-exclamation"></i>';
        alertBtn.style.background = "#3498db";
    }

    alertOverlay.classList.add("active");
    alertBtn.focus();
}

alertBtn.addEventListener("click", () => {
    alertOverlay.classList.remove("active");
    if (currentAlertCallback) {
        currentAlertCallback();
        currentAlertCallback = null;
    }
});

const setupToggle = (button, input) => {
    if (!button || !input) return;
    button.addEventListener('click', () => {
        const isHidden = input.type === 'password';
        input.type = isHidden ? 'text' : 'password';
        const icon = button.querySelector('i');
        if (icon) {
            icon.className = isHidden ? 'fa-solid fa-eye-slash' : 'fa-solid fa-eye';
        }
        button.setAttribute('aria-label', isHidden ? 'Hide password' : 'Show password');
    });
};

setupToggle(document.getElementById('togglePassword'), passwordInput);
setupToggle(document.getElementById('toggleConfirmPassword'), confirmPasswordInput);

// ===================================
// LIVE EMAIL AVAILABILITY VERIFICATION
// ===================================
async function verifyEmailUniqueness() {
    const emailValue = emailInput.value.trim().toLowerCase();

    if (emailValue === "") {
        emailHelper.innerHTML = "";
        isEmailValidAndAvailable = false;
        return;
    }

    if (!emailValidatorRegex.test(emailValue)) {
        emailHelper.className = "input-helper-text error";
        emailHelper.innerHTML = "<i class='fa-solid fa-circle-xmark'></i> Please enter a valid email format.";
        isEmailValidAndAvailable = false;
        return;
    }

    emailHelper.className = "input-helper-text";
    emailHelper.innerHTML = "<i class='fa-solid fa-spinner fa-spin'></i> Checking availability...";

    try {
        const response = await fetch(`/auth/check-email?email=${encodeURIComponent(emailValue)}`);
        
        if (response.status === 409 || !response.ok) {
            emailHelper.className = "input-helper-text error";
            emailHelper.innerHTML = "<i class='fa-solid fa-circle-xmark'></i> Email address is already registered.";
            isEmailValidAndAvailable = false;
        } else {
            emailHelper.className = "input-helper-text";
            emailHelper.innerHTML = "";
            isEmailValidAndAvailable = true;
        }
    } catch (err) {
        emailHelper.innerHTML = "";
        isEmailValidAndAvailable = true; 
    }

    updateManualOtpVisibility();
}

emailInput.addEventListener("blur", () => {
    if (!emailInput.readOnly) {
        verifyEmailUniqueness();
    }
});

emailInput.addEventListener("input", () => {
    if (!emailInput.readOnly) {
        isEmailValidAndAvailable = false;
    }
});

emailInput.addEventListener("input", () => {
    if (!emailInput.readOnly) {
        isEmailValidAndAvailable = false;
        isRegistrationEmailOtpVerified = false;
    }

    updateManualOtpVisibility();

});

updateManualOtpVisibility();

// ===================================
// LIVE MOBILE NUMBER MASK AND FORMAT
// ===================================
phoneInput.addEventListener("input", function() {
    this.value = this.value.replace(/\D/g, ""); 
    if (this.value === "") {
        phoneHelper.innerHTML = "";
    } else if (phoneRegex.test(this.value)) {
        phoneHelper.className = "input-helper-text success";
        phoneHelper.innerHTML = "<i class='fa-solid fa-circle-check'></i> Valid Philippine mobile number.";
    } else {
        phoneHelper.className = "input-helper-text error";
        phoneHelper.innerHTML = "<i class='fa-solid fa-circle-xmark'></i> Must be exactly 11 digits starting with 09.";
    }
});

// ===================================
// LIVE PASSWORD COMPLEXITY TRACKER
// ===================================
function updateRequirementStatus(element, isValid) {
    const icon = element.querySelector(".status-icon");
    if (isValid) {
        element.classList.remove("invalid");
        element.classList.add("valid");
        icon.className = "fa-solid fa-circle-check status-icon";
    } else {
        element.classList.remove("valid");
        element.classList.add("invalid");
        icon.className = "fa-solid fa-circle-xmark status-icon";
    }
}

passwordInput.addEventListener("focus", () => { passwordRequirements.style.display = "block"; });
passwordInput.addEventListener("blur", () => { passwordRequirements.style.display = "none"; });

passwordInput.addEventListener("input", () => {
    const value = passwordInput.value;
    updateRequirementStatus(reqLength, value.length >= 8);
    updateRequirementStatus(reqUppercase, /[A-Z]/.test(value));
    updateRequirementStatus(reqLowercase, /[a-z]/.test(value));
    updateRequirementStatus(reqNumber, /\d/.test(value));
    updateRequirementStatus(reqSpecial, /[@$!%*?&#]/.test(value));
    checkMatch();
});

confirmPasswordInput.addEventListener("input", checkMatch);

function checkMatch() {
    if (confirmPasswordInput.value === "") {
        reqMatch.style.display = "none";
        return;
    }
    reqMatch.style.display = "flex";
    const valuesMatch = (passwordInput.value === confirmPasswordInput.value && passwordInput.value !== "");
    updateRequirementStatus(reqMatch, valuesMatch);
    if(valuesMatch) {
        reqMatch.querySelector(".status-icon").nextSibling.textContent = " Passwords match";
    } else {
        reqMatch.querySelector(".status-icon").nextSibling.textContent = " Passwords do not match";
    }
}

// ===================================
// SECURE SUBMIT HANDLER WITH AJAX POST
// ===================================
form.addEventListener("submit", async function(e) {
    e.preventDefault();

    if (!termsAgreement.checked) {
        showCustomAlert("Please accept the Terms of Service and Privacy Policy.", "error");
        return;
    }

    const email = emailInput.value.trim();
    const password = passwordInput.value;
    const confirmPassword = confirmPasswordInput.value;
    const phoneNumber = phoneInput.value.trim();

    if (!isEmailValidAndAvailable) {
        await verifyEmailUniqueness();
        if (!isEmailValidAndAvailable) {
            showCustomAlert("The email address provided is invalid or already taken.", "error");
            return;
        }
    }

    if (!emailInput.readOnly && !isRegistrationEmailOtpVerified) {
        openOtpModalButton.click();
        return;
    }

    if (!phoneRegex.test(phoneNumber)) {
        showCustomAlert("Please enter a valid 11-digit Philippine mobile number starting with 09.", "error");
        return;
    }

    if (!passwordRegex.test(password)) {
        showCustomAlert("Password does not meet the security complexity requirements.", "error");
        return;
    }

    if (password !== confirmPassword) {
        showCustomAlert("Passwords do not match.", "error");
        return;
    }
    const firstNameValid =
    validateName(firstName, firstNameHelper, "First Name");

const lastNameValid =
    validateName(lastName, lastNameHelper, "Last Name");

const occupationValid =
    validateOccupation();

const streetAddressValid =
    validateStreetAddress();

if (
    !firstNameValid ||
    !lastNameValid ||
    !occupationValid ||
    !streetAddressValid
) {
    showCustomAlert(
        "Please correct the highlighted fields before creating your account.",
        "error"
    );
    return;
}
    const payload = {
        firstName: document.getElementById("firstName").value.trim(),
        lastName: document.getElementById("lastName").value.trim(),
        birthday: birthdayInput.value.trim(),
        civilStatus: document.getElementById("civilStatus").value.trim(),
        occupation: document.getElementById("occupation").value.trim(),
        streetAddress: streetAddress.value.trim(),
        region: regionSelect.value.trim(),
        barangay: barangaySelect.value.trim(),
        city: citySelect.value.trim(),
        province: provinceSelect.value.trim(),
        zipCode: zipCode.value.trim(),
        phoneNumber: phoneNumber,
        email: email,
        password: password,
        confirmPassword: confirmPassword
    };

    const csrfToken = form.querySelector('input[name="csrfToken"]')?.value;

    try {
        const response = await fetch("/auth/register", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "X-CSRF-Token": csrfToken
            },
            body: JSON.stringify(payload)
        });

        const result = await response.text();

        if (response.ok) {
            showCustomAlert("Account created successfully! Welcome to Pawpon.", "success", () => {
                window.location.href = "/auth/login";
            });
        } else {
            showCustomAlert(result, "error");
        }
    } catch (err) {
        console.error(err);
        showCustomAlert("Unable to process your registration request. Please try again later.", "error");
    }
});

// ===================================
// LOCAL PHILIPPINE ADDRESS CASCADING
// ===================================

async function loadRegions() {
    try {
        regionSelect.innerHTML = '<option value="">Loading regions...</option>';
        const res = await fetch('/data/regions.json');
        if (!res.ok) throw new Error("Local file not found");
        regionsData = await res.json();

        regionSelect.innerHTML = '<option value="">Select Region</option>';
        regionsData.forEach(reg => {
            const opt = document.createElement('option');
            opt.value = reg.region_name;
            opt.textContent = reg.region_name;
            opt.dataset.code = reg.region_code;
            regionSelect.appendChild(opt);
        });
    } catch (err) {
        console.error("Error loading regions:", err);
        regionSelect.innerHTML = '<option value="">System error: Missing data</option>';
    }
}


regionSelect.addEventListener('change', async function() {
    const selectedOption = this.options[this.selectedIndex];
    const regCode = selectedOption ? selectedOption.dataset.code : null;

    provinceSelect.innerHTML = '<option value="">Loading provinces...</option>';
    provinceSelect.disabled = true;
    citySelect.innerHTML = '<option value="">Select City / Municipality</option>';
    citySelect.disabled = true;
    barangaySelect.innerHTML = '<option value="">Select Barangay</option>';
    barangaySelect.disabled = true;

    validateStep2();

    if (!regCode) {
        provinceSelect.innerHTML = '<option value="">Select Province</option>';
        return;
    }

    try {
        if (provincesData.length === 0) {
            const res = await fetch('/data/provinces.json');
            if (!res.ok) throw new Error("Local file not found");
            provincesData = await res.json();
        }

        let filteredProvinces = provincesData.filter(p => p.region_code === regCode);
        filteredProvinces.sort((a, b) => a.province_name.localeCompare(b.province_name));

        // Para sa NCR o mga lugar na walang hiwalay na province list
        if (filteredProvinces.length === 0) {
            filteredProvinces = [{ province_code: regCode, province_name: selectedOption.value }];
        }

        provinceSelect.innerHTML = '<option value="">Select Province</option>';
        filteredProvinces.forEach(p => {
            const opt = document.createElement('option');
            opt.value = p.province_name;
            opt.textContent = p.province_name;
            opt.dataset.code = p.province_code;
            provinceSelect.appendChild(opt);
        });
        provinceSelect.disabled = false;
    } catch (err) {
        console.error("Error loading provinces:", err);
        provinceSelect.innerHTML = '<option value="">System error: Missing data</option>';
    }
});


provinceSelect.addEventListener('change', async function() {
    const selectedOption = this.options[this.selectedIndex];
    const provCode = selectedOption ? selectedOption.dataset.code : null;
    const regCode = regionSelect.options[regionSelect.selectedIndex]?.dataset.code;

    citySelect.innerHTML = '<option value="">Loading cities...</option>';
    citySelect.disabled = true;
    barangaySelect.innerHTML = '<option value="">Select Barangay</option>';
    barangaySelect.disabled = true;

    validateStep2();

    if (!provCode) {
        citySelect.innerHTML = '<option value="">Select City / Municipality</option>';
        return;
    }

    try {
        if (citiesData.length === 0) {
            const res = await fetch('/data/cities.json');
            if (!res.ok) throw new Error("Local file not found");
            citiesData = await res.json();
        }

        const filteredCities = citiesData.filter(c => {
            if (String(provCode) === String(regCode)) {
                return String(c.region_desc) === String(regCode);
            }
        
            return String(c.province_code) === String(provCode);
        });
        filteredCities.sort((a, b) => a.city_name.localeCompare(b.city_name));

        citySelect.innerHTML = '<option value="">Select City / Municipality</option>';
        filteredCities.forEach(c => {
            const opt = document.createElement('option');
            opt.value = c.city_name;
            opt.textContent = c.city_name;
            opt.dataset.code = c.city_code;
            citySelect.appendChild(opt);
        });
        citySelect.disabled = false;
    } catch (err) {
        console.error("Error loading cities:", err);
        citySelect.innerHTML = '<option value="">System error: Missing data</option>';
    }
});


citySelect.addEventListener('change', async function() {
    const selectedOption = this.options[this.selectedIndex];
    const cityCode = selectedOption ? selectedOption.dataset.code : null;
    await updateZipCodeFromLocation();

    barangaySelect.innerHTML = '<option value="">Loading barangays...</option>';
    barangaySelect.disabled = true;

    validateStep2();

    if (!cityCode) {
        barangaySelect.innerHTML = '<option value="">Select Barangay</option>';
        return;
    }

    try {
        if (barangaysData.length === 0) {
            const res = await fetch('/data/barangays.json');
            if (!res.ok) throw new Error("Local file not found");
            barangaysData = await res.json();
        }

        const filteredBarangays = barangaysData.filter(b => b.city_code === cityCode);
        filteredBarangays.sort((a, b) => a.brgy_name.localeCompare(b.brgy_name));

        barangaySelect.innerHTML = '<option value="">Select Barangay</option>';
        filteredBarangays.forEach(b => {
            const opt = document.createElement('option');
            opt.value = b.brgy_name;
            opt.textContent = b.brgy_name;
            barangaySelect.appendChild(opt);
        });
        barangaySelect.disabled = false;
    } catch (err) {
        console.error("Error loading barangays:", err);
        barangaySelect.innerHTML = '<option value="">System error: Missing data</option>';
    }
});

barangaySelect.addEventListener('change', () => {
    updateAddressFieldsState();
    validateStep2();
});

loadRegions();


zipCode.addEventListener('input', function() {

    this.value = this.value.replace(/\D/g, '');

    if (this.value === '') {
        zipHelper.innerHTML = '';
    } else if (zipRegex.test(this.value)) {
        zipHelper.className = 'input-helper-text';
        zipHelper.innerHTML =
            "<i class='fa-solid fa-circle-info'></i> " +
            "Please make sure this ZIP code matches your address.";
    } else {
        zipHelper.className = 'input-helper-text error';
        zipHelper.innerHTML = "<i class='fa-solid fa-circle-xmark'></i> Must be exactly 4 digits.";
    }

    validateStep2();
});


const legalModal = document.getElementById("legalModal");
const legalModalTitle = document.getElementById("legalModalTitle");
const legalModalBody = document.getElementById("legalModalBody");

const termsLink = document.getElementById("termsLink");
const privacyLink = document.getElementById("privacyLink");
const closeLegalModal = document.getElementById("closeLegalModal");


const termsContent = `
    <p><strong>Last Updated:</strong> August 25, 2026</p>

    <p>Welcome to Pawpon, a web-based Pet Adoption and Welfare System. These Terms of Service govern your access to and use of the Pawpon website, including its pet listings, adoption applications, welfare reporting features, donation-related features, pet matching features, and other services provided through the System.</p>

    <p>By accessing or using Pawpon, you acknowledge that you have read, understood, and agreed to comply with these Terms of Service. If you do not agree with any part of these terms, please do not use the System.</p>

    <h2>1. Definitions</h2>

    <p>For purposes of these Terms of Service:</p>

    <ul>
        <li><strong>"Pawpon"</strong> refers to the Pet Adoption and Welfare System.</li>
        <li><strong>"System"</strong> refers to the Pawpon website, its features, pages, databases, and related services.</li>
        <li><strong>"User"</strong> refers to any individual who accesses or uses the System.</li>
        <li><strong>"Account"</strong> refers to a registered user's account within the System.</li>
        <li><strong>"Pet Listing"</strong> refers to information about a pet made available through the System for adoption or welfare-related purposes.</li>
        <li><strong>"Adoption Application"</strong> refers to information submitted by a user to express their intent to adopt a pet.</li>
        <li><strong>"Welfare Report"</strong> refers to a report submitted by a user concerning an animal welfare-related concern or situation.</li>
    </ul>

    <h2>2. Acceptance of Terms</h2>

    <p>By creating an account, submitting an adoption application, browsing pet listings, submitting a welfare report, or otherwise using Pawpon, you agree to comply with these Terms of Service and all applicable laws and regulations of the Republic of the Philippines.</p>

    <h2>3. User Accounts</h2>

    <p>Users are responsible for providing accurate information and maintaining the confidentiality of their account credentials.</p>

    <ul>
        <li>You must provide truthful and accurate information.</li>
        <li>You are responsible for activities performed through your account.</li>
        <li>You must not impersonate another person or organization.</li>
        <li>You must not create an account using false or misleading information.</li>
    </ul>

    <h2>4. Pet Listings</h2>

    <p>Pawpon may display information about pets available for adoption or requiring welfare assistance. Pet information may include the pet's name, species, breed, age, sex, health information, behavior, photographs, and adoption status.</p>

    <p>Pet information and availability may change over time. Pawpon may update, modify, hide, or remove pet listings when necessary.</p>

    <h2>5. Adoption Applications</h2>

    <p>Pawpon provides users with a platform to express their interest in adopting pets and to submit adoption applications. Submission of an adoption application does not guarantee approval or successful adoption.</p>

    <p>Users must provide truthful and complete information when submitting an adoption application.</p>

    <h2>6. Pet Matching and Recommendations</h2>

    <p>Pawpon may provide pet matching or recommendation features based on information supplied by users and information contained in pet profiles.</p>

    <p>Any match score or recommendation generated by the System is intended only as a decision-support feature. It does not guarantee compatibility or adoption approval.</p>

    <h2>7. Animal Welfare Reports</h2>

    <p>Users may submit reports concerning animal welfare situations. Users are expected to provide truthful, relevant, and accurate information.</p>

    <p>Intentionally false, fabricated, malicious, or misleading reports are prohibited.</p>

    <h2>8. Donations</h2>

    <p>Where donation-related features are available, users may use the System to support pet adoption and animal welfare activities.</p>

    <p>Donation and transaction records may be maintained by the System for administrative, monitoring, and reporting purposes.</p>

    <h2>9. Prohibited Activities</h2>

    <ul>
        <li>Using false or fraudulent information;</li>
        <li>Impersonating another person or organization;</li>
        <li>Submitting fraudulent adoption applications;</li>
        <li>Submitting intentionally false welfare reports;</li>
        <li>Attempting unauthorized access to the System;</li>
        <li>Uploading malicious files or harmful content;</li>
        <li>Harassing or threatening other users;</li>
        <li>Disrupting the operation or security of the System; or</li>
        <li>Using the System for unlawful purposes.</li>
    </ul>

    <h2>10. Privacy</h2>

    <p>Your use of Pawpon is also subject to the System's Privacy Policy, which explains how personal information is collected, used, stored, and protected.</p>

    <h2>11. Account Suspension or Termination</h2>

    <p>Pawpon administrators may suspend, restrict, or terminate an account when a user violates these Terms of Service, misuses the System, provides fraudulent information, or compromises the safety or security of the System.</p>

    <h2>12. Governing Law</h2>

    <p>These Terms of Service shall be governed by and interpreted in accordance with the laws of the Republic of the Philippines.</p>

    <h2>13. Changes to These Terms</h2>

    <p>Pawpon may update these Terms of Service when necessary. Updated terms will be posted on the System with the corresponding revision date.</p>

    <h2>14. Contact Us</h2>

    <p>If you have questions or concerns regarding these Terms of Service, you may contact the Pawpon system administrator through the contact information provided within the System.</p>
`;

// PRIVACY POLICY
const privacyContent = `
    <p><strong>Last Updated:</strong> August 25, 2026</p>

    <p>Pawpon is committed to protecting the privacy and security of information provided by its users. This Privacy Policy explains what information may be collected through the Pawpon Pet Adoption and Welfare System, how the information may be used, and how it may be protected.</p>

    <h2>1. Information We Collect</h2>

    <p>Pawpon may collect information necessary to provide and manage its features and services.</p>

    <h3>1.1 Account Information</h3>

    <ul>
        <li>Full name;</li>
        <li>Email address;</li>
        <li>Contact number;</li>
        <li>Username or account credentials;</li>
        <li>Address or location information; and</li>
        <li>Other information required for account registration.</li>
    </ul>

    <h3>1.2 Adoption Application Information</h3>

    <ul>
        <li>Personal and contact information;</li>
        <li>Living situation and household information;</li>
        <li>Pet preferences;</li>
        <li>Lifestyle and pet-care information;</li>
        <li>Adoption intentions;</li>
        <li>Emergency contact information; and</li>
        <li>Other information required by the adoption process.</li>
    </ul>

    <h3>1.3 Pet Information</h3>

    <p>The System may store pet information such as name, species, breed, age, sex, health information, behavior, photographs, and adoption status.</p>

    <h3>1.4 Welfare Reports</h3>

    <p>Users may provide information when submitting an animal welfare report, including descriptions, photographs, and other relevant details.</p>

    <h3>1.5 Donation and Transaction Information</h3>

    <p>Where donation features are available, the System may record information associated with donations or transactions, such as transaction references, amounts, dates, and transaction status.</p>

    <h2>2. How We Use Information</h2>

    <ul>
        <li>Creating and managing user accounts;</li>
        <li>Processing adoption applications;</li>
        <li>Providing pet matching and recommendation features;</li>
        <li>Managing pet profiles and adoption statuses;</li>
        <li>Managing animal welfare reports;</li>
        <li>Processing and recording donations or transactions;</li>
        <li>Communicating with users;</li>
        <li>Improving System performance;</li>
        <li>Maintaining System security;</li>
        <li>Generating administrative reports and analytics; and</li>
        <li>Complying with applicable laws and regulations.</li>
    </ul>

    <h2>3. Pet Matching and Recommendations</h2>

    <p>Pawpon may use information provided by users and information contained in pet profiles to generate pet matching scores or recommendations.</p>

    <p>These recommendations are intended to assist users in identifying potentially suitable pets. A match score does not automatically determine an adoption decision.</p>

    <h2>4. Sharing and Disclosure of Information</h2>

    <p>Pawpon does not intend to sell or commercially trade users' personal information.</p>

    <p>Information may be accessed or disclosed when reasonably necessary for System operations, including by authorized system administrators, service providers, payment providers where applicable, or government authorities when required or permitted by law.</p>

    <h2>5. Publicly Displayed Information</h2>

    <p>Pet profile information such as pet names, photographs, descriptions, characteristics, and adoption status may be displayed publicly when necessary for the System's intended functions.</p>

    <p>Personal information submitted through adoption applications, account registration, welfare reports, or other private features should not be publicly displayed unless necessary and authorized for a legitimate purpose.</p>

    <h2>6. Data Retention</h2>

    <p>Pawpon may retain personal information for as long as reasonably necessary to provide System services, maintain records, process applications, manage reports and transactions, improve System operations, or comply with applicable requirements.</p>

    <h2>7. Data Security</h2>

    <p>Pawpon implements reasonable administrative, technical, and organizational measures intended to protect personal information against unauthorized access, alteration, disclosure, loss, misuse, or destruction.</p>

    <p>However, no electronic system can guarantee absolute security. Users are also responsible for maintaining the confidentiality of their account credentials.</p>

    <h2>8. Cookies</h2>

    <p>Pawpon may use cookies or similar technologies when necessary to support account sessions, authentication, preferences, security, and System functionality.</p>

    <h2>9. Third-Party Services</h2>

    <p>Pawpon may integrate with third-party services when necessary to provide certain functionality, such as payment processing, authentication, analytics, hosting, or external links.</p>

    <p>Third-party services may process information according to their own privacy policies.</p>

    <h2>10. Children's Privacy</h2>

    <p>Pawpon is not specifically designed to collect personal information from children. Users should not provide personal information belonging to a child without appropriate authorization from a parent, guardian, or legally authorized person.</p>

    <h2>11. User Rights</h2>

    <p>Subject to applicable laws and regulations, users may have rights concerning their personal information, including the right to:</p>

    <ul>
        <li>Be informed about how their personal information is processed;</li>
        <li>Access their personal information;</li>
        <li>Request correction of inaccurate or incomplete information;</li>
        <li>Request deletion when legally applicable;</li>
        <li>Object to certain forms of processing when permitted by law; and</li>
        <li>Withdraw consent where processing is based on consent and withdrawal is legally applicable.</li>
    </ul>

    <h2>12. Data Privacy Act of 2012</h2>

    <p>Pawpon recognizes the importance of protecting personal information and aims to handle personal data in accordance with applicable Philippine data privacy requirements, including Republic Act No. 10173, also known as the Data Privacy Act of 2012.</p>

    <h2>13. Changes to This Privacy Policy</h2>

    <p>Pawpon may update this Privacy Policy when necessary to reflect changes to the System, its features, data processing practices, security measures, or applicable requirements.</p>

    <h2>14. Contact Us</h2>

    <p>If you have questions, concerns, or requests regarding this Privacy Policy, you may contact the Pawpon system administrator through the contact information provided within the System.</p>
`;


termsLink.addEventListener("click", function (e) {
    e.preventDefault();

    legalModalTitle.textContent = "Terms of Service";
    legalModalBody.innerHTML = termsContent;
    legalModal.classList.add("active");
});


privacyLink.addEventListener("click", function (e) {
    e.preventDefault();

    legalModalTitle.textContent = "Privacy Policy";
    legalModalBody.innerHTML = privacyContent;
    legalModal.classList.add("active");
});


closeLegalModal.addEventListener("click", function () {
    legalModal.classList.remove("active");
});


legalModal.addEventListener("click", function (e) {
    if (e.target === legalModal) {
        legalModal.classList.remove("active");
    }
});

// Close modal using ESC key
document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") {
        legalModal.classList.remove("active");
    }
});

window.addEventListener("load", async () => {
    if (!window.google?.accounts?.id) {
        console.error("Google Identity Services did not load.");
        return;
    }

    let googleConfig;

    try {
        const response = await fetch("/api/config/google", {
            method: "GET",
            headers: {
                "Accept": "application/json"
            },
            credentials: "same-origin"
        });

        if (!response.ok) {
            throw new Error("Failed to load Google configuration.");
        }

        googleConfig = await response.json();

        if (!googleConfig.clientId) {
            throw new Error("Google Client ID is missing.");
        }
    } catch (error) {
        console.error("Google configuration error:", error);
        return;
    }

    google.accounts.id.initialize({
        client_id: googleConfig.clientId,
        callback: async (response) => {
            try {
                const csrfResponse = await fetch("/auth/csrf-token", {
                    method: "GET",
                    credentials: "same-origin"
                });

                if (!csrfResponse.ok) {
                    throw new Error("Could not get security token.");
                }

                const csrfData = await csrfResponse.json();

                const googleResponse = await fetch("/auth/google", {
                    method: "POST",
                    credentials: "same-origin",
                    headers: {
                        "Content-Type": "application/json",
                        "X-CSRF-Token": csrfData.token
                    },
                    body: JSON.stringify({
                        credential: response.credential
                    })
                });

                const result = await googleResponse.json();

                if (!googleResponse.ok) {
                    throw new Error(result.message || "Google verification failed.");
                }

                emailInput.value = result.email;
                emailInput.readOnly = true;
                updateManualOtpVisibility();
                isEmailValidAndAvailable = true;

                emailHelper.className = "input-helper-text success";
                emailHelper.textContent = "Google email verified.";

                updateSignUpButtonState();

                showCustomAlert(
                    "Google email verified. Continue completing your adopter registration."
                );
            } catch (error) {
                console.error("Google verification error:", error);
                showCustomAlert(
                    error.message || "Unable to verify your Google account.",
                    "error"
                );
            }
        }
    });

    const googleButton = document.getElementById("adopterGoogleSignInButton");

    if (!googleButton) {
        console.error("Adopter Google button container not found.");
        return;
    }

    google.accounts.id.renderButton(googleButton, {
        theme: "outline",
        size: "large",
        text: "continue_with",
        shape: "rectangular"
    });
});