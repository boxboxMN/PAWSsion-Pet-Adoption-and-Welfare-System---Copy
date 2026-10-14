function getOrgProfileImageUrl(profilePic) {
    if (!profilePic || !String(profilePic).trim()) {
        return "";
    }
    const image = String(profilePic).trim();
    // Cloudinary or another complete image URL
    if (/^https?:\/\//i.test(image)) {
        return image;
    }
    // Existing absolute local path
    if (image.startsWith("/")) {
        return image;
    }
    // Legacy local filename
    return `/uploads/org-profiles/${encodeURIComponent(image)}`;
}


async function syncHeaderProfilePic() {
    const imgTag = document.getElementById("headerProfilePic");
    const iconTag = document.getElementById("headerProfileIcon");

    if (!imgTag || !iconTag) return false;

    try {
        const response = await fetch("/api/organization/profile", {
            credentials: "include"
        });

        if (!response.ok) return false;

        const data = await response.json();
        const imageUrl = getOrgProfileImageUrl(data.profile_pic);

        if (!imageUrl) {
            imgTag.removeAttribute("src");
            imgTag.classList.add("hidden");
            iconTag.classList.remove("hidden");
            return true;
        }

        imgTag.onerror = () => {
            imgTag.classList.add("hidden");
            iconTag.classList.remove("hidden");
        };

        imgTag.onload = () => {
            imgTag.classList.remove("hidden");
            iconTag.classList.add("hidden");
        };

        imgTag.src = imageUrl;

        return true;
    } catch (error) {
        console.error("Error syncing header profile pic:", error);
        return false;
    }
}

// 1. Subukan patakbuhin agad pagka-load ng DOM
document.addEventListener('DOMContentLoaded', () => {
    console.log("🔥 orgProfile.js DOMContentLoaded fired!");
    syncHeaderProfilePic();
});

// 2. WATCHDOG (MutationObserver): Babantayan ang buong page. 
// Sa oras na i-inject ng orgTopbar.js ang header sa HTML, huli agad siya nito!

let isSyncingHeaderProfilePic = false;

const observer = new MutationObserver(async (mutations, obs) => {
    const imgTag = document.getElementById("headerProfilePic");
    const iconTag = document.getElementById("headerProfileIcon");

    if (!imgTag || !iconTag || isSyncingHeaderProfilePic) {
        return;
    }

    isSyncingHeaderProfilePic = true;

    try {
        const isSynced = await syncHeaderProfilePic();

        if (isSynced) {
            obs.disconnect();
            console.log("Organization header profile picture synced.");
        }
    } finally {
        isSyncingHeaderProfilePic = false;
    }
});

observer.observe(document.documentElement, {
    childList: true,
    subtree: true
});

//hide the org profile data
let currentOrgData = null;

// Cascading address dropdown data caches
let regionsData = [];
let provincesData = [];
let citiesData = [];
let barangaysData = [];

document.addEventListener("DOMContentLoaded", async () => {

// await loadTopbar({
//     title: "Organization Profile",
//     subtitle: "View and manage your organization's public information, contact details, and account settings."
// });

// await loadSidebar();
// // 2. Kuhanin ang kumpletong impormasyon ng Org mula sa bagong API route natin

if (window.location.pathname === "/org/profile") {
    await loadTopbar({
        title: "Organization Profile",
        subtitle: "View and manage your organization's public information, contact details, and account settings."
    });

    await loadSidebar();
}

try {
    const response = await fetch("/api/organization/profile");

    if (response.ok) {
        const data = await response.json();
        currentOrgData = data;

        
        const profileOrgName = document.getElementById("profileOrgName");
        if (profileOrgName && data.organization_name) {
            profileOrgName.textContent = data.organization_name;
        }

        const defaultIcon = document.getElementById("defaultUserIcon");
        const orgLogo = document.getElementById("orgLogo");      
        const imageUrl = getOrgProfileImageUrl(data.profile_pic);

        if (imageUrl && orgLogo) {
            orgLogo.onerror = () => {
                orgLogo.classList.add("hidden");
                defaultIcon?.classList.remove("hidden");
            };

            orgLogo.onload = () => {
                orgLogo.classList.remove("hidden");
                defaultIcon?.classList.add("hidden");
            };

            orgLogo.src = imageUrl;
        } else {
            if (orgLogo) {
                orgLogo.removeAttribute("src");
                orgLogo.classList.add("hidden");
            }

            defaultIcon?.classList.remove("hidden");
        }


        // ----------------------------------------------------
        // BASIC INFO
        // ----------------------------------------------------
        const infoContactPerson = document.getElementById("infoContactPerson");
        if (infoContactPerson) {
            infoContactPerson.textContent = data.contact_person || "Not Specified";
        }
    
        const infoContact = document.getElementById("infoContact");
        if (infoContact) {
            infoContact.textContent = data.contact_number || "Not Specified";
        }
        
        const infoType = document.getElementById("infoType");
        if (infoType && data.organization_type) {
            infoType.textContent = data.organization_type;
        }

        // ----------------------------------------------------
        // ADDRESS (Region, Province, City, Barangay, Zip)
        // ----------------------------------------------------
        const infoFullAddress = document.getElementById("infoFullAddress");
        if (infoFullAddress) {
            const addressParts = [
                data.address,
                data.barangay ? `Brgy. ${data.barangay}` : "",
                data.city,
                data.province,
                data.zip_code
            ].filter(part => part && String(part).trim() !== "");

            infoFullAddress.textContent = addressParts.length > 0 ? addressParts.join(", ") : "No address specified";
        }

        const infoRegion = document.getElementById("infoRegion");
        if (infoRegion) {
            infoRegion.textContent = data.region || "Not Specified";
        }

        // ----------------------------------------------------
        // SHORT DESCRIPTON
        // ----------------------------------------------------
        const infoDescription = document.getElementById("infoDescription");
        if (infoDescription && data.description) {
            infoDescription.textContent = data.description;
        }
    }

} catch (error) {
    console.error("Unable to upload the organization's information':", error);
}

// ----------------------------------------------------
// CHANGE PASSWORD MODAL OPEN/CLOSE TOGGLE
// ----------------------------------------------------
const passwordModal = document.getElementById("passwordModal");
const openModalBtn = document.getElementById("openModalBtn");
const cancelModalBtn = document.getElementById("cancelModalBtn");
const changePasswordForm = document.getElementById("changePasswordForm");

// Step Containers & Controls
const step1Container = document.getElementById("step1Container");
const step2Container = document.getElementById("step2Container");
const verifyPasswordBtn = document.getElementById("verifyPasswordBtn");
const backToStep1Btn = document.getElementById("backToStep1Btn");
const stepIndicator1 = document.getElementById("stepIndicator1");
const stepIndicator2 = document.getElementById("stepIndicator2");
const modalMessage = document.getElementById("modalMessage");

// Input Fields
const currentPasswordInput = document.getElementById("currentPassword");
const newPasswordInput = document.getElementById("newPassword");
const confirmPasswordInput = document.getElementById("confirmPassword");

// 1. Pagpapakita ng Mensahe sa Modal (Helper function)
function showModalMessage(text, isError = true) {
    modalMessage.textContent = text;
    modalMessage.classList.remove("hidden", "text-red-500", "text-green-500");
    modalMessage.classList.add(isError ? "text-red-500" : "text-green-500");
}

function hideModalMessage() {
    modalMessage.classList.add("hidden");
}

// 2. Pagbukas ng Modal (Laging babalik sa Step 1 kapag binuksan)
openModalBtn?.addEventListener("click", () => {
    goToStep1();
    passwordModal.classList.remove("hidden");
    setTimeout(() => {
        passwordModal.classList.remove("opacity-0");
        passwordModal.querySelector('div').classList.remove("scale-95");
    }, 10);
});

// 3. Pagtatago ng Modal (Clean reset)
const hideModal = () => {
    passwordModal.classList.add("opacity-0");
    passwordModal.querySelector('div').classList.add("scale-95");
    setTimeout(() => {
        passwordModal.classList.add("hidden");
        changePasswordForm.reset();
        hideModalMessage();
    }, 300);
};

cancelModalBtn?.addEventListener("click", hideModal);

// 4. Function para mag-navigate sa Step 1
function goToStep1() {
    hideModalMessage();
    
    // UI states
    stepIndicator1.classList.replace("bg-gray-200", "bg-blue-900");
    stepIndicator2.classList.replace("bg-blue-900", "bg-gray-200");
    
    // Transition effects
    step2Container.classList.add("opacity-0", "translate-x-4");
    setTimeout(() => {
        step2Container.classList.add("hidden");
        step1Container.classList.remove("hidden");
        setTimeout(() => {
            step1Container.classList.remove("opacity-0", "-translate-x-4");
        }, 50);
    }, 150);

    // Dynamic required fields management
    currentPasswordInput.required = true;
    newPasswordInput.required = false;
    confirmPasswordInput.required = false;
}

// 5. Function para mag-navigate sa Step 2
function goToStep2() {
    hideModalMessage();

    // UI states
    stepIndicator1.classList.replace("bg-blue-900", "bg-gray-200");
    stepIndicator2.classList.replace("bg-gray-200", "bg-blue-900");

    // Transition effects
    step1Container.classList.add("opacity-0", "-translate-x-4");
    setTimeout(() => {
        step1Container.classList.add("hidden");
        step2Container.classList.remove("hidden");
        setTimeout(() => {
            step2Container.classList.remove("opacity-0", "translate-x-4");
        }, 50);
    }, 150);

    // Dynamic required fields management
    currentPasswordInput.required = false;
    newPasswordInput.required = true;
    confirmPasswordInput.required = true;
}

// Bumalik sa Step 1 mula sa Step 2
backToStep1Btn?.addEventListener("click", goToStep1);

// 6. ACTION: I-verify ang Current Password (STEP 1)
verifyPasswordBtn?.addEventListener("click", async () => {
    const currentPassword = currentPasswordInput.value.trim();
    if (!currentPassword) {
        showModalMessage("Please enter your current password.");
        return;
    }

    verifyPasswordBtn.disabled = true;
    verifyPasswordBtn.innerHTML = `<i class="fa-solid fa-spinner animate-spin"></i> Verifying...`;

    try {
        
        const response = await fetch("/api/organization/verify-password", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ currentPassword })
        });

        const result = await response.json();

        if (response.ok) {
            goToStep2(); // Kapag TAMA ang password, pupunta na sa Step 2!
        } else {
            showModalMessage(result.message || "Incorrect password. Please try again.");
        }
    } catch (error) {
        console.error(error);
        showModalMessage("An error occurred during verification.");
    } finally {
        verifyPasswordBtn.disabled = false;
        verifyPasswordBtn.innerHTML = `Verify <i class="fa-solid fa-arrow-right text-[10px]"></i>`;
    }
});

// 7. ACTION: I-update na ang Bagong Password (STEP 2 SUBMIT)
changePasswordForm?.addEventListener("submit", async (e) => {
    e.preventDefault();

    // I-double check kung nasa Step 2 nga ba talaga ang submit trigger
    if (step2Container.classList.contains("hidden")) return;

    const currentPassword = currentPasswordInput.value;
    const newPassword = newPasswordInput.value;
    const confirmPassword = confirmPasswordInput.value;

    // 1. BAWAL GAMITIN ANG DATING PASSWORD (Basic Frontend Check)
    if (newPassword === currentPassword) {
        showModalMessage("New password cannot be the same as your current password.");
        return;
    }

    // 2. PARAMS CHECK: 8+ chars, uppercase, lowercase, number, special char
    // RegEx pattern para sa requirements
    // Minimum 8 characters, kahit anong haba, kahit walang special characters
    const passwordRegex = /^.{8,}$/;

    if (!passwordRegex.test(newPassword)) {
        showModalMessage("Password must be at least 8 characters long, contain at least one uppercase letter, one lowercase letter, one number, and one special character (@$!%*?&).");
        return;
    }

    // 3. MATCHING CHECK
    if (newPassword !== confirmPassword) {
        showModalMessage("New passwords do not match.");
        return;
    }

    const submitBtn = document.getElementById("submitPasswordBtn");
    submitBtn.disabled = true;
    submitBtn.innerHTML = `<i class="fa-solid fa-spinner animate-spin"></i> Updating...`;

    try {
        
        const response = await fetch("/api/organization/update-password", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ 
                currentPassword, 
                newPassword 
            })
        });

        const result = await response.json();

        if (response.ok) {
            showModalMessage("Password changed successfully!", false);
            setTimeout(() => {
                hideModal();
            }, 1500); // Isasara ang modal pagkatapos ng 1.5 seconds para mabasa ang success text
        } else {
            showModalMessage(result.message || "Failed to update password.");
        }
    } catch (error) {
        console.error(error);
        showModalMessage("An error occurred while updating password.");
    } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = `Update Password`;
    }
});

// ----------------------------------------------------
// EDIT PROFILE MODAL TOGGLE & PRE-FILL
// ----------------------------------------------------
const editProfileModal = document.getElementById("editProfileModal");
const openEditModalBtn = document.getElementById("openEditModalBtn");
const cancelEditBtn = document.getElementById("cancelEditBtn");
const editProfileForm = document.getElementById("editProfileForm");
const editModalMessage = document.getElementById("editModalMessage");

const imageUploadInput = document.getElementById("imageUploadInput");
const editModalPreview = document.getElementById("editModalPreview");
const editModalIcon = document.getElementById("editModalIcon");

// Contact Number sanitation & validation
const editContactInput = document.getElementById("editContact");
const editContactHelper = document.getElementById("editContactHelper");
const phPhoneRegex = /^09\d{9}$/;

// Live sanitation: numbers lang, at eksaktong 11 digits
if (editContactInput) {
    editContactInput.addEventListener('input', function() {
        let value = this.value.replace(/\D/g, ''); // Tanggalin ang lahat maliban sa digits
        if (value.length > 11) value = value.slice(0, 11); // I-limit sa 11 digits

        this.value = value;

        if (editContactHelper) {
            if (value === '' ) {
                editContactHelper.textContent = '';
            } else if (phPhoneRegex.test(value)) {
                editContactHelper.textContent = '';
            } else {
                editContactHelper.textContent = 'Enter a valid 11-digit PH mobile number starting with 09 (e.g., 09123456789).';
            }
        }
    });
}

// Cascading address dropdowns
const editRegionInput = document.getElementById("editRegion");
const editProvinceInput = document.getElementById("editProvince");
const editCityInput = document.getElementById("editCity");
const editBarangayInput = document.getElementById("editBarangay");
const editZipInput = document.getElementById("editZip");
const editZipHelper = document.getElementById("editZipHelper");

// Global variable para hawakan ang napiling file blob kung mayroon man
let selectedImageFile = null;

// Pagbukas at Pag-fill ng Data sa mga Inputs
openEditModalBtn?.addEventListener("click", async () => {
    if (!currentOrgData) return;

    // I-pre-fill ang text fields (with a guard against the literal
    // strings "undefined"/"null" that older bad data may contain)
    const safeValue = (val) => {
        const str = (val || "").toString().trim();
        return (str === "undefined" || str === "null") ? "" : str;
    };

    document.getElementById("editOrgName").value = safeValue(currentOrgData.organization_name);
    document.getElementById("editContact").value = safeValue(currentOrgData.contact_number);
    document.getElementById("editContactPerson").value = safeValue(currentOrgData.contact_person);
    document.getElementById("editAddress").value = safeValue(currentOrgData.address);
    document.getElementById("editZip").value = safeValue(currentOrgData.zip_code);
    document.getElementById("editDescription").value = safeValue(currentOrgData.description);

    await setEditAddressValues();

    const imageUrl = getOrgProfileImageUrl(currentOrgData.profile_pic);
    if (imageUrl) {
        editModalPreview.onerror = () => {
            editModalPreview.classList.add("hidden");
            editModalIcon.classList.remove("hidden");
        };
        editModalPreview.onload = () => {
            editModalPreview.classList.remove("hidden");
            editModalIcon.classList.add("hidden");
        };
        editModalPreview.src = imageUrl;
    } else {
        editModalPreview.removeAttribute("src");
        editModalPreview.classList.add("hidden");
        editModalIcon.classList.remove("hidden");
    }

    selectedImageFile = null; // I-reset ang file selector taglay
    imageUploadInput.value = ""; // Linisin ang input state

    // Buksan ang modal
    editProfileModal.classList.remove("hidden");
    setTimeout(() => {
        editProfileModal.classList.remove("opacity-0");
        editProfileModal.querySelector('div').classList.remove("scale-95");
    }, 10);
});

imageUploadInput?.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (file) {
        selectedImageFile = file; 
        
    
        const reader = new FileReader();
        reader.onload = function(e) {
            editModalPreview.src = e.target.result;
            editModalPreview.classList.remove("hidden");
            editModalIcon.classList.add("hidden");
        }
        reader.readAsDataURL(file);
    }
});

// Pagtatago ng Modal
const hideEditModal = () => {
    editProfileModal.classList.add("opacity-0");
    editProfileModal.querySelector('div').classList.add("scale-95");
    setTimeout(() => {
        editProfileModal.classList.add("hidden");
        editModalMessage.classList.add("hidden");
    }, 300);
};

cancelEditBtn?.addEventListener("click", hideEditModal);

// ACTION: I-submit ang mga Binagong Data (Texts + Image)
editProfileForm?.addEventListener("submit", async (e) => {
    e.preventDefault();

    // 2. VALIDATION NG MOBILE NUMBER
    const contactValue = editContactInput.value.trim();

    if (!phPhoneRegex.test(contactValue)) {
        // Kapag may mali, ipapakita ang error
        editModalMessage.textContent = "Please enter a valid Philippine mobile number (e.g., 09123456789).";
        editModalMessage.className = "text-xs font-semibold text-red-500 mt-2 block";
        
        editContactInput.focus();
        return;
    }

    // 3. VALIDATION NG ADDRESS DROPDOWNS + ZIP
    const regionValue = editRegionInput.value.trim();
    const provinceValue = editProvinceInput.value.trim();
    const cityValue = editCityInput.value.trim();
    const barangayValue = editBarangayInput.value.trim();
    const zipValue = editZipInput.value.trim();

    if (!regionValue || !provinceValue || !cityValue || !barangayValue) {
        editModalMessage.textContent = "Please complete all address dropdowns (Region, Province, City, Barangay).";
        editModalMessage.className = "text-xs font-semibold text-red-500 mt-2 block";
        return;
    }

    if (!/^\d{4}$/.test(zipValue)) {
        editModalMessage.textContent = "Please enter a valid 4-digit ZIP code.";
        editModalMessage.className = "text-xs font-semibold text-red-500 mt-2 block";
        editZipInput.focus();
        return;
    }
    
    editModalMessage.classList.add("hidden");

    const saveProfileBtn = document.getElementById("saveProfileBtn");
    saveProfileBtn.disabled = true;
    saveProfileBtn.innerHTML = `<i class="fa-solid fa-spinner animate-spin"></i> Saving...`;

    // 1. Gumawa ng FormData Instance
    const formData = new FormData();
    formData.append("organization_name", document.getElementById("editOrgName").value.trim());
    formData.append("contact_number", document.getElementById("editContact").value.trim());
    formData.append("contact_person", document.getElementById("editContactPerson").value.trim());
    formData.append("address", document.getElementById("editAddress").value.trim());
    formData.append("region", regionValue);
    formData.append("province", provinceValue);
    formData.append("city", cityValue);
    formData.append("barangay", barangayValue);
    formData.append("zip_code", zipValue);
    formData.append("description", document.getElementById("editDescription").value.trim());
    
    // Isama ang image file kung may piniling bago si user
    if (selectedImageFile) {
        formData.append("profile_pic", selectedImageFile);
    }

    try {
       
        const response = await fetch("/api/organization/update-profile", {
            method: "PUT",
            body: formData 
        });

        const result = await response.json();

        if (response.ok) {
            editModalMessage.textContent = "Profile updated successfully!";
            editModalMessage.className = "text-xs font-semibold text-green-500 mt-2 block";

            // I-refresh ang page para makita ang mga bagong pagbabago pagkatapos ng 1 segundo
            setTimeout(() => {
                window.location.reload();
            }, 1000);
        } else {
            editModalMessage.textContent = result.message || "Failed to update profile.";
            editModalMessage.className = "text-xs font-semibold text-red-500 mt-2 block";
            saveProfileBtn.disabled = false;
            saveProfileBtn.innerHTML = "Save Changes";
        }
    } catch (error) {
        console.error(error);
        editModalMessage.textContent = "An error occurred while saving profile.";
        editModalMessage.className = "text-xs font-semibold text-red-500 mt-2 block";
        saveProfileBtn.disabled = false;
        saveProfileBtn.innerHTML = "Save Changes";
    }
});

// ----------------------------------------------------
// ADDRESS: REGION / PROVINCE / CITY / BARANGAY CASCADING DROPDOWNS
// ----------------------------------------------------
async function loadRegions() {
    try {
        if (regionsData.length === 0) {
            const res = await fetch('/data/regions.json');
            regionsData = await res.json();
        }
        editRegionInput.innerHTML = '<option value="">Select Region</option>';
        regionsData.forEach(reg => {
            const opt = document.createElement('option');
            opt.value = reg.region_name;
            opt.textContent = reg.region_name;
            opt.dataset.code = reg.region_code;
            editRegionInput.appendChild(opt);
        });
    } catch (err) {
        console.error("Error loading regions:", err);
    }
}

async function populateProvinces(regionName, selectedProvince = null) {
    const selectedOption = Array.from(editRegionInput.options).find(opt => opt.value === regionName);
    const regCode = selectedOption ? selectedOption.dataset.code : null;

    editProvinceInput.innerHTML = '<option value="">Select Province</option>';
    editProvinceInput.disabled = true;
    editCityInput.innerHTML = '<option value="">Select City / Municipality</option>';
    editCityInput.disabled = true;
    editBarangayInput.innerHTML = '<option value="">Select Barangay</option>';
    editBarangayInput.disabled = true;

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
        editProvinceInput.appendChild(opt);
    });

    editProvinceInput.disabled = false;
    if (selectedProvince) editProvinceInput.value = selectedProvince;
}

async function populateCities(provinceName, selectedCity = null) {
    const selectedOption = Array.from(editProvinceInput.options).find(opt => opt.value === provinceName);
    const provCode = selectedOption ? selectedOption.dataset.code : null;
    const regCode = editRegionInput.options[editRegionInput.selectedIndex]?.dataset.code;

    editCityInput.innerHTML = '<option value="">Select City / Municipality</option>';
    editCityInput.disabled = true;
    editBarangayInput.innerHTML = '<option value="">Select Barangay</option>';
    editBarangayInput.disabled = true;

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
        editCityInput.appendChild(opt);
    });

    editCityInput.disabled = false;
    if (selectedCity) editCityInput.value = selectedCity;
}

async function populateBarangays(cityName, selectedBarangay = null) {
    const selectedOption = Array.from(editCityInput.options).find(opt => opt.value === cityName);
    const cityCode = selectedOption ? selectedOption.dataset.code : null;

    editBarangayInput.innerHTML = '<option value="">Select Barangay</option>';
    editBarangayInput.disabled = true;

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
        editBarangayInput.appendChild(opt);
    });

    editBarangayInput.disabled = false;
    if (selectedBarangay) editBarangayInput.value = selectedBarangay;
}

editRegionInput?.addEventListener('change', () => populateProvinces(editRegionInput.value));
editProvinceInput?.addEventListener('change', () => populateCities(editProvinceInput.value));
editCityInput?.addEventListener('change', () => populateBarangays(editCityInput.value));

// ZIP Code live validation mask (Numbers only & exact 4 digits)
if (editZipInput) {
    editZipInput.addEventListener('input', function() {
        this.value = this.value.replace(/\D/g, '');
        if (editZipHelper) {
            if (this.value.length === 4) {
                editZipHelper.textContent = '';
            } else if (this.value.length > 0) {
                editZipHelper.textContent = 'ZIP code must be 4 digits.';
            } else {
                editZipHelper.textContent = '';
            }
        }
    });
}

// Pre-fill ng Region/Province/City/Barangay dropdowns gamit ang kasalukuyang address ng org
async function setEditAddressValues() {
    await loadRegions();
    if (currentOrgData && currentOrgData.region) {
        editRegionInput.value = currentOrgData.region;
        await populateProvinces(currentOrgData.region, currentOrgData.province);
    }
    if (currentOrgData && currentOrgData.province) {
        await populateCities(currentOrgData.province, currentOrgData.city);
    }
    if (currentOrgData && currentOrgData.city) {
        await populateBarangays(currentOrgData.city, currentOrgData.barangay);
    }
}

});

// ----------------------------------------------------
// CUTE PET PASSWORD TOGGLE FUNCTION
// ----------------------------------------------------
function togglePetPassword(inputId, iconId) {
    const passwordInput = document.getElementById(inputId);
    const petIcon = document.getElementById(iconId);

    if (passwordInput.type === "password") {
        // Ipakita ang password (Text mode)
        passwordInput.type = "text";
        
        // Palitan ang paw ng dilat na aso/pusa! (Gagamit tayo ng fa-dog o fa-cat depende sa gusto mo)
        petIcon.className = "fa-solid fa-dog text-base text-blue-900 scale-110 transition-transform duration-200"; 
    } else {
        // Itago ang password
        passwordInput.type = "password";
        
        // Ibalik sa paw/tinatakpan ang mukha
        petIcon.className = "fa-solid fa-paw text-base text-gray-400 transition-transform duration-200";
    }
}