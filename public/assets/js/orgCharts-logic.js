// ORGANIZATION ANALYTICS CHARTS
let adoptedPetsChart = null;
let availablePetsChart = null;
let cashDonationChart = null;
let inKindDonationChart = null;

// FORMAT PERIOD LABEL
function getPeriodLabel(period, date) {
    const selectedDate = new Date(`${date}T00:00:00`);
    if (period === "day") {
        return selectedDate.toLocaleDateString("en-US", {
            month: "long",
            day: "numeric",
            year: "numeric"
        });
    }
    if (period === "year") {
        return selectedDate.getFullYear().toString();
    }
    return selectedDate.toLocaleDateString("en-US", {
        month: "long",
        year: "numeric"
    });
}
// FORMAT DATE LABEL
function formatDateLabel(value) {
    const selectedDate = new Date(`${value}T00:00:00`);

    return selectedDate.toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric"
    });
}
// FORMAT MONTH LABEL
function formatMonthLabel(value) {
    const [year, month] = value.split("-");
    const date = new Date(Number(year), Number(month) - 1, 1);

    return date.toLocaleDateString("en-US", {
        month: "long",
        year: "numeric"
    });
}
// GET PERIOD DESCRIPTION
function getPeriodDescription(period) {
    if (period === "day") {
        return "Hourly";
    }
    if (period === "year") {
        return "Monthly";
    }
    return "Daily";
}
// LOAD ANALYTICS
async function loadAnalytics() {
    try {
        const periodElement =
            document.getElementById("analyticsPeriodType");
        const dateElement =
            document.getElementById("analyticsDate");
        const period =
            periodElement?.value || "month";
        const date =
            dateElement?.value ||
            new Date().toISOString().slice(0, 10);
        const response = await fetch(
            `/org/analytics/data?period=${encodeURIComponent(period)}&date=${encodeURIComponent(date)}`
        );
        const data = await response.json();

        console.log("Analytics DB response:", data);

        // Save latest response for export
        latestAnalyticsData = data;

        if (!data.success) {
            throw new Error(
                data.message || "Failed to load analytics."
            );
        }

        // PERIOD LABEL
        const periodLabel =
            getPeriodLabel(data.period, data.date);
        const periodDescription =
            getPeriodDescription(data.period);

        // PET SUMMARY
        document.getElementById("petAvailable").textContent =
            data.pets.available;
        document.getElementById("petPending").textContent =
            data.pets.pending;
        document.getElementById("petAdopted").textContent =
            data.pets.adopted;
        document.getElementById("petArchived").textContent =
            data.pets.archived;
        document.getElementById("petTotal").textContent =
            data.pets.total;

        // CASH SUMMARY
        const cashTotal =
            Number(data.cash.total || 0);
        document.getElementById("summaryCash").textContent =
            `₱${cashTotal.toLocaleString("en-PH", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
            })}`;
        document.getElementById("cashTotal").textContent =
            `₱${cashTotal.toLocaleString("en-PH", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
            })}`;
        document.getElementById("cashPeriodLabel").textContent =
            `${periodLabel} — Approved donations`;
        document.getElementById("cashPeriodLabelChart").textContent =
            periodLabel;

        // IN-KIND SUMMARY
        const inKindTotal =
            Number(data.inKind.totalQuantity || 0);
        document.getElementById("summaryInKind").textContent =
            inKindTotal.toLocaleString();
        document.getElementById("inKindTotal").textContent =
            inKindTotal.toLocaleString();
        document.getElementById("inKindPeriodLabel").textContent =
            `${periodLabel} — Approved donations`;
        document.getElementById("inKindPeriodLabelChart").textContent =
            periodLabel;

        // ADOPTION TOTAL
        const adoptionTotal =
            Number(data.adoptions.total || 0);
        document.getElementById("adoptedTotal").textContent =
            adoptionTotal;
        document.getElementById("adoptionPeriodLabel").textContent =
            periodLabel;

        // AVAILABLE PET TOTAL
        document.getElementById("availableTotal").textContent =
            data.pets.available;
        document.getElementById("availablePetsSubtitle").textContent =
            `Current available pets — ${periodLabel}`;

        // CHART SUBTITLES
        document.getElementById("adoptionChartSubtitle").textContent =
            `${periodLabel} — ${periodDescription} approved adoptions`;
        document.getElementById("cashChartSubtitle").textContent =
            `${periodLabel} — ${periodDescription} approved cash donations`;
        document.getElementById("inKindChartSubtitle").textContent =
            `${periodLabel} — ${periodDescription} approved in-kind donations`;

        // DRAW CHART
        createAdoptionChart(
            data,
            periodLabel,
            periodDescription
        );
        createAvailablePetsChart(
            data
        );
        createCashChart(
            data,
            periodLabel,
            periodDescription
        );
        createInKindChart(
            data,
            periodLabel,
            periodDescription
        );
    } catch (error) {
        console.error(
            "Analytics loading error:",
            error
        );
    }
}

// ADOPTION BAR CHART
function createAdoptionChart(
    data,
    periodLabel,
    periodDescription
) {
    const canvas =
        document.getElementById("adoptedPetsChart");
    if (!canvas) return;
    if (adoptedPetsChart) {
        adoptedPetsChart.destroy();
    }

    const chartData =
        data.adoptions.chart || [];
    const labels = chartData.map(item => {
        if (data.period === "month") {
            return formatDateLabel(item.label);
        }

        if (data.period === "year") {
            return formatMonthLabel(item.label);
        }

        return item.label;
    });
    const values =
        chartData.map(item => Number(item.total || 0));

    adoptedPetsChart =
        new Chart(canvas, {
            type: "bar",
            data: {
                labels,
                datasets: [{
                    label: "Approved adoptions",
                    data: values,
                    borderWidth: 1,
                    borderRadius: 6
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: true
                    },
                    tooltip: {
                        callbacks: {
                            title: function(items) {
                                return items[0].label;
                            },
                            label: function(context) {
                                return ` Approved adoptions: ${context.raw}`;
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        title: {
                            display: true,
                            text:
                                data.period === "day"
                                    ? "Hour"
                                    : data.period === "year"
                                        ? "Month"
                                        : "Day"
                        }
                    },
                    y: {
                        beginAtZero: true,
                        ticks: {
                            precision: 0
                        },
                        title: {
                            display: true,
                            text: "Number of approved adoptions"
                        }
                    }
                }
            }
        });
}

// AVAILABLE PETS DOUGHNUT
function createAvailablePetsChart(data) {
    const canvas =
        document.getElementById("availablePetsChart");
    if (!canvas) return;
    if (availablePetsChart) {
        availablePetsChart.destroy();
    }

    const speciesData =
    data.availableBySpecies || [];
    const labels =
        speciesData.map(item => item.species);
    const values =
        speciesData.map(item => Number(item.total || 0));

    availablePetsChart =
        new Chart(canvas, {
            type: "doughnut",
            data: {
                labels,
                datasets: [{
                    label: "Available pets",
                    data: values,
                    borderWidth: 2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: "bottom"
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                return ` ${context.label}: ${context.raw} pets`;
                            }
                        }
                    }
                }
            }
        });
}

// CASH BAR CHART
function createCashChart(
    data,
    periodLabel,
    periodDescription
) {
    const canvas =
        document.getElementById("cashDonationChart");
    if (!canvas) return;
    if (cashDonationChart) {
        cashDonationChart.destroy();
    }

    const chartData =
        data.cash.chart || [];
    const labels = chartData.map(item => {
        if (data.period === "month") {
            return formatDateLabel(item.label);
        }

        if (data.period === "year") {
            return formatMonthLabel(item.label);
        }

        return item.label;
    });
    const values =
        chartData.map(item => Number(item.total || 0));

    cashDonationChart =
        new Chart(canvas, {
            type: "bar",
            data: {
                labels,
                datasets: [{
                    label: "Approved cash donations (₱)",
                    data: values,
                    borderWidth: 1,
                    borderRadius: 6
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,

                plugins: {
                    legend: {
                        display: true
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                return ` ₱${Number(context.raw).toLocaleString("en-PH", {
                                    minimumFractionDigits: 2
                                })}`;
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        title: {
                            display: true,
                            text:
                                data.period === "day"
                                    ? "Hour"
                                    : data.period === "year"
                                        ? "Month"
                                        : "Day"
                        }
                    },
                    y: {
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: "Amount (₱)"
                        }
                    }
                }
            }
        });
}
// =====================================================
// IN-KIND BAR CHART
// =====================================================
function createInKindChart(
    data,
    periodLabel,
    periodDescription
) {
    const canvas =
        document.getElementById("inKindDonationChart");
    if (!canvas) return;
    if (inKindDonationChart) {
        inKindDonationChart.destroy();
    }

    const chartData =
        data.inKind.chart || [];
    const labels = chartData.map(item => {
        if (data.period === "month") {
            return formatDateLabel(item.label);
        }

        if (data.period === "year") {
            return formatMonthLabel(item.label);
        }

        return item.label;
    });
    const values =
        chartData.map(item => Number(item.quantity || 0));

    inKindDonationChart =
        new Chart(canvas, {
            type: "bar",
            data: {
                labels,
                datasets: [{
                    label: "Approved donated quantity",
                    data: values,
                    borderWidth: 1,
                    borderRadius: 6
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: true
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                return ` Quantity: ${context.raw}`;
                            }
                        }
                    }
                },

                scales: {
                    x: {
                        title: {
                            display: true,
                            text:
                                data.period === "day"
                                    ? "Hour"
                                    : data.period === "year"
                                        ? "Month"
                                        : "Day"
                        }
                    },
                    y: {
                        beginAtZero: true,
                        ticks: {
                            precision: 0
                        },
                        title: {
                            display: true,
                            text: "Quantity"
                        }
                    }
                }
            }
        });
}
// =====================================================
// INITIALIZE
// =====================================================
document.addEventListener(
    "DOMContentLoaded",
    () => {
        const periodSelect =
            document.getElementById("analyticsPeriodType");
        const dateContainer =
            document.getElementById("analyticsDateContainer");
        function createDateInput() {
            const period =
                periodSelect.value;
            let inputType = "month";
            let value =
                new Date().toISOString().slice(0, 7);

            if (period === "day") {
                inputType = "date";
                value =
                    new Date().toISOString().slice(0, 10);
            }

            else if (period === "year") {
                inputType = "number";
                value =
                    new Date().getFullYear();
            }

            dateContainer.innerHTML = `
                <input
                    id="analyticsDate"
                    type="${inputType}"
                    value="${value}"
                    ${inputType === "number"
                        ? `min="2000" max="2100"`
                        : ""
                    }
                    class="bg-white border border-gray-200
                           text-gray-700 text-sm font-semibold
                           py-2.5 px-4 rounded-xl shadow-sm
                           focus:outline-none focus:ring-2
                           focus:ring-blue-100
                           focus:border-blue-400"
                >
            `;
        }
        createDateInput();
        periodSelect.addEventListener(
            "change",
            () => {
                createDateInput();
                loadAnalytics();
            }
        );

        document
            .getElementById("refreshAnalyticsBtn")
            ?.addEventListener(
                "click",
                () => {
                    loadAnalytics();
                }
            );

        dateContainer.addEventListener(
            "change",
            () => {
                loadAnalytics();
            }
        );
        loadAnalytics();
    }
);

// =====================================================
// ANALYTICS EXPORT
// =====================================================

// Store the latest analytics response
let latestAnalyticsData = null;


// =====================================================
// FORMAT REPORT PERIOD
// =====================================================

function getExportPeriodLabel() {
    const period = document.getElementById("analyticsPeriodType")?.value || "year";
    const date = document.getElementById("analyticsDate")?.value || new Date().getFullYear().toString();

    // DAY
    if (period === "day") {
        const selectedDate = new Date(`${date}T00:00:00`);

        return selectedDate.toLocaleDateString("en-US", {
            month: "long",
            day: "numeric",
            year: "numeric"
        });
    }

    // MONTH
    if (period === "month") {
        const [year, month] = date.split("-");
        const selectedDate = new Date(Number(year), Number(month) - 1, 1);

        return selectedDate.toLocaleDateString("en-US", {
            month: "long",
            year: "numeric"
        });
    }

    // YEAR
    return date;
}


// =====================================================
// FORMAT GENERATED DATE
// =====================================================

function getGeneratedDate() {
    return new Date().toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric"
    });
}


// =====================================================
// HELPERS - SAFE NUMBER FORMATTING
// =====================================================

// Convert anything to a safe finite number
function toNumber(value) {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
}

// ASCII-safe currency string (no ₱ glyph — needed for PDF fonts)
function formatCurrencyPHP(value) {
    const n = toNumber(value);
    return "PHP " + n.toLocaleString("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
}

// Integer with commas
function formatInteger(value) {
    return toNumber(value).toLocaleString("en-US");
}


// =====================================================
// GET CURRENT ANALYTICS SUMMARY
// =====================================================

function getAnalyticsExportData() {
    const period = document.getElementById("analyticsPeriodType")?.value || "year";
    const periodLabel = getExportPeriodLabel();
    const organizationName = latestAnalyticsData?.organization?.name || "Organization";

    const pets = latestAnalyticsData?.pets || {};
    const cashTotal = toNumber(latestAnalyticsData?.cash?.total);
    const inKindTotal = toNumber(latestAnalyticsData?.inKind?.totalQuantity);
    const adoptionTotal = toNumber(latestAnalyticsData?.adoptions?.total);
    const availableTotal = toNumber(pets.available);

    return {
        organizationName,
        period,
        periodLabel,
        generatedDate: getGeneratedDate(),

        pets: {
            available: toNumber(pets.available),
            pending: toNumber(pets.pending),
            adopted: toNumber(pets.adopted),
            archived: toNumber(pets.archived),
            total: toNumber(pets.total)
        },

        // RAW numbers (Excel — kept numeric so they stay summable)
        cash: cashTotal,
        inKind: inKindTotal,
        adoptionTotal: adoptionTotal,
        availableTotal: availableTotal,

        // PRE-FORMATTED strings (PDF — ASCII-safe, no ₱)
        cashFormatted: formatCurrencyPHP(cashTotal),
        inKindFormatted: `${formatInteger(inKindTotal)} item(s)`,
        adoptionTotalFormatted: formatInteger(adoptionTotal),
        availableTotalFormatted: formatInteger(availableTotal)
    };
}


// =====================================================
// EXPORT TO EXCEL
// =====================================================

function exportAnalyticsToExcel() {
    const data = getAnalyticsExportData();

    // =================================================
    // EXCEL DATA (numbers stay numbers, labels stay labels)
    // =================================================

    const rows = [
        // HEADER
        ["PAWPON SYSTEM ANALYTICS"],
        ["Organization Name", data.organizationName],
        [],
        ["Report Period", data.periodLabel],
        ["Generated Date", data.generatedDate],
        [],
        ["Generated from", "Pawpon System Analytics"],
        [],

        // PET OVERVIEW
        ["PET OVERVIEW", ""],
        ["Available Pets", data.pets.available],
        ["Pending Pets", data.pets.pending],
        ["Adopted Pets", data.pets.adopted],
        ["Archived Pets", data.pets.archived],
        ["Total Pets", data.pets.total],
        [],

        // DONATION SUMMARY
        ["DONATION SUMMARY", ""],
        ["Approved Cash Donations (PHP)", data.cash],
        ["Approved In-Kind Donations (items)", data.inKind],
        [],

        // ADOPTION SUMMARY
        ["ADOPTION SUMMARY", ""],
        ["Approved Adoptions", data.adoptionTotal],
        ["Currently Available Pets", data.availableTotal]
    ];

    // =================================================
    // CREATE WORKSHEET
    // =================================================

    const worksheet = XLSX.utils.aoa_to_sheet(rows);

    // =================================================
    // COLUMN WIDTHS
    // =================================================

    worksheet["!cols"] = [
        { wch: 36 },
        { wch: 30 }
    ];

    // =================================================
    // CURRENCY FORMAT ON CASH CELL
    // Row 15 (1-indexed) is "Approved Cash Donations (PHP)"
    // The value lives in B15.
    // =================================================

    if (worksheet["B15"]) {
        worksheet["B15"].z = '"PHP "#,##0.00';
    }

    // =================================================
    // CREATE WORKBOOK
    // =================================================

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Analytics");

    // =================================================
    // FILE NAME
    // =================================================

    const safeOrganizationName = data.organizationName
        .replace(/[^a-zA-Z0-9]+/g, "_")
        .replace(/^_+|_+$/g, "");

    const safePeriod = data.periodLabel
        .replace(/[^a-zA-Z0-9]+/g, "_")
        .replace(/^_+|_+$/g, "");

    const fileName = `Pawpon_Analytics_${safeOrganizationName}_${safePeriod}.xlsx`;

    // =================================================
    // DOWNLOAD
    // =================================================

    XLSX.writeFile(workbook, fileName);
}


// =====================================================
// EXPORT TO PDF
// =====================================================

function exportAnalyticsToPDF() {
    const data = getAnalyticsExportData();

    // =================================================
    // CHECK JSPDF
    // =================================================

    if (!window.jspdf) {
        console.error("jsPDF library is not loaded.");
        alert("PDF export is currently unavailable. Please refresh the page and try again.");
        return;
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    // =================================================
    // HEADER
    // =================================================

    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.text("PAWPON SYSTEM ANALYTICS", 14, 20);

    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text(`Organization: ${data.organizationName}`, 14, 29);

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(`Report Period: ${data.periodLabel}`, 14, 37);
    doc.text(`Generated Date: ${data.generatedDate}`, 14, 43);

    // =================================================
    // PET OVERVIEW
    // =================================================

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
        styles: {
            fontSize: 10,
            halign: "center"
        },
        headStyles: {
            fontStyle: "bold",
            fillColor: [30, 64, 175]
        }
    });

    // =================================================
    // DONATION SUMMARY (2-column layout, ASCII-safe values)
    // =================================================

    let currentY = doc.lastAutoTable.finalY + 15;

    doc.setFontSize(13);
    doc.setFont("helvetica", "bold");
    doc.text("Donation Summary", 14, currentY);

    doc.autoTable({
        startY: currentY + 4,
        head: [["Donation Type", "Amount / Quantity"]],
        body: [
            ["Approved Cash Donations", data.cashFormatted],
            ["Approved In-Kind Donations", data.inKindFormatted]
        ],
        theme: "grid",
        styles: {
            fontSize: 10
        },
        headStyles: {
            fontStyle: "bold",
            fillColor: [30, 64, 175]
        },
        columnStyles: {
            0: { cellWidth: 100, halign: "left" },
            1: { cellWidth: 80, halign: "right" }
        }
    });

    // =================================================
    // ADOPTION SUMMARY
    // =================================================

    currentY = doc.lastAutoTable.finalY + 15;

    doc.setFontSize(13);
    doc.setFont("helvetica", "bold");
    doc.text("Adoption Summary", 14, currentY);

    doc.autoTable({
        startY: currentY + 4,
        head: [["Metric", "Value"]],
        body: [
            ["Approved Adoptions", data.adoptionTotalFormatted],
            ["Currently Available Pets", data.availableTotalFormatted]
        ],
        theme: "grid",
        styles: {
            fontSize: 10
        },
        headStyles: {
            fontStyle: "bold",
            fillColor: [30, 64, 175]
        },
        columnStyles: {
            0: { cellWidth: 100, halign: "left" },
            1: { cellWidth: 80, halign: "right" }
        }
    });

    // =================================================
    // FOOTER
    // =================================================

    const pageHeight = doc.internal.pageSize.height;

    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.text("Generated from Pawpon System Analytics", 14, pageHeight - 15);
    doc.text(`Generated on ${data.generatedDate}`, 14, pageHeight - 9);

    // =================================================
    // FILE NAME
    // =================================================

    const safeOrganizationName = data.organizationName
        .replace(/[^a-zA-Z0-9]+/g, "_")
        .replace(/^_+|_+$/g, "");

    const safePeriod = data.periodLabel
        .replace(/[^a-zA-Z0-9]+/g, "_")
        .replace(/^_+|_+$/g, "");

    const fileName = `Pawpon_Analytics_${safeOrganizationName}_${safePeriod}.pdf`;

    // =================================================
    // DOWNLOAD
    // =================================================

    doc.save(fileName);
}


// =====================================================
// EXPORT MENU
// =====================================================

document.addEventListener("DOMContentLoaded", () => {
    const exportBtn = document.getElementById("exportAnalyticsBtn");
    const exportMenu = document.getElementById("exportAnalyticsMenu");
    const exportExcelBtn = document.getElementById("exportExcelBtn");
    const exportPdfBtn = document.getElementById("exportPdfBtn");

    // =================================================
    // OPEN / CLOSE EXPORT MENU
    // =================================================

    exportBtn?.addEventListener("click", (event) => {
        event.stopPropagation();
        exportMenu?.classList.toggle("hidden");
    });

    // =================================================
    // EXPORT EXCEL
    // =================================================

    exportExcelBtn?.addEventListener("click", () => {
        exportAnalyticsToExcel();
        exportMenu?.classList.add("hidden");
    });

    // =================================================
    // EXPORT PDF
    // =================================================

    exportPdfBtn?.addEventListener("click", () => {
        exportAnalyticsToPDF();
        exportMenu?.classList.add("hidden");
    });

    // =================================================
    // CLOSE MENU WHEN CLICKING OUTSIDE
    // =================================================

    document.addEventListener("click", (event) => {
        if (
            exportMenu &&
            exportBtn &&
            !exportMenu.contains(event.target) &&
            !exportBtn.contains(event.target)
        ) {
            exportMenu.classList.add("hidden");
        }
    });
});