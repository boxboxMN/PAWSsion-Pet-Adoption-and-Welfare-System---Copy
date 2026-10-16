// =====================================================
// ORGANIZATION ANALYTICS CHARTS
// =====================================================

let adoptedPetsChart = null;
let availablePetsChart = null;
let cashDonationChart = null;
let inKindDonationChart = null;

// =====================================================
// GLOBAL CHART DEFAULTS (modern look)
// =====================================================
if (typeof Chart !== "undefined") {
    Chart.defaults.font.family = "'Inter', sans-serif";
    Chart.defaults.font.size = 12;
    Chart.defaults.color = "#64748b";
    Chart.defaults.animation.duration = 800;
    Chart.defaults.animation.easing = "easeOutQuart";
    Chart.defaults.plugins.legend.labels.usePointStyle = true;
    Chart.defaults.plugins.legend.labels.boxWidth = 8;
    Chart.defaults.plugins.legend.labels.padding = 15;
    Chart.defaults.plugins.tooltip.backgroundColor = "#0f172a";
    Chart.defaults.plugins.tooltip.padding = 12;
    Chart.defaults.plugins.tooltip.cornerRadius = 8;
    Chart.defaults.plugins.tooltip.titleFont = { size: 12, weight: "bold" };
    Chart.defaults.plugins.tooltip.bodyFont = { size: 12 };
}

// =====================================================
// PERIOD LABEL HELPERS
// =====================================================
function getPeriodLabel(period, date) {
    const selectedDate = new Date(`${date}T00:00:00`);
    if (period === "day") {
        return selectedDate.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
    }
    if (period === "year") return selectedDate.getFullYear().toString();
    return selectedDate.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

function formatDateLabel(value) {
    const selectedDate = new Date(`${value}T00:00:00`);
    return selectedDate.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatMonthLabel(value) {
    const [year, month] = value.split("-");
    const date = new Date(Number(year), Number(month) - 1, 1);
    return date.toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

function getPeriodDescription(period) {
    if (period === "day") return "Hourly";
    if (period === "year") return "Monthly";
    return "Daily";
}

// =====================================================
// GRADIENT HELPER
// =====================================================
function createGradient(ctx, area, colorStart, colorEnd) {
    const gradient = ctx.createLinearGradient(0, area.bottom, 0, area.top);
    gradient.addColorStop(0, colorStart);
    gradient.addColorStop(1, colorEnd);
    return gradient;
}

// =====================================================
// ANIMATED NUMBER COUNTER
// =====================================================
function animateNumber(element, targetValue, prefix = "", suffix = "", decimals = 0) {
    if (!element) return;
    const duration = 700;
    const startTime = performance.now();
    const startValue = 0;

    function update(currentTime) {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const easeOut = 1 - Math.pow(1 - progress, 3);
        const currentValue = startValue + (targetValue - startValue) * easeOut;

        if (decimals > 0) {
            element.textContent = prefix + currentValue.toLocaleString("en-PH", {
                minimumFractionDigits: decimals,
                maximumFractionDigits: decimals
            }) + suffix;
        } else {
            element.textContent = prefix + Math.round(currentValue).toLocaleString("en-PH") + suffix;
        }

        if (progress < 1) requestAnimationFrame(update);
    }
    requestAnimationFrame(update);
}

// =====================================================
// PROGRESS BAR UPDATER
// =====================================================
function updateProgressBar(barId, pctId, value, total) {
    const pct = total > 0 ? Math.round((value / total) * 100) : 0;
    const bar = document.getElementById(barId);
    const pctEl = document.getElementById(pctId);
    if (bar) bar.style.width = `${pct}%`;
    if (pctEl) pctEl.textContent = `${pct}%`;
}

// =====================================================
// LOAD ANALYTICS
// =====================================================
let latestAnalyticsData = null;

async function loadAnalytics() {
    try {
        const periodElement = document.getElementById("analyticsPeriodType");
        const dateElement = document.getElementById("analyticsDate");
        const period = periodElement?.value || "month";
        const date = dateElement?.value || new Date().toISOString().slice(0, 10);

        const response = await fetch(
            `/org/analytics/data?period=${encodeURIComponent(period)}&date=${encodeURIComponent(date)}`
        );
        const data = await response.json();

        console.log("Analytics DB response:", data);

        latestAnalyticsData = data;

        if (!data.success) {
            throw new Error(data.message || "Failed to load analytics.");
        }

        const periodLabel = getPeriodLabel(data.period, data.date);
        const periodDescription = getPeriodDescription(data.period);

        // ==========================================
        // PET SUMMARY + PROGRESS BARS
        // ==========================================
        const petTotal = Number(data.pets.total || 0);

        animateNumber(document.getElementById("petAvailable"), data.pets.available);
        animateNumber(document.getElementById("petPending"), data.pets.pending);
        animateNumber(document.getElementById("petAdopted"), data.pets.adopted);
        animateNumber(document.getElementById("petArchived"), data.pets.archived);
        animateNumber(document.getElementById("petTotal"), petTotal);

        updateProgressBar("petAvailableBar", "petAvailablePct", data.pets.available, petTotal);
        updateProgressBar("petPendingBar", "petPendingPct", data.pets.pending, petTotal);
        updateProgressBar("petAdoptedBar", "petAdoptedPct", data.pets.adopted, petTotal);
        updateProgressBar("petArchivedBar", "petArchivedPct", data.pets.archived, petTotal);

        // ==========================================
        // CASH SUMMARY
        // ==========================================
        const cashTotal = Number(data.cash.total || 0);
        const formattedCash = cashTotal.toLocaleString("en-PH", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        });

        document.getElementById("summaryCash").textContent = `₱${formattedCash}`;
        document.getElementById("cashTotal").textContent = `₱${formattedCash}`;
        document.getElementById("cashPeriodLabel").textContent = `${periodLabel} — Approved donations`;
        document.getElementById("cashPeriodLabelChart").textContent = periodLabel;

        // ==========================================
        // IN-KIND SUMMARY
        // ==========================================
        const inKindTotal = Number(data.inKind.totalQuantity || 0);
        animateNumber(document.getElementById("summaryInKind"), inKindTotal);
        animateNumber(document.getElementById("inKindTotal"), inKindTotal);

        document.getElementById("inKindPeriodLabel").textContent = `${periodLabel} — Approved donations`;
        document.getElementById("inKindPeriodLabelChart").textContent = periodLabel;

        // ==========================================
        // ADOPTION TOTAL
        // ==========================================
        const adoptionTotal = Number(data.adoptions.total || 0);
        animateNumber(document.getElementById("adoptedTotal"), adoptionTotal);
        document.getElementById("adoptionPeriodLabel").textContent = periodLabel;

        // ==========================================
        // AVAILABLE PET TOTAL
        // ==========================================
        animateNumber(document.getElementById("availableTotal"), data.pets.available);
        document.getElementById("availablePetsSubtitle").textContent = `Current available pets — ${periodLabel}`;

        // ==========================================
        // CHART SUBTITLES
        // ==========================================
        document.getElementById("adoptionChartSubtitle").textContent = `${periodLabel} — ${periodDescription} approved adoptions`;
        document.getElementById("cashChartSubtitle").textContent = `${periodLabel} — ${periodDescription} approved cash donations`;
        document.getElementById("inKindChartSubtitle").textContent = `${periodLabel} — ${periodDescription} approved in-kind donations`;

        // ==========================================
        // DRAW CHARTS
        // ==========================================
        createAdoptionChart(data, periodLabel, periodDescription);
        createAvailablePetsChart(data);
        createCashChart(data, periodLabel, periodDescription);
        createInKindChart(data, periodLabel, periodDescription);

    } catch (error) {
        console.error("Analytics loading error:", error);
    }
}

// =====================================================
// ADOPTION BAR CHART
// =====================================================
function createAdoptionChart(data, periodLabel, periodDescription) {
    const canvas = document.getElementById("adoptedPetsChart");
    const emptyState = document.getElementById("adoptedPetsEmpty");
    if (!canvas) return;

    if (adoptedPetsChart) adoptedPetsChart.destroy();

    const chartData = data.adoptions.chart || [];

    // Empty state
    if (chartData.length === 0) {
        emptyState?.classList.remove("hidden");
        return;
    }
    emptyState?.classList.add("hidden");

    const labels = chartData.map(item => {
        if (data.period === "month") return formatDateLabel(item.label);
        if (data.period === "year") return formatMonthLabel(item.label);
        return item.label;
    });
    const values = chartData.map(item => Number(item.total || 0));

    const ctx = canvas.getContext("2d");

    adoptedPetsChart = new Chart(canvas, {
        type: "bar",
        data: {
            labels,
            datasets: [{
                label: "Approved adoptions",
                data: values,
                backgroundColor: (context) => {
                    const chart = context.chart;
                    const { ctx, chartArea } = chart;
                    if (!chartArea) return "rgba(16, 185, 129, 0.7)";
                    return createGradient(ctx, chartArea, "rgba(16, 185, 129, 0.35)", "rgba(16, 185, 129, 1)");
                },
                borderColor: "#10b981",
                borderWidth: 1.5,
                borderRadius: 8,
                borderSkipped: false,
                hoverBackgroundColor: "rgba(16, 185, 129, 1)"
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: (context) => ` Approved adoptions: ${context.raw}`
                    }
                }
            },
            scales: {
                x: {
                    grid: { display: false },
                    title: {
                        display: true,
                        text: data.period === "day" ? "Hour" : data.period === "year" ? "Month" : "Day",
                        color: "#94a3b8",
                        font: { size: 11, weight: "bold" }
                    }
                },
                y: {
                    beginAtZero: true,
                    ticks: { precision: 0 },
                    grid: { color: "rgba(148, 163, 184, 0.15)" },
                    title: {
                        display: true,
                        text: "Number of adoptions",
                        color: "#94a3b8",
                        font: { size: 11, weight: "bold" }
                    }
                }
            }
        }
    });
}

// =====================================================
// AVAILABLE PETS DOUGHNUT
// =====================================================
function createAvailablePetsChart(data) {
    const canvas = document.getElementById("availablePetsChart");
    const emptyState = document.getElementById("availablePetsEmpty");
    if (!canvas) return;

    if (availablePetsChart) availablePetsChart.destroy();

    const speciesData = data.availableBySpecies || [];

    if (speciesData.length === 0) {
        emptyState?.classList.remove("hidden");
        return;
    }
    emptyState?.classList.add("hidden");

    const labels = speciesData.map(item => item.species);
    const values = speciesData.map(item => Number(item.total || 0));
    const total = values.reduce((a, b) => a + b, 0);

    const palette = [
        "#3b82f6", "#8b5cf6", "#f59e0b", "#10b981",
        "#ef4444", "#ec4899", "#06b6d4", "#84cc16"
    ];

    availablePetsChart = new Chart(canvas, {
        type: "doughnut",
        data: {
            labels,
            datasets: [{
                label: "Available pets",
                data: values,
                backgroundColor: palette.slice(0, labels.length),
                borderColor: "#ffffff",
                borderWidth: 3,
                hoverOffset: 8
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: "62%",
            plugins: {
                legend: {
                    position: "bottom",
                    labels: {
                        padding: 12,
                        font: { size: 11, weight: "600" }
                    }
                },
                tooltip: {
                    callbacks: {
                        label: (context) => {
                            const val = context.raw;
                            const pct = total > 0 ? ((val / total) * 100).toFixed(1) : 0;
                            return ` ${context.label}: ${val} pets (${pct}%)`;
                        }
                    }
                }
            }
        },
        plugins: [{
            id: "centerText",
            afterDraw(chart) {
                const { ctx, chartArea } = chart;
                if (!chartArea) return;
                const centerX = (chartArea.left + chartArea.right) / 2;
                const centerY = (chartArea.top + chartArea.bottom) / 2;

                ctx.save();
                ctx.font = "bold 22px 'Inter', sans-serif";
                ctx.fillStyle = "#0f172a";
                ctx.textAlign = "center";
                ctx.textBaseline = "middle";
                ctx.fillText(String(total), centerX, centerY - 6);

                ctx.font = "600 10px 'Inter', sans-serif";
                ctx.fillStyle = "#94a3b8";
                ctx.fillText("TOTAL PETS", centerX, centerY + 14);
                ctx.restore();
            }
        }]
    });
}

// =====================================================
// CASH BAR CHART
// =====================================================
function createCashChart(data, periodLabel, periodDescription) {
    const canvas = document.getElementById("cashDonationChart");
    const emptyState = document.getElementById("cashDonationEmpty");
    if (!canvas) return;

    if (cashDonationChart) cashDonationChart.destroy();

    const chartData = data.cash.chart || [];

    if (chartData.length === 0) {
        emptyState?.classList.remove("hidden");
        return;
    }
    emptyState?.classList.add("hidden");

    const labels = chartData.map(item => {
        if (data.period === "month") return formatDateLabel(item.label);
        if (data.period === "year") return formatMonthLabel(item.label);
        return item.label;
    });
    const values = chartData.map(item => Number(item.total || 0));

    cashDonationChart = new Chart(canvas, {
        type: "bar",
        data: {
            labels,
            datasets: [{
                label: "Cash (₱)",
                data: values,
                backgroundColor: (context) => {
                    const chart = context.chart;
                    const { ctx, chartArea } = chart;
                    if (!chartArea) return "rgba(245, 158, 11, 0.7)";
                    return createGradient(ctx, chartArea, "rgba(251, 191, 36, 0.35)", "rgba(217, 119, 6, 1)");
                },
                borderColor: "#d97706",
                borderWidth: 1.5,
                borderRadius: 8,
                borderSkipped: false,
                hoverBackgroundColor: "rgba(217, 119, 6, 1)"
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: (context) =>
                            ` ₱${Number(context.raw).toLocaleString("en-PH", {
                                minimumFractionDigits: 2
                            })}`
                    }
                }
            },
            scales: {
                x: {
                    grid: { display: false },
                    title: {
                        display: true,
                        text: data.period === "day" ? "Hour" : data.period === "year" ? "Month" : "Day",
                        color: "#94a3b8",
                        font: { size: 11, weight: "bold" }
                    }
                },
                y: {
                    beginAtZero: true,
                    grid: { color: "rgba(148, 163, 184, 0.15)" },
                    ticks: {
                        callback: (v) => "₱" + Number(v).toLocaleString()
                    },
                    title: {
                        display: true,
                        text: "Amount (₱)",
                        color: "#94a3b8",
                        font: { size: 11, weight: "bold" }
                    }
                }
            }
        }
    });
}

// =====================================================
// IN-KIND BAR CHART
// =====================================================
function createInKindChart(data, periodLabel, periodDescription) {
    const canvas = document.getElementById("inKindDonationChart");
    const emptyState = document.getElementById("inKindDonationEmpty");
    if (!canvas) return;

    if (inKindDonationChart) inKindDonationChart.destroy();

    const chartData = data.inKind.chart || [];

    if (chartData.length === 0) {
        emptyState?.classList.remove("hidden");
        return;
    }
    emptyState?.classList.add("hidden");

    const labels = chartData.map(item => {
        if (data.period === "month") return formatDateLabel(item.label);
        if (data.period === "year") return formatMonthLabel(item.label);
        return item.label;
    });
    const values = chartData.map(item => Number(item.quantity || 0));

    inKindDonationChart = new Chart(canvas, {
        type: "bar",
        data: {
            labels,
            datasets: [{
                label: "Quantity",
                data: values,
                backgroundColor: (context) => {
                    const chart = context.chart;
                    const { ctx, chartArea } = chart;
                    if (!chartArea) return "rgba(139, 92, 246, 0.7)";
                    return createGradient(ctx, chartArea, "rgba(167, 139, 250, 0.35)", "rgba(109, 40, 217, 1)");
                },
                borderColor: "#7c3aed",
                borderWidth: 1.5,
                borderRadius: 8,
                borderSkipped: false,
                hoverBackgroundColor: "rgba(109, 40, 217, 1)"
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: (context) => ` Quantity: ${context.raw}`
                    }
                }
            },
            scales: {
                x: {
                    grid: { display: false },
                    title: {
                        display: true,
                        text: data.period === "day" ? "Hour" : data.period === "year" ? "Month" : "Day",
                        color: "#94a3b8",
                        font: { size: 11, weight: "bold" }
                    }
                },
                y: {
                    beginAtZero: true,
                    ticks: { precision: 0 },
                    grid: { color: "rgba(148, 163, 184, 0.15)" },
                    title: {
                        display: true,
                        text: "Quantity",
                        color: "#94a3b8",
                        font: { size: 11, weight: "bold" }
                    }
                }
            }
        }
    });
}

// =====================================================
// INITIALIZE
// =====================================================
document.addEventListener("DOMContentLoaded", () => {
    const periodSelect = document.getElementById("analyticsPeriodType");
    const dateContainer = document.getElementById("analyticsDateContainer");

    function createDateInput() {
        const period = periodSelect.value;
        let inputType = "month";
        let value = new Date().toISOString().slice(0, 7);

        if (period === "day") {
            inputType = "date";
            value = new Date().toISOString().slice(0, 10);
        } else if (period === "year") {
            inputType = "number";
            value = new Date().getFullYear();
        }

        dateContainer.innerHTML = `
            <input
                id="analyticsDate"
                type="${inputType}"
                value="${value}"
                ${inputType === "number" ? `min="2000" max="2100"` : ""}
                class="bg-white border border-gray-200 text-gray-700 text-sm font-semibold py-2.5 px-4 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400"
            >
        `;
    }

    createDateInput();

    periodSelect.addEventListener("change", () => {
        createDateInput();
        loadAnalytics();
    });

    document.getElementById("refreshAnalyticsBtn")?.addEventListener("click", () => {
        loadAnalytics();
    });

    dateContainer.addEventListener("change", () => {
        loadAnalytics();
    });

    loadAnalytics();
});

// =====================================================
// ANALYTICS EXPORT (keep existing)
// =====================================================

function getExportPeriodLabel() {
    const period = document.getElementById("analyticsPeriodType")?.value || "year";
    const date = document.getElementById("analyticsDate")?.value || new Date().getFullYear().toString();

    if (period === "day") {
        const selectedDate = new Date(`${date}T00:00:00`);
        return selectedDate.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
    }
    if (period === "month") {
        const [year, month] = date.split("-");
        const selectedDate = new Date(Number(year), Number(month) - 1, 1);
        return selectedDate.toLocaleDateString("en-US", { month: "long", year: "numeric" });
    }
    return date;
}

function getGeneratedDate() {
    return new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

function toNumber(value) {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
}

function formatCurrencyPHP(value) {
    return "PHP " + toNumber(value).toLocaleString("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
}

function formatInteger(value) {
    return toNumber(value).toLocaleString("en-US");
}

function getAnalyticsExportData() {
    const periodLabel = getExportPeriodLabel();
    const organizationName = latestAnalyticsData?.organization?.name || "Organization";
    const pets = latestAnalyticsData?.pets || {};
    const cashTotal = toNumber(latestAnalyticsData?.cash?.total);
    const inKindTotal = toNumber(latestAnalyticsData?.inKind?.totalQuantity);
    const adoptionTotal = toNumber(latestAnalyticsData?.adoptions?.total);
    const availableTotal = toNumber(pets.available);

    return {
        organizationName,
        periodLabel,
        generatedDate: getGeneratedDate(),
        pets: {
            available: toNumber(pets.available),
            pending: toNumber(pets.pending),
            adopted: toNumber(pets.adopted),
            archived: toNumber(pets.archived),
            total: toNumber(pets.total)
        },
        cash: cashTotal,
        inKind: inKindTotal,
        adoptionTotal,
        availableTotal,
        cashFormatted: formatCurrencyPHP(cashTotal),
        inKindFormatted: `${formatInteger(inKindTotal)} item(s)`,
        adoptionTotalFormatted: formatInteger(adoptionTotal),
        availableTotalFormatted: formatInteger(availableTotal)
    };
}

function exportAnalyticsToExcel() {
    const data = getAnalyticsExportData();

    const rows = [
        ["PAWPON SYSTEM ANALYTICS"],
        ["Organization Name", data.organizationName],
        [],
        ["Report Period", data.periodLabel],
        ["Generated Date", data.generatedDate],
        [],
        ["PET OVERVIEW", ""],
        ["Available Pets", data.pets.available],
        ["Pending Pets", data.pets.pending],
        ["Adopted Pets", data.pets.adopted],
        ["Archived Pets", data.pets.archived],
        ["Total Pets", data.pets.total],
        [],
        ["DONATION SUMMARY", ""],
        ["Approved Cash Donations (PHP)", data.cash],
        ["Approved In-Kind Donations (items)", data.inKind],
        [],
        ["ADOPTION SUMMARY", ""],
        ["Approved Adoptions", data.adoptionTotal],
        ["Currently Available Pets", data.availableTotal]
    ];

    const worksheet = XLSX.utils.aoa_to_sheet(rows);
    worksheet["!cols"] = [{ wch: 36 }, { wch: 30 }];
    if (worksheet["B15"]) worksheet["B15"].z = '"PHP "#,##0.00';

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Analytics");

    const safeOrg = data.organizationName.replace(/[^a-zA-Z0-9]+/g, "_").replace(/^_+|_+$/g, "");
    const safePeriod = data.periodLabel.replace(/[^a-zA-Z0-9]+/g, "_").replace(/^_+|_+$/g, "");

    XLSX.writeFile(workbook, `Pawpon_Analytics_${safeOrg}_${safePeriod}.xlsx`);
}

function exportAnalyticsToPDF() {
    const data = getAnalyticsExportData();

    if (!window.jspdf) {
        alert("PDF export is currently unavailable.");
        return;
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.text("PAWPON SYSTEM ANALYTICS", 14, 20);

    doc.setFontSize(12);
    doc.text(`Organization: ${data.organizationName}`, 14, 29);

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(`Report Period: ${data.periodLabel}`, 14, 37);
    doc.text(`Generated Date: ${data.generatedDate}`, 14, 43);

    doc.setFontSize(13);
    doc.setFont("helvetica", "bold");
    doc.text("Pet Overview", 14, 55);

    doc.autoTable({
        startY: 59,
        head: [["Available", "Pending", "Adopted", "Archived", "Total"]],
        body: [[
            data.pets.available,
            data.pets.pending,
            data.pets.adopted,
            data.pets.archived,
            data.pets.total
        ]],
        theme: "grid",
        styles: { fontSize: 10, halign: "center" },
        headStyles: { fontStyle: "bold", fillColor: [30, 64, 175] }
    });

    let currentY = doc.lastAutoTable.finalY + 15;
    doc.setFontSize(13);
    doc.text("Donation Summary", 14, currentY);

    doc.autoTable({
        startY: currentY + 4,
        head: [["Donation Type", "Amount / Quantity"]],
        body: [
            ["Approved Cash Donations", data.cashFormatted],
            ["Approved In-Kind Donations", data.inKindFormatted]
        ],
        theme: "grid",
        styles: { fontSize: 10 },
        headStyles: { fontStyle: "bold", fillColor: [30, 64, 175] },
        columnStyles: { 0: { cellWidth: 100 }, 1: { cellWidth: 80, halign: "right" } }
    });

    currentY = doc.lastAutoTable.finalY + 15;
    doc.setFontSize(13);
    doc.text("Adoption Summary", 14, currentY);

    doc.autoTable({
        startY: currentY + 4,
        head: [["Metric", "Value"]],
        body: [
            ["Approved Adoptions", data.adoptionTotalFormatted],
            ["Currently Available Pets", data.availableTotalFormatted]
        ],
        theme: "grid",
        styles: { fontSize: 10 },
        headStyles: { fontStyle: "bold", fillColor: [30, 64, 175] },
        columnStyles: { 0: { cellWidth: 100 }, 1: { cellWidth: 80, halign: "right" } }
    });

    const pageHeight = doc.internal.pageSize.height;
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.text("Generated from Pawpon System Analytics", 14, pageHeight - 15);
    doc.text(`Generated on ${data.generatedDate}`, 14, pageHeight - 9);

    const safeOrg = data.organizationName.replace(/[^a-zA-Z0-9]+/g, "_").replace(/^_+|_+$/g, "");
    const safePeriod = data.periodLabel.replace(/[^a-zA-Z0-9]+/g, "_").replace(/^_+|_+$/g, "");
    doc.save(`Pawpon_Analytics_${safeOrg}_${safePeriod}.pdf`);
}

// =====================================================
// EXPORT MENU HANDLERS
// =====================================================
document.addEventListener("DOMContentLoaded", () => {
    const exportBtn = document.getElementById("exportAnalyticsBtn");
    const exportMenu = document.getElementById("exportAnalyticsMenu");
    const exportExcelBtn = document.getElementById("exportExcelBtn");
    const exportPdfBtn = document.getElementById("exportPdfBtn");

    exportBtn?.addEventListener("click", (event) => {
        event.stopPropagation();
        exportMenu?.classList.toggle("hidden");
    });

    exportExcelBtn?.addEventListener("click", () => {
        exportAnalyticsToExcel();
        exportMenu?.classList.add("hidden");
    });

    exportPdfBtn?.addEventListener("click", () => {
        exportAnalyticsToPDF();
        exportMenu?.classList.add("hidden");
    });

    document.addEventListener("click", (event) => {
        if (exportMenu && exportBtn &&
            !exportMenu.contains(event.target) &&
            !exportBtn.contains(event.target)) {
            exportMenu.classList.add("hidden");
        }
    });
});