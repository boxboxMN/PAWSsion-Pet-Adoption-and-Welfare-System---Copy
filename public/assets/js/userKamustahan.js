let petsData = [];
let selectedFiles = []; 
let selectedEditFile = null;
let fetchedUpdates = []; // Cache para sa Edit Modal
let dueUpdatesList = []; // Cache para sa Kamustahan Due

// ===================================================
// FILTER VARIABLES
// ===================================================
let historySearchQuery = '';
let historyStatusFilter = 'all';

// ===================================================
// CHECKLIST DATA DEFINITIONS
// ===================================================
const HEALTH_CHECKLIST = {
    appetite: {
        label: 'Appetite', icon: 'fa-utensils',
        options: [
            { value: 'normal',    label: 'Normal' },
            { value: 'reduced',   label: 'Reduced' },
            { value: 'refusing',  label: 'Refusing to eat (24h+)' }
        ]
    },
    water: {
        label: 'Water Intake', icon: 'fa-droplet',
        options: [
            { value: 'normal',    label: 'Normal' },
            { value: 'reduced',   label: 'Drinking less' },
            { value: 'excessive', label: 'Excessive thirst' }
        ]
    },
    litter: {
        label: 'Litter Box / Stool', icon: 'fa-broom',
        options: [
            { value: 'normal',      label: 'Normal' },
            { value: 'diarrhea',    label: 'Diarrhea' },
            { value: 'constipated', label: 'Constipated' },
            { value: 'blood',       label: 'Blood in stool' },
            { value: 'not_using',   label: 'Not using litter box' }
        ]
    },
    vomiting: {
        label: 'Vomiting', icon: 'fa-face-frown',
        options: [
            { value: 'none',       label: 'None' },
            { value: 'hairball',   label: 'Occasional hairballs' },
            { value: 'frequent',   label: 'Frequent vomiting' },
            { value: 'with_blood', label: 'Vomiting with blood' }
        ]
    },
    activity: {
        label: 'Activity Level', icon: 'fa-person-running',
        options: [
            { value: 'playful',   label: 'Playful & Active' },
            { value: 'lethargic', label: 'Lethargic / Weak' },
            { value: 'hyper',     label: 'Restless / Hyperactive' }
        ]
    },
    respiratory: {
        label: 'Breathing / Eyes / Nose', icon: 'fa-lungs',
        options: [
            { value: 'normal',   label: 'Normal' },
            { value: 'sneezing', label: 'Sneezing / Discharge' },
            { value: 'labored',  label: 'Labored breathing' }
        ]
    },
    grooming: {
        label: 'Grooming / Coat', icon: 'fa-brush',
        options: [
            { value: 'good',      label: 'Clean & well-groomed' },
            { value: 'matted',    label: 'Matted / Dull coat' },
            { value: 'excessive', label: 'Over-grooming / Hair loss' }
        ]
    }
};

const BEHAVIOR_CHECKLIST = {
    socialization: {
        label: 'Socialization', icon: 'fa-users',
        options: [
            { value: 'friendly',   label: 'Friendly & Affectionate' },
            { value: 'shy',        label: 'Shy but approaching' },
            { value: 'withdrawn',  label: 'Withdrawn / Avoiding' },
            { value: 'aggressive', label: 'Aggressive / Biting' }
        ]
    },
    hiding: {
        label: 'Hiding Behavior', icon: 'fa-eye-slash',
        options: [
            { value: 'rarely',    label: 'Rarely hides' },
            { value: 'sometimes', label: 'Sometimes hides' },
            { value: 'frequent',  label: 'Hides all the time' }
        ]
    },
    anxiety: {
        label: 'Anxiety / Stress', icon: 'fa-heart-pulse',
        options: [
            { value: 'none',   label: 'None' },
            { value: 'mild',   label: 'Mild (pacing, meowing)' },
            { value: 'severe', label: 'Severe (panic, destructive)' }
        ]
    },
    destructive: {
        label: 'Destructive Behavior', icon: 'fa-hammer',
        options: [
            { value: 'none',   label: 'None' },
            { value: 'mild',   label: 'Mild (scratching furniture)' },
            { value: 'severe', label: 'Severe (damaging things)' }
        ]
    },
    vocalization: {
        label: 'Vocalization', icon: 'fa-volume-high',
        options: [
            { value: 'normal',    label: 'Normal' },
            { value: 'excessive', label: 'Excessive meowing/barking' },
            { value: 'hissing',   label: 'Hissing / Growling' }
        ]
    },
    sleep: {
        label: 'Sleep Pattern', icon: 'fa-bed',
        options: [
            { value: 'normal',    label: 'Normal' },
            { value: 'restless',  label: 'Restless / Awake at night' },
            { value: 'excessive', label: 'Sleeping too much' }
        ]
    }
};

// ⭐ Emergency symptoms na mag-shoshow ng non-blocking vet nudge
const EMERGENCY_OPTIONS = new Set([
    'refusing', 'excessive', 'diarrhea', 'constipated', 'blood', 'with_blood', 'lethargic', 'labored'
]);

const healthAnswers = {};
const behaviorAnswers = {};

// ===================================================
// INITIALIZATION
// ===================================================
document.addEventListener("DOMContentLoaded", async () => {
    await loadSidebar();
    requestAnimationFrame(() => {
        loadTopbar({ title: "Kamustahan", subtitle: "Share updates about your adopted pet." });
        document.body.style.visibility = "visible";
    });

    renderChecklist('healthChecklistGrid', HEALTH_CHECKLIST, healthAnswers, '#059669', '#ecfdf5');
    renderChecklist('behaviorChecklistGrid', BEHAVIOR_CHECKLIST, behaviorAnswers, '#4f46e5', '#eef2ff');

    document.getElementById('vetVisitToggle')?.addEventListener('change', (e) => {
        document.getElementById('vetVisitFields')?.classList.toggle('hidden', !e.target.checked);
    });

    const phTimeOptions = { timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit' };
    const formatter = new Intl.DateTimeFormat('en-CA', phTimeOptions);
    document.getElementById('updateDate').value = formatter.format(new Date());

       // 1. Fetch Kamustahan Due Updates FIRST (Para magamit sa Dropdown)
    try {
        const dueRes = await fetch('/api/user/kamustahan-due');
        const dueData = await dueRes.json();

        if (dueData.success) {
            dueUpdatesList = dueData.dueUpdates || [];
            window.myDueUpdates = dueUpdatesList;

            // ⭐ Timezone-safe na "Today" sa PH Time (YYYY-MM-DD)
            const todayStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
            
            // ⭐ I-filter lang ang mga TOTOONG DUE NA (today or past) para sa banner
            const actuallyDue = dueUpdatesList.filter(u => {
                if (!u.scheduled_date) return false;
                const schedStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(u.scheduled_date));
                return schedStr <= todayStr;
            });

            if (actuallyDue.length > 0) {
                const banner = document.getElementById('kamustahanDueBanner');
                const bannerText = document.getElementById('kamustahanDueText');

                const names = actuallyDue.map(u => u.pet_name).join(", ");
                bannerText.textContent = actuallyDue.length === 1
                    ? `An update for ${names} is due. Please share how they're doing!`
                    : `Updates are due for: ${names}. Please share how they're doing!`;

                banner.classList.remove('hidden');

                banner.addEventListener('click', () => {
                    const firstDue = actuallyDue[0];
                    const petSelect = document.getElementById('petSelect');
                    if (petSelect) {
                        petSelect.value = firstDue.animal_id;
                        petSelect.dispatchEvent(new Event('change'));
                        petSelect.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    }
                });
                banner.classList.add('cursor-pointer', 'hover:bg-amber-100', 'transition');
            }
        }
    } catch (err) {
        console.error("Error loading due Kamustahan updates:", err);
    }

    // 2. Fetch Approved Pets Data (At lagyan ng Due Indicator)
    try {
        const res = await fetch('/api/user/approved-pets');
        const data = await res.json();
        const petSelect = document.getElementById('petSelect');

        if (data.success && data.pets.length > 0) {
            petsData = data.pets;
            petSelect.innerHTML = '<option value="">-- Choose your adopted pet --</option>';

            // ⭐ Gumawa ng dynamic notice para sa deadline
            const dateContainer = document.getElementById('updateDate').parentElement;
            let deadlineNotice = document.getElementById('dueDeadlineNotice');
            if (!deadlineNotice) {
                deadlineNotice = document.createElement('div');
                deadlineNotice.id = 'dueDeadlineNotice';
                deadlineNotice.className = 'hidden mt-2 text-xs font-bold text-amber-700 bg-amber-50 p-2.5 rounded-xl border border-amber-200 flex items-center gap-1.5 shadow-sm';
                deadlineNotice.innerHTML = '<i class="fas fa-calendar-check"></i> Deadline to submit: <span id="dueDeadlineDate"></span>';
                dateContainer.appendChild(deadlineNotice);
            }

                petsData.forEach(pet => {
                const opt = document.createElement('option');
                opt.value = pet.animal_id;
                
                const isDue = dueUpdatesList.some(u => u.animal_id == pet.animal_id);
                
                const petName = pet.name || pet.pet_name || 'Unknown Pet';
                
                opt.textContent = petName + (isDue ? ' 🟡 (Update Needed)' : '');
                
                petSelect.appendChild(opt);
            });

            petSelect.addEventListener('change', (e) => {
                const selectedPet = petsData.find(p => p.animal_id == e.target.value);
                document.getElementById('orgIdInput').value = selectedPet ? selectedPet.organization_id : '';

                // ⭐ Ipakita ang Deadline kapag pinili ang pet
                const notice = document.getElementById('dueDeadlineNotice');
                const noticeDate = document.getElementById('dueDeadlineDate');
                
                if (selectedPet) {
                    const dueUpdate = dueUpdatesList.find(u => u.animal_id == selectedPet.animal_id);
                    
                    if (dueUpdate && dueUpdate.scheduled_date) {
                        const formatted = new Date(dueUpdate.scheduled_date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
                        if (noticeDate) noticeDate.textContent = formatted;
                        if (notice) notice.classList.remove('hidden');
                    } else {
                        if (notice) notice.classList.add('hidden');
                    }
                } else {
                    if (notice) notice.classList.add('hidden');
                }
            });
        } else {
            petSelect.innerHTML = '<option value="">No approved adopted pets available.</option>';
        }
    } catch (err) {
        console.error("Error loading approved pets:", err);
    }

    // 3. Photo input (Multiple Uploads)
    const photoInput = document.getElementById('photoInput');
    photoInput.addEventListener('change', (e) => {
        const files = Array.from(e.target.files);
        
        // Limitahan sa 5 photos
        if (selectedFiles.length + files.length > 5) {
            showUiAlert("Maximum of 5 photos only.", "error");
            return;
        }
        
        selectedFiles.push(...files);
        renderPreview(); 
        e.target.value = '';
    });

    // Edit Photo input
    const editPhotoInput = document.getElementById('editPhotoInput');
    if (editPhotoInput) {
        editPhotoInput.addEventListener('change', (e) => {
            const files = e.target.files;
            if (files && files.length > 0) {
                selectedEditFile = files[0];
                const reader = new FileReader();
                reader.onload = function(event) {
                    document.getElementById('editCurrentPhotoPreview').src = event.target.result;
                }
                reader.readAsDataURL(selectedEditFile);
            }
        });
    }

    // 4. FORM SUBMISSION (WITH STRICT VALIDATION & SANITATION)
    document.getElementById('kamustahanForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        hideUiAlert();

        // ⭐ 1. Check kung may napiling Pet
        const petSelect = document.getElementById('petSelect');
        if (!petSelect.value) {
            showUiAlert("Please select an adopted pet.", "error");
            petSelect.focus();
            return;
        }

        // ⭐ 2. Check kung may Photo
        if (selectedFiles.length === 0) {
            showUiAlert("Please upload at least one photo of your pet.", "error");
            return;
        }

        // ⭐ 3. Validate Health Checklist (Kumpleto ba?)
        const missingHealth = Object.keys(HEALTH_CHECKLIST).filter(key => !healthAnswers[key]);
        if (missingHealth.length > 0) {
            showUiAlert(`Please answer all Health Check items. (Missing: ${missingHealth.length})`, "error");
            return;
        }

        // ⭐ 4. Validate Behavior Checklist (Kumpleto ba?)
        const missingBehavior = Object.keys(BEHAVIOR_CHECKLIST).filter(key => !behaviorAnswers[key]);
        if (missingBehavior.length > 0) {
            showUiAlert(`Please answer all Behavior Check items. (Missing: ${missingBehavior.length})`, "error");
            return;
        }

        // ⭐ 5. Validate Vet Visit (Kung naka-check, kailangan may Date)
        const isVetVisit = document.getElementById('vetVisitToggle').checked;
        const vetDate = document.getElementById('vetVisitDate').value;
        if (isVetVisit && !vetDate) {
            showUiAlert("Please provide the date of the vet visit.", "error");
            return;
        }

        const submitBtn = document.getElementById('submitBtn');
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i> Submitting Report...';

        const formData = new FormData(e.target);
        
        // Append all photos
        selectedFiles.forEach(file => {
            formData.append('photos', file);
        });

        // ⭐ 6. Sanitize Text Inputs (Trim at Limitahan)
        const rawConcerns = document.getElementById('petConcerns')?.value || '';
        const rawDiagnosis = document.getElementById('vetDiagnosis')?.value || '';

        const cleanConcerns = rawConcerns.trim().slice(0, 1000);
        const cleanDiagnosis = rawDiagnosis.trim().slice(0, 500);
        
        formData.set('update_text', cleanConcerns !== '' ? cleanConcerns : 'Updated via Health & Behavior Checklist.');

        formData.set('health_checklist',   JSON.stringify(healthAnswers));
        formData.set('behavior_checklist', JSON.stringify(behaviorAnswers));
        formData.set('vet_visit',          isVetVisit ? '1' : '0');
        formData.set('vet_visit_date',     vetDate);
        formData.set('vet_diagnosis',      cleanDiagnosis);
        formData.set('concerns',           cleanConcerns);

        try {
            const response = await fetch('/api/user/kamustahan', {
                method: 'POST',
                body: formData
            });

            const result = await response.json();
            if (result.success) {
                const petSelectEl = document.getElementById('petSelect');
                const selectedPetName = petSelectEl.options[petSelectEl.selectedIndex].text;

                document.getElementById('modalPetName').textContent = selectedPetName;
                const phTimestamp = new Date().toLocaleString('en-US', { timeZone: 'Asia/Manila', dateStyle: 'full', timeStyle: 'medium' });
                document.getElementById('modalTimestamp').textContent = phTimestamp;

                const modalImagesGrid = document.getElementById('modalImagesGrid');
                modalImagesGrid.innerHTML = '';

                if (selectedFiles.length > 0) {
                    const reader = new FileReader();
                    reader.onload = function(ev) {
                        const img = document.createElement('img');
                        img.src = ev.target.result;
                        img.className = 'w-20 h-20 object-cover rounded-xl border border-slate-200 shadow-sm flex-shrink-0 cursor-pointer hover:opacity-90 transition';
                        img.onclick = () => openLightbox(ev.target.result);
                        modalImagesGrid.appendChild(img);
                        
                        if (selectedFiles.length > 1) {
                            const badge = document.createElement('div');
                            badge.className = 'w-20 h-20 bg-slate-100 rounded-xl border border-slate-200 flex items-center justify-center text-slate-500 font-bold text-sm';
                            badge.textContent = `+${selectedFiles.length - 1}`;
                            modalImagesGrid.appendChild(badge);
                        }
                    }
                    reader.readAsDataURL(selectedFiles[0]);
                }

                document.getElementById('successModal').classList.remove('hidden');
                document.getElementById('successModal').classList.add('flex');
            } else {
                showUiAlert(result.error || 'Failed to submit update.', 'error');
                submitBtn.disabled = false;
                submitBtn.innerHTML = '<i class="fas fa-paper-plane"></i> Submit Pet Update';
            }
        } catch (error) {
            console.error('Submission error:', error);
            showUiAlert('An error occurred during submission.', 'error');
            submitBtn.disabled = false;
            submitBtn.innerHTML = '<i class="fas fa-paper-plane"></i> Submit Pet Update';
        }
    });

    // 5. Edit form (Simple update text)
    const editForm = document.getElementById('editKamustahanForm');
    if (editForm) {
        editForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const updateId = document.getElementById('editUpdateId').value;
            const saveBtn = document.getElementById('saveEditBtn');

            saveBtn.disabled = true;
            saveBtn.textContent = 'Saving...';

            const formData = new FormData();
            formData.append('update_text', document.getElementById('editUpdateText').value);

            if (selectedEditFile) {
                formData.append('photos', selectedEditFile);
            }

            try {
                const response = await fetch(`/api/user/kamustahan/${updateId}`, {
                    method: 'PUT',
                    body: formData
                });

                const result = await response.json();
                if (result.success) {
                    closeEditModal();
                    openHistoryModal();
                    showUiAlert('Update successfully modified!', 'success');
                } else {
                    alert(result.error || 'Failed to update record.');
                }
            } catch (err) {
                console.error('Error updating record:', err);
                alert('An error occurred while saving.');
            } finally {
                saveBtn.disabled = false;
                saveBtn.textContent = 'Save Changes';
            }
        });
    }
});

// ===================================================
// CHECKLIST RENDER FUNCTION
// ===================================================
function renderChecklist(containerId, checklist, storageObj, colorHex, colorBg) {
    const grid = document.getElementById(containerId);
    if (!grid) return;
    grid.innerHTML = '';

    for (const key in checklist) {
        const field = checklist[key];
        const wrapper = document.createElement('div');
        wrapper.className = 'bg-white border border-slate-200 rounded-xl p-4 shadow-sm';

        const optionsHtml = field.options.map((o) => `
            <label class="flex items-center gap-2.5 cursor-pointer p-2 rounded-lg hover:bg-slate-50 transition-colors">
                <input type="radio" name="${containerId}_${key}" value="${o.value}" style="accent-color: ${colorHex}; width: 16px; height: 16px;">
                <span class="text-xs font-medium text-slate-700">${o.label}</span>
            </label>
        `).join('');

        wrapper.innerHTML = `
            <div class="text-[12px] font-bold text-slate-800 mb-2 flex items-center gap-2">
                <div style="background-color: ${colorBg}; color: ${colorHex}; width: 24px; height: 24px; border-radius: 6px; display: flex; align-items: center; justify-content: center;">
                    <i class="fas ${field.icon || 'fa-circle'}" style="font-size: 12px;"></i>
                </div>
                ${field.label}
            </div>
            <div class="space-y-1 pl-1">
                ${optionsHtml}
            </div>
        `;

        wrapper.querySelectorAll('input[type="radio"]').forEach(radio => {
            radio.addEventListener('change', (e) => {
                storageObj[key] = e.target.value;

                // ⭐ Emergency symptom nudge (hindi risk level — tip lang)
                let tip = wrapper.querySelector('.vet-tip');

                if (EMERGENCY_OPTIONS.has(e.target.value)) {
                    if (!tip) {
                        tip = document.createElement('div');
                        tip.className = 'vet-tip mt-2 text-[11px] text-rose-700 bg-rose-50 border border-rose-200 rounded-lg p-2 flex items-start gap-1.5';
                        tip.innerHTML = `
                            <i class="fas fa-stethoscope mt-0.5 shrink-0"></i>
                            <span>This symptom may need a vet. Consider consulting one before submitting.</span>
                        `;
                        wrapper.appendChild(tip);
                    }
                } else if (tip) {
                    tip.remove();
                }
            });
        });

        grid.appendChild(wrapper);
    }
}

// ===================================================
// RENDER DETAILS PARA SA EDIT MODAL (Checklist & Vet)
// ===================================================
function renderUpdateDetails(item) {
    let html = '';

    if (item.health_checklist && item.health_checklist !== 'null') {
        try {
            const h = typeof item.health_checklist === 'string' ? JSON.parse(item.health_checklist) : item.health_checklist;
            if (Object.keys(h).length > 0) {
                html += `<div class="mb-2"><strong class="text-[10px] text-emerald-700 uppercase block mb-1">Health Check:</strong> <div class="flex flex-wrap gap-1">`;
                for (const [key, val] of Object.entries(h)) {
                    html += `<span class="text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-100 px-2 py-0.5 rounded-md capitalize">${key.replace(/_/g, ' ')}: ${val}</span>`;
                }
                html += `</div></div>`;
            }
        } catch(e) { console.error(e); }
    }

    if (item.behavior_checklist && item.behavior_checklist !== 'null') {
        try {
            const b = typeof item.behavior_checklist === 'string' ? JSON.parse(item.behavior_checklist) : item.behavior_checklist;
            if (Object.keys(b).length > 0) {
                html += `<div class="mb-2"><strong class="text-[10px] text-indigo-700 uppercase block mb-1">Behavior Check:</strong> <div class="flex flex-wrap gap-1">`;
                for (const [key, val] of Object.entries(b)) {
                    html += `<span class="text-[10px] bg-indigo-50 text-indigo-700 border border-indigo-100 px-2 py-0.5 rounded-md capitalize">${key.replace(/_/g, ' ')}: ${val}</span>`;
                }
                html += `</div></div>`;
            }
        } catch(e) { console.error(e); }
    }

    if (item.vet_visit == 1) {
        let formattedVetDate = 'Date N/A';
        if (item.vet_visit_date) {
            const d = new Date(item.vet_visit_date);
            formattedVetDate = d.toLocaleDateString('en-US', {
                timeZone: 'Asia/Manila',
                month: 'long',
                day: 'numeric',
                year: 'numeric'
            });
        }

        html += `<div class="mt-2 text-[11px] text-slate-700 bg-white border border-slate-200 p-2 rounded-lg">
            <i class="fas fa-hospital text-blue-500 mr-1"></i> 
            <strong>Vet Visit:</strong> ${formattedVetDate} 
            ${item.vet_diagnosis ? `<br><span class="text-[10px] text-slate-500">Diagnosis: ${item.vet_diagnosis}</span>` : ''}
        </div>`;
    }

    return html;
}

// ===================================================
// UI & MODALS FUNCTIONS
// ===================================================
function showUiAlert(message, type = 'error') {
    const alertBox = document.getElementById('uiAlertBox');
    const alertMsg = document.getElementById('uiAlertMessage');
    const alertTitle = document.getElementById('uiAlertTitle');
    const alertIcon = document.getElementById('uiAlertIcon');

    alertMsg.textContent = message;

    if (type === 'error') {
        alertBox.className = 'mb-6 p-4 rounded-2xl border text-sm flex items-start gap-3 transition-all bg-rose-50 border-rose-200 text-rose-900';
        alertIcon.className = 'fas fa-exclamation-circle mt-0.5 text-lg shrink-0 text-rose-600';
        alertTitle.textContent = 'Action Required';
    } else {
        alertBox.className = 'mb-6 p-4 rounded-2xl border text-sm flex items-start gap-3 transition-all bg-emerald-50 border-emerald-200 text-emerald-900';
        alertIcon.className = 'fas fa-check-circle mt-0.5 text-lg shrink-0 text-emerald-600';
        alertTitle.textContent = 'Success';
    }

    alertBox.classList.remove('hidden');
    alertBox.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

    setTimeout(() => {
        hideUiAlert();
    }, 4000);
}

function hideUiAlert() {
    document.getElementById('uiAlertBox')?.classList.add('hidden');
}

function renderPreview() {
    const container = document.getElementById('previewContainer');
    const existingThumbs = container.querySelectorAll('.preview-thumb');
    existingThumbs.forEach(el => el.remove());

    const addPhotoButton = container.querySelector('label');
    const badge = document.getElementById('fileCountBadge');

    if (selectedFiles.length > 0) {
        badge.textContent = `${selectedFiles.length} / 5 photos selected`;
        badge.className = 'bg-blue-50 text-blue-700 text-xs font-bold px-3 py-1 rounded-full border border-blue-100';
        
        // Itago ang add button kung umabot na ng 5
        if (selectedFiles.length >= 5) {
            addPhotoButton.style.display = 'none';
        } else {
            addPhotoButton.style.display = 'flex';
        }

        selectedFiles.forEach((file, index) => {
            const reader = new FileReader();
            reader.onload = function(event) {
                const div = document.createElement('div');
                div.className = 'relative w-32 h-32 border border-slate-200 rounded-2xl overflow-hidden preview-thumb shadow-sm bg-white group';
                div.innerHTML = `
                    <img src="${event.target.result}" class="w-full h-full object-cover cursor-pointer" onclick="openLightbox('${event.target.result}')">
                    <button type="button" onclick="removePhoto(${index})" class="absolute top-1.5 right-1.5 bg-rose-600 hover:bg-rose-700 text-white w-7 h-7 rounded-full flex items-center justify-center text-xs transition shadow-md">
                        <i class="fas fa-times"></i>
                    </button>
                `;
                addPhotoButton.before(div);
            }
            reader.readAsDataURL(file);
        });
    } else {
        addPhotoButton.style.display = 'flex';
        badge.textContent = '0 selected';
        badge.className = 'bg-slate-100 text-slate-500 text-xs font-bold px-3 py-1 rounded-full border border-slate-200';
    }
}

function removePhoto(index) {
    selectedFiles.splice(index, 1);
    renderPreview();
}

function closeSuccessModal() {
    document.getElementById('successModal').classList.add('hidden');
    window.location.reload();
}

// ===================================================
// HISTORY MODAL WITH FILTERS
// ===================================================
async function openHistoryModal() {
    const modal = document.getElementById('historyModal');
    modal.classList.remove('hidden');
    modal.classList.add('flex');

    historySearchQuery = '';
    historyStatusFilter = 'all';
    const searchEl = document.getElementById('historySearch');
    const filterEl = document.getElementById('historyStatusFilter');

    if (searchEl) searchEl.value = '';
    if (filterEl) filterEl.value = 'all';

    const container = document.getElementById('historyFeedContainer');
    container.innerHTML = `
        <div class="text-center py-12 text-slate-400">
            <i class="fas fa-spinner fa-spin text-2xl mb-2"></i>
            <p class="text-sm">Loading history records...</p>
        </div>
    `;

    try {
        const res = await fetch('/api/user/kamustahan-history');
        const data = await res.json();

        if (data.success && data.updates.length > 0) {
            fetchedUpdates = data.updates;
            setupHistoryFilters();
            filterAndRenderHistory();
        } else {
            container.innerHTML = `<p class="text-center text-slate-500 py-12 text-sm italic">No update history logs found.</p>`;
        }
    } catch (err) {
        console.error("History fetch error:", err);
        container.innerHTML = `<p class="text-center text-rose-500 py-12 text-sm">Failed to retrieve history logs.</p>`;
    }
}

function setupHistoryFilters() {
    const searchInput = document.getElementById('historySearch');
    const statusSelect = document.getElementById('historyStatusFilter');

    if (!searchInput || !statusSelect) return;

    const newSearch = searchInput.cloneNode(true);
    searchInput.parentNode.replaceChild(newSearch, searchInput);

    const newSelect = statusSelect.cloneNode(true);
    statusSelect.parentNode.replaceChild(newSelect, statusSelect);

    newSearch.addEventListener('input', (e) => {
        historySearchQuery = e.target.value.toLowerCase();
        filterAndRenderHistory();
    });

    newSelect.addEventListener('change', (e) => {
        historyStatusFilter = e.target.value;
        filterAndRenderHistory();
    });
}

function filterAndRenderHistory() {
    const container = document.getElementById('historyFeedContainer');

    const filteredData = fetchedUpdates.filter(item => {
        const matchesSearch = (item.pet_name || '').toLowerCase().includes(historySearchQuery);
        let matchesStatus = true;
        if (historyStatusFilter === 'reviewed') {
            matchesStatus = !!item.org_response || !!item.org_verdict;
        } else if (historyStatusFilter === 'pending') {
            matchesStatus = !item.org_response && !item.org_verdict;
        }
        return matchesSearch && matchesStatus && (item.update_text || item.health_checklist);
    });

    if (filteredData.length === 0) {
        container.innerHTML = `
            <div class="flex flex-col items-center justify-center py-16 text-slate-400">
                <div class="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-3">
                    <i class="fas fa-dog text-2xl opacity-30"></i>
                </div>
                <p class="text-sm font-medium">No history logs found.</p>
            </div>`;
        return;
    }

    container.innerHTML = '';
    filteredData.forEach(item => {
        // ⭐ 1. PHOTO & DATE FORMATTING (MULTIPLE PHOTOS)
        let photosArray = [];
        if (item.photos) {
            try {
                const parsed = JSON.parse(item.photos);
                photosArray = Array.isArray(parsed) ? parsed : [parsed];
            } catch(e) { photosArray = [item.photos]; }
        }

        // I-format ang paths
        photosArray = photosArray.map(p => (!p.startsWith('http') && !p.startsWith('/')) ? `/${p}` : p);
        const firstImage = photosArray.length > 0 ? photosArray[0] : '';

        // Gawing Philippine Time (PHT)
        let formattedDate = 'N/A';
        if (item.update_date) {
            const dateStr = item.update_date.length === 10 ? `${item.update_date}T00:00:00` : item.update_date;
            const d = new Date(dateStr);
            formattedDate = d.toLocaleDateString('en-US', { 
                timeZone: 'Asia/Manila', 
                month: 'long', 
                day: 'numeric', 
                year: 'numeric' 
            });
        }

        // ⭐ 2. VERDICT BADGES
        const verdictThemes = {
            approved:  { cls: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: 'fa-check-circle',        label: 'Approved' },
            follow_up: { cls: 'bg-amber-50 text-amber-700 border-amber-200',       icon: 'fa-clock',                label: 'Follow-up Needed' },
            urgent:    { cls: 'bg-rose-50 text-rose-700 border-rose-200',          icon: 'fa-exclamation-circle',   label: 'Urgent Concern' }
        };
        const verdictKey = (item.org_verdict || '').toString().toLowerCase().trim();
        const v = verdictThemes[verdictKey];
        
        const headerVerdictBadge = v 
            ? `<span class="text-[11px] font-bold px-2.5 py-1 rounded-md border ${v.cls} flex items-center gap-1.5 shadow-sm">
                   <i class="fas ${v.icon}"></i> ${v.label}
               </span>` 
            : '';

        // ⭐ 3. PARSE CHECKLISTS
        let healthData = {};
        let behaviorData = {};
        try { if (item.health_checklist) healthData = JSON.parse(item.health_checklist); } catch(e){}
        try { if (item.behavior_checklist) behaviorData = JSON.parse(item.behavior_checklist); } catch(e){}

        const renderTag = (key, val, colorBase) => `
            <span class="text-[10px] font-semibold px-2 py-1 rounded-md bg-${colorBase}-50 text-${colorBase}-700 border border-${colorBase}-100 capitalize shadow-sm">
                ${key.replace(/_/g, ' ')}: <span class="font-bold">${val}</span>
            </span>`;

        const healthTags = Object.entries(healthData).map(([k, val]) => renderTag(k, val, 'emerald')).join('');
        const behaviorTags = Object.entries(behaviorData).map(([k, val]) => renderTag(k, val, 'indigo')).join('');

        // ⭐ 4. ORG REVIEW BLOCK
        let orgReplyHtml = '';
        if (item.org_response || item.org_verdict) {
            let replyDate = item.org_responded_at ? new Date(item.org_responded_at).toLocaleString('en-US', { timeZone: 'Asia/Manila', dateStyle: 'medium', timeStyle: 'short' }) : '';
            
            let evalMini = '';
            if (item.org_evaluation_checklist) {
                try {
                    const data = typeof item.org_evaluation_checklist === 'string' ? JSON.parse(item.org_evaluation_checklist) : item.org_evaluation_checklist;
                    const labels = { photo_quality: '📸 Photo', health_info: '🩺 Health', behavior_info: '🧠 Behavior', overall_wellbeing: '❤️ Well-being' };
                    const iconMap = { satisfied: 'fa-check text-emerald-600', follow_up: 'fa-exclamation text-amber-600', unsatisfied: 'fa-times text-rose-600' };
                    
                    evalMini = '<div class="flex flex-wrap gap-1.5 mt-3">' + Object.entries(data).map(([k, val]) => `
                        <span class="text-[10px] font-semibold px-2 py-1 rounded-md bg-white border border-slate-200 text-slate-600 shadow-sm">
                            ${labels[k] || k} <i class="fas ${iconMap[val] || 'fa-circle'} ml-1"></i>
                        </span>
                    `).join('') + '</div>';
                } catch (e) {}
            }

            orgReplyHtml = `
                <div class="mt-4 bg-blue-50/70 border border-blue-100 rounded-2xl p-4 relative overflow-hidden">
                    <div class="absolute top-0 left-0 w-1.5 h-full bg-blue-500"></div>
                    <div class="flex items-center justify-between gap-2 mb-2 flex-wrap">
                        <div class="flex items-center gap-2">
                            <div class="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 shadow-sm border border-blue-200">
                                <i class="fas fa-building text-[11px]"></i>
                            </div>
                            <span class="text-[11px] font-bold text-blue-900 uppercase tracking-wider">Organization Review</span>
                        </div>
                        ${replyDate ? `<span class="text-[9px] font-semibold text-blue-500 bg-blue-100/50 px-2 py-1 rounded-md">${replyDate}</span>` : ''}
                    </div>
                    
                    ${evalMini}
                    
                    ${item.org_response ? `
                        <div class="mt-3 bg-white p-3.5 rounded-xl border border-blue-50 shadow-sm relative">
                            <i class="fas fa-quote-left absolute top-2 left-2 text-blue-100 text-xl"></i>
                            <p class="text-sm text-slate-700 leading-relaxed pl-5">${item.org_response}</p>
                        </div>
                    ` : ''}
                    
                    ${item.follow_up_date ? `
                        <div class="mt-3 flex items-center gap-2 text-[11px] font-bold text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 w-fit shadow-sm">
                            <i class="fas fa-calendar-check"></i> Follow-up due: ${new Date(item.follow_up_date).toLocaleDateString('en-US', {month:'short',day:'numeric',year:'numeric'})}
                        </div>
                    ` : ''}
                </div>
            `;
        }

        const isEditable = !item.org_response && !item.org_verdict && item.status !== 'Archived';
        const editBtnHtml = isEditable
            ? `<button onclick="openEditModal(${item.update_id})" class="text-xs bg-white border border-slate-200 text-slate-600 hover:text-blue-600 hover:border-blue-300 hover:bg-blue-50 px-3.5 py-2 rounded-xl font-bold transition-all shadow-sm flex items-center gap-1.5"><i class="fas fa-pen text-[10px]"></i> Edit</button>`
            : `<span class="text-[10px] font-bold text-emerald-600 bg-emerald-50/50 px-3 py-2 rounded-xl border border-emerald-100 flex items-center gap-1.5 shadow-sm"><i class="fas fa-lock text-[10px]"></i> Locked</span>`;

        // ⭐ 5. PET-CENTRIC CARD HTML
        const card = document.createElement('div');
        card.className = 'bg-white rounded-3xl border border-slate-200 shadow-sm hover:shadow-md transition-all duration-300 overflow-hidden';

        card.innerHTML = `
            <!-- CARD HEADER -->
            <div class="p-5 flex items-start justify-between gap-4">
                <div class="flex items-center gap-4">
                    <!-- Pet Avatar (First Image) -->
                    <div class="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-50 to-indigo-50 border-2 border-white shadow-sm flex items-center justify-center text-blue-500 shrink-0 overflow-hidden">
                        ${firstImage 
                            ? `<img src="${firstImage}" class="w-full h-full object-cover">` 
                            : `<i class="fas fa-dog text-2xl"></i>`
                        }
                    </div>
                    <!-- Pet Details -->
                    <div>
                        <div class="flex items-center gap-2 flex-wrap mb-1.5">
                            <h4 class="font-extrabold text-slate-800 text-lg tracking-tight">${item.pet_name}</h4>
                            ${headerVerdictBadge}
                        </div>
                        <div class="flex items-center gap-2 text-xs font-semibold text-slate-500">
                            <i class="fas fa-calendar-day text-slate-400"></i> ${formattedDate}
                        </div>
                    </div>
                </div>
                <div class="shrink-0 pt-1">
                    ${editBtnHtml}
                </div>
            </div>

            <!-- CARD BODY -->
            <div class="px-5 pb-5 space-y-4">
                
                <!-- Checkboxes (Health & Behavior) -->
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    ${Object.keys(healthData).length > 0 ? `
                        <div class="bg-slate-50 rounded-2xl p-3.5 border border-slate-100">
                            <strong class="text-[10px] uppercase tracking-wider text-emerald-600 block mb-2 flex items-center gap-1.5">
                                <i class="fas fa-stethoscope"></i> Health Check
                            </strong>
                            <div class="flex flex-wrap gap-1.5">${healthTags}</div>
                        </div>
                    ` : ''}
                    
                    ${Object.keys(behaviorData).length > 0 ? `
                        <div class="bg-slate-50 rounded-2xl p-3.5 border border-slate-100">
                            <strong class="text-[10px] uppercase tracking-wider text-indigo-600 block mb-2 flex items-center gap-1.5">
                                <i class="fas fa-brain"></i> Behavior Check
                            </strong>
                            <div class="flex flex-wrap gap-1.5">${behaviorTags}</div>
                        </div>
                    ` : ''}
                </div>

                <!-- User Notes -->
                ${item.update_text ? `
                    <div class="bg-amber-50/60 rounded-2xl p-3.5 border border-amber-100/50 relative overflow-hidden">
                        <div class="absolute top-0 right-0 w-16 h-16 bg-amber-100/30 rounded-bl-full pointer-events-none"></div>
                        <strong class="text-[10px] text-amber-700 uppercase tracking-wider block mb-1.5 flex items-center gap-1.5">
                            <i class="fas fa-comment-dots"></i> Your Note
                        </strong>
                        <p class="text-sm text-slate-700 leading-relaxed font-medium">${item.update_text}</p>
                    </div>
                ` : ''}

                <!-- ⭐ MULTIPLE PHOTOS DISPLAY (Horizontal Scroll) -->
                ${photosArray.length > 0 ? `
                    <div class="pt-2">
                        <div class="flex gap-2 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-slate-200">
                            ${photosArray.map(p => `
                                <img src="${p}" class="w-20 h-20 sm:w-24 sm:h-24 object-cover rounded-xl border border-slate-200 shadow-sm cursor-pointer hover:opacity-80 hover:scale-105 transition-all flex-shrink-0" onclick="openLightbox('${p}')" title="View photo">
                            `).join('')}
                        </div>
                    </div>
                ` : ''}

                <!-- Org Review -->
                ${orgReplyHtml}
            </div>
        `;
        container.appendChild(card);
    });
}

function closeHistoryModal() {
    document.getElementById('historyModal').classList.add('hidden');
}

function openLightbox(imgSrc) {
    const lightbox = document.getElementById('imageLightboxModal');
    const lightboxImg = document.getElementById('lightboxImage');
    lightboxImg.src = imgSrc;
    lightbox.classList.remove('hidden');
    lightbox.classList.add('flex');
}

function closeLightbox() {
    const lightbox = document.getElementById('imageLightboxModal');
    lightbox.classList.add('hidden');
    lightbox.classList.remove('flex');
}

function openEditModal(updateId) {
    const item = fetchedUpdates.find(u => u.update_id == updateId);
    if (!item) return;

    document.getElementById('editUpdateId').value = item.update_id;
    document.getElementById('editUpdateText').value = item.update_text;

    const displayBox = document.getElementById('editDetailsDisplay');
    const detailsHtml = renderUpdateDetails(item);

    if (detailsHtml.trim() !== '') {
        displayBox.innerHTML = detailsHtml;
        displayBox.classList.remove('hidden');
    } else {
        displayBox.innerHTML = '<span class="text-xs text-slate-400 italic">No checklist or vet data available.</span>';
        displayBox.classList.remove('hidden');
    }

    selectedEditFile = null;
    document.getElementById('editPhotoInput').value = '';

    let imageUrl = '';
    if (item.photos) {
        try {
            const parsed = JSON.parse(item.photos);
            imageUrl = Array.isArray(parsed) ? parsed[0] : parsed;
        } catch(e) {
            imageUrl = item.photos;
        }
    }
    if (imageUrl && !imageUrl.startsWith('http')) {
        imageUrl = imageUrl.startsWith('/') ? imageUrl : `/${imageUrl}`;
    }

    document.getElementById('editCurrentPhotoPreview').src = imageUrl || '';

    const modal = document.getElementById('editModal');
    modal.classList.remove('hidden');
    modal.classList.add('flex');
}

function closeEditModal() {
    const modal = document.getElementById('editModal');
    modal.classList.add('hidden');
    modal.classList.remove('flex');
}