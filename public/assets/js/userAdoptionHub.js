// <!-- ===== ADOPTION HUB SCRIPT ===== -->
let petsData = [];
let filteredPets = [];
const favoritePetIds = new Set();
let modalPetImages = [];
let modalPetImageIndex = 0;
const fallbackPetImage = "/assets/images/no-image.png";

function getPetImageUrl(imagePath) {
    if (typeof imagePath !== "string" || !imagePath.trim()) {
        return fallbackPetImage;
    }

    const image = imagePath.trim();
    if (/^https?:\/\//i.test(image) || image.startsWith("/")) {
        return image;
    }
    return `/uploads/pets/${encodeURIComponent(image)}`;
}

function showModalPetImage() {
    const image = document.getElementById("modalImage");
    const previousButton = document.getElementById("modalImagePrev");
    const nextButton = document.getElementById("modalImageNext");
    const counter = document.getElementById("modalImageCounter");
    if (!image || !modalPetImages.length) return;

    image.onerror = () => {
        image.onerror = null;
        image.src = fallbackPetImage;
    };
    image.src = modalPetImages[modalPetImageIndex];

    const hasMultipleImages = modalPetImages.length > 1;
    previousButton?.classList.toggle("hidden", !hasMultipleImages);
    nextButton?.classList.toggle("hidden", !hasMultipleImages);
    counter?.classList.toggle("hidden", !hasMultipleImages);
    if (counter && hasMultipleImages) {
        counter.textContent = `${modalPetImageIndex + 1} / ${modalPetImages.length}`;
    }
}

document.getElementById("modalImagePrev")?.addEventListener("click", () => {
    modalPetImageIndex =
        (modalPetImageIndex - 1 + modalPetImages.length) % modalPetImages.length;
    showModalPetImage();
});

document.getElementById("modalImageNext")?.addEventListener("click", () => {
    modalPetImageIndex = (modalPetImageIndex + 1) % modalPetImages.length;
    showModalPetImage();
});

// =====================================================
// SECURITY: HTML ESCAPING
// Prevents user/database data from being interpreted as HTML
// =====================================================
function escapeHTML(value) {
    if (value === null || value === undefined) return '';

    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

async function loadPets() {
    try {

        const response = await fetch("/api/pets");
        const data = await response.json();

        if (!data.success) {
            alert("Unable to load pets.");
            return;
        }

        petsData = data.pets.map((pet, originalIndex) => {
            const images = [...new Set(
                (Array.isArray(pet.images) ? pet.images : [pet.image_path])
                    .filter(image => typeof image === "string" && image.trim())
                    .map(getPetImageUrl)
            )];

            return {
                animal_id: pet.animal_id,
                originalIndex,
                name: pet.name,
                species: pet.species,
                gender: pet.gender,
                age: pet.age,
                color: pet.color,
                personality: pet.personality_tags || "",
                breed: pet.personality_tags || "",
                behavior: pet.pet_description,
                status: pet.adoption_status,
                birth_date: pet.birth_date,
                health: pet.health_status,
                vaccination: pet.vaccination_status,
                organization: pet.organization_name,
                organization_id: pet.organization_id,
                organization_logo: pet.profile_pic,
                medical_history: pet.medical_history || [],
                images,
                img: images[0] || fallbackPetImage
            };
        });

    const favoritesResponse = await fetch("/api/user/favorites", {
        credentials: "include"
    });
    const favoritesData = await favoritesResponse.json();
    if (!favoritesResponse.ok || !favoritesData.success || !Array.isArray(favoritesData.favoritePetIds)) {
        throw new Error(favoritesData.message || "Unable to load saved favorites.");
    }
    favoritePetIds.clear();
    favoritesData.favoritePetIds.forEach(id => favoritePetIds.add(String(id)));

    filteredPets = [...petsData];

    populateOrgFilter();
    renderGrid(filteredPets);

    } catch (err) {

        alert(err.message || "Unable to load pets and saved favorites.");

    }
}

// Awtomatikong bubuo ng listahan ng mga organization batay sa aktwal na pets na naka-load,
// kaya kahit may bagong org na nadagdag na may pet, lalabas ito rito ng walang extra config.
function populateOrgFilter() {
    const orgFilterSelect = document.getElementById("org-filter");
    if (!orgFilterSelect) return;

    // Panatilihin ang currently selected value (kung meron) bago i-rebuild ang options
    const previouslySelected = orgFilterSelect.value || "All";

    // Kunin lang ang mga unique organizations (id + name), at ayusin ng alphabetical base sa pangalan
    const orgMap = new Map();
    petsData.forEach(pet => {
        if (pet.organization_id && pet.organization && !orgMap.has(String(pet.organization_id))) {
            orgMap.set(String(pet.organization_id), pet.organization);
        }
    });

    const uniqueOrgs = [...orgMap.entries()].sort((a, b) => a[1].localeCompare(b[1]));

    orgFilterSelect.innerHTML = '<option value="All">All Organizations</option>';
    uniqueOrgs.forEach(([orgId, orgName]) => {
        const opt = document.createElement("option");
        opt.value = orgId;
        opt.textContent = orgName;
        orgFilterSelect.appendChild(opt);
    });

    // I-restore ang dating napiling org kung nandiyan pa rin ito sa bagong listahan
    if (orgMap.has(previouslySelected) || previouslySelected === "All") {
        orgFilterSelect.value = previouslySelected;
    }
}

function renderGrid(pets = filteredPets) {

    const grid = document.getElementById("pet-grid");

    if (!pets.length) {
        grid.innerHTML = `
            <div class="col-span-full text-center py-10 text-gray-500">
                No pets available for adoption.
            </div>
        `;
        return;
    }

grid.innerHTML = pets.map(pet => `
<div class="group bg-white rounded-3xl overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300 hover:-translate-y-1.5 border border-slate-200/80 flex flex-col">

    <!-- Image -->
    <div class="relative overflow-hidden bg-slate-100">
        <img
           src="${escapeHTML(pet.img)}"
           alt="${escapeHTML(pet.name)}"
            class="w-full h-60 object-cover transition-transform duration-500 group-hover:scale-105"
        >

        <!-- Gradient Overlay -->
        <div class="absolute inset-0 bg-gradient-to-t from-slate-900/60 via-transparent to-transparent opacity-80"></div>

        <div class="absolute top-3 left-3 right-3 flex items-start justify-between gap-2">
            <div class="flex flex-wrap items-center gap-2">
                <!-- Species -->
                <span class="px-3 py-1 rounded-xl text-white text-xs font-bold shadow-md ${
                    pet.species.toLowerCase() === "dog"
                        ? "bg-blue-600"
                        : "bg-orange-500"
                }">
                    ${escapeHTML(pet.species).toUpperCase()}
                </span>

                <!-- Status -->
                <span class="px-3 py-1 rounded-xl bg-green-600 text-white text-xs font-bold shadow-md">
                    ${escapeHTML(pet.status).toUpperCase()}
                </span>
            </div>

            <button
                type="button"
                class="favorite-btn inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/90 text-slate-500 shadow-md transition hover:scale-110 hover:text-rose-600"
                data-id="${pet.animal_id}"
                aria-label="${favoritePetIds.has(String(pet.animal_id)) ? "Remove from favorites" : "Add to favorites"}: ${escapeHTML(pet.name)}"
                aria-pressed="${favoritePetIds.has(String(pet.animal_id))}"
                title="${favoritePetIds.has(String(pet.animal_id)) ? "Remove from favorites" : "Add to favorites"}"
            >
                <i class="${favoritePetIds.has(String(pet.animal_id)) ? "fa-solid" : "fa-regular"} fa-heart text-lg ${favoritePetIds.has(String(pet.animal_id)) ? "text-rose-600" : ""}"></i>
            </button>
        </div>

        <!-- Name Banner -->
        <div class="absolute bottom-3 left-4 right-4">
            <div class="inline-flex items-center px-3.5 py-1.5 rounded-xl bg-white/80 backdrop-blur-md border border-white/60 shadow-md">
                <h2 class="text-xl font-extrabold text-slate-900 tracking-tight">
                    ${escapeHTML(pet.name)}
                </h2>
            </div>
        </div>
    </div>

    <!-- Body -->
    <div class="p-5 flex flex-col flex-1 justify-between gap-4">

        <!-- Species Age Gender -->
        <div class="flex items-center gap-2 overflow-x-auto whitespace-nowrap no-scrollbar">
            <span class="inline-flex shrink-0 items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 text-xs font-semibold border border-slate-200/60">
                <i class="fa-solid fa-paw text-slate-400 text-[10px]"></i>
                    ${escapeHTML(pet.species)}
            </span>

            <span class="inline-flex shrink-0 items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 text-xs font-semibold border border-slate-200/60">
                <i class="fa-regular fa-calendar-days text-slate-400 text-[10px]"></i>
                    ${escapeHTML(pet.age)}
            </span>

            <span class="inline-flex shrink-0 items-center gap-1 px-2.5 py-1 rounded-lg border border-slate-200/60 bg-slate-100 text-xs font-semibold ${
                pet.gender === "Male"
                    ? "text-blue-600"
                    : "text-pink-600"
            }">
                <i class="fas ${
                    pet.gender === "Male"
                        ? "fa-mars"
                        : "fa-venus"
                } text-[10px]"></i>
                ${escapeHTML(pet.gender)}
            </span>
        </div>

        <!-- Organization -->
        <div class="rounded-2xl bg-slate-50 border border-slate-200/70 p-3.5">
            <p class="text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-2">
                <i class="fas fa-building text-slate-400 text-[10px]"></i>
                Organization
            </p>
            <p class="text-sm font-semibold text-slate-800 break-words">
                ${escapeHTML(pet.organization)}
            </p>
        </div>

        <!-- Button -->
        <button class="view-btn w-full bg-gradient-to-r from-blue-600 via-indigo-600 to-indigo-700 hover:from-blue-700 hover:to-indigo-800 transition-all duration-200 text-white py-3 rounded-xl font-bold text-xs shadow-md shadow-indigo-100 hover:shadow-indigo-200 active:scale-[0.99] flex items-center justify-center gap-2 cursor-pointer"
            data-id="${pet.animal_id}">
            <i class="fa-regular fa-eye text-sm"></i>View Profile
        </button>

    </div>

</div>
`).join("");
        }
function filterPets() {

    const search = document
        .getElementById("search-input")
        .value
        .toLowerCase()
        .trim();

    const type = document
        .getElementById("type-filter")
        .value;

        const org = document
        .getElementById("org-filter")
        .value;

    const sortOption = document
        .getElementById("sort-filter")
        .value;

    filteredPets = petsData.filter(pet => {

        const matchesSearch =
            pet.name.toLowerCase().includes(search) ||
            pet.species.toLowerCase().includes(search) ||
            pet.personality.toLowerCase().includes(search) ||
            pet.organization.toLowerCase().includes(search);

        const matchesType =
            type === "All" ||
            pet.species === type;

        const matchesOrg =
            org === "All" ||
            String(pet.organization_id) === org;

        return matchesSearch && matchesType && matchesOrg;
    });

    filteredPets.sort((a, b) => {
        const favoriteOrder =
            Number(favoritePetIds.has(String(b.animal_id))) -
            Number(favoritePetIds.has(String(a.animal_id)));
        if (favoriteOrder !== 0) return favoriteOrder;

        if (sortOption === "name-asc") {
            return a.name.localeCompare(b.name);
        }
        if (sortOption === "name-desc") {
            return b.name.localeCompare(a.name);
        }
        return a.originalIndex - b.originalIndex;
    });

    renderGrid(filteredPets);
}
loadPets();
document.getElementById("search-input")
    .addEventListener("input", filterPets);

document.getElementById("type-filter")
    .addEventListener("change", filterPets);

    document.getElementById("org-filter")
    .addEventListener("change", filterPets);

document.getElementById("sort-filter")
    .addEventListener("change", filterPets);

document.addEventListener("click", e => {

    const favoriteBtn = e.target.closest(".favorite-btn");
    if (favoriteBtn) {
        togglePetFavorite(favoriteBtn);
        return;
    }

    const btn = e.target.closest(".view-btn");

    if(!btn) return;

    const id = Number(btn.dataset.id);

    const pet = petsData.find(p => p.animal_id == id);

    if(pet){

        openPetModal(pet);

    }

});

async function togglePetFavorite(button) {
    const petId = String(button.dataset.id);
    const removing = favoritePetIds.has(petId);
    button.disabled = true;

    try {
        const tokenResponse = await fetch("/auth/csrf-token", {
            credentials: "include"
        });
        const tokenData = await tokenResponse.json();
        if (!tokenResponse.ok || !tokenData.token) {
            throw new Error(tokenData.message || "Unable to verify this request. Please try again.");
        }

        const response = await fetch(
            removing ? `/api/user/favorites/${encodeURIComponent(petId)}` : "/api/user/favorites",
            {
                method: removing ? "DELETE" : "POST",
                credentials: "include",
                headers: {
                    "X-CSRF-Token": tokenData.token,
                    ...(removing ? {} : { "Content-Type": "application/json" })
                },
                body: removing ? undefined : JSON.stringify({ animal_id: petId })
            }
        );
        const data = await response.json();
        if (!response.ok || !data.success) {
            throw new Error(data.message || "Unable to update this favorite.");
        }

        if (removing) {
            favoritePetIds.delete(petId);
        } else {
            favoritePetIds.add(petId);
        }
        filterPets();
    } catch (err) {
        console.error("Save pet favorite error:", err);
        alert(err.message || "Unable to update this favorite. Please try again.");
        button.disabled = false;
    }
}


async function checkPetApplicationStatus(petId) {
    const applyBtn = document.getElementById('applyModalBtn');
    if (!applyBtn) return;

    applyBtn.onclick = null;

    try {
        const res = await fetch(`/check-applied/${petId}`, {
            credentials: 'include'
        });
        const data = await res.json();

        if (data.hasApplied) {
            const statusUpper = (data.status || '').toUpperCase();

            // KAPAG DECLINED: Clickable Button na nagpapakita ng reason
            if (statusUpper === 'DECLINED' || statusUpper === 'REJECTED') {
                applyBtn.disabled = false;
                applyBtn.className = "w-full bg-red-600 hover:bg-red-700 text-white py-3 rounded-xl font-bold text-xs shadow-md transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer active:scale-[0.99]";
                applyBtn.innerHTML = `
                    <i class="fa-solid fa-circle-xmark text-sm"></i>
                    <span>Application Declined (View Details)</span>
                `;

        
            applyBtn.onclick = (e) => {
                e.preventDefault();
                sessionStorage.setItem("targetAppTab", "Declined");
                sessionStorage.setItem("targetPetId", petId); // I-save ang Pet ID
                window.location.href = "/application";
            };
            // KAPAG CANCELLED: Gawing ACTIVE at PWEDENG MAG-APPLY ULI (Normal Apply Button)
            } else if (statusUpper === 'CANCELLED') {
                applyBtn.disabled = false;
                applyBtn.onclick = null; // Gagamitin ang default form-opening listener
                applyBtn.className = "w-full bg-gradient-to-r from-blue-600 via-indigo-600 to-indigo-700 hover:from-blue-700 hover:to-indigo-800 transition-all duration-200 text-white py-3 rounded-xl font-bold text-xs shadow-md shadow-indigo-100 hover:shadow-indigo-200 active:scale-[0.99] flex items-center justify-center gap-2 cursor-pointer";
                applyBtn.innerHTML = `
                    <i class="fa-regular fa-heart text-sm"></i>
                    <span>Apply for Adoption</span>
                `;
            } else {
                // KAPAG PENDING / APPROVED: Disabled Button
                applyBtn.disabled = true;
                applyBtn.onclick = null;
                applyBtn.className = "w-full bg-gray-400 text-white py-3 rounded-xl font-bold text-xs shadow-none cursor-not-allowed flex items-center justify-center gap-2";
                applyBtn.innerHTML = `
                    <i class="fa-solid fa-circle-check text-sm"></i>
                    <span>Application Submitted (${data.status || 'Pending'})</span>
                `;
            }
        } else {
            // KAPAG WALA PANG APPLICATION
            applyBtn.disabled = false;
            applyBtn.onclick = null;   
            applyBtn.className = "w-full bg-gradient-to-r from-blue-600 via-indigo-600 to-indigo-700 hover:from-blue-700 hover:to-indigo-800 transition-all duration-200 text-white py-3 rounded-xl font-bold text-xs shadow-md shadow-indigo-100 hover:shadow-indigo-200 active:scale-[0.99] flex items-center justify-center gap-2 cursor-pointer";
            applyBtn.innerHTML = `
                <i class="fa-regular fa-heart text-sm"></i>
                <span>Apply for Adoption</span>
            `;
        }
    } catch (err) {
        console.error("Error checking application status:", err);
    }
}

async function openPetModal(pet){
   
    window.currentPet = pet;
    const applyBtn = document.getElementById("applyModalBtn");
    if (applyBtn) {
        applyBtn.dataset.petId = pet.id || pet.animal_id; 
    }
    
    modalPetImages = Array.isArray(pet.images) && pet.images.length
        ? pet.images
        : [pet.img || fallbackPetImage];
    modalPetImageIndex = 0;
    showModalPetImage();
    document.getElementById("modalName").textContent = pet.name;
    document.getElementById("modalSpecies").textContent = pet.species;
    document.getElementById("modalGender").textContent = pet.gender;
    document.getElementById("modalAge").textContent = pet.age;
    document.getElementById("modalOrganization").textContent = pet.organization || "Unknown Organization";

    // ======================
    // Adoption Status
    // ======================
    const statusBadge = document.getElementById("modalStatus");

    statusBadge.className =
        "flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold";

    switch (pet.status) {

        case "Available":
            statusBadge.textContent = "Available";
            statusBadge.classList.add(
                "bg-emerald-50",
                "border",
                "border-emerald-200",
                "text-emerald-800"
            );
            break;

        case "Pending":
            statusBadge.textContent = "Adoption in Progress";
            statusBadge.classList.add(
                "bg-yellow-50",
                "border",
                "border-yellow-200",
                "text-yellow-800"
            );
            break;

        case "Adopted":
            statusBadge.textContent = "Successfully Adopted";
            statusBadge.classList.add(
                "bg-blue-50",
                "border",
                "border-blue-200",
                "text-blue-800"
            );
            break;

        case "Archived":
            statusBadge.textContent = "No Longer Listed";
            statusBadge.classList.add(
                "bg-slate-100",
                "border",
                "border-slate-300",
                "text-slate-700"
            );
            break;

        default:
            statusBadge.textContent = "Unknown";
            statusBadge.classList.add(
                "bg-gray-50",
                "border",
                "border-gray-200",
                "text-gray-700"
            );
    }
    // ======================
    // Health Status
    // ======================
    const healthBadge = document.getElementById("modalHealth");

    healthBadge.className =
        "flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium";

    switch (pet.health) {

        case "Healthy":
            healthBadge.textContent = "Excellent Condition";
            healthBadge.classList.add(
                "bg-emerald-50",
                "border",
                "border-emerald-200",
                "text-emerald-800"
            );
            break;

        case "Recovered":
            healthBadge.textContent = "Recovered";
            healthBadge.classList.add(
                "bg-green-50",
                "border",
                "border-green-200",
                "text-green-700"
            );
            break;

        case "Under Treatment":
            healthBadge.textContent = "Under Treatment";
            healthBadge.classList.add(
                "bg-yellow-50",
                "border",
                "border-yellow-200",
                "text-yellow-800"
            );
            break;

        case "Sick":
            healthBadge.textContent = "Needs Extra Care";
            healthBadge.classList.add(
                "bg-red-50",
                "border",
                "border-red-200",
                "text-red-700"
            );
            break;

        default:
            healthBadge.textContent = "Unknown";
            healthBadge.classList.add(
                "bg-gray-50",
                "border",
                "border-gray-200",
                "text-gray-700"
            );
    }
    // ======================
    // Vaccination Status
    // ======================
    const vaccinationBadge = document.getElementById("modalVaccination");

    vaccinationBadge.className =
        "flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium";

    switch (pet.vaccination) {

        case "Vaccinated":
            vaccinationBadge.textContent = "Vaccinated";
            vaccinationBadge.classList.add(
                "bg-blue-50",
                "border",
                "border-blue-200",
                "text-blue-700"
            );
            break;

        case "Not Vaccinated":
            vaccinationBadge.textContent = "Not Yet Vaccinated";
            vaccinationBadge.classList.add(
                "bg-orange-50",
                "border",
                "border-orange-200",
                "text-orange-700"
            );
            break;

        case "Unknown":
            vaccinationBadge.textContent = "Vaccination Unknown";
            vaccinationBadge.classList.add(
                "bg-slate-100",
                "border",
                "border-slate-300",
                "text-slate-700"
            );
            break;

        default:
            vaccinationBadge.textContent = "Unknown";
            vaccinationBadge.classList.add(
                "bg-gray-50",
                "border",
                "border-gray-200",
                "text-gray-700"
            );
    }
    // Behavior
    document.getElementById("modalBehavior").textContent = pet.behavior || "No description.";

    renderMedicalHistory(pet.medical_history);
        // const tags = document.getElementById("modalTags");

    await checkPetApplicationStatus(pet.animal_id);

    document.getElementById("viewPetModal").classList.remove("hidden");
    document.getElementById("viewPetModal").classList.add("flex");
    document.getElementById("viewPetModal").classList.remove("hidden");
    document.getElementById("viewPetModal").classList.add("flex");

}

function renderMedicalHistory(history) {
    const tbody = document.getElementById("modalMedicalBody");
    tbody.innerHTML = "";
    if (!history || history.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="3"
                    class="text-center p-6 text-gray-400">
                    No medical records.
                </td>
            </tr>
        `;
        return;
    }

    history.forEach(record => {
        const date = record.administered_date
            ? new Date(record.administered_date).toLocaleDateString("en-US", {
                year: "numeric",
                month: "long",
                day: "numeric"
            })
            : "-";

        tbody.innerHTML += `
            <tr class="border-t hover:bg-gray-50">
                <td class="p-3">
                    ${escapeHTML(record.treatment)}
                </td>
                <td class="p-3">
                    ${date}
                </td>
                <td class="p-3">
                    ${escapeHTML(record.administered_by)}
                </td>
            </tr>
        `;
    });
}

function closePetModal(){

    document.getElementById("viewPetModal").classList.add("hidden");

    document.getElementById("viewPetModal").classList.remove("flex");
}

// Helper para hintayin munang lumabas ang options bago i-set ang value
async function selectOptionWhenReady(selectElement, targetValue, maxAttempts = 30) {
    for (let i = 0; i < maxAttempts; i++) {
        const optionExists = Array.from(selectElement.options).some(opt => opt.value === targetValue);
        if (optionExists) {
            selectElement.value = targetValue;
            selectElement.dispatchEvent(new Event('change'));
            return true;
        }
        await new Promise(resolve => setTimeout(resolve, 100)); // Hintay ng 100ms bago ulitin
    }
    return false;
}

// Function para i-fetch at i-auto-fill ang Profile Information ng User
async function autoFillUserProfile() {
    try {
        const response = await fetch('/api/user/profile', { credentials: 'include' });
        if (!response.ok) return;

        const user = await response.json();

        // 1. Full Name (Pinagsamang first_name at last_name)
        const fullNameInput = document.getElementById('app-fullname');
        if (fullNameInput && (user.first_name || user.last_name)) {
            fullNameInput.value = `${user.first_name || ''} ${user.last_name || ''}`.trim();
        }

        // 2. Phone / Mobile Number
        const phoneInput = document.getElementById('app-phone');
        if (phoneInput && user.phone_number) {
            phoneInput.value = user.phone_number;
        }

        // 3. Email Address
        const emailInput = document.getElementById('app-email');
        if (emailInput && user.email) {
            emailInput.value = user.email;
        }

        // 4. Street Address / House No.
        const streetInput = document.getElementById('app-street');
        if (streetInput && user.street_address) {
            streetInput.value = user.street_address;
        }

        // 5. Zip Code
        const zipInput = document.getElementById('app-zip');
        if (zipInput && user.zip_code) {
            zipInput.value = user.zip_code;
            // Trigger input event para mag-update ang live validation ng ZIP code
            zipInput.dispatchEvent(new Event('input'));
        }

        // 6. Civil Status
        const civilSelect = document.getElementById('app-civil');
        if (civilSelect && user.civil_status) {
            civilSelect.value = user.civil_status;
        }

        // 7. Age (Kukwentahin batay sa birthday kung mayroon)
        const ageInput = document.getElementById('app-age');
        if (ageInput && user.birthday) {
            const birthDate = new Date(user.birthday);
            const ageDifMs = Date.now() - birthDate.getTime();
            const ageDate = new Date(ageDifMs);
            const calculatedAge = Math.abs(ageDate.getUTCFullYear() - 1970);
            ageInput.value = calculatedAge;
        }

        // 8. Occupation
        const occupationInput = document.getElementById('app-occupation');
        if (occupationInput && user.occupation) {
            occupationInput.value = user.occupation;
        }

        // =========================================================
        // 9. CASCADING ADDRESS AUTO-FILL (Region -> Province -> City -> Barangay)
        // =========================================================
        if (typeof window.applyAddressCascade === 'function') {
            await window.applyAddressCascade({
                region: user.region,
                province: user.province,
                city: user.city,
                barangay: user.barangay
            });
        } else {
            console.warn("autoFillUserProfile: window.applyAddressCascade is not available; skipping address cascade auto-fill.");
        }

    } catch (err) {
        console.error("Error auto-filling user profile:", err);
    }
}

document.addEventListener("DOMContentLoaded", async () => {
    // Wait until sidebar + header are loaded
    if (typeof loadSidebar === 'function') {
        await loadSidebar();
    }
    // ==========================================================
    // PHILIPPINE ADDRESS CASCADING (Region -> Province -> City -> Barangay)
    // ==========================================================
    const streetInput = document.getElementById('app-street');
    const regionSelect = document.getElementById('app-region');
    const provinceSelect = document.getElementById('app-province');
    const citySelect = document.getElementById('app-city');
    const barangaySelect = document.getElementById('app-barangay');
    const zipInput = document.getElementById('app-zip');
    const zipHelper = document.getElementById('app-zip-helper');
    const zipRegex = /^\d{4}$/;
    const fullAddressHidden = document.getElementById('app-address');

    let appRegionsData = [];
    let appProvincesData = [];
    let appCitiesData = [];
    let appBarangaysData = [];

    async function loadAppRegions() {
        try {
            regionSelect.innerHTML = '<option value="">Loading regions...</option>';
            const res = await fetch('/data/regions.json');
            appRegionsData = await res.json();

            regionSelect.innerHTML = '<option value="">Select Region</option>';
            appRegionsData.forEach(reg => {
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

    async function loadProvincesForRegion(regCode, fallbackName) {
        if (!provinceSelect) return;
        provinceSelect.innerHTML = '<option value="">Loading provinces...</option>';
        provinceSelect.disabled = true;
        if (citySelect) { citySelect.innerHTML = '<option value="">Select City / Municipality</option>'; citySelect.disabled = true; }
        if (barangaySelect) { barangaySelect.innerHTML = '<option value="">Select Barangay</option>'; barangaySelect.disabled = true; }

        if (!regCode) {
            provinceSelect.innerHTML = '<option value="">Select Province</option>';
            return;
        }

        try {
            if (appProvincesData.length === 0) {
                const res = await fetch('/data/provinces.json');
                appProvincesData = await res.json();
            }

            let filteredProvinces = appProvincesData.filter(p => p.region_code === regCode);
            filteredProvinces.sort((a, b) => a.province_name.localeCompare(b.province_name));

            if (filteredProvinces.length === 0 && fallbackName) {
                filteredProvinces = [{ province_code: regCode, province_name: fallbackName }];
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
    }

    async function loadCitiesForProvince(provCode, regCode) {
        if (!citySelect) return;
        citySelect.innerHTML = '<option value="">Loading cities...</option>';
        citySelect.disabled = true;
        if (barangaySelect) { 
            barangaySelect.innerHTML = '<option value="">Select Barangay</option>';
            barangaySelect.disabled = true;
        }

        if (!provCode) {
            citySelect.innerHTML = '<option value="">Select City / Municipality</option>';
            return;
        }

        try {
            if (appCitiesData.length === 0) {
                const res = await fetch('/data/cities.json');
                appCitiesData = await res.json();
            }

            const filteredCities = appCitiesData.filter(c => c.province_code === provCode || c.region_desc === regCode);
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
    }

    async function loadBarangaysForCity(cityCode) {
        if (!barangaySelect) return;
        barangaySelect.innerHTML = '<option value="">Loading barangays...</option>';
        barangaySelect.disabled = true;

        if (!cityCode) {
            barangaySelect.innerHTML = '<option value="">Select Barangay</option>';
            return;
        }

        try {
            if (appBarangaysData.length === 0) {
                const res = await fetch('/data/barangays.json');
                appBarangaysData = await res.json();
            }

            const filteredBarangays = appBarangaysData.filter(b => b.city_code === cityCode);
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
    }

    if (regionSelect) {
        regionSelect.addEventListener('change', async function () {
            const selectedOption = this.options[this.selectedIndex];
            const regCode = selectedOption ? selectedOption.dataset.code : null;
            await loadProvincesForRegion(regCode, selectedOption ? selectedOption.value : '');
        });
    }

    if (provinceSelect) {
        provinceSelect.addEventListener('change', async function () {
            const selectedOption = this.options[this.selectedIndex];
            const provCode = selectedOption ? selectedOption.dataset.code : null;
            const regCode = regionSelect.options[regionSelect.selectedIndex]?.dataset.code;
            await loadCitiesForProvince(provCode, regCode);
        });
    }

    if (citySelect) {
        citySelect.addEventListener('change', async function () {
            const selectedOption = this.options[this.selectedIndex];
            const cityCode = selectedOption ? selectedOption.dataset.code : null;
            await loadBarangaysForCity(cityCode);
        });
    }

    await loadAppRegions();

    async function applyAddressCascade({ region, province, city, barangay } = {}) {
        if (!regionSelect) return;
        if (regionSelect.options.length <= 1) {
            await loadAppRegions();
        }

        if (!region) return;
        const regionOption = [...regionSelect.options].find(o => o.value === region);
        if (!regionOption) {
            console.warn("applyAddressCascade: region not found in list:", region);
            return;
        }
        regionSelect.value = region;
        await loadProvincesForRegion(regionOption.dataset.code, region);

        if (!province || !provinceSelect) return;
        const provinceOption = [...provinceSelect.options].find(o => o.value === province);
        if (!provinceOption) {
            console.warn("applyAddressCascade: province not found in list:", province);
            return;
        }
        provinceSelect.value = province;
        await loadCitiesForProvince(provinceOption.dataset.code, regionOption.dataset.code);

        if (!city || !provinceSelect) return;
        const cityOption = [...citySelect.options].find(o => o.value === city);
        if (!cityOption) {
            console.warn("applyAddressCascade: city not found in list:", city);
            return;
        }
        citySelect.value = city;
        await loadBarangaysForCity(cityOption.dataset.code);

        if (!barangay || !barangaySelect) return;
        const barangayOption = [...barangaySelect.options].find(o => o.value === barangay);
        if (barangayOption) {
            barangaySelect.value = barangay;
        } else {
            console.warn("applyAddressCascade: barangay not found in list:", barangay);
        }
    }
    window.applyAddressCascade = applyAddressCascade;

    // ==========================================================
    // PET APPLICATION INITIALIZATION & NAVIGATION
    // ==========================================================
    const params = new URLSearchParams(window.location.search);
    const urlPetId = params.get("petId");
    const sessionPetId = sessionStorage.getItem("autoOpenPetId");

    // Tanggalin ang session key agad para hindi paulit-ulit kapag ni-refresh ang page
    if (sessionPetId) sessionStorage.removeItem("autoOpenPetId");

    // Gamitin alinman sa dalawa ang may laman
    const petId = urlPetId || sessionPetId;

    let isFormOpened = false;
    // let pendingReapplyApp = null; // holds previous application data until the address cascade is ready

    if (petId) {
        try {
            // Check kung may existing application na
            const res = await fetch(`/check-applied/${petId}`, { credentials: 'include' });
            const data = await res.json();

            const inactiveStatuses = ['DECLINED', 'REJECTED', 'CANCELLED'];
            const isInactive = inactiveStatuses.includes((data.status || '').toUpperCase());

            // Kapag galing sa Re-apply button (Declined status) O bago pa lang ang application
            if (data.hasApplied && !isInactive) {
                alert(`You have already submitted an application for this pet (Status: ${data.status}).`);
                window.location.href = "/adoption-hub";
                return; 
            }

            console.log("Opening form for pet:", petId);
            // 2. Palaging buksan muna ang form view para hindi ito maipit sakaling magka-error ang auto-fill
            const hiddenInput = document.getElementById("selectedPetId");
            if (hiddenInput) hiddenInput.value = petId;

            document.getElementById("list-view")?.classList.add("hidden");
            document.getElementById("application-view")?.classList.remove("hidden");

            if (typeof loadTopbar === "function") {
                loadTopbar({
                title: "Adoption Form",
                subtitle: "Please fill out the form below to start your adoption journey."
                });
            }

            isFormOpened = true;

            // 3. I-load ang pet details at profile nang hiwalay para ligtas sa error
            await loadSelectedPet(petId);
            
            try {
                await autoFillUserProfile();
            } catch (profileErr) {
                console.warn("Warning: Could not auto-fill profile data:", profileErr);
            }

            // 4. Kung ito ay re-application, i-load ang dating data
            if (sessionStorage.getItem("isReapply") === "true") {
                sessionStorage.removeItem("isReapply");
                const reapplyDataRaw = sessionStorage.getItem("reapplyData");
                if (reapplyDataRaw) {
                    sessionStorage.removeItem("reapplyData");
                    let pendingReapplyApp = JSON.parse(reapplyDataRaw);
                    autofillAdoptionForm(pendingReapplyApp);   
                    
                    // Update topbar header
                    if (typeof loadTopbar === "function") {
                        loadTopbar({
                            title: "Adoption Form",
                            subtitle: "Please fill out the form below to start your adoption journey."
                        });
                    }
                }
            }

        } catch (err) {
            console.error("Error opening adoption form:", err);
            alert("Unable to open the adoption form. Please try again.");
            window.location.href = "/adoption-hub";
        }
    }

    // Topbar fallback at visibility setup
    requestAnimationFrame(() => {
        if (!isFormOpened && typeof loadTopbar === "function") {
            loadTopbar({
                title: "Adoption Hub",
                subtitle: "Browse available pets, view their profiles, and begin your adoption journey."
            });
        }
        document.body.style.visibility = "visible";
    });

    // Helper function to return to Pet List
    function returnToPetList() {
        // Automatically open the application form if a pet ID is in the URL
        // Hide application form
        document.getElementById("application-view")?.classList.add("hidden");

        //Show the pet list again
        document.getElementById("list-view")?.classList.remove("hidden");

        // I-clear ang selected pet ID para hindi maibalik ang form
        const hiddenInput = document.getElementById("selectedPetId");
        if (hiddenInput) {
            hiddenInput.value = "";
        }

        sessionStorage.removeItem("selectedPetId");
        sessionStorage.removeItem("autoOpenPetId");
        sessionStorage.removeItem("isReapply");
        sessionStorage.removeItem("reapplyData");
        
        window.history.replaceState({}, "", "/adoption-hub");

        //Adoption Hub header
        if (typeof loadTopbar === "function") {
            loadTopbar({
                title: "Adoption Hub",
                subtitle: "Browse available pets, view their profiles, and begin your adoption journey."
            });
        }
    }
        
    async function loadSelectedPet(targetPetId) {
        try {
            const res = await fetch(`/api/pets/${targetPetId}`);
            const pet = await res.json();

            const hiddenPetId = document.getElementById("selectedPetId");
            if (hiddenPetId) hiddenPetId.value = pet.animal_id;

            // document.getElementById("selectedPetImage").src =
            //     `/uploads/pets/${pet.image_path}`;

            const petImg = document.getElementById("selectedPetImage");
            if (petImg) {
            petImg.src = pet.image_path
                ? (
                    pet.image_path.startsWith("http")
                        ? pet.image_path
                        : `/uploads/pets/${pet.image_path}`
                )
                : "/assets/images/no-image.png";
            }

            const petName = document.getElementById("selectedPetName");
            if (petName) petName.textContent = pet.name;

            const petInfo = document.getElementById("selectedPetInfo");
            if (petInfo) petInfo.textContent = `${pet.gender} • ${pet.species} • ${pet.age}`;

            const petOrg = document.getElementById("selectedPetOrg");
            if (petOrg) petOrg.textContent = pet.organization_name;

        } catch (err) {
            console.error("Error fetching pet details:", err);
        }
    }
    function autofillAdoptionForm(app) {
        if (!app) return;
        const e = app.emergency || {};


        document.getElementById("app-intent").value = app.intent || "";
        document.getElementById("app-emergency-name").value = e.name || "";
        document.getElementById("app-emergency-phone").value = e.phone || "";
        document.getElementById("app-emergency-relation").value = e.relation || "";
    }
    // 1. Kapag pinindot ang Apply Button sa Modal
    const applyBtn = document.getElementById('applyModalBtn');
    if (applyBtn) {
        applyBtn.addEventListener("click", async function () {
            // Kung may sariling onclick function (tulad ng view decline reason), huwag buksan ang form
            if (this.onclick) return;
            
            const selectedPetId = window.currentPet?.animal_id;
            if (!selectedPetId) return;

            // I-save ang Pet ID sa JavaScript memory / Session Storage
            sessionStorage.setItem("selectedPetId", selectedPetId);

            // PANATILIHING MALINIS ANG URL (Ise-set sa /adoption-hub nang WALANG query parameters)
            window.history.replaceState({}, "", "/adoption-hub");

            await loadSelectedPet(selectedPetId);
            await autoFillUserProfile();
            closePetModal();

            // Ipakita ang Application Form View
            document.getElementById("list-view")?.classList.add("hidden");
            document.getElementById("application-view")?.classList.remove("hidden");

            if (typeof loadTopbar === "function") {
                loadTopbar({
                    title: "Adoption Form",
                    subtitle: "Please fill out the form below to start your adoption journey."
                });
            }
        });
    }

    // 2. Kapag pinindot ang Back Button mula sa Application Form
    const backBtn = document.getElementById('appBackBtn');
    if (backBtn) {
        backBtn.addEventListener('click', returnToPetList);
    }

    // 3. Kapag pinindot ang Cancel Button sa Form
    const cancelBtn = document.getElementById('appCancelBtn');
    if (cancelBtn) {
        cancelBtn.addEventListener('click', function() {
            const form = document.getElementById('adoptionForm');
            if (form) form.reset(); // I-clear ang mga na-type sa form
            returnToPetList();
        });
    }

    // 4. Input restriction para PH Phone Numbers lamang
    document.querySelectorAll('.ph-phone-input').forEach(input => {
        input.addEventListener('input', (e) => {
            e.target.value = e.target.value.replace(/[^0-9]/g, '');
        });
    });

    // 5. Input restriction para sa Age Field (Whole positive numbers lang, max 2 digits)
    const ageInput = document.getElementById('app-age');
    if (ageInput) {
        ageInput.addEventListener('input', (e) => {
            e.target.value = e.target.value.replace(/[^0-9]/g, '');
            if (e.target.value.length > 2) {
                e.target.value = e.target.value.slice(0, 2);
            }
        });
    }

    // 6. Submit Application Event Handler
    if (zipInput) {
        zipInput.addEventListener('input', function () {
            this.value = this.value.replace(/[^0-9]/g, '').slice(0, 4);

            if (!zipHelper) return;
            if (this.value.length === 0) {
                zipHelper.className = 'text-xs mt-1';
                zipHelper.innerHTML = '';
            } else if (zipRegex.test(this.value)) {
                zipHelper.className = 'text-xs mt-1 text-green-600';
                zipHelper.innerHTML = '<i class="fa-solid fa-circle-check"></i> Valid ZIP code.';
            } else {
                zipHelper.className = 'text-xs mt-1 text-red-500';
                zipHelper.innerHTML = '<i class="fa-solid fa-circle-xmark"></i> Must be exactly 4 digits.';
            }
        });
    }

    // 6b. Combine Street + Barangay + City + Province + Region + Zip into one full_address string
    function buildFullAddress() {
        const street = streetInput?.value.trim();
        const barangay = barangaySelect?.value.trim();
        const city = citySelect?.value.trim();
        const province = provinceSelect?.value.trim();
        const region = regionSelect?.value.trim();
        const zip = zipInput?.value.trim();

        if (!street || !barangay || !city || !province || !region || !zipRegex.test(zip)) {
            if (zipHelper && !zipRegex.test(zip)) {
                zipHelper.className = 'text-xs mt-1 text-red-500';
                zipHelper.innerHTML = '<i class="fa-solid fa-circle-xmark"></i> Must be exactly 4 digits.';
            }
            return '';
        }

        const parts = [
            street,
            `Barangay ${barangay}`,
            city,
            province,
            region,
            zip
        ];

        const fullAddr = parts.join(', ');
        if (fullAddressHidden) fullAddressHidden.value = fullAddr;
        return fullAddr;
    }

    // =====================================================
    // SECURITY: INPUT SANITIZATION & HTML ESCAPING
    // =====================================================

    // Cleans user input without changing normal readable text
    function sanitizeInput(value) {
        if (typeof value !== 'string') return '';

        return value
            .normalize('NFKC')
            .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
            .trim();
    }

    // Escapes user-controlled text before inserting it into HTML
    function escapeHTML(value) {
        if (value === null || value === undefined) return '';

        return String(value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    const adoptionForm = document.getElementById('adoptionForm');
    if (adoptionForm) {
        adoptionForm.addEventListener('submit', async function (e) {
            e.preventDefault();

            // =====================================================
            // ✅ SEUSR-03: HTML5 VALIDATION TRIGGER
            // (Kailangan ito dahil ang e.preventDefault() ay pumipigil
            //  sa default browser validation)
            // =====================================================
            if (!this.checkValidity()) {
                this.reportValidity();
                return;
            }

            // =====================================================
            // ✅ SEUSR-03: CUSTOM VALIDATION FOR TEXTAREA
            // (Hindi supported ng textarea ang `pattern` attribute)
            // =====================================================
            const intentField = document.getElementById('app-intent');
            if (intentField) {
                const intentValue = sanitizeInput(intentField.value);

                // (a) Minimum 20 characters
                if (intentValue.length < 20) {
                    intentField.setCustomValidity('Adoption intent must be at least 20 characters.');
                    intentField.reportValidity();
                    intentField.setCustomValidity('');
                    return;
                }

                // (b) Dangerous patterns — XSS at SQL injection
                const dangerousRegex = /(<script|<\/script|javascript:|onerror\s*=|onload\s*=|onclick\s*=|onmouseover\s*=|onfocus\s*=|onblur\s*=|oninput\s*=|onchange\s*=|onkeydown\s*=|onkeyup\s*=|onkeypress\s*=|<iframe|<img\s|<svg|<object|<embed|<\s*script|'\s*--|;\s*drop\s|;\s*delete\s|;\s*update\s|;\s*insert\s|union\s+select|or\s+1\s*=\s*1|or\s+'1'\s*=\s*'1'|\bexec\s*\(|\bxp_cmdshell\b)/i;

                if (dangerousRegex.test(intentValue)) {
                    // intentField.setCustomValidity('Adoption intent contains invalid or dangerous characters.');
                    // intentField.reportValidity();
                    // intentField.setCustomValidity('');
                    showModal(
                        'Invalid Input',
                        'Adoption intent contains invalid or dangerous characters.',
                        false
                    );
                    return;
                }

                // (c) Gibberish check (5+ sunod-sunod na parehong character)
                if (/(.)\1{4,}/.test(intentValue)) {
                    // intentField.setCustomValidity('Adoption intent looks like gibberish. Please write a proper reason.');
                    // intentField.reportValidity();
                    // intentField.setCustomValidity('');
                    showModal(
                        'Invalid Input',
                        'Adoption intent looks like gibberish. Please write a proper reason.',
                        false
                    );
                    return;
                }
            }

            // =====================================================
            // ✅ SEUSR-03: CUSTOM VALIDATION FOR NAME FIELDS
            // (Extra check — HTML pattern ay hindi laging sapat)
            // =====================================================
            const nameRegex = /^[A-Za-zñÑáéíóúÁÉÍÓÚàèìòùÀÈÌÒÙ\s.'-]{2,100}$/;
            const nameFields = [
                { id: 'app-fullname',       label: 'Full Name' },
                { id: 'app-emergency-name', label: 'Emergency Contact Name' }
            ];

            for (const field of nameFields) {
                const el = document.getElementById(field.id);
                if (!el) continue;

                const val = el.value.trim();

                if (!nameRegex.test(val)) {
                    el.setCustomValidity(`${field.label} contains invalid characters. Letters, spaces, periods, hyphens, and apostrophes only.`);
                    el.reportValidity();
                    el.setCustomValidity('');
                    return;
                }

                if (/(.)\1{4,}/.test(val)) {
                    el.setCustomValidity(`${field.label} looks like gibberish. Please enter a real name.`);
                    el.reportValidity();
                    el.setCustomValidity('');
                    return;
                }
            }

            // =====================================================
            // EXISTING VALIDATION (hindi binago)
            // =====================================================
            const petId = document.getElementById('selectedPetId').value;
            if (!petId) {
                alert("Please select a pet first!");
                return;
            }

            // I-build muna ang full_address bago i-collect ang FormData
            if (!buildFullAddress()) {
                alert("Please complete your address (Street, Region, Province, City, Barangay, Zip Code).");
                return;
            }


            // Kukuha ng lahat ng inputs pati na ang in-upload na file
            const formData = new FormData(this);

            const submitBtn = document.getElementById('appSubmitBtn');
            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.innerText = "Submitting...";
            }

            try {
                const response = await fetch('/api/adoptions/submit-application', {
                    method: 'POST',
                    credentials: 'include',
                    body: formData
                });

                const result = await response.json();

                if (response.ok) {
                    showModal('Success!', result.message, true, () => {
                        window.location.href = "/adoption-hub";
                    });
                } else {
                    // Ipapakita na ngayon ang mismong error mula sa Multer o Database!
                    showModal('Upload Error', result.message || result.error || 'Failed to submit application.', false);
                }
            } catch (error) {
                console.error("Submission catch error:", error);
                showModal('Connection Error', 'Unable to reach the server. Please check your network connection.', false);
            } finally {
                submitBtn.disabled = false;
                submitBtn.innerText = "Submit Application";
            }
        });
    }

});

let modalCallback = null;

function showModal(title, message, isSuccess = true, callback = null) {
    const modal = document.getElementById('customModal');
    const container = document.getElementById('modalContainer');
    const iconContainer = document.getElementById('modalIconContainer');
    const icon = document.getElementById('modalIcon');
    const titleEl = document.getElementById('modalTitle');
    const messageEl = document.getElementById('modalMessage');
    const btn = document.getElementById('modalBtn');

    if (!modal || !container) return;

    titleEl.textContent = title;
    messageEl.textContent = message;
    modalCallback = callback;

    if (isSuccess) {
        // Blue Theme para sa Success
        if (iconContainer) iconContainer.className = "mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-blue-100 text-blue-600";
        if (iconContainer) icon.innerHTML = `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>`;
        if (btn) btn.className = "w-full rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-md transition-all hover:bg-blue-700 active:scale-95";
    } else {
        // Red Theme para sa Error
        if (iconContainer) iconContainer.className = "mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-red-100 text-red-600";
        if (icon) icon.innerHTML = `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>`;
        if (icon) btn.className = "w-full rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white shadow-md transition-all hover:bg-red-700 active:scale-95";
    }

    // Isagawa ang Smooth Pop Animation
    modal.classList.remove('hidden');
    modal.classList.add('flex');
    setTimeout(() => {
        container.classList.remove('scale-95');
        container.classList.add('scale-100');
    }, 10);
}

function closeModal() {
    const modal = document.getElementById('customModal');
    const container = document.getElementById('modalContainer');

    if (!modal || !container) return;

    container.classList.remove('scale-100');
    container.classList.add('scale-95');

    setTimeout(() => {
        modal.classList.remove('flex');
        modal.classList.add('hidden');
        if (modalCallback) modalCallback();
    }, 150);
}
