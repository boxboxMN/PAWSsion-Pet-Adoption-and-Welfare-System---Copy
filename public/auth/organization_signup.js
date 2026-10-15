// ================================
// REGEX & PHILIPPINES ADDR DATA
// ================================
const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#]).{8,}$/;
const phoneRegex = /^09\d{9}$/;
const emailValidatorRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const zipRegex = /^\d{4}$/;
const streetAddressInput = document.getElementById("streetAddress");
const addressSuggestions = document.getElementById("addressSuggestions");
const regionSelect = document.getElementById("region");
const provinceSelect = document.getElementById("province");
const citySelect = document.getElementById("city");
const barangaySelect = document.getElementById("barangay");
const zipCodeInput = document.getElementById("zipCode");
const streetAddressRegex = /^[A-Za-zÀ-ÖØ-öø-ÿ0-9 .,#()\/-]{5,150}$/;
const zipHelper = document.getElementById("zipHelper");

async function searchAddressSuggestions() {
    const street = streetAddressInput.value.trim();
    const barangay = barangaySelect.value.trim();
    const city = citySelect.value.trim();
    const province = provinceSelect.value.trim();

    if (street.length < 2 || !barangay || !city || !province) {
        addressSuggestions.hidden = true;
        addressSuggestions.innerHTML = "";
        return;
    }

    try {
        const params = new URLSearchParams({
            text: street,
            barangay,
            city,
            province
        });

        const response = await fetch(
            `/api/address/search?${params.toString()}`,
            { credentials: "same-origin" }
        );

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || "Unable to search addresses.");
        }

        renderAddressSuggestions(data.results || []);
    } catch (error) {
        console.error("Address autocomplete error:", error);
        addressSuggestions.hidden = true;
        addressSuggestions.innerHTML = "";
    }
}

// Organization description: letters, numbers, spaces, and common punctuation
const descriptionRegex = /^[A-Za-zÀ-ÖØ-öø-ÿ0-9\s.,'"()&\-\/#]+$/;
const MAX_DESCRIPTION_LENGTH = 100;

// ================================
// CUSTOM MODAL ALERT FUNCTION
// ================================
const alertOverlay = document.getElementById("customAlertOverlay");
const alertIcon = document.getElementById("customAlertIcon");
const alertMessage = document.getElementById("customAlertMessage");
const alertBtn = document.getElementById("customAlertBtn");
let currentAlertCallback = null;

let regionsData = [];
let provincesData = [];
let citiesData = [];
let barangaysData = [];

// Zip code live formatting
zipCodeInput.addEventListener("input", function() {
    this.value = this.value.replace(/\D/g, "");
    if (this.value === "") {
        zipHelper.innerHTML = "";
    } else if (zipRegex.test(this.value)) {
        zipHelper.className = "input-helper-text success";
        zipHelper.innerHTML = "<i class='fa-solid fa-circle-check'></i> Valid ZIP code.";
    } else {
        zipHelper.className = "input-helper-text error";
        zipHelper.innerHTML = "<i class='fa-solid fa-circle-xmark'></i> Must be exactly 4 digits.";
    }
});

async function updateZipCodeFromLocation() {
    const province = provinceSelect.value.trim();
    const city = citySelect.value.trim();

    if (!province || !city) {
        zipCodeInput.value = "";
        zipCodeInput.readOnly = true;

        zipHelper.className = "input-helper-text";
        zipHelper.innerHTML = "";

        validateStep2();
        return;
    }

    // Keep ZIP locked while retrieving the correct value
    zipCodeInput.readOnly = true;

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
            zipCodeInput.value = String(data.zip_code);
            zipCodeInput.readOnly = true;

            zipHelper.className = "input-helper-text success";
            zipHelper.innerHTML =
                "<i class='fa-solid fa-circle-check'></i> " +
                "ZIP code automatically filled.";
        } else {
            zipCodeInput.value = "";
            zipCodeInput.readOnly = false;

            zipHelper.className = "input-helper-text error";
            zipHelper.innerHTML =
                "<i class='fa-solid fa-circle-xmark'></i> " +
                "No ZIP code was found for the selected city. " +
                "Please enter your ZIP code manually.";
        }

        validateStep2();

    } catch (error) {
        console.error("ZIP API error:", error);

        zipCodeInput.value = "";
        zipCodeInput.readOnly = false;

        zipHelper.className = "input-helper-text error";
        zipHelper.innerHTML =
            "<i class='fa-solid fa-circle-xmark'></i> " +
            "Unable to retrieve ZIP code. " +
            "Please enter it manually.";

        validateStep2();
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
        title.textContent = result.street || result.name || "Address result";

        const details = document.createElement("div");
        details.className = "address-suggestion-details";

        const detailsParts = [
            result.suburb,
            result.district,
            result.city,
            result.state,
            result.postcode
        ].filter(Boolean);

        details.textContent = detailsParts.join(", ");

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
        result.street || result.name || ""
    ).trim();

    if (!addressName) return;

    const currentValue = streetAddressInput.value.trim();
    const houseNumberMatch = currentValue.match(/^\s*(\d+[A-Za-z0-9-]*)\s+/);

    streetAddressInput.value = houseNumberMatch
        ? `${houseNumberMatch[1]} ${addressName}`
        : addressName;

    streetAddressHelper.className = "input-helper-text success";
    streetAddressHelper.textContent = "Address selected from suggestions.";

    addressSuggestions.hidden = true;
    addressSuggestions.innerHTML = "";

    validateStep2();
}

function validateStreetAddress() {
    const value = streetAddressInput.value.trim();
    const helper = document.getElementById("streetAddressHelper");

    const showError = (message) => {
        if (helper) {
            helper.className = "input-helper-text error";
            helper.textContent = message;
        }
    };

    const showSuccess = (message) => {
        if (helper) {
            helper.className = "input-helper-text success";
            helper.textContent = message;
        }
    };

    // Street address is optional
    if (value === "") {
        if (helper) {
            helper.textContent = "";
            helper.className = "input-helper-text";
        }
        return true;
    }

    if (value.length < 5) {
        showError("Please enter a complete street address.");
        return false;
    }

    if (value.length > 150) {
        showError("Street address must not exceed 150 characters.");
        return false;
    }

    if (!streetAddressRegex.test(value)) {
        showError("Use only letters, numbers, spaces, and common address characters.");
        return false;
    }

    if (!/[aeiouáéíóúàèìòù]/i.test(value)) {
        showError("Please enter a valid street address.");
        return false;
    }

    if (!/[A-Za-zÀ-ÖØ-öø-ÿ]/.test(value)) {
        showError("Street address must contain at least one letter.");
        return false;
    }

    if (/(.)\1{4,}/.test(value)) {
        showError("Please enter a valid street address.");
        return false;
    }

    const compact = value.toLowerCase().replace(/\s/g, "");
    const keyboardPatterns = [
        "asdf", "asdfgh", "qwer", "qwerty",
        "zxcv", "zxcvb", "poiuy", "lkjh", "mnbv"
    ];

    if (keyboardPatterns.some(pattern => compact.includes(pattern))) {
        showError("Please enter a valid street address.");
        return false;
    }

    const lettersOnly = compact.replace(/[^a-zá-öø-ÿ]/g, "");

    if (/(.{2,3})\1{2,}/i.test(lettersOnly)) {
        showError("Please enter a valid street address.");
        return false;
    }

    showSuccess("Street address entered manually.");
    return true;
}

// Cascading Loaders
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
        regionSelect.innerHTML = '<option value="">Failed to load regions</option>';
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

    updateAddressFieldsState();
    updateZipCodeFromLocation();

    if (!regCode) {
        provinceSelect.innerHTML = '<option value="">Select Province</option>';
        return;
    }

    try {
        if (provincesData.length === 0) {
            const res = await fetch('/data/provinces.json');
            provincesData = await res.json();
        }

        let filtered = provincesData.filter(p => p.region_code === regCode);
        filtered.sort((a, b) => a.province_name.localeCompare(b.province_name));

        if (filtered.length === 0) {
            filtered = [{ province_code: regCode, province_name: selectedOption.value }];
        }

        provinceSelect.innerHTML = '<option value="">Select Province</option>';
        filtered.forEach(p => {
            const opt = document.createElement('option');
            opt.value = p.province_name;
            opt.textContent = p.province_name;
            opt.dataset.code = p.province_code;
            provinceSelect.appendChild(opt);
        });
        provinceSelect.disabled = false;
    } catch (err) {
        provinceSelect.innerHTML = '<option value="">Error loading</option>';
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

    updateAddressFieldsState();
    updateZipCodeFromLocation();

    if (!provCode) return;

    try {
        if (citiesData.length === 0) {
            const res = await fetch('/data/cities.json');
            citiesData = await res.json();
        }

        const filtered = citiesData.filter(c => {
            if (String(provCode) === String(regCode)) {
                return String(c.region_desc) === String(regCode);
            }
        
            return String(c.province_code) === String(provCode);
        });
        filtered.sort((a, b) => a.city_name.localeCompare(b.city_name));

        citySelect.innerHTML = '<option value="">Select City / Municipality</option>';
        filtered.forEach(c => {
            const opt = document.createElement('option');
            opt.value = c.city_name;
            opt.textContent = c.city_name;
            opt.dataset.code = c.city_code;
            citySelect.appendChild(opt);
        });
        citySelect.disabled = false;
    } catch (err) {
        citySelect.innerHTML = '<option value="">Error loading</option>';
    }
});

citySelect.addEventListener('change', async function() {
    const selectedOption = this.options[this.selectedIndex];
    const cityCode = selectedOption ? selectedOption.dataset.code : null;

    barangaySelect.innerHTML = '<option value="">Loading barangays...</option>';
    barangaySelect.disabled = true;

    updateAddressFieldsState();
    updateZipCodeFromLocation();
    
    if (!cityCode) return;

    try {
        if (barangaysData.length === 0) {
            const res = await fetch('/data/barangays.json');
            barangaysData = await res.json();
        }

        const filtered = barangaysData.filter(b => b.city_code === cityCode);
        filtered.sort((a, b) => a.brgy_name.localeCompare(b.brgy_name));

        barangaySelect.innerHTML = '<option value="">Select Barangay</option>';
        filtered.forEach(b => {
            const opt = document.createElement('option');
            opt.value = b.brgy_name;
            opt.textContent = b.brgy_name;
            barangaySelect.appendChild(opt);
        });
        barangaySelect.disabled = false;
    } catch (err) {
        barangaySelect.innerHTML = '<option value="">Error loading</option>';
    }
});

loadRegions();

function showCustomAlert(message, type = "error", callback = null) {
    alertMessage.textContent = message;
    currentAlertCallback = callback;

    if (type === "success") {
        alertIcon.className = "custom-alert-icon success-icon";
        alertIcon.innerHTML = '<i class="fa-solid fa-circle-check"></i>';
    } else {
        alertIcon.className = "custom-alert-icon";
        alertIcon.innerHTML = '<i class="fa-solid fa-circle-exclamation"></i>';
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


// ================================
// LIVE VALIDATIONS (EMAIL, PHONE & NAME)
// ================================
const emailInput = document.getElementById("email");
const emailHelper = document.getElementById("emailHelper");
const phoneInput = document.getElementById("contactNumber");
const phoneHelper = document.getElementById("phoneHelper");
const orgNameInput = document.getElementById("organizationName");
const orgNameHelper = document.getElementById("orgNameHelper");

// Email OTP verification
const manualOtpSection = document.getElementById("manualOtpSection");
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

let isEmailValidAndAvailable = false; 
let isRegistrationEmailOtpVerified = false;
let isOrgNameAvailable = false;

// kapag empty ang email hindi makikita ang verify email button until may email
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

    emailHelper.className = "input-helper-text";
    emailHelper.textContent = "";

    emailOtpStatus.className = "input-helper-text";
    emailOtpStatus.textContent = "";

    changeEmailButton.hidden = true;

    updateManualOtpVisibility();
    validateStep1();
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

    await verifyEmailUniqueness();

    if (!isEmailValidAndAvailable) {
        otpHelper.className = "input-helper-text error";
        otpHelper.textContent = "Please use an available email address.";
        return;
    }

    const csrfToken = document.querySelector(
        '#organizationSignupForm input[name="csrfToken"]'
    )?.value;

    if (!csrfToken) {
        otpHelper.className = "input-helper-text error";
        otpHelper.textContent =
            "Security token missing. Please reload the page.";
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
            throw new Error(
                result.message || "Could not send the verification code."
            );
        }

        sendOtpButton.hidden = true;

        otpInputSection.hidden = false;

        otpHelper.className = "input-helper-text success";
        otpHelper.textContent =
            result.message || "Code sent. Check your email.";

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
        otpHelper.textContent =
            error.message ||
            "Unable to send the code. Please try again.";
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

    const csrfToken = document.querySelector(
        '#organizationSignupForm input[name="csrfToken"]'
    )?.value;

    if (!csrfToken) {
        otpHelper.className = "input-helper-text error";
        otpHelper.textContent =
            "Security token missing. Please reload the page.";
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

    // Allow numbers only and limit to 6 digits
    emailOtpInput.value = otp.replace(/\D/g, "").slice(0, 6);

    // Enable Verify Code only when exactly 6 digits are entered
    verifyOtpButton.disabled = emailOtpInput.value.length !== 6;
});

// Async validation for Email Uniqueness
async function verifyEmailUniqueness() {
    const emailValue = emailInput.value.trim().toLowerCase();

    if (emailValue === "") {
        emailHelper.className = "input-helper-text";
        emailHelper.innerHTML = "";
        isEmailValidAndAvailable = false;
        validateStep1();
        return;
    }

    if (!emailValidatorRegex.test(emailValue)) {
        emailHelper.className = "input-helper-text error";
        emailHelper.innerHTML = "<i class='fa-solid fa-circle-xmark'></i> Please enter a valid email format.";
        isEmailValidAndAvailable = false;
        validateStep1();
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
        emailHelper.className = "input-helper-text";
        emailHelper.innerHTML = "";
        isEmailValidAndAvailable = true; 
    }

    updateManualOtpVisibility();
    validateStep1();
}

emailInput.addEventListener("blur", verifyEmailUniqueness);
emailInput.addEventListener("input", () => {
    const emailValue = emailInput.value.trim().toLowerCase();
    isEmailValidAndAvailable = false;

    if (emailValue === "") {
        emailHelper.className = "input-helper-text";
        emailHelper.innerHTML = "";
    } else if (!emailValidatorRegex.test(emailValue)) {
        emailHelper.className = "input-helper-text error";
        emailHelper.innerHTML = "<i class='fa-solid fa-circle-xmark'></i> Please enter a valid email address format.";
    } else {
        emailHelper.className = "input-helper-text";
        emailHelper.innerHTML = "<i class='fa-solid fa-spinner fa-spin'></i> Checking availability on blur...";
    }

    validateStep1();
});

emailInput.addEventListener("input", () => {
    if (!emailInput.readOnly) {
        isEmailValidAndAvailable = false;
        isRegistrationEmailOtpVerified = false;
    }

    updateManualOtpVisibility();
});

updateManualOtpVisibility();

verifyOtpButton.addEventListener("click", async () => {
    const email = emailInput.value.trim().toLowerCase();
    const otp = emailOtpInput.value.trim();

    if (!/^\d{6}$/.test(otp)) {
        otpHelper.className = "input-helper-text error";
        otpHelper.textContent = "Please enter the 6-digit code.";
        return;
    }

    const csrfToken = document.querySelector(
        '#organizationSignupForm input[name="csrfToken"]'
    )?.value;

    if (!csrfToken) {
        otpHelper.className = "input-helper-text error";
        otpHelper.textContent =
            "Security token missing. Please reload the page.";
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
            throw new Error(
                result.message || "Could not verify the code."
            );
        }

        isRegistrationEmailOtpVerified = true;

        // Lock the verified email
        emailInput.readOnly = true;
        changeEmailButton.hidden = false;

        emailHelper.className = "input-helper-text";
        emailHelper.textContent = "";

        updateManualOtpVisibility();
        validateStep1();

        otpHelper.className = "input-helper-text success";
        otpHelper.textContent =
            result.message || "Email verified successfully.";

        emailOtpInput.value = "";
        emailOtpInput.disabled = true;
        verifyOtpButton.disabled = true;
        verifyOtpButton.textContent = "Verified";

        emailOtpStatus.className = "input-helper-text success";
        emailOtpStatus.textContent =
            result.message || "Email verified successfully.";

        setTimeout(() => {
            otpModal.hidden = true;

            emailOtpInput.disabled = false;
            verifyOtpButton.disabled = false;
            verifyOtpButton.textContent = "Verify Code";
            otpHelper.textContent = "";
        }, 1800);

    } catch (error) {
        otpHelper.className = "input-helper-text error";
        otpHelper.textContent =
            error.message ||
            "Verification failed. Please try again.";
    } finally {
        if (!isRegistrationEmailOtpVerified) {
            verifyOtpButton.disabled = false;
            verifyOtpButton.textContent = "Verify Code";
        }
    }
});

// Async validation for Organization Name Uniqueness
async function verifyOrgNameUniqueness() {
    const orgNameValue = orgNameInput.value.trim();

    if (orgNameValue === "") {
        orgNameHelper.className = "input-helper-text";
        orgNameHelper.innerHTML = "Must be at least 3 characters.";
        isOrgNameAvailable = false;
        return;
    }

    if (orgNameValue.length < 3) {
        orgNameHelper.className = "input-helper-text error";
        orgNameHelper.innerHTML = "<i class='fa-solid fa-circle-xmark'></i> Name is too short (min 3 characters).";
        isOrgNameAvailable = false;
        return;
    }

    orgNameHelper.className = "input-helper-text";
    orgNameHelper.innerHTML = "<i class='fa-solid fa-spinner fa-spin'></i> Checking if organization name exists...";

    try {
        const response = await fetch(`/auth/check-org-name?orgName=${encodeURIComponent(orgNameValue)}`);
        
        if (response.status === 409 || !response.ok) {
            orgNameHelper.className = "input-helper-text error";
            orgNameHelper.innerHTML = "<i class='fa-solid fa-circle-xmark'></i> This organization name is already registered.";
            isOrgNameAvailable = false;
        } else {
            orgNameHelper.className = "input-helper-text success";
            orgNameHelper.innerHTML = "<i class='fa-solid fa-circle-check'></i> Organization name is available!";
            isOrgNameAvailable = true;
        }
    } catch (err) {
        isOrgNameAvailable = false;
        orgNameHelper.className = "input-helper-text error";
        orgNameHelper.textContent =
            "Could not verify organization name. Please try again.";
    }
}

orgNameInput.addEventListener("blur", verifyOrgNameUniqueness);
orgNameInput.addEventListener("input", () => {
    isOrgNameAvailable = false; 
    
    const val = orgNameInput.value.trim();
    if(val.length >= 3) {
        orgNameHelper.className = "input-helper-text";
        orgNameHelper.innerHTML = "Checking uniqueness when you finish typing...";
    } else if (val.length > 0) {
        orgNameHelper.className = "input-helper-text error";
        orgNameHelper.innerHTML = "<i class='fa-solid fa-circle-xmark'></i> Name is too short (min 3 characters).";
    }
});

// Mobile number digits restriction
phoneInput.addEventListener("input", function() {
    this.value = this.value.replace(/\D/g, "");
    if (this.value === "") {
        phoneHelper.className = "input-helper-text";
        phoneHelper.innerHTML = "Format: 11-digit starting with 09";
    } else if (phoneRegex.test(this.value)) {
        phoneHelper.className = "input-helper-text success";
        phoneHelper.innerHTML = "<i class='fa-solid fa-circle-check'></i> Valid Philippine mobile number format.";
    } else {
        phoneHelper.className = "input-helper-text error";
        phoneHelper.innerHTML = "<i class='fa-solid fa-circle-xmark'></i> Must be exactly 11 digits starting with 09.";
    }
});


// ================================
// LIVE PASSWORD CHECKLIST TRACKER
// ================================
const passwordInput = document.getElementById("password");
const confirmInput = document.getElementById("confirmPassword");
const passwordRequirements = document.getElementById("passwordRequirements");

const reqLength = document.getElementById("reqLength");
const reqUppercase = document.getElementById("reqUppercase");
const reqLowercase = document.getElementById("reqLowercase");
const reqNumber = document.getElementById("reqNumber");
const reqSpecial = document.getElementById("reqSpecial");
const reqMatch = document.getElementById("reqMatch");

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

passwordInput.addEventListener("focus", () => {
    passwordRequirements.style.display = "block";
});

passwordInput.addEventListener("blur", () => {
    passwordRequirements.style.display = "none";
});

passwordInput.addEventListener("input", () => {
    const value = passwordInput.value;

    updateRequirementStatus(reqLength, value.length >= 8);
    updateRequirementStatus(reqUppercase, /[A-Z]/.test(value));
    updateRequirementStatus(reqLowercase, /[a-z]/.test(value));
    updateRequirementStatus(reqNumber, /\d/.test(value));
    updateRequirementStatus(reqSpecial, /[@$!%*?&#]/.test(value));
    
    checkMatch();
});

confirmInput.addEventListener("input", checkMatch);

function checkMatch() {
    if (confirmInput.value === "") {
        reqMatch.style.display = "none";
        return;
    }
    reqMatch.style.display = "flex";
    const valuesMatch = (passwordInput.value === confirmInput.value && passwordInput.value !== "");
    updateRequirementStatus(reqMatch, valuesMatch);
    if(valuesMatch) {
        reqMatch.querySelector(".status-icon").nextSibling.textContent = " Passwords match";
    } else {
        reqMatch.querySelector(".status-icon").nextSibling.textContent = " Passwords do not match";
    }
}


// ================================
// PASSWORD VISIBILITY TOGGLE
// ================================
document.querySelectorAll(".toggle-password").forEach(button => {
    button.addEventListener("click", () => {
        const input = button.parentElement.querySelector("input");
        const icon = button.querySelector("i");

        const isHidden = input.type === "password";
        input.type = isHidden ? "text" : "password";

        icon.className = isHidden ? "fa-solid fa-eye-slash" : "fa-solid fa-eye";
    });
});


// ================================
// STEP NAVIGATION
// ================================
const step1 = document.getElementById("step1");
const step2 = document.getElementById("step2");
const step3 = document.getElementById("step3");
const stepTitle = document.getElementById("stepTitle");

function showStep(step) {
    step1.style.display = "none";
    step2.style.display = "none";
    step3.style.display = "none";

    step.style.display = "block";

    if (step === step1)
        stepTitle.innerHTML = "Step 1: Account Credentials";

    if (step === step2)
        stepTitle.innerHTML = "Step 2: Organization Information";

    if (step === step3)
        stepTitle.innerHTML = "Step 3: Verification";
}

showStep(step1);


// ================================
// NEXT STEP 1 VALIDATION (FIXED)
// ================================
const next1Btn = document.getElementById("next1");

function validateStep1() {
    const emailVal = emailInput.value.trim();
    const passVal = passwordInput.value;
    const confirmVal = confirmInput.value;

    const isEmailFormatValid = emailValidatorRegex.test(emailVal);
    const isPassValid = passwordRegex.test(passVal);
    const isConfirmMatch = (passVal === confirmVal && passVal !== "");

    // I-enable ang button base sa format at local validation.
    // Ang async email uniqueness check ay gagawin sa pag-click ng Next.
    const isEmailVerified =
    emailInput.readOnly || isRegistrationEmailOtpVerified;

    const isValid = isEmailFormatValid && isEmailVerified && isPassValid && isConfirmMatch;
    next1Btn.disabled = !isValid;
}

// I-trigger ang validateStep1 kapag nagbago ang password/confirm password
passwordInput.addEventListener("input", validateStep1);
confirmInput.addEventListener("input", validateStep1);


document.getElementById("next1").addEventListener("click", async () => {
    const email = emailInput.value.trim();
    const password = passwordInput.value;
    const confirm = confirmInput.value;

    if (email === "") {
        showCustomAlert("Email is required.");
        return;
    }

    if (!isEmailValidAndAvailable) {
        await verifyEmailUniqueness();
        if(!isEmailValidAndAvailable) {
            showCustomAlert("Please use a unique and valid email address to proceed.");
            return;
        }
    }

    if (!passwordRegex.test(password)) {
        showCustomAlert("Please make sure your password satisfies all requirement items shown below the field.");
        return;
    }

    if (password !== confirm) {
        showCustomAlert("Passwords do not match.");
        return;
    }

    showStep(step2);
});


// ================================
// BACK STEP 2
// ================================
document.getElementById("back1").addEventListener("click", () => {
    showStep(step1);
});


// ================================
// NEXT STEP 2 VALIDATION
// ================================
const next2Btn = document.getElementById("next2");
const orgTypeSelect = document.getElementById("organizationType");
const contactPersonInput = document.getElementById("contactPerson");

function updateAddressFieldsState() {
    const hasRegion = regionSelect.value !== "";
    const hasProvince = provinceSelect.value !== "";
    const hasCity = citySelect.value !== "";
    const hasBarangay = barangaySelect.value !== "";

    // Street Address becomes available after Barangay is selected
    streetAddressInput.disabled = !(hasRegion && hasProvince && hasCity && hasBarangay);

    // ZIP becomes available after Region, Province, and City are selected
    zipCodeInput.disabled = !(hasRegion && hasProvince && hasCity);

    // Clear values when the required location selection is incomplete
    if (streetAddressInput.disabled) {
        streetAddressInput.value = "";
        validateStreetAddress();
    }

    if (zipCodeInput.disabled) {
        zipCodeInput.value = "";
        zipHelper.textContent = "";
        zipHelper.className = "input-helper-text";
    }

    validateStep2();
}

function validateStep2() {
    const orgNameLength = orgNameInput.value.trim().length;
    const isOrgNameValid = orgNameLength >= 3 && orgNameLength <= 50;
    const isTypeSelected = orgTypeSelect.value !== "";
    const isContactPersonValid = contactPersonInput.value.trim() !== "";
    const isPhoneValid = phoneRegex.test(phoneInput.value.trim());

    const isRegionValid = regionSelect.value !== "";
    const isProvinceValid = provinceSelect.value !== "";
    const isCityValid = citySelect.value !== "";
    const isBarangayValid = barangaySelect.value !== "";
    const isZipValid = zipRegex.test(zipCodeInput.value.trim());
    const isStreetAddressValid = validateStreetAddress();

    const isValid = 
        isOrgNameValid &&
        isTypeSelected &&
        isContactPersonValid &&
        isPhoneValid &&
        isStreetAddressValid &&
        isRegionValid &&
        isProvinceValid &&
        isCityValid &&
        isBarangayValid &&
        isZipValid;

    next2Btn.disabled = !isValid;
}

streetAddressInput.addEventListener("input", validateStep2);

let addressSearchTimer;

streetAddressInput.addEventListener("input", function () {
    clearTimeout(addressSearchTimer);

    const value = this.value.trim();

    if (value.length < 2) {
        addressSuggestions.hidden = true;
        addressSuggestions.innerHTML = "";
        return;
    }

    addressSearchTimer = setTimeout(() => {
        searchAddressSuggestions();
    }, 300);
});

[orgNameInput, orgTypeSelect, contactPersonInput, phoneInput, streetAddressInput, zipCodeInput].forEach(el => {
    el.addEventListener("input", validateStep2);
    el.addEventListener("change", validateStep2);
});

[regionSelect, provinceSelect, citySelect, barangaySelect].forEach(el => {
    el.addEventListener("change", validateStep2);
});

barangaySelect.addEventListener("change", updateAddressFieldsState);

document.getElementById("next2").addEventListener("click", async () => {
    const contactNumber = phoneInput.value.trim();
    const organizationName = orgNameInput.value.trim();

    if (organizationName === "" || organizationName.length < 3) {
        showCustomAlert("A valid organization name (at least 3 characters) is required.");
        return;
    }

    if (!isOrgNameAvailable) {
        await verifyOrgNameUniqueness();
        if (!isOrgNameAvailable) {
            showCustomAlert("The organization name you entered is already taken. Please choose another name.");
            return;
        }
    }

    if (document.getElementById("organizationType").value === "") {
        showCustomAlert("Please select organization type.");
        return;
    }
    if (document.getElementById("contactPerson").value.trim() === "") {
        showCustomAlert("Contact person is required.");
        return;
    }
    if (!phoneRegex.test(contactNumber)) {
        showCustomAlert("Please enter a valid 11-digit mobile number starting with 09.");
        return;
    }

    if (!validateStreetAddress()) {
        showCustomAlert("Please enter a valid street address or leave it blank.");
        return;
    }

    if (regionSelect.value === "") {
        showCustomAlert("Please select your region.");
        return;
    }
    if (provinceSelect.value === "") {
        showCustomAlert("Please select your province.");
        return;
    }
    if (citySelect.value === "") {
        showCustomAlert("Please select your city or municipality.");
        return;
    }
    if (barangaySelect.value === "") {
        showCustomAlert("Please select your barangay.");
        return;
    }
    if (!zipRegex.test(zipCodeInput.value.trim())) {
        showCustomAlert("Please enter a valid 4-digit ZIP code.");
        return;
    }

    showStep(step3);
});


// ================================
// BACK STEP 3
// ================================
document.getElementById("back2").addEventListener("click", () => {
    showStep(step2);
});


// ================================
// FINAL SUBMIT
// ================================
document.getElementById("organizationSignupForm").addEventListener("submit", async function(e) {
    e.preventDefault();

    const password = passwordInput.value;
    const contactNumber = phoneInput.value.trim();
    const organizationName = orgNameInput.value.trim();

    if (!isEmailValidAndAvailable) {
        showCustomAlert("The email address provided is invalid or already taken.", "error", () => {
            showStep(step1);
        });
        return;
    }

    if (!isOrgNameAvailable) {
        showCustomAlert("Organization name is already taken or invalid.", "error", () => {
            showStep(step2);
        });
        return;
    }

    if (!passwordRegex.test(password)) {
        showCustomAlert("Password does not meet the complexity requirements.", "error", () => {
            showStep(step1);
        });
        return;
    }

    if (organizationName.length < 3) {
        showCustomAlert("Organization name is too short.", "error", () => {
            showStep(step2);
        });
        return;
    }

    if (!phoneRegex.test(contactNumber)) {
        showCustomAlert("Please enter a valid Philippine mobile number.", "error", () => {
            showStep(step2);
        });
        return;
    }

    if (document.getElementById("document").files.length === 0) {
        showCustomAlert("Please upload a verification document.");
        return;
    }

    if (!document.getElementById("agree").checked) {
        showCustomAlert("Please certify the information.");
        return;
    }

    const formData = new FormData();
    formData.append("email", emailInput.value.trim());
    formData.append("password", password);
    formData.append("confirmPassword", confirmInput.value);
    formData.append("organizationName", organizationName);
    formData.append("organizationType", document.getElementById("organizationType").value);
    formData.append("contactPerson", document.getElementById("contactPerson").value.trim());
    formData.append("contactNumber", contactNumber);
    formData.append("streetAddress", streetAddressInput.value.trim());
    formData.append("region", regionSelect.value.trim());
    formData.append("province", provinceSelect.value.trim());
    formData.append("city", citySelect.value.trim());
    formData.append("barangay", barangaySelect.value.trim());
    formData.append("zipCode", zipCodeInput.value.trim());
    formData.append("description", document.getElementById("description").value.trim());
    formData.append("document", document.getElementById("document").files[0]);

    const csrfResponse = await fetch("/auth/csrf-token");
    const csrfData = await csrfResponse.json();

    try {
        const response = await fetch("/auth/register-organization", {
            method: "POST",
            headers: {
                "X-CSRF-Token": csrfData.token
            },
            body: formData
        });

        const result = await response.text();

        if (response.ok) {
            showCustomAlert("Application submitted successfully!", "success", () => {
                window.location.href = "/auth/login";
            });
        } else {
            showCustomAlert(result);
        }
    } catch (err) {
        console.error(err);
        showCustomAlert("Unable to submit application.");
    }
});

// ================================
// GOOGLE VERIFICATION FOR ORG SIGNUP
// ================================
window.addEventListener("load", async () => {
    if (!window.google?.accounts?.id) {
        console.error("Google Identity Services is not available.");
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
                emailInput.dispatchEvent(new Event("input", { bubbles: true }));

                emailHelper.className = "input-helper-text success";
                emailHelper.textContent = "Google email verified.";

                isEmailValidAndAvailable = true;
                validateStep1();

                showCustomAlert(
                    "Google email verified. Continue completing your organization registration."
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

    const googleButton = document.getElementById("orgGoogleSignInButton");

    if (!googleButton) {
        console.error("Organization Google button container not found.");
        return;
    }

    google.accounts.id.renderButton(googleButton, {
        theme: "outline",
        size: "large",
        text: "continue_with",
        shape: "rectangular"
    });
});