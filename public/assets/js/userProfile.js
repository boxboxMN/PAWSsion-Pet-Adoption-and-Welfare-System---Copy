let isEditing = false;
let isPasswordFormVisible = false;

let currentProfile = {};
let regionsData = [];
let provincesData = [];
let citiesData = [];
let barangaysData = [];

const displayName = document.getElementById('display-name');
const getMemberSinceText = () => document.querySelector('.fa-calendar-alt')?.nextElementSibling;

const viewModeSection = document.getElementById('view-mode-section');
const editModeSection = document.getElementById('edit-mode-section');

const viewFullName = document.getElementById('view-full-name');
const viewEmail = document.getElementById('view-email');
const viewMobile = document.getElementById('view-mobile');
const viewBirthday = document.getElementById('view-birthday');
const containerViewCivilStatus = document.getElementById('container-view-civil-status');
const viewCivilStatus = document.getElementById('view-civil-status');
const containerViewOccupation = document.getElementById('container-view-occupation');
const viewOccupation = document.getElementById('view-occupation');
const viewFullAddress = document.getElementById('view-full-address');
const viewRegion = document.getElementById('view-region');

// Input Elements
const inputFirstName = document.getElementById('input-first-name');
const inputLastName = document.getElementById('input-last-name');
const inputEmail = document.getElementById('input-email');
const inputMobile = document.getElementById('input-mobile');
const inputBirthday = document.getElementById('input-birthday');
const inputCivilStatus = document.getElementById('input-civil-status');
const inputOccupation = document.getElementById('input-occupation');
const inputStreet = document.getElementById('input-street');
const regionDisplay = document.getElementById('region-display');
const regionInput = document.getElementById('region-input');
const provinceDisplay = document.getElementById('province-display');
const provinceInput = document.getElementById('province-input');
const cityDisplay = document.getElementById('city-display');
const cityInput = document.getElementById('city-input');
const barangayDisplay = document.getElementById('barangay-display');
const barangayInput = document.getElementById('barangay-input');
const zipDisplay = document.getElementById('zip-display');
const zipInput = document.getElementById('zip-input');
const zipHelper = document.getElementById('zipHelper');

const editBtn = document.getElementById('edit-btn');
const editActions = document.getElementById('edit-actions');
const saveBtn = document.getElementById('save-btn');
const cancelBtn = document.getElementById('cancel-btn');

const togglePasswordBtn = document.getElementById('toggle-password-btn');
const passwordForm = document.getElementById('password-form');
const currentPassword = document.getElementById('current-password');
const currentPasswordHint = document.getElementById('current-password-hint');
const newPassword = document.getElementById('new-password');
const confirmPassword = document.getElementById('confirm-password');
const updatePasswordBtn = document.getElementById('update-password-btn');

let currentPasswordVerified = false;
let verifyDebounceTimer = null;
let clientLockedUntil = null;

function lockNewPasswordFields() {
    currentPasswordVerified = false;
    [newPassword, confirmPassword].forEach(input => {
        input.disabled = true;
        input.value = '';
        input.classList.add('bg-slate-100', 'text-slate-400', 'cursor-not-allowed');
    });
}

function unlockNewPasswordFields() {
    currentPasswordVerified = true;
    [newPassword, confirmPassword].forEach(input => {
        input.disabled = false;
        input.classList.remove('bg-slate-100', 'text-slate-400', 'cursor-not-allowed');
    });
}

function showLockoutHint(remainingMs) {
    const minutesLeft = Math.max(1, Math.ceil(remainingMs / 60000));
    currentPasswordHint.textContent = `Too many failed attempts. Try again in ${minutesLeft} minute(s).`;
    currentPasswordHint.className = 'text-xs text-rose-600 font-semibold -mt-2';
}

async function verifyCurrentPassword() {
    const value = currentPassword.value.trim();

    // Skip the request entirely while we already know we're locked —
    // no need to hit the server again until the timer actually expires.
    if (clientLockedUntil && Date.now() < clientLockedUntil) {
        lockNewPasswordFields();
        showLockoutHint(clientLockedUntil - Date.now());
        return;
    }

    clientLockedUntil = null;

    if (!value) {
        lockNewPasswordFields();
        currentPasswordHint.textContent = '';
        return;
    }

    try {
        const res = await fetch('/api/user/profile/verify-password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ currentPassword: value })
        });
        const result = await res.json();

        if (result.valid) {
            unlockNewPasswordFields();
            currentPasswordHint.textContent = 'Verified — you may now set a new password.';
            currentPasswordHint.className = 'text-xs text-emerald-600 -mt-2';
        } else if (result.locked) {
            lockNewPasswordFields();
            // Server doesn't return an exact timestamp, so estimate 15 min from now
            // for the client-side skip window (server remains the source of truth).
            clientLockedUntil = Date.now() + 15 * 60 * 1000;
            showLockoutHint(clientLockedUntil - Date.now());
        } else {
            lockNewPasswordFields();
            currentPasswordHint.textContent = result.message || 'Incorrect password.';
            currentPasswordHint.className = 'text-xs text-rose-500 -mt-2';
        }
    } catch (err) {
        console.error('Password verification failed:', err);
        lockNewPasswordFields();
        currentPasswordHint.textContent = 'Unable to verify right now.';
        currentPasswordHint.className = 'text-xs text-rose-500 -mt-2';
    }
}

currentPassword?.addEventListener('input', () => {
    clearTimeout(verifyDebounceTimer);
    verifyDebounceTimer = setTimeout(verifyCurrentPassword, 500);
});

const avatarContainer = document.getElementById('avatarContainer');
const avatarOverlay = document.getElementById('avatarOverlay');
const avatarInput = document.getElementById('avatarInput');
const avatarDisplay = document.getElementById('avatarDisplay');

function setAvatarEditMode(editable) {
    const container = document.getElementById('avatarContainer');
    if(container) {
        if(editable) container.classList.add('editable');
        else container.classList.remove('editable');
    }
}

function getProfileImageUrl(profilePicture) {
    const fallback = "/images/default-avatar.png"; // Replace with your actual default image path

    if (!profilePicture || !String(profilePicture).trim()) {
        return fallback;
    }

    const image = String(profilePicture).trim();

    // Cloudinary URL or another complete image URL
    if (/^https?:\/\//i.test(image)) {
        return image;
    }

    // Existing local image path
    if (image.startsWith("/")) {
        return image;
    }

    // Legacy local filename
    return `/uploads/profiles/${encodeURIComponent(image)}`;
}

async function fetchProfileData() {
    try {
        const response = await fetch('/api/user/profile');
        if (!response.ok) throw new Error("Failed to fetch profile");
        
        const data = await response.json();
        currentProfile = data;
        
        const fName = data.first_name || '';
        const lName = data.last_name || '';
        const fullCombinedName = `${fName} ${lName}`.trim() || 'No Name Set';

        const displayNameEl = document.getElementById('display-name');
        if (displayNameEl) displayNameEl.textContent = fullCombinedName;
        
        // I-display ang Role mula sa Database (e.g. 'adopter' -> 'ADOPTER', 'user' -> 'USER')
        const displayAccountType = document.getElementById('display-account-type');
        if (displayAccountType) {
            displayAccountType.textContent = data.role 
                ? (data.role.charAt(0).toUpperCase() + data.role.slice(1).toLowerCase()) // Halimbawa: "User" o "Adopter"
                : 'User';
        }

        // 3. Member since date
       const memberSinceTextEl = getMemberSinceText();
        if (data.created_at && memberSinceTextEl) {
            const date = new Date(data.created_at);
            memberSinceTextEl.textContent = `Member since ${date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`;
        }
        
        // Format Birthday
        const viewBirthdayEl = document.getElementById('view-birthday');
        const inputBirthdayEl = document.getElementById('input-birthday');
        if (data.birthday) {
            const rawDate = data.birthday.toString().split('T')[0];
            
            // View Mode: August 16, 2005
            if (viewBirthdayEl) viewBirthdayEl.textContent = formatBirthdayView(data.birthday);
            
            // Edit Mode: 2005-08-16
            if (inputBirthdayEl) inputBirthdayEl.value = rawDate;
        } else {
            if (viewBirthdayEl) viewBirthdayEl.textContent = 'N/A';
            if (inputBirthdayEl) inputBirthdayEl.value = '';
        }

        // Civil Status check
        const containerViewCivilStatusEl = document.getElementById('container-view-civil-status');
        const viewCivilStatusEl = document.getElementById('view-civil-status');
        if (data.civil_status && data.civil_status.trim() !== '' && data.civil_status.toUpperCase() !== 'N/A') {
            if (containerViewCivilStatusEl) containerViewCivilStatusEl.classList.remove('hidden');
            if (viewCivilStatusEl) viewCivilStatusEl.textContent = data.civil_status;
        } else {
            if (containerViewCivilStatusEl) containerViewCivilStatusEl.classList.add('hidden');
        }

        // Occupation check
       const containerViewOccupationEl = document.getElementById('container-view-occupation');
        const viewOccupationEl = document.getElementById('view-occupation');
        if (data.occupation && data.occupation.trim() !== '' && data.occupation.toUpperCase() !== 'N/A') {
            if (containerViewOccupationEl) containerViewOccupationEl.classList.remove('hidden');
            if (viewOccupationEl) viewOccupationEl.textContent = data.occupation;
        } else {
            if (containerViewOccupationEl) containerViewOccupationEl.classList.add('hidden');
        }

        // Construct Full Address
        const addressParts = [
            data.street_address,
            data.barangay ? `Brgy. ${data.barangay}` : '',
            data.city,
            data.province,
            data.zip_code
        ].filter(part => part && part.trim() !== '');

        const viewFullAddressEl = document.getElementById('view-full-address');
        const viewRegionEl = document.getElementById('view-region');
        if (viewFullAddressEl) viewFullAddressEl.textContent = addressParts.length > 0 ? addressParts.join(', ') : 'N/A';
        if (viewRegionEl) viewRegionEl.textContent = data.region || 'N/A';

        // Edit Mode Form Inputs Populating
        const inputFirstNameEl = document.getElementById('input-first-name');
        const inputLastNameEl = document.getElementById('input-last-name');
        const inputEmailEl = document.getElementById('input-email');
        const inputMobileEl = document.getElementById('input-mobile');
        const inputCivilStatusEl = document.getElementById('input-civil-status');
        const inputOccupationEl = document.getElementById('input-occupation');
        const inputStreetEl = document.getElementById('input-street');
        const regionDisplayEl = document.getElementById('region-display');
        const provinceDisplayEl = document.getElementById('province-display');
        const cityDisplayEl = document.getElementById('city-display');
        const barangayDisplayEl = document.getElementById('barangay-display');
        const zipDisplayEl = document.getElementById('zip-display');
        const zipInputEl = document.getElementById('zip-input');

        if (inputFirstNameEl) inputFirstNameEl.value = fName;
        if (inputLastNameEl) inputLastNameEl.value = lName;
        if (inputEmailEl) inputEmailEl.value = data.email || '';
        if (inputMobileEl) inputMobileEl.value = data.phone_number || '';
        if (inputCivilStatusEl) inputCivilStatusEl.value = data.civil_status || '';
        if (inputOccupationEl) inputOccupationEl.value = data.occupation || '';
        if (inputStreetEl) inputStreetEl.value = data.street_address || '';
        if (regionDisplayEl) regionDisplayEl.textContent = data.region || 'N/A';
        if (provinceDisplayEl) provinceDisplayEl.textContent = data.province || 'N/A';
        if (cityDisplayEl) cityDisplayEl.textContent = data.city || 'N/A';
        if (barangayDisplayEl) barangayDisplayEl.textContent = data.barangay || 'N/A';
        if (zipDisplayEl) zipDisplayEl.textContent = data.zip_code || 'N/A';
        if (zipInputEl) zipInputEl.value = data.zip_code || '';

        const avatarDisplayEl = document.getElementById('avatarDisplay');
        if (avatarDisplayEl) {
            const imageUrl = getProfileImageUrl(data.profile_picture);
            avatarDisplayEl.innerHTML = `
                <img src="${imageUrl}" alt="Profile Picture" class="w-full h-full object-cover rounded-full" onerror="this.onerror=null; this.src='/images/default-avatar.png';">
            `;
        }

    } catch (error) {
        console.error("Error loading profile:", error);
    }
}

function sanitizeEmail(value) {
    return value
        .trim()
        .toLowerCase();
}


function sanitizeMobile(value) {
    return value
        .replace(/[^\d+]/g, '')
        .replace(/(?!^)\+/g, '');
}


function validateEmail(email) {
    // Regex na pumipigil sa mga may sobra o maling characters sa dulo ng TLD
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,8}$/;
    return emailRegex.test(email);
}


function validatePhilippineMobile(mobile) {
    return /^(09\d{9}|\+639\d{9})$/.test(mobile);
}

inputEmail?.addEventListener('input', function () {
    this.value = sanitizeEmail(this.value);

    if (!this.value) {
        this.setCustomValidity('');
        return;
    }

    if (!validateEmail(this.value)) {
        this.setCustomValidity(
            'Please enter a valid email address.'
        );
    } else {
        this.setCustomValidity('');
    }
});


inputMobile?.addEventListener('input', function () {
    this.value = sanitizeMobile(this.value);

    if (!this.value) {
        this.setCustomValidity('');
        return;
    }

    if (!validatePhilippineMobile(this.value)) {
        this.setCustomValidity(
            'Please enter a valid Philippine mobile number.'
        );
    } else {
        this.setCustomValidity('');
    }
});

async function enterEditMode() {
    isEditing = true;
    editBtn.classList.add('hidden');
    editActions.classList.remove('hidden');
    viewModeSection.classList.add('hidden'); // Show Edit Mode 
    editModeSection.classList.remove('hidden');

    // Itago ang mga static display spans/divs
    document.querySelectorAll('[id$="-display"]').forEach(el => el.classList.add('hidden'));
    
    // Ipakita ang lahat ng input at select dropdowns
    document.querySelectorAll('[id$="-input"]').forEach(el => el.classList.remove('hidden'));
    
    if (avatarOverlay) {
        avatarOverlay.classList.remove('hidden');
        avatarOverlay.style.opacity = "1"; 
    }
    setAvatarEditMode(true);
    
    // I-load ang mga Region, Province, City, Barangay dropdowns at i-prefill gamit ang kasalukuyang address ng user
    await setEditAddressValues();
}

function exitEditMode() {
    isEditing = false;
    editBtn.classList.remove('hidden');
    editActions.classList.add('hidden');
    viewModeSection.classList.remove('hidden');
    editModeSection.classList.add('hidden');

    document.querySelectorAll('[id$="-display"]').forEach(el => el.classList.remove('hidden'));
    document.querySelectorAll('[id$="-input"]').forEach(el => el.classList.add('hidden'));
    
    if (avatarOverlay) {
        avatarOverlay.classList.add('hidden');
        avatarOverlay.style.opacity = "0";
    }
    setAvatarEditMode(false);
}

function showProfileModal(message, type = "success") {
    const existingModal = document.getElementById("profileMessageModal");
    if (existingModal) existingModal.remove();

    const icon = type === "success"
        ? "fa-circle-check"
        : "fa-circle-exclamation";

    const iconColor = type === "success"
        ? "text-green-500"
        : "text-red-500";

    const buttonColor = type === "success"
        ? "bg-blue-900 hover:bg-blue-800"
        : "bg-red-600 hover:bg-red-500";

    const modal = document.createElement("div");
    modal.id = "profileMessageModal";
    modal.className = "fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 px-4";

    modal.innerHTML = `
        <div class="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 text-center">
            <i class="fas ${icon} ${iconColor} text-4xl mb-4"></i>

            <h2 class="text-lg font-bold text-slate-800 mb-2">
                ${type === "success" ? "Success!" : "Something went wrong"}
            </h2>

            <p class="text-sm text-slate-600 mb-6">
                ${message}
            </p>

            <button
                type="button"
                id="profileModalClose"
                class="${buttonColor} text-white px-6 py-2 rounded-lg font-medium transition">
                OK
            </button>
        </div>
    `;

    document.body.appendChild(modal);

    document.getElementById("profileModalClose").addEventListener("click", () => {
        modal.remove();
    });
}

async function saveProfile() {
    let firstName = '';
    let lastName = '';

    const firstNameInputEl = document.getElementById('input-first-name');
    const lastNameInputEl = document.getElementById('input-last-name');

    if (firstNameInputEl && lastNameInputEl) {
    firstName = firstNameInputEl.value.trim();
    lastName = lastNameInputEl.value.trim();
    } else if (fullNameInputEl) {
    const nameParts = fullNameInputEl.value.trim().split(" ");
    firstName = nameParts[0] || "";
    lastName = nameParts.slice(1).join(" ") || "";
    }

    const email = sanitizeEmail(inputEmail.value);
    const mobile = sanitizeMobile(inputMobile.value);
    const birthday = inputBirthday.value.trim();
    const civilStatus = inputCivilStatus.value.trim();
    const occupation = inputOccupation.value.trim();
    const streetAddress = inputStreet.value.trim();

    const region = regionInput.value.trim();
    const province = provinceInput.value.trim();
    const city = cityInput.value.trim();
    const barangay = barangayInput.value.trim();
    const zipCode = zipInput.value.trim().replace(/\D/g, '');

    // 2. Client-side Validations
    if (!firstName || !lastName) {
    alert('Please provide your complete First and Last Name.');
    return;
    }

    if (!email) {
    alert('Email cannot be empty.');
    return;
    }

    if (!validateEmail(email)) {
    alert('Please enter a valid email address.');
    inputEmail.focus();
    return;
    }

    if (!mobile || !validatePhilippineMobile(mobile)) {
    alert('Please enter a valid Philippine mobile number.');
    return;
    }

    if (!birthday) {
    alert('Please enter your birthday.');
    return;
    }

    // 18+ Age Validation
    const birthDate = new Date(birthday);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
    }
    if (age < 18) {
    alert('You must be at least 18 years old.');
    return;
    }

    if (!streetAddress || !region || !province || !city || !barangay) {
    alert('Please complete all address dropdowns and street address.');
    return;
    }

    if (!/^\d{4}$/.test(zipCode)) {
    alert('Please enter a valid 4-digit Philippine ZIP code.');
    return;
    }

    // 3. Payload Construction
    const updatedData = {
    firstName,
    lastName,
    email,
    mobile,
    birthday,
    civilStatus,
    occupation,
    streetAddress,
    region,
    province,
    city,
    barangay,
    zipCode
    };

    try {
        const response = await fetch('/api/user/profile/update', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updatedData)
        });

        const result = await response.json();

        if (result.success) {
            showProfileModal('Your profile has been updated successfully!');
            await fetchProfileData();
            exitEditMode();
            
            // if(typeof loadComponent === "function") {
            //     loadComponent("header", "/user/userHeader.html");
            // }
            await refreshTopbarAvatar();

        } else {
            showProfileModal(
                'Failed to update profile: ' + result.error,
                'error'
            );
        }
    } catch (error) {
        console.error("Network update error:", error);
        alert('A network error occurred while updating profile.');
    }
}

function cancelEdit() {
    fetchProfileData(); 
    exitEditMode();
}

function formatBirthdayView(dateStr) {
    if (!dateStr) return 'N/A';
    
    // Kunin ang YYYY-MM-DD para iwas timezone bug
    const cleanDate = dateStr.toString().split('T')[0];
    const [year, month, day] = cleanDate.split('-');
    
    if (!year || !month || !day) return 'N/A';

    const fullMonthNames = [
        "January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December"
    ];

    const monthIndex = parseInt(month, 10) - 1;
    const formattedDay = day.padStart(2, '0');
    const formattedMonth = fullMonthNames[monthIndex] || '';

    return `${formattedMonth} ${formattedDay}, ${year}`;
}

function togglePasswordForm() {
    isPasswordFormVisible = !isPasswordFormVisible;
    if (isPasswordFormVisible) {
        passwordForm.classList.remove('hidden');
        togglePasswordBtn.innerHTML = '<i class="fas fa-times"></i> Cancel Change';
        togglePasswordBtn.className = "flex items-center gap-2 border border-red-500 text-red-500 px-4 py-2 rounded-lg hover:bg-red-50 transition-custom";
    } else {
        passwordForm.classList.add('hidden');
        togglePasswordBtn.innerHTML = '<i class="fas fa-lock"></i> Change Password';
        togglePasswordBtn.className = "flex items-center gap-2 border border-blue-500 text-blue-500 px-4 py-2 rounded-lg hover:bg-blue-50 transition-custom";
        
        currentPassword.value = '';
        currentPasswordHint.textContent = '';
        lockNewPasswordFields();
    }
}

async function updatePassword() {
    const currentPwd = currentPassword.value.trim();
    const newPwd = newPassword.value.trim();
    const confirm = confirmPassword.value.trim();

    if (!currentPasswordVerified) {
        alert('Please enter your correct current password first.');
        return;
    }

    if (!currentPwd || !newPwd || !confirm) {
        alert('Please fill in all password fields.');
        return;
    }

    if (newPwd !== confirm) {
        alert('New passwords do not match!');
        return;
    }

    if (newPwd.length < 6) {
        alert('New password must be at least 6 characters long.');
        return;
    }

    try {
        const response = await fetch('/api/user/profile/password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                currentPassword: currentPwd,
                newPassword: newPwd
            })
        });

        const result = await response.json();

        if (result.success) {
            alert('Password Changed Successfully in Database!');
            currentPasswordVerified = false;
            togglePasswordForm();
        } else {
            alert('Failed to change password: ' + result.error);
        }
    } catch (error) {
        console.error("Network update error for password:", error);
        alert('A network error occurred while updating the password.');
    }
}

avatarOverlay?.addEventListener('click', () => {
    if (isEditing) {
        avatarInput?.click();
    } else {
        alert('Please click "Edit Profile" first before changing your profile picture.');
    }
});

avatarInput?.addEventListener('change', async function() {
    const file = this.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
        showProfileModal('Please select an image file.', 'error');
        return;
    }

    if (file.size > 2 * 1024 * 1024) {
        showProfileModal('File size is too large. Maximum limit is 2MB.', 'error');
        return;
    }

    const formData = new FormData();
    formData.append('avatar', file); 

    try {
        const response = await fetch('/api/user/profile/avatar', {
            method: 'POST',
            body: formData 
        });

        if (!response.ok) {
            const errData = await response.json().catch(() => ({}));
            throw new Error(errData.error || `Server responded with status ${response.status}`);
        }

        const result = await response.json();
        if (result.success) {
                showProfileModal('Your profile picture has been uploaded successfully!');
                const imageUrl = getProfileImageUrl(result.avatarUrl);
                if (avatarDisplay) {
                    avatarDisplay.innerHTML = `
                        <img src="${imageUrl}" alt="Profile Picture" class="w-full h-full object-cover rounded-full" onerror="this.onerror=null; this.src='/images/default-avatar.png';" >
                    `;
                }
                await refreshTopbarAvatar();
            } else {
                showProfileModal('Failed to upload: ' + result.error, 'error');
            }
    } catch (error) {
        console.error("Avatar upload error detailed:", error);
        alert('A network error occurred: ' + error.message);
    }
});

editBtn?.addEventListener('click', enterEditMode);
saveBtn?.addEventListener('click', saveProfile);
cancelBtn?.addEventListener('click', cancelEdit);

togglePasswordBtn?.addEventListener('click', togglePasswordForm);
updatePasswordBtn?.addEventListener('click', updatePassword);

document.querySelectorAll('#password-form input').forEach(input => {
    input.addEventListener('keydown', function(e) {
        if (e.key === 'Enter') {
            updatePassword();
        }
    });
});

async function refreshTopbarAvatar() {
    try {
        const userRes = await fetch("/api/current-user");
        const userData = await userRes.json();

        const avatarContainer = document.getElementById("topbarAvatarContainer");

        if (!avatarContainer) return;
        
        if (userData.profile_picture) {
            avatarContainer.innerHTML = `
                <img src="${getProfileImageUrl(userData.profile_picture)}" alt="Profile"  class="w-full h-full object-cover rounded-full"
                    onerror="this.onerror=null; this.src='/images/default-avatar.png';"
                >
            `;
        } else {
            avatarContainer.innerHTML = `<i class="fas fa-user-circle text-2xl text-gray-500"></i> `;
        }

    } catch (error) {
        console.error("Error refreshing topbar avatar:", error);
    }
}

// Initialization gamit ang loadSidebar, loadTopbar, at fetchProfileData katulad ng Adoption Hub
document.addEventListener("DOMContentLoaded", async () => {
    try {
        await loadSidebar();

        requestAnimationFrame(async () => {
            if (typeof loadTopbar === "function") {
                await loadTopbar({
                    title: "User Profile",
                    subtitle: "Manage your personal account details, preferences, and security settings."
                });
            }

            await fetchProfileData();
            setAvatarEditMode(false);

            document.body.style.visibility = "visible";
        });

    } catch (error) {
        console.error("Error initializing page:", error);
        document.body.style.visibility = "visible";
    }
});

//for address
// 1. JSON Cascading Loaders
async function loadRegions() {
    try {
        if (regionsData.length === 0) {
            const res = await fetch('/data/regions.json');
            regionsData = await res.json();
        }
        regionInput.innerHTML = '<option value="">Select Region</option>';
        regionsData.forEach(reg => {
            const opt = document.createElement('option');
            opt.value = reg.region_name;
            opt.textContent = reg.region_name;
            opt.dataset.code = reg.region_code;
            regionInput.appendChild(opt);
        });
    } catch (err) {
        console.error("Error loading regions:", err);
    }
}

async function populateProvinces(regionName, selectedProvince = null) {
    const selectedOption = Array.from(regionInput.options).find(opt => opt.value === regionName);
    const regCode = selectedOption ? selectedOption.dataset.code : null;

    provinceInput.innerHTML = '<option value="">Select Province</option>';
    provinceInput.disabled = true;
    cityInput.innerHTML = '<option value="">Select City / Municipality</option>';
    cityInput.disabled = true;
    barangayInput.innerHTML = '<option value="">Select Barangay</option>';
    barangayInput.disabled = true;

    if (!regCode) return;

    if (provincesData.length === 0) {
        const res = await fetch('/data/provinces.json');
        provincesData = await res.json();
    }

    let filtered = provincesData.filter(p => p.region_code === regCode);
    filtered.sort((a, b) => a.province_name.localeCompare(b.province_name));

    if (filtered.length === 0) {
        filtered = [{ province_code: regCode, province_name: regionName }];
    }

    filtered.forEach(p => {
        const opt = document.createElement('option');
        opt.value = p.province_name;
        opt.textContent = p.province_name;
        opt.dataset.code = p.province_code;
        provinceInput.appendChild(opt);
    });

    provinceInput.disabled = false;
    if (selectedProvince) provinceInput.value = selectedProvince;
}

async function populateCities(provinceName, selectedCity = null) {
    const selectedOption = Array.from(provinceInput.options).find(opt => opt.value === provinceName);
    const provCode = selectedOption ? selectedOption.dataset.code : null;
    const regCode = regionInput.options[regionInput.selectedIndex]?.dataset.code;

    cityInput.innerHTML = '<option value="">Select City / Municipality</option>';
    cityInput.disabled = true;
    barangayInput.innerHTML = '<option value="">Select Barangay</option>';
    barangayInput.disabled = true;

    if (!provCode) return;

    if (citiesData.length === 0) {
        const res = await fetch('/data/cities.json');
        citiesData = await res.json();
    }

    const filtered = citiesData.filter(c => c.province_code === provCode || c.region_desc === regCode);
    filtered.sort((a, b) => a.city_name.localeCompare(b.city_name));

    filtered.forEach(c => {
        const opt = document.createElement('option');
        opt.value = c.city_name;
        opt.textContent = c.city_name;
        opt.dataset.code = c.city_code;
        cityInput.appendChild(opt);
    });

    cityInput.disabled = false;
    if (selectedCity) cityInput.value = selectedCity;
}

async function populateBarangays(cityName, selectedBarangay = null) {
    const selectedOption = Array.from(cityInput.options).find(opt => opt.value === cityName);
    const cityCode = selectedOption ? selectedOption.dataset.code : null;

    barangayInput.innerHTML = '<option value="">Select Barangay</option>';
    barangayInput.disabled = true;

    if (!cityCode) return;

    if (barangaysData.length === 0) {
        const res = await fetch('/data/barangays.json');
        barangaysData = await res.json();
    }

    const filtered = barangaysData.filter(b => b.city_code === cityCode);
    filtered.sort((a, b) => a.brgy_name.localeCompare(b.brgy_name));

    filtered.forEach(b => {
        const opt = document.createElement('option');
        opt.value = b.brgy_name;
        opt.textContent = b.brgy_name;
        barangayInput.appendChild(opt);
    });

    barangayInput.disabled = false;
    if (selectedBarangay) barangayInput.value = selectedBarangay;
}

// 2. Event Listeners para sa Cascading
regionInput?.addEventListener('change', () => populateProvinces(regionInput.value));
provinceInput?.addEventListener('change', () => populateCities(provinceInput.value));
cityInput?.addEventListener('change', () => populateBarangays(cityInput.value));

// 3. ZIP Code validation mask (Numbers only & exact 4 digits)
zipInput?.addEventListener('input', function() {
    this.value = this.value.replace(/\D/g, '');
    if (this.value.length === 4) {
        zipHelper.textContent = '';
    } else if (this.value.length > 0) {
        zipHelper.textContent = 'ZIP code must be 4 digits.';
    }
});

// 4. Pre-fill Dropdowns sa Edit Mode
async function setEditAddressValues() {
    await loadRegions();
    if (currentProfile.region) {
        regionInput.value = currentProfile.region;
        await populateProvinces(currentProfile.region, currentProfile.province);
    }
    if (currentProfile.province) {
        await populateCities(currentProfile.province, currentProfile.city);
    }
    if (currentProfile.city) {
        await populateBarangays(currentProfile.city, currentProfile.barangay);
    }
}