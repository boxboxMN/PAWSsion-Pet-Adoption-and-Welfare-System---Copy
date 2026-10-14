document.addEventListener('DOMContentLoaded', async function() {
    await loadSidebar();

    requestAnimationFrame(() => {
        loadTopbar({
            title: "In-Kind Donation",
            subtitle: "Support our shelter by donating items and supplies needed for animal care."
        });

        document.body.style.visibility = "visible";
    });

    let organizations = [];
    let selectedOrganization = null;

    const itemNameInput = document.getElementById('itemNameInput');
    const quantityInput = document.getElementById('quantityInput');
    const unitInput     = document.getElementById('unitInput');       // ⭐ NEW
    const termsCheckbox = document.getElementById('termsCheckbox');
    const submitBtn     = document.getElementById('submitInKindBtn');

    // ⭐ Quantity — numbers only, block negatives, decimals, at e/E
    if (quantityInput) {
        quantityInput.addEventListener("input", function () {
            // Alisin ang non-digits
            this.value = this.value.replace(/[^0-9]/g, "");
            // Block 0
            if (this.value === "0") this.value = "";
        });
        quantityInput.addEventListener("keydown", function (e) {
            const blockedKeys = ["-", ".", "e", "E", "+", "Subtract", "Decimal"];
            if (blockedKeys.includes(e.key)) {
                e.preventDefault();
            }
        });
        quantityInput.addEventListener("paste", function (e) {
            const pasted = (e.clipboardData || window.clipboardData).getData("text");
            if (!/^\d+$/.test(pasted.trim())) {
                e.preventDefault();
            }
        });
    }

    const dropoffTitle   = document.getElementById('dropoffTitle');
    const dropoffAddress = document.getElementById('dropoffAddress');
    const dropoffHours   = document.getElementById('dropoffHours');
    const dropoffNotes   = document.getElementById('dropoffNotes');
    const dropoffImg     = document.getElementById('dropoffImg');
    const modal          = document.getElementById("orgModal");
    const closeBtn       = document.getElementById("modalClose");
    const closeBtn2      = document.getElementById("modalCloseBtn");

    const orgName    = document.getElementById("modalOrgName");
    const orgAddress = document.getElementById("modalOrgAddress");
    const orgPhone   = document.getElementById("modalOrgPhone");
    const orgEmail   = document.getElementById("modalOrgEmail");
    const orgMission = document.getElementById("modalOrgMission");

    // ==========================================
    // ITEM NAME VALIDATION (same sa index.js)
    // ==========================================
    function validateItemName(name) {
        const value = (name || '').trim();

        if (!value)
            return { valid: false, reason: 'Please enter the item you wish to donate.' };

        if (value.length < 3)
            return { valid: false, reason: 'Item name is too short. Please enter a valid item name.' };

        if (value.length > 100)
            return { valid: false, reason: 'Item name is too long (max 100 characters).' };

        if (!/^[a-zA-Z0-9\s\-',.()\/&+]+$/.test(value))
            return { valid: false, reason: 'Item name contains invalid characters.' };

        if (!/[a-zA-Z]/.test(value))
            return { valid: false, reason: 'Item name must contain letters.' };

        if (!/[aeiouAEIOU]/.test(value))
            return { valid: false, reason: 'Please enter a valid item name.' };

        // No character repeated 4+ times in a row
        if (/(.)\1{3,}/i.test(value))
            return { valid: false, reason: 'Please enter a valid item name.' };

        // No 5+ consecutive consonants
        if (/[bcdfghjklmnpqrstvwxyzBCDFGHJKLMNPQRSTVWXYZ]{5,}/.test(value))
            return { valid: false, reason: 'Please enter a valid item name.' };

        // Keyboard mash
        if (/(asdf|sdfg|dfgh|fghj|ghjk|hjkl|qwer|wert|erty|rtyu|tyui|yuiop|zxcv|xcvb|cvbn|vbnm)/i
                .test(value.replace(/\s+/g, '')))
            return { valid: false, reason: 'Please enter a valid item name.' };

        // Bawat word (3+ letters) dapat may vowel
        const words = value.split(/[\s\-',.()\/&+]+/).filter(Boolean);
        for (const w of words) {
            const letters = w.replace(/[^a-zA-Z]/g, '');
            if (letters.length >= 3 && !/[aeiouAEIOU]/.test(letters)) {
                return { valid: false, reason: 'Please enter a valid item name.' };
            }
        }

        return { valid: true };
    }

    function getValidImageUrl(imagePath, fallbackUrl = "", legacyFolder = "/uploads/") {
        if (typeof imagePath !== "string") {
            return fallbackUrl;
        }
        const image = imagePath.trim();
        if (!image || image === "null" || image === "undefined") {
            return fallbackUrl;
        }
        // Cloudinary and other complete URLs must be returned unchanged.
        if (/^https?:\/\//i.test(image)) {
            return image;
        }
        // Preserve paths that already begin with /uploads/, /assets/, etc.
        if (image.startsWith("/")) {
            return image;
        }
        // Only prepend the legacy folder to a bare filename.
        return `${legacyFolder.replace(/\/+$/, "")}/${encodeURIComponent(image)}`;
    }
    async function loadOrganizations() {
        try {
            const response = await fetch("/api/organizations");
            const allOrganizations = await response.json();

            organizations = (Array.isArray(allOrganizations) ? allOrganizations : []).filter(org =>
                org.dropoff_address && org.dropoff_address.trim() !== ""
            );

            const container = document.getElementById("orgContainer");
            if (!container) return;

            container.innerHTML = "";

            if (!organizations || organizations.length === 0) {
                container.innerHTML = `<p class="text-gray-500 text-center col-span-3">No organizations currently accept in-kind donations. Please check back later.</p>`;
                return;
            }

            organizations.forEach(org => {
                console.log("ORG PROFILE PIC:", org.organization_name, org.profile_pic);
                
                const profileImg = getValidImageUrl( org.profile_pic,"https://via.placeholder.com/64","/uploads/orgs");

                container.innerHTML += `
                    <div class="org-card border rounded-xl p-4 relative cursor-pointer flex flex-col items-center text-center justify-between bg-white" data-id="${org.organization_id}">
                        <div class="checkmark absolute top-0 right-0 bg-blue-600 text-white text-xs px-2 py-1 rounded-bl-lg">✓</div>
                        <div class="w-full flex flex-col items-center pt-2">
                            <img
                                src="${profileImg}"
                                alt="${org.organization_name || 'Organization'}"
                                onerror="this.onerror=null; this.src='https://via.placeholder.com/64';"
                                class="w-16 h-16 rounded-full object-cover mb-3"
                            >
                            <h3 class="font-semibold text-gray-800 mb-2">${org.organization_name}</h3>
                        </div>
                        <div class="w-full pt-3 border-t border-gray-100 mt-2">
                            <p class="view-profile-btn text-xs text-blue-600 hover:text-blue-800 font-medium transition inline-flex items-center gap-1 cursor-pointer">
                                View Profile →
                            </p>
                        </div>
                    </div>
                `;
            });

            initializeCards();

        } catch (err) {
            console.error("Error loading organizations:", err);
        }
    }

    function initializeCards() {
        document.querySelectorAll(".org-card").forEach(card => {
            card.addEventListener("click", function (e) {
                if (e.target.closest(".view-profile-btn")) return;

                document.querySelectorAll(".org-card").forEach(c => c.classList.remove("selected"));
                this.classList.add("selected");

                selectedOrganization = this.dataset.id;
                updateDropoffInfo(selectedOrganization);
            });

            const viewBtn = card.querySelector(".view-profile-btn");
            if (viewBtn) {
                viewBtn.addEventListener("click", function (e) {
                    e.stopPropagation();
                    openModal(card.dataset.id);
                });
            }
        });
    }

    function updateDropoffInfo(id) {
        const org = organizations.find(o => o.organization_id == id);
        if (!org) return;

        if (dropoffTitle)   dropoffTitle.textContent = org.dropoff_location_name || "";
        if (dropoffAddress) dropoffAddress.textContent = org.dropoff_address || "";
        if (dropoffHours)   dropoffHours.textContent = org.dropoff_hours || "";
        if (dropoffNotes)   dropoffNotes.textContent = org.dropoff_notes || "";

        if (dropoffImg) {
            if (org.dropoff_image) {
                const dropoffImgUrl = getValidImageUrl(org.dropoff_image, "/assets/images/cspc.png");
                dropoffImg.src = dropoffImgUrl;
                dropoffImg.style.display = "block";
            } else {
                dropoffImg.src = "";
                dropoffImg.style.display = "none";
            }
        }
    }

    async function openModal(id) {
        const org = organizations.find(o => o.organization_id == id);
        if (!org || !modal) return;

        if (orgName) orgName.textContent = org.organization_name;
        if (orgAddress) orgAddress.innerHTML = `<i class="fa-solid fa-location-dot"></i> ${org.city || ''}, ${org.province || ''}`;
        if (orgPhone) orgPhone.textContent = org.contact_number || "N/A";
        if (orgEmail) orgEmail.textContent = org.email || "N/A";
        if (orgMission) orgMission.textContent = org.description || "No description available.";

        try {
            const response = await fetch(`/api/organizations/${id}`);
            if (response.ok) {
                const fullOrg = await response.json();

                if (orgName) orgName.textContent = fullOrg.organization_name || org.organization_name;
                if (orgAddress) {
                    const addressText = fullOrg.city && fullOrg.province
                        ? `${fullOrg.city}, ${fullOrg.province}`
                        : (fullOrg.address || `${org.city || ''}, ${org.province || ''}`);
                    orgAddress.innerHTML = `<i class="fa-solid fa-location-dot"></i> ${addressText}`;
                }
                if (orgPhone) orgPhone.textContent = fullOrg.contact_number || fullOrg.phone || "N/A";
                if (orgEmail) orgEmail.textContent = fullOrg.email || fullOrg.org_email || "N/A";
                if (orgMission) orgMission.textContent = fullOrg.description || fullOrg.mission || "No description available.";

                const logoElement = document.getElementById("modalOrgLogo");
                const logoPath = fullOrg.logo || fullOrg.avatar || fullOrg.image || org.profile_pic || org.logo;

                if (logoElement && logoPath) {
                    const validLogoUrl = getValidImageUrl(logoPath, "");
                    logoElement.outerHTML = `<img id="modalOrgLogo" src="${validLogoUrl}" alt="Org Logo" class="w-full h-full object-cover rounded-full">`;
                } else if (logoElement) {
                    logoElement.outerHTML = `<i id="modalOrgLogo" class="fa-solid fa-building-user"></i>`;
                }
            }
        } catch (err) {
            console.error("Error fetching live organization profile:", err);
        }

        modal.classList.add("active");
        document.body.style.overflow = "hidden";
    }

    function closeModal() {
        if (!modal) return;
        modal.classList.remove("active");
        document.body.style.overflow = "";
    }

    if (closeBtn)  closeBtn.addEventListener("click", closeModal);
    if (closeBtn2) closeBtn2.addEventListener("click", closeModal);

    if (modal) {
        modal.addEventListener("click", function (e) {
            if (e.target === modal) closeModal();
        });
    }

    document.addEventListener("keydown", function (e) {
        if (e.key === "Escape") closeModal();
    });

    // ==========================================
    // IN-KIND SUBMISSION
    // ==========================================
    if (submitBtn) {
        submitBtn.addEventListener("click", async function (e) {
            e.preventDefault();

            if (!selectedOrganization) {
                showToast("Please select an organization to donate to.", "error");
                return;
            }

            const org = organizations.find(o => o.organization_id == selectedOrganization);
            if (!org || !org.dropoff_address || org.dropoff_address.trim() === "") {
                showToast("This organization hasn't provided drop-off location details yet. In-kind donation is temporarily unavailable.", "error");
                return;
            }

            const finalItemName = itemNameInput ? itemNameInput.value.trim() : "";
            const quantity      = quantityInput ? quantityInput.value.trim() : "";
            const unit          = unitInput     ? unitInput.value             : "pcs";

            // ⭐ Item name validation (same sa index.js)
            const itemCheck = validateItemName(finalItemName);
            if (!itemCheck.valid) {
                showToast(itemCheck.reason, "error");
                return;
            }

            // ⭐ Quantity validation — positive whole number
            const strictQuantityPattern = /^[1-9]\d*$/;
            if (!quantity || !strictQuantityPattern.test(quantity)) {
                showToast("Please enter a valid quantity (numbers only, greater than zero).", "error");
                return;
            }

            // ⭐ Unit validation — dapat nasa allowed list
            const allowedUnits = ["pcs", "kg", "packs", "boxes", "sacks", "bottles", "liters"];
            if (!allowedUnits.includes(unit)) {
                showToast("Please select a valid unit.", "error");
                return;
            }

            if (termsCheckbox && !termsCheckbox.checked) {
                showToast("You must agree to the in-kind donation guidelines before submitting.", "error");
                return;
            }

            // ⭐ Payload with unit
            const payload = {
                organization_id: selectedOrganization,
                item_name: finalItemName,
                quantity: parseInt(quantity, 10),
                unit: unit
            };

            console.log("[In-Kind] payload:", payload);

            const originalBtnText = submitBtn.textContent;

            try {
                submitBtn.disabled = true;
                submitBtn.textContent = "Submitting...";

                const res = await fetch("/api/user/donation/in-kind", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(payload)
                });

                const data = await res.json();

                if (data.success) {
                    showToast(data.message || "Thank you! Your in-kind donation offer has been submitted.", "success");

                    // Reset form
                    if (itemNameInput) itemNameInput.value = "";
                    if (quantityInput) quantityInput.value = "";
                    if (unitInput)     unitInput.value = "pcs";
                    if (termsCheckbox) termsCheckbox.checked = false;

                    setTimeout(() => window.location.reload(), 1500);
                } else {
                    showToast(data.error || data.message || "Unable to process donation.", "error");
                }
            } catch (err) {
                console.error("Submission Error:", err);
                showToast("An error occurred while connecting to the server.", "error");
            } finally {
                submitBtn.disabled = false;
                submitBtn.textContent = originalBtnText;
            }
        });
    }

    function showToast(message, type = "error") {
        const container = document.getElementById("toastContainer");
        if (!container) return;

        const isSuccess = type === "success";
        const bgColor   = isSuccess ? "bg-emerald-600" : "bg-rose-600";
        const iconClass = isSuccess ? "fa-circle-check" : "fa-circle-exclamation";

        const toast = document.createElement("div");
        toast.className = `${bgColor} text-white px-5 py-3.5 rounded-xl shadow-xl flex items-center gap-3 transition-all duration-300 transform translate-y-5 opacity-0 pointer-events-auto max-w-md`;

        toast.innerHTML = `
            <i class="fa-solid ${iconClass} text-lg"></i>
            <span class="text-sm font-medium leading-snug">${message}</span>
            <button onclick="this.parentElement.remove()" class="ml-auto text-white/70 hover:text-white p-1">
                <i class="fa-solid fa-xmark"></i>
            </button>
        `;

        container.appendChild(toast);
        setTimeout(() => {
            toast.classList.remove("translate-y-5", "opacity-0");
        }, 10);

        setTimeout(() => {
            toast.classList.add("translate-y-5", "opacity-0");
            setTimeout(() => toast.remove(), 300);
        }, 4000);
    }

    // Initialization
    await loadOrganizations();
    if (organizations.length > 0) {
        selectedOrganization = organizations[0].organization_id;
        updateDropoffInfo(selectedOrganization);

        const targetCard = document.querySelector(`.org-card[data-id="${selectedOrganization}"]`);
        if (targetCard) {
            targetCard.classList.add("selected");
        }
    }
});