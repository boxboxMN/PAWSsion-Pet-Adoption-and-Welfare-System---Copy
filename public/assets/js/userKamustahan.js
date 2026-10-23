let petsData = [];
let selectedFile = null;
let selectedEditFile = null;
let fetchedUpdates = []; // Cache para sa Edit Modal

// ===================================================
// FILTER VARIABLES
// ===================================================
let historySearchQuery = '';
let historyStatusFilter = 'all';
// ===================================================
// CHECKLIST DATA DEFINITIONS (EXPANDED)
// ===================================================
const HEALTH_CHECKLIST = {
    appetite: {
        label: 'Appetite', icon: 'fa-utensils',
        options: [
            { value: 'normal',    label: 'Normal',  risk: 'low' },
            { value: 'reduced',   label: 'Reduced', risk: 'medium' },
            { value: 'refusing',  label: 'Refusing to eat (24h+)', risk: 'high' }
        ]
    },
    water: {
        label: 'Water Intake', icon: 'fa-droplet',
        options: [
            { value: 'normal',    label: 'Normal',  risk: 'low' },
            { value: 'reduced',   label: 'Drinking less', risk: 'medium' },
            { value: 'excessive', label: 'Excessive thirst', risk: 'high' }
        ]
    },
    litter: {
        label: 'Litter Box / Stool', icon: 'fa-broom',
        options: [
            { value: 'normal',      label: 'Normal', risk: 'low' },
            { value: 'diarrhea',    label: 'Diarrhea', risk: 'high' },
            { value: 'constipated', label: 'Constipated', risk: 'high' },
            { value: 'blood',       label: 'Blood in stool', risk: 'high' },
            { value: 'not_using',   label: 'Not using litter box', risk: 'medium' }
        ]
    },
    vomiting: {
        label: 'Vomiting', icon: 'fa-face-frown',
        options: [
            { value: 'none',       label: 'None', risk: 'low' },
            { value: 'hairball',   label: 'Occasional hairballs', risk: 'low' },
            { value: 'frequent',   label: 'Frequent vomiting', risk: 'medium' },
            { value: 'with_blood', label: 'Vomiting with blood', risk: 'high' }
        ]
    },
    activity: {
        label: 'Activity Level', icon: 'fa-person-running',
        options: [
            { value: 'playful',   label: 'Playful & Active', risk: 'low' },
            { value: 'lethargic', label: 'Lethargic / Weak', risk: 'high' },
            { value: 'hyper',     label: 'Restless / Hyperactive', risk: 'medium' }
        ]
    },
    respiratory: {
        label: 'Breathing / Eyes / Nose', icon: 'fa-lungs',
        options: [
            { value: 'normal',   label: 'Normal', risk: 'low' },
            { value: 'sneezing', label: 'Sneezing / Discharge', risk: 'medium' },
            { value: 'labored',  label: 'Labored breathing', risk: 'high' }
        ]
    },
    grooming: {
        label: 'Grooming / Coat', icon: 'fa-brush',
        options: [
            { value: 'good',      label: 'Clean & well-groomed', risk: 'low' },
            { value: 'matted',    label: 'Matted / Dull coat', risk: 'medium' },
            { value: 'excessive', label: 'Over-grooming / Hair loss', risk: 'medium' }
        ]
    }
};

const BEHAVIOR_CHECKLIST = {
    socialization: {
        label: 'Socialization', icon: 'fa-users',
        options: [
            { value: 'friendly',   label: 'Friendly & Affectionate', risk: 'low' },
            { value: 'shy',        label: 'Shy but approaching', risk: 'low' },
            { value: 'withdrawn',  label: 'Withdrawn / Avoiding', risk: 'medium' },
            { value: 'aggressive', label: 'Aggressive / Biting', risk: 'high' }
        ]
    },
    hiding: {
        label: 'Hiding Behavior', icon: 'fa-eye-slash',
        options: [
            { value: 'rarely',    label: 'Rarely hides', risk: 'low' },
            { value: 'sometimes', label: 'Sometimes hides', risk: 'medium' },
            { value: 'frequent',  label: 'Hides all the time', risk: 'high' }
        ]
    },
    anxiety: {
        label: 'Anxiety / Stress', icon: 'fa-heart-pulse',
        options: [
            { value: 'none',   label: 'None', risk: 'low' },
            { value: 'mild',   label: 'Mild (pacing, meowing)', risk: 'medium' },
            { value: 'severe', label: 'Severe (panic, destructive)', risk: 'high' }
        ]
    },
    destructive: {
        label: 'Destructive Behavior', icon: 'fa-hammer',
        options: [
            { value: 'none',   label: 'None', risk: 'low' },
            { value: 'mild',   label: 'Mild (scratching furniture)', risk: 'low' },
            { value: 'severe', label: 'Severe (damaging things)', risk: 'high' }
        ]
    },
    vocalization: {
        label: 'Vocalization', icon: 'fa-volume-high',
        options: [
            { value: 'normal',    label: 'Normal', risk: 'low' },
            { value: 'excessive', label: 'Excessive meowing/barking', risk: 'medium' },
            { value: 'hissing',   label: 'Hissing / Growling', risk: 'medium' }
        ]
    },
    sleep: {
        label: 'Sleep Pattern', icon: 'fa-bed',
        options: [
            { value: 'normal',    label: 'Normal', risk: 'low' },
            { value: 'restless',  label: 'Restless / Awake at night', risk: 'medium' },
            { value: 'excessive', label: 'Sleeping too much', risk: 'medium' }
        ]
    }
};


const healthAnswers = {};
const behaviorAnswers = {};

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

        try {
            const res = await fetch('/api/user/approved-pets');
            const data = await res.json();
            const petSelect = document.getElementById('petSelect');

            if (data.success && data.pets.length > 0) {
                petsData = data.pets;
                petSelect.innerHTML = '<option value="">-- Choose your adopted pet --</option>';
                
                petsData.forEach(pet => {
                    const opt = document.createElement('option');
                    opt.value = pet.animal_id;
                    opt.textContent = pet.name;
                    petSelect.appendChild(opt);
                });

                petSelect.addEventListener('change', (e) => {
                    const selectedPet = petsData.find(p => p.animal_id == e.target.value);
                    document.getElementById('orgIdInput').value = selectedPet ? selectedPet.organization_id : '';
                });
            } else {
                petSelect.innerHTML = '<option value="">No approved adopted pets available.</option>';
            }
        } catch (err) {
            console.error("Error loading approved pets:", err);
        }
        try {
            const dueRes = await fetch('/api/user/kamustahan-due');
            const dueData = await dueRes.json();

            if (dueData.success && dueData.dueUpdates.length > 0) {
                const banner = document.getElementById('kamustahanDueBanner');
                const bannerText = document.getElementById('kamustahanDueText');

                const names = dueData.dueUpdates.map(u => u.pet_name).join(", ");
                bannerText.textContent = dueData.dueUpdates.length === 1
                    ? `An update for ${names} was due on ${new Date(dueData.dueUpdates[0].scheduled_date).toLocaleDateString("en-US", { month: "long", day: "numeric" })}. Please share how they're doing!`
                    : `Updates are due for: ${names}. Please share how they're doing!`;

                banner.classList.remove('hidden');

                banner.addEventListener('click', () => {
                    const firstDue = dueData.dueUpdates[0];
                    const petSelect = document.getElementById('petSelect');
                    if (petSelect) {
                        petSelect.value = firstDue.animal_id;
                        petSelect.dispatchEvent(new Event('change'));
                        petSelect.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    }
                });
                banner.classList.add('cursor-pointer', 'hover:bg-amber-100', 'transition');
            }
        } catch (err) {
            console.error("Error loading due Kamustahan updates:", err);
        }

        const photoInput = document.getElementById('photoInput');
        photoInput.addEventListener('change', (e) => {
            const files = e.target.files;
            if (files && files.length > 0) {
                selectedFile = files[0];
                renderPreview();
            }
        });
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

        document.getElementById('kamustahanForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            hideUiAlert();

            if (!selectedFile) {
                showUiAlert("Please upload a photo of your pet.", "error");
                return;
            }

            const submitBtn = document.getElementById('submitBtn');
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i> Submitting Report...';

            const formData = new FormData(e.target);
            formData.set('photos', selectedFile);
                
                const concernsText = document.getElementById('petConcerns')?.value || '';
                formData.set('update_text', concernsText.trim() !== '' ? concernsText : 'Updated via Health & Behavior Checklist.');

                formData.set('health_checklist',   JSON.stringify(healthAnswers));
                formData.set('behavior_checklist', JSON.stringify(behaviorAnswers));
                formData.set('risk_level',         computeRiskLevel(healthAnswers, behaviorAnswers));
                formData.set('vet_visit',          document.getElementById('vetVisitToggle').checked ? '1' : '0');
                formData.set('vet_visit_date',     document.getElementById('vetVisitDate')?.value || '');
                formData.set('vet_diagnosis',      document.getElementById('vetDiagnosis')?.value || '');
                formData.set('concerns',           concernsText);
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
                    
                    const reader = new FileReader();
                    reader.onload = function(ev) {
                        const img = document.createElement('img');
                        img.src = ev.target.result;
                        img.className = 'w-20 h-20 object-cover rounded-xl border border-slate-200 shadow-sm flex-shrink-0 cursor-pointer hover:opacity-90 transition';
                        img.onclick = () => openLightbox(ev.target.result);
                        modalImagesGrid.appendChild(img);
                    }
                    reader.readAsDataURL(selectedFile);

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
                updateRiskPreview();
            });
        });

        grid.appendChild(wrapper);
    }
}

// ===================================================
// RISK COMPUTATION & FORMATTING
// ===================================================
function computeRiskLevel(health, behavior) {
    let score = 0;
    const all = { ...health, ...behavior };
    const sources = { ...HEALTH_CHECKLIST, ...BEHAVIOR_CHECKLIST };

    for (const key in all) {
        const chosen = all[key];
        if (!chosen) continue;
        const field = sources[key];
        if (!field) continue;
        const opt = field.options.find(o => o.value === chosen);
        if (!opt) continue;
        if (opt.risk === 'high')   score += 3;
        if (opt.risk === 'medium') score += 1;
    }

    if (score >= 5) return 'high';
    if (score >= 2) return 'medium';
    return 'low';
}

function updateRiskPreview() {
    const box = document.getElementById('riskPreview');
    if (!box) return;

    const hasAnswer = Object.keys(healthAnswers).length > 0 || Object.keys(behaviorAnswers).length > 0;
    if (!hasAnswer) { box.classList.add('hidden'); return; }

    const level = computeRiskLevel(healthAnswers, behaviorAnswers);
    const themes = {
        low: {
            cls:  'bg-emerald-50 border-emerald-200 text-emerald-800',
            icon: 'fa-circle-check',
            msg:  'Low concern — your pet seems fine. Thank you for the update!'
        },
        medium: {
            cls:  'bg-amber-50 border-amber-200 text-amber-800',
            icon: 'fa-triangle-exclamation',
            msg:  'Medium concern — there are some signs to monitor.'
        },
        high: {
            cls:  'bg-rose-50 border-rose-200 text-rose-800',
            icon: 'fa-circle-exclamation',
            msg:  'High concern — vet consultation is recommended.'
        }
    };
    const t = themes[level];

    box.className = `p-3.5 rounded-xl border text-xs font-semibold flex items-start gap-2.5 ${t.cls}`;
    box.innerHTML = `
        <i class="fas ${t.icon} mt-0.5 text-sm shrink-0"></i>
        <div>
            <span class="block uppercase tracking-wide text-[10px] opacity-80 mb-0.5">Auto-detected Concern Level</span>
            ${t.msg}
        </div>
    `;
    box.classList.remove('hidden');
}
// ===================================================
// RENDER DETAILS PARA SA EDIT MODAL (Checklist & Vet)
// ===================================================
function renderUpdateDetails(item) {
    let html = '';

    // 1. Risk Level Badge
    if (item.risk_level) {
        const riskColors = {
            low: 'bg-emerald-100 text-emerald-700',
            medium: 'bg-amber-100 text-amber-700',
            high: 'bg-rose-100 text-rose-700'
        };
        html += `<div class="mb-3"><span class="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${riskColors[item.risk_level] || riskColors.low}">${item.risk_level} Risk</span></div>`;
    }

    // 2. Health Checklist
    if (item.health_checklist && item.health_checklist !== 'null') {
        try {
            const h = typeof item.health_checklist === 'string' ? JSON.parse(item.health_checklist) : item.health_checklist;
            if (Object.keys(h).length > 0) {
                html += `<div class="mb-2"><strong class="text-[10px] text-emerald-700 uppercase block mb-1">Health Check:</strong> <div class="flex flex-wrap gap-1">`;
                for (const [key, val] of Object.entries(h)) {
                    html += `<span class="text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-100 px-2 py-0.5 rounded-md">${key}: ${val}</span>`;
                }
                html += `</div></div>`;
            }
        } catch(e) { console.error(e); }
    }

    // 3. Behavior Checklist
    if (item.behavior_checklist && item.behavior_checklist !== 'null') {
        try {
            const b = typeof item.behavior_checklist === 'string' ? JSON.parse(item.behavior_checklist) : item.behavior_checklist;
            if (Object.keys(b).length > 0) {
                html += `<div class="mb-2"><strong class="text-[10px] text-indigo-700 uppercase block mb-1">Behavior Check:</strong> <div class="flex flex-wrap gap-1">`;
                for (const [key, val] of Object.entries(b)) {
                    html += `<span class="text-[10px] bg-indigo-50 text-indigo-700 border border-indigo-100 px-2 py-0.5 rounded-md">${key}: ${val}</span>`;
                }
                html += `</div></div>`;
            }
        } catch(e) { console.error(e); }
    }

    // 4. Vet Visit Data
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

        if (selectedFile) {
            const reader = new FileReader();
            reader.onload = function(event) {
                const div = document.createElement('div');
                div.className = 'relative w-32 h-32 border border-slate-200 rounded-2xl overflow-hidden preview-thumb shadow-sm bg-white group';
                div.innerHTML = `
                    <img src="${event.target.result}" class="w-full h-full object-cover cursor-pointer" onclick="openLightbox('${event.target.result}')" title="Tap to preview">
                    <button type="button" onclick="removePhoto()" class="absolute top-1.5 right-1.5 bg-rose-600 hover:bg-rose-700 text-white w-7 h-7 rounded-full flex items-center justify-center text-xs transition shadow-md" title="Remove photo">
                        <i class="fas fa-times"></i>
                    </button>
                `;
                addPhotoButton.before(div);
            }
            reader.readAsDataURL(selectedFile);
            document.getElementById('fileCountBadge').textContent = '1 photo selected';
        } else {
            document.getElementById('fileCountBadge').textContent = '0 selected';
        }
    }

    function removePhoto() {
        selectedFile = null;
        document.getElementById('photoInput').value = '';
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

    // I-reset ang filters tuwing bubuksan
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
            
            // Setup filter listeners (one-time setup)
            setupHistoryFilters();
            
            // I-render ang unang listahan
            filterAndRenderHistory();
        } else {
            container.innerHTML = `<p class="text-center text-slate-500 py-12 text-sm italic">No update history logs found.</p>`;
        }
    } catch (err) {
        console.error("History fetch error:", err);
        container.innerHTML = `<p class="text-center text-rose-500 py-12 text-sm">Failed to retrieve history logs.</p>`;
    }
}

// Function para i-attach ang events sa search at dropdown (para hindi magdoble)
function setupHistoryFilters() {
    const searchInput = document.getElementById('historySearch');
    const statusSelect = document.getElementById('historyStatusFilter');

    if (!searchInput || !statusSelect) return;

    // Remove existing listeners by cloning
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

// Function para i-filter at i-render ang data
function filterAndRenderHistory() {
    const container = document.getElementById('historyFeedContainer');

    // 1. Filter the data
    const filteredData = fetchedUpdates.filter(item => {
        // Check search query (Pet Name)
        const matchesSearch = (item.pet_name || '').toLowerCase().includes(historySearchQuery);
        
        // Check status filter
        let matchesStatus = true;
        if (historyStatusFilter === 'reviewed') {
            matchesStatus = !!item.org_response; // May reply/note
        } else if (historyStatusFilter === 'pending') {
            matchesStatus = !item.org_response && item.status === 'For Update'; // Wala pang reply at pending
        }

        return matchesSearch && matchesStatus && (item.update_text || item.health_checklist);
    });

    // 2. Render
    if (filteredData.length === 0) {
        container.innerHTML = `<p class="text-center text-slate-500 py-12 text-sm italic">No history logs match your filter.</p>`;
        return;
    }

    container.innerHTML = '';
    filteredData.forEach(item => {
        let imageUrl = '';
        if (item.photos) {
            try {
                const parsed = JSON.parse(item.photos);
                imageUrl = Array.isArray(parsed) ? parsed[0] : parsed;
            } catch(e) { imageUrl = item.photos; }
        }

        if (imageUrl && !imageUrl.startsWith('http')) {
            imageUrl = imageUrl.startsWith('/') ? imageUrl : `/${imageUrl}`;
        }

        let photosHtml = imageUrl 
            ? `<img src="${imageUrl}" class="w-20 h-20 object-cover rounded-xl border border-slate-200 shadow-sm flex-shrink-0 cursor-pointer hover:scale-105 transition duration-150" onclick="openLightbox('${imageUrl}')" title="Tap to view full image">`
            : '<span class="text-xs text-slate-400 italic">No photo attached</span>';

        const detailsHtml = renderUpdateDetails(item);

        // Org Note Logic
        let orgReplyHtml = '';
        if (item.org_response) {
            let replyDate = '';
            if (item.org_responded_at) {
                const d = new Date(item.org_responded_at);
                replyDate = d.toLocaleString('en-US', { timeZone: 'Asia/Manila', dateStyle: 'medium', timeStyle: 'short' });
            }

            orgReplyHtml = `
                <div class="mt-3 bg-blue-50 border border-blue-100 rounded-xl p-3.5 relative">
                    <div class="flex items-center gap-1.5 mb-1.5">
                        <i class="fas fa-building text-blue-600 text-sm"></i>
                        <span class="text-[11px] font-bold text-blue-800 uppercase tracking-wide">Organization Note</span>
                        ${replyDate ? `<span class="text-[9px] text-blue-400 font-medium ml-auto">${replyDate}</span>` : ''}
                    </div>
                    <p class="text-sm text-slate-700 leading-relaxed">${item.org_response}</p>
                </div>
            `;
        }

        // Edit button logic
        const isEditable = item.status === 'For Update' && !item.org_response;
        const editBtnHtml = isEditable 
            ? `<button onclick="openEditModal(${item.update_id})" class="text-xs bg-blue-50 text-blue-600 hover:bg-blue-100 px-3 py-1.5 rounded-xl font-semibold transition flex items-center gap-1">
                 <i class="fas fa-edit"></i> Edit
               </button>`
            : `<span class="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-100 flex items-center gap-1"><i class="fas fa-check-circle"></i> Reviewed by Org</span>`;

        const card = document.createElement('div');
        card.className = 'bg-slate-50/80 border border-slate-200/80 rounded-2xl p-5 space-y-3';
        
        card.innerHTML = `
            <div class="flex items-center justify-between">
                <span class="font-bold text-slate-800 text-sm flex items-center gap-1.5"><i class="fas fa-paw text-blue-600"></i> ${item.pet_name}</span>
                ${editBtnHtml}
            </div>
            
            ${detailsHtml}

            <p class="text-sm text-slate-700 bg-white p-3.5 rounded-xl border border-slate-100 leading-relaxed"><strong class="text-xs text-slate-400 block mb-1">Your Concerns/Notes:</strong> ${item.update_text}</p>
            
            ${orgReplyHtml}

            <div class="flex gap-2.5 overflow-x-auto pt-1">${photosHtml}</div>
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