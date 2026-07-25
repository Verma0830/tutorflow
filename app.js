/* ==========================================
   TutorFlow JS - Roster & Attendance Logic
   ========================================== */

// --- Global App State ---
let state = {
    students: [],      // Array of { id, name, class, fees }
    attendance: {},    // Keyed by "YYYY-MM-DD": { studentId: "present" | "absent" | "late" }
    fees: {},          // Keyed by "YYYY-MM": { studentId: true (paid) | false (pending) }
    currentTab: "dashboard",
    currentDate: "",   // "YYYY-MM-DD"
    currentMonth: "",  // "YYYY-MM"
    activeClassFilterAttendance: "all",
    activeClassFilterFees: "all",
    activeFeeStatusFilter: "all",
    activeRosterClassFilter: "all",
    searchQuery: "",
    chartInstance: null,
    fpInstance: null
};

// --- DOM Elements ---
const elements = {
    // Navigation
    navButtons: document.querySelectorAll(".nav-btn"),
    tabContents: document.querySelectorAll(".tab-content"),
    themeToggleBtn: document.getElementById("theme-toggle-btn"),
    mobileThemeToggleBtn: document.getElementById("mobile-theme-toggle-btn"),
    
    // Header
    globalSearch: document.getElementById("global-search"),
    attendanceDateInput: document.getElementById("attendance-date"),
    
    // Dashboard Stats
    statTotalStudents: document.getElementById("stat-total-students"),
    statPresentToday: document.getElementById("stat-present-today"),
    statPresentPct: document.getElementById("stat-present-pct"),
    statAbsentToday: document.getElementById("stat-absent-today"),
    statFeesCollected: document.getElementById("stat-fees-collected"),
    statFeesProgress: document.getElementById("stat-fees-progress"),
    classSummaryRows: document.getElementById("class-summary-rows"),
    
    // Attendance View
    attendanceViewTitle: document.getElementById("attendance-view-title"),
    attendanceStudentList: document.getElementById("attendance-student-list"),
    classFiltersAttendance: document.getElementById("class-filters-attendance"),
    markAllPresentBtn: document.getElementById("mark-all-present-btn"),
    markAllOffBtn: document.getElementById("mark-all-off-btn"),
    
    // Fee View
    feeMonthSelector: document.getElementById("fee-month-selector"),
    classFiltersFees: document.getElementById("class-filters-fees"),
    feeStatusFilter: document.getElementById("fee-status-filter"),
    feesStudentList: document.getElementById("fees-student-list"),
    
    // Roster & Sync View
    excelUploadInput: document.getElementById("excel-upload-input"),
    excelExportBtn: document.getElementById("excel-export-btn"),
    rosterCount: document.getElementById("roster-count"),
    rosterClassFilter: document.getElementById("roster-class-filter"),
    rosterTableRows: document.getElementById("roster-table-rows"),
    addStudentBtn: document.getElementById("add-student-btn"),
    
    // Student Modal
    studentModal: document.getElementById("student-modal"),
    modalTitle: document.getElementById("modal-title"),
    studentForm: document.getElementById("student-form"),
    studentEditId: document.getElementById("student-edit-id"),
    studentNameInput: document.getElementById("student-name"),
    studentClassInput: document.getElementById("student-class"),
    studentFeesInput: document.getElementById("student-fees"),
    studentJoiningDateInput: document.getElementById("student-joining-date"),
    modalCancelBtn: document.getElementById("modal-cancel-btn"),
    modalCloseBtn: document.getElementById("modal-close-btn"),
    
    // Toast
    toast: document.getElementById("toast"),
    toastIcon: document.getElementById("toast-icon"),
    toastMessage: document.getElementById("toast-message")
};

// --- Initialization ---
document.addEventListener("DOMContentLoaded", async () => {
    initDates();
    setupTheme();
    setupEventListeners();
    await loadInitialData();
    updateAppView();
    
    // Register Service Worker for PWA
    if ('serviceWorker' in navigator) {
        try {
            const reg = await navigator.serviceWorker.register('./sw.js');
            console.log('Service Worker registered successfully!', reg.scope);
        } catch (err) {
            console.error('Service Worker registration failed:', err);
        }
    }
});

// --- Date Initialization ---
function initDates() {
    const today = new Date();
    // Format YYYY-MM-DD
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    
    state.currentDate = `${yyyy}-${mm}-${dd}`;
    state.currentMonth = `${yyyy}-${mm}`;
    
    elements.feeMonthSelector.value = state.currentMonth;
    
    // Initialize Flatpickr (Premium Custom Calendar)
    state.fpInstance = flatpickr("#attendance-date", {
        dateFormat: "Y-m-d",
        altInput: true,
        altFormat: "d-m-Y",
        defaultDate: state.currentDate,
        disableMobile: "true", // Force custom calendar even on mobile for consistent high-end UI
        onChange: function(selectedDates, dateStr, instance) {
            state.currentDate = dateStr;
            state.currentMonth = dateStr.substring(0, 7);
            elements.feeMonthSelector.value = state.currentMonth;
            updateAppView();
        },
        onDayCreate: function(dObj, dStr, fp, dayElem) {
            // Get date string
            const date = dayElem.dateObj;
            const yyyy = date.getFullYear();
            const mm = String(date.getMonth() + 1).padStart(2, '0');
            const dd = String(date.getDate()).padStart(2, '0');
            const dateStr = `${yyyy}-${mm}-${dd}`;
            
            // Look up attendance records
            const records = state.attendance[dateStr];
            if (records && Object.keys(records).length > 0) {
                const statuses = Object.values(records);
                
                // All marked students are off
                const allOff = statuses.every(s => s === "off");
                
                // At least one active student had tuition
                const hasOn = statuses.some(s => s === "present" || s === "absent");
                
                if (allOff) {
                    dayElem.classList.add("fp-day-tuition-off");
                } else if (hasOn) {
                    dayElem.classList.add("fp-day-tuition-on");
                }
            }
        }
    });
}

// --- Theme Setup ---
function setupTheme() {
    const savedTheme = localStorage.getItem("tutorflow_theme") || "light";
    const darkFpTheme = document.getElementById("flatpickr-dark-theme");
    
    if (savedTheme === "dark") {
        document.body.classList.add("dark-theme");
        document.body.classList.remove("light-theme");
        elements.themeToggleBtn.querySelector("span").textContent = "light_mode";
        elements.themeToggleBtn.querySelector("span:last-child").textContent = "Light Mode";
        if (elements.mobileThemeToggleBtn) {
            elements.mobileThemeToggleBtn.querySelector("span").textContent = "light_mode";
        }
        if (darkFpTheme) darkFpTheme.removeAttribute("disabled");
    } else {
        document.body.classList.add("light-theme");
        document.body.classList.remove("dark-theme");
        elements.themeToggleBtn.querySelector("span").textContent = "dark_mode";
        elements.themeToggleBtn.querySelector("span:last-child").textContent = "Dark Mode";
        if (elements.mobileThemeToggleBtn) {
            elements.mobileThemeToggleBtn.querySelector("span").textContent = "dark_mode";
        }
        if (darkFpTheme) darkFpTheme.setAttribute("disabled", "true");
    }
}

function toggleTheme() {
    const isDark = document.body.classList.toggle("dark-theme");
    document.body.classList.toggle("light-theme", !isDark);
    
    localStorage.setItem("tutorflow_theme", isDark ? "dark" : "light");
    
    elements.themeToggleBtn.querySelector("span").textContent = isDark ? "light_mode" : "dark_mode";
    elements.themeToggleBtn.querySelector("span:last-child").textContent = isDark ? "Light Mode" : "Dark Mode";
    if (elements.mobileThemeToggleBtn) {
        elements.mobileThemeToggleBtn.querySelector("span").textContent = isDark ? "light_mode" : "dark_mode";
    }
    
    const darkFpTheme = document.getElementById("flatpickr-dark-theme");
    if (darkFpTheme) {
        if (isDark) darkFpTheme.removeAttribute("disabled");
        else darkFpTheme.setAttribute("disabled", "true");
    }
    
    showToast(isDark ? "Dark theme enabled" : "Light theme enabled", "info");
    
    // Re-render chart to adjust grid colors
    renderAttendanceChart();
}

// --- Data Loading & Storage ---
async function loadInitialData() {
    // Load Students
    try {
        const cachedStudents = localStorage.getItem("tutorflow_students");
        if (cachedStudents) {
            state.students = JSON.parse(cachedStudents);
            // Self-healing merge to pull joiningDates from students.json for existing students
            try {
                const response = await fetch("students.json");
                if (response.ok) {
                    const freshStudents = await response.json();
                    let merged = false;
                    state.students.forEach(student => {
                        const fresh = freshStudents.find(s => s.name.toLowerCase().trim() === student.name.toLowerCase().trim());
                        if (fresh && fresh.joiningDate && !student.joiningDate) {
                            student.joiningDate = fresh.joiningDate;
                            merged = true;
                        }
                    });
                    if (merged) {
                        localStorage.setItem("tutorflow_students", JSON.stringify(state.students));
                    }
                }
            } catch (e) {
                console.error("Failed to merge cached students with students.json", e);
            }
        } else {
            // Fallback: Fetch from students.json
            try {
                const response = await fetch("students.json");
                if (response.ok) {
                    state.students = await response.json();
                    localStorage.setItem("tutorflow_students", JSON.stringify(state.students));
                }
            } catch (e) {
                console.error("Failed to load students.json, loading empty list.", e);
                state.students = [];
            }
        }
    } catch (err) {
        console.error("Failed to load cached students", err);
        state.students = [];
    }
    
    // Load Attendance
    try {
        const cachedAttendance = localStorage.getItem("tutorflow_attendance");
        state.attendance = cachedAttendance ? JSON.parse(cachedAttendance) : {};
    } catch (err) {
        console.error("Failed to load cached attendance", err);
        state.attendance = {};
    }
    
    // Load Fees
    try {
        const cachedFees = localStorage.getItem("tutorflow_fees");
        state.fees = cachedFees ? JSON.parse(cachedFees) : {};
    } catch (err) {
        console.error("Failed to load cached fees", err);
        state.fees = {};
    }
}

function saveData() {
    try {
        localStorage.setItem("tutorflow_students", JSON.stringify(state.students));
        localStorage.setItem("tutorflow_attendance", JSON.stringify(state.attendance));
        localStorage.setItem("tutorflow_fees", JSON.stringify(state.fees));
    } catch (e) {
        console.error("Failed to save data to localStorage", e);
        showToast("Storage error: Private Mode might block saving.", "error");
    }
}

// --- Event Listeners ---
function setupEventListeners() {
    // Navigation Tabs
    elements.navButtons.forEach(btn => {
        btn.addEventListener("click", () => {
            elements.navButtons.forEach(b => b.classList.remove("active"));
            btn.classList.add("active");
            
            const tabId = btn.getAttribute("data-tab");
            state.currentTab = tabId;
            
            elements.tabContents.forEach(content => {
                content.classList.remove("active");
                if (content.id === `tab-${tabId}`) {
                    content.classList.add("active");
                }
            });
            
            updateAppView();
        });
    });
    
    // Theme Toggle
    elements.themeToggleBtn.addEventListener("click", toggleTheme);
    if (elements.mobileThemeToggleBtn) {
        elements.mobileThemeToggleBtn.addEventListener("click", toggleTheme);
    }
    
    // Global Search
    elements.globalSearch.addEventListener("input", (e) => {
        state.searchQuery = e.target.value.toLowerCase().trim();
        updateAppView();
    });
    
    // Attendance Date Wrapper Click (triggers Flatpickr)
    const dateWrapper = document.querySelector(".date-picker-wrapper");
    if (dateWrapper) {
        dateWrapper.addEventListener("click", () => {
            if (state.fpInstance) {
                state.fpInstance.open();
            }
        });
    }
    
    // Fee Month Change & Click (to trigger showPicker)
    elements.feeMonthSelector.addEventListener("change", (e) => {
        state.currentMonth = e.target.value;
        // Keep date matching month (first day of the selected month if month changed)
        const dateParts = state.currentDate.split('-');
        if (`${dateParts[0]}-${dateParts[1]}` !== state.currentMonth) {
            state.currentDate = `${state.currentMonth}-01`;
            if (state.fpInstance) {
                state.fpInstance.setDate(state.currentDate);
            }
        }
        
        updateAppView();
    });
    
    elements.feeMonthSelector.addEventListener("click", () => {
        try {
            elements.feeMonthSelector.showPicker();
        } catch (err) {
            console.log("showPicker failed", err);
        }
    });

    const monthWrapper = document.querySelector(".month-selector-wrapper");
    if (monthWrapper) {
        monthWrapper.addEventListener("click", (e) => {
            if (e.target !== elements.feeMonthSelector) {
                try {
                    elements.feeMonthSelector.showPicker();
                } catch (err) {
                    console.log("showPicker failed", err);
                }
            }
        });
    }
    
    // Mark All Present Button
    elements.markAllPresentBtn.addEventListener("click", markAllDisplayedPresent);
    
    // Mark All Off Button
    elements.markAllOffBtn.addEventListener("click", markAllDisplayedOff);
    
    // Fee Status Dropdown Filter
    elements.feeStatusFilter.addEventListener("change", (e) => {
        state.activeFeeStatusFilter = e.target.value;
        renderFeesList();
    });
    
    // Roster Class Filter Dropdown
    elements.rosterClassFilter.addEventListener("change", (e) => {
        state.activeRosterClassFilter = e.target.value;
        renderRosterList();
    });
    
    // Modal controls
    elements.addStudentBtn.addEventListener("click", () => openStudentModal());
    elements.modalCloseBtn.addEventListener("click", closeStudentModal);
    elements.modalCancelBtn.addEventListener("click", closeStudentModal);
    elements.studentForm.addEventListener("submit", handleStudentFormSubmit);
    
    // Excel Import / Export
    elements.excelUploadInput.addEventListener("change", handleExcelImport);
    elements.excelExportBtn.addEventListener("click", handleExcelExport);

    // Onboarding starter guide controls
    const onboardingCard = document.getElementById("onboarding-guide");
    const closeOnboardingBtn = document.getElementById("close-onboarding-btn");
    if (onboardingCard && closeOnboardingBtn) {
        if (localStorage.getItem("tutorflow_hide_onboarding") === "true") {
            onboardingCard.style.display = "none";
        }
        closeOnboardingBtn.addEventListener("click", () => {
            onboardingCard.style.display = "none";
            localStorage.setItem("tutorflow_hide_onboarding", "true");
            showToast("Starter guide hidden.", "info");
        });
    }
}

// --- Sunday Default holiday Auto-Check ---
function checkAndDefaultSunday() {
    if (!state.currentDate || state.students.length === 0) return;
    
    // Parse selected date in local timezone
    const dateParts = state.currentDate.split('-');
    const year = parseInt(dateParts[0]);
    const month = parseInt(dateParts[1]) - 1;
    const day = parseInt(dateParts[2]);
    const dateObj = new Date(year, month, day);
    
    const isSunday = dateObj.getDay() === 0; // 0 is Sunday
    const hasRecords = state.attendance[state.currentDate] && Object.keys(state.attendance[state.currentDate]).length > 0;
    
    if (isSunday && !hasRecords) {
        state.attendance[state.currentDate] = {};
        state.students.forEach(student => {
            state.attendance[state.currentDate][student.id] = "off";
        });
        saveData();
        showToast("Sunday detected: Defaulted to Tuition Holiday. You can override status below.", "info");
    }
}

// --- Global View Update Orchestrator ---
function updateAppView() {
    // Check if the current date is a Sunday and default to Holiday if unmarked
    checkAndDefaultSunday();
    
    populateClassFilters();
    
    // Redraw calendar to update colors based on attendance status
    if (state.fpInstance) {
        state.fpInstance.redraw();
    }
    
    // Update active tab contents
    if (state.currentTab === "dashboard") {
        updateDashboardStats();
        renderClassSummary();
        renderAttendanceChart();
    } else if (state.currentTab === "attendance") {
        updateAttendanceHeader();
        renderAttendanceList();
    } else if (state.currentTab === "fees") {
        renderFeesList();
    } else if (state.currentTab === "roster") {
        renderRosterList();
    }
}

// --- Fee Calculation Helper ---
function calculateStudentMonthlyFee(studentId, monthStr) {
    const student = state.students.find(s => s.id === studentId);
    if (!student) return { baseFee: 0, calculatedFee: 0, daysInMonth: 30, offCount: 0, daysOn: 30, notJoinedDays: 0, joinedMidMonth: false, notYetJoined: false };
    
    const parts = monthStr.split('-');
    const year = parseInt(parts[0]);
    const month = parseInt(parts[1]);
    const daysInMonth = new Date(year, month, 0).getDate();
    
    let baseFee = student.fees;
    
    // Check joining date
    if (student.joiningDate) {
        const joiningMonthStr = student.joiningDate.substring(0, 7); // "YYYY-MM"
        
        if (monthStr < joiningMonthStr) {
            // Student had not joined yet in this month
            return {
                baseFee: baseFee,
                calculatedFee: 0,
                daysInMonth: daysInMonth,
                offCount: 0,
                daysOn: 0,
                notJoinedDays: daysInMonth,
                joinedMidMonth: false,
                notYetJoined: true
            };
        } else if (monthStr === joiningMonthStr) {
            // Student joined in this month!
            const joiningDay = parseInt(student.joiningDate.split('-')[2]);
            const notJoinedDays = joiningDay - 1;
            
            // Count off days only on or after the joining day
            let offCount = 0;
            for (let day = joiningDay; day <= daysInMonth; day++) {
                const dateKey = `${monthStr}-${String(day).padStart(2, '0')}`;
                const dayRecord = state.attendance[dateKey] || {};
                if (dayRecord[studentId] === "off") {
                    offCount++;
                }
            }
            
            const daysOn = daysInMonth - notJoinedDays - offCount;
            const activeDays = Math.max(0, daysOn);
            const calculatedFee = Math.round(baseFee * (activeDays / daysInMonth));
            
            return {
                baseFee: baseFee,
                calculatedFee: calculatedFee,
                daysInMonth: daysInMonth,
                offCount: offCount,
                daysOn: activeDays,
                notJoinedDays: notJoinedDays,
                joinedMidMonth: true,
                notYetJoined: false
            };
        }
    }
    
    // Default / Joined before this month case
    let offCount = 0;
    for (let day = 1; day <= daysInMonth; day++) {
        const dateKey = `${monthStr}-${String(day).padStart(2, '0')}`;
        const dayRecord = state.attendance[dateKey] || {};
        if (dayRecord[studentId] === "off") {
            offCount++;
        }
    }
    
    const daysOn = Math.max(0, daysInMonth - offCount);
    const calculatedFee = Math.round(baseFee * (daysOn / daysInMonth));
    
    return {
        baseFee: baseFee,
        calculatedFee: calculatedFee,
        daysInMonth: daysInMonth,
        offCount: offCount,
        daysOn: daysOn,
        notJoinedDays: 0,
        joinedMidMonth: false,
        notYetJoined: false
    };
}

// --- Class Filters Population ---
function populateClassFilters() {
    // Extract unique classes/grades
    const classes = [...new Set(state.students.map(s => s.class))].sort((a, b) => {
        // Numeric sort if possible
        const numA = parseInt(a);
        const numB = parseInt(b);
        if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
        return a.localeCompare(b);
    });
    
    // Render pill filters in Attendance View
    const attFilterContainer = elements.classFiltersAttendance;
    const selectedAttClass = state.activeClassFilterAttendance;
    
    let attHTML = `<button class="pill-btn ${selectedAttClass === 'all' ? 'active' : ''}" data-class="all">All Grades</button>`;
    classes.forEach(c => {
        attHTML += `<button class="pill-btn ${selectedAttClass === c ? 'active' : ''}" data-class="${c}">Class ${c}</button>`;
    });
    attFilterContainer.innerHTML = attHTML;
    
    // Add event listeners to attendance class pills
    attFilterContainer.querySelectorAll(".pill-btn").forEach(btn => {
        btn.addEventListener("click", () => {
            state.activeClassFilterAttendance = btn.getAttribute("data-class");
            attFilterContainer.querySelectorAll(".pill-btn").forEach(b => b.classList.remove("active"));
            btn.classList.add("active");
            renderAttendanceList();
        });
    });

    // Render pill filters in Fee View
    const feeFilterContainer = elements.classFiltersFees;
    const selectedFeeClass = state.activeClassFilterFees;
    
    let feeHTML = `<button class="pill-btn ${selectedFeeClass === 'all' ? 'active' : ''}" data-class="all">All Grades</button>`;
    classes.forEach(c => {
        feeHTML += `<button class="pill-btn ${selectedFeeClass === c ? 'active' : ''}" data-class="${c}">Class ${c}</button>`;
    });
    feeFilterContainer.innerHTML = feeHTML;
    
    // Add event listeners to fee class pills
    feeFilterContainer.querySelectorAll(".pill-btn").forEach(btn => {
        btn.addEventListener("click", () => {
            state.activeClassFilterFees = btn.getAttribute("data-class");
            feeFilterContainer.querySelectorAll(".pill-btn").forEach(b => b.classList.remove("active"));
            btn.classList.add("active");
            renderFeesList();
        });
    });

    // Roster Dropdown
    const selectedRosterClass = state.activeRosterClassFilter;
    let optHTML = `<option value="all" ${selectedRosterClass === 'all' ? 'selected' : ''}>All Classes</option>`;
    classes.forEach(c => {
        optHTML += `<option value="${c}" ${selectedRosterClass === c ? 'selected' : ''}>Class ${c}</option>`;
    });
    elements.rosterClassFilter.innerHTML = optHTML;
}

// --- Dashboard View Logic ---
function updateDashboardStats() {
    const total = state.students.length;
    elements.statTotalStudents.textContent = total;
    
    // Attendance stats
    const todayRecords = state.attendance[state.currentDate] || {};
    let presentCount = 0;
    let absentCount = 0;
    let offCount = 0;
    
    state.students.forEach(student => {
        const status = todayRecords[student.id];
        if (status === "present") presentCount++;
        else if (status === "absent") absentCount++;
        else if (status === "off") offCount++;
    });
    
    elements.statPresentToday.textContent = presentCount;
    elements.statAbsentToday.textContent = absentCount;
    
    const activeTotal = total - offCount;
    const presentPct = activeTotal > 0 ? Math.round((presentCount / activeTotal) * 100) : 0;
    
    let subtext = `${presentPct}% attendance`;
    if (offCount > 0) {
        subtext += ` (${offCount} off)`;
    }
    elements.statPresentPct.textContent = subtext;
    
    // Fee stats
    const monthFees = state.fees[state.currentMonth] || {};
    let collectedSum = 0;
    let expectedSum = 0;
    
    state.students.forEach(student => {
        const feeInfo = calculateStudentMonthlyFee(student.id, state.currentMonth);
        expectedSum += feeInfo.calculatedFee;
        if (monthFees[student.id] === true) {
            collectedSum += feeInfo.calculatedFee;
        }
    });
    
    elements.statFeesCollected.textContent = `₹${collectedSum.toLocaleString()}`;
    const feePct = expectedSum > 0 ? Math.round((collectedSum / expectedSum) * 100) : 0;
    elements.statFeesProgress.textContent = `${feePct}% of expected ₹${expectedSum.toLocaleString()}`;
}

function renderClassSummary() {
    // Group students by class
    const classes = {};
    state.students.forEach(s => {
        if (!classes[s.class]) {
            classes[s.class] = { total: 0, present: 0, off: 0 };
        }
        classes[s.class].total++;
        
        const todayRecords = state.attendance[state.currentDate] || {};
        const status = todayRecords[s.id];
        if (status === "present") {
            classes[s.class].present++;
        } else if (status === "off") {
            classes[s.class].off++;
        }
    });
    
    const tbody = elements.classSummaryRows;
    tbody.innerHTML = "";
    
    const sortedClasses = Object.keys(classes).sort((a, b) => {
        const numA = parseInt(a);
        const numB = parseInt(b);
        if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
        return a.localeCompare(b);
    });
    
    if (sortedClasses.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" style="text-align: center; color: var(--text-muted);">No student data available. Go to the "Students" tab to add some!</td></tr>`;
        return;
    }
    
    sortedClasses.forEach(c => {
        const data = classes[c];
        const activeClassTotal = data.total - data.off;
        const rate = activeClassTotal > 0 ? Math.round((data.present / activeClassTotal) * 100) : 0;
        
        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td><span class="class-badge">Class ${c}</span></td>
            <td>${data.total} students${data.off > 0 ? ` (${data.off} off)` : ''}</td>
            <td>${data.present}</td>
            <td style="font-weight: 600; color: ${rate >= 75 ? 'var(--success)' : rate >= 40 ? 'var(--warning)' : 'var(--danger)'}">${rate}%</td>
        `;
        tbody.appendChild(tr);
    });
}

function renderAttendanceChart() {
    const ctx = document.getElementById("attendance-chart").getContext("2d");
    
    // Find past 7 days ending in selected date
    const dateLabels = [];
    const attendanceData = [];
    
    const baseDate = new Date(state.currentDate);
    
    for (let i = 6; i >= 0; i--) {
        const d = new Date(baseDate);
        d.setDate(baseDate.getDate() - i);
        
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        const dateStr = `${yyyy}-${mm}-${dd}`;
        
        // Label format (e.g. "Jul 25")
        const label = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        dateLabels.push(label);
        
        // Calculation
        const records = state.attendance[dateStr] || {};
        let present = 0;
        let activeTotal = 0;
        
        state.students.forEach(s => {
            const status = records[s.id];
            if (status !== "off") {
                activeTotal++;
                if (status === "present") {
                    present++;
                }
            }
        });
        
        const rate = activeTotal > 0 ? Math.round((present / activeTotal) * 100) : 0;
        attendanceData.push(rate);
    }
    
    // Destroy previous chart
    if (state.chartInstance) {
        state.chartInstance.destroy();
    }
    
    const isDark = document.body.classList.contains("dark-theme");
    const gridColor = isDark ? "#374151" : "#e2e8f0";
    const labelColor = isDark ? "#9ca3af" : "#64748b";
    
    state.chartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: dateLabels,
            datasets: [{
                label: 'Present %',
                data: attendanceData,
                borderColor: '#4f46e5',
                backgroundColor: 'rgba(79, 70, 229, 0.1)',
                fill: true,
                tension: 0.3,
                borderWidth: 3,
                pointBackgroundColor: '#4f46e5',
                pointHoverRadius: 7
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false }
            },
            scales: {
                x: {
                    grid: { color: gridColor },
                    ticks: { color: labelColor, font: { family: 'Inter' } }
                },
                y: {
                    min: 0,
                    max: 100,
                    grid: { color: gridColor },
                    ticks: { 
                        color: labelColor, 
                        font: { family: 'Inter' },
                        callback: function(value) { return value + "%" }
                    }
                }
            }
        }
    });
}

// --- Attendance View Logic ---
function updateAttendanceHeader() {
    const d = new Date(state.currentDate);
    const dayName = d.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    elements.attendanceViewTitle.textContent = `Attendance: ${dayName}`;
}

function renderAttendanceList() {
    const listContainer = elements.attendanceStudentList;
    listContainer.innerHTML = "";
    
    const dateRecords = state.attendance[state.currentDate] || {};
    
    // Filter & Search students
    const filteredStudents = state.students.filter(student => {
        // Class filter
        if (state.activeClassFilterAttendance !== "all" && student.class !== state.activeClassFilterAttendance) {
            return false;
        }
        // Search query
        if (state.searchQuery && !student.name.toLowerCase().includes(state.searchQuery)) {
            return false;
        }
        return true;
    });
    
    if (filteredStudents.length === 0) {
        listContainer.innerHTML = `<div style="padding: 40px; text-align: center; color: var(--text-muted);">No students match the current filters.</div>`;
        return;
    }
    
    filteredStudents.forEach(student => {
        const status = dateRecords[student.id] || ""; // present, absent, late, or empty
        
        const row = document.createElement("div");
        row.className = "student-row";
        
        // Initial letter for avatar
        const initial = student.name.trim().charAt(0).toUpperCase();
        
        // Check if student was enrolled on this date
        let isEnrolled = true;
        if (student.joiningDate && state.currentDate < student.joiningDate) {
            isEnrolled = false;
        }

        let statusControlsHTML = "";
        if (!isEnrolled) {
            statusControlsHTML = `
                <div class="not-enrolled-label" style="color: var(--text-muted); font-size: 13px; font-style: italic; display: flex; align-items: center; gap: 6px;">
                    <span class="material-symbols-rounded" style="color: var(--danger); font-size: 18px;">info</span>
                    Not enrolled yet (Joins ${student.joiningDate.split('-').reverse().join('-')})
                </div>
            `;
        } else {
            statusControlsHTML = `
                <div class="status-controls">
                    <button class="status-btn ${status === 'present' ? 'active' : ''}" data-status="present" data-id="${student.id}">
                        <span class="material-symbols-rounded">check_circle</span>Present
                    </button>
                    <button class="status-btn ${status === 'absent' ? 'active' : ''}" data-status="absent" data-id="${student.id}">
                        <span class="material-symbols-rounded">cancel</span>Absent
                    </button>
                    <button class="status-btn ${status === 'off' ? 'active' : ''}" data-status="off" data-id="${student.id}">
                        <span class="material-symbols-rounded">toggle_off</span>Tuition Off
                    </button>
                </div>
            `;
        }

        row.innerHTML = `
            <div class="student-info">
                <div class="student-avatar">${initial}</div>
                <div class="student-name-details">
                    <span class="student-name">${student.name}</span>
                </div>
            </div>
            <div class="class-col"><span class="class-badge">Class ${student.class}</span></div>
            ${statusControlsHTML}
        `;
        
        // Status button toggling
        row.querySelectorAll(".status-btn").forEach(btn => {
            btn.addEventListener("click", () => {
                const sId = btn.getAttribute("data-id");
                const stat = btn.getAttribute("data-status");
                
                // Toggle action
                if (!state.attendance[state.currentDate]) {
                    state.attendance[state.currentDate] = {};
                }
                
                if (state.attendance[state.currentDate][sId] === stat) {
                    // Remove if clicked again
                    delete state.attendance[state.currentDate][sId];
                } else {
                    state.attendance[state.currentDate][sId] = stat;
                }
                
                saveData();
                renderAttendanceList();
            });
        });
        
        listContainer.appendChild(row);
    });
}

function markAllDisplayedPresent() {
    const dateRecords = state.attendance[state.currentDate] || {};
    
    // Find all currently active/filtered students
    const filteredStudents = state.students.filter(student => {
        if (state.activeClassFilterAttendance !== "all" && student.class !== state.activeClassFilterAttendance) return false;
        if (state.searchQuery && !student.name.toLowerCase().includes(state.searchQuery)) return false;
        return true;
    });
    
    if (filteredStudents.length === 0) return;
    
    if (!state.attendance[state.currentDate]) {
        state.attendance[state.currentDate] = {};
    }
    
    filteredStudents.forEach(student => {
        state.attendance[state.currentDate][student.id] = "present";
    });
    
    saveData();
    renderAttendanceList();
    showToast(`Marked ${filteredStudents.length} students as Present`, "success");
}

function markAllDisplayedOff() {
    const dateRecords = state.attendance[state.currentDate] || {};
    
    // Find all currently active/filtered students
    const filteredStudents = state.students.filter(student => {
        if (state.activeClassFilterAttendance !== "all" && student.class !== state.activeClassFilterAttendance) return false;
        if (state.searchQuery && !student.name.toLowerCase().includes(state.searchQuery)) return false;
        return true;
    });
    
    if (filteredStudents.length === 0) return;
    
    if (!state.attendance[state.currentDate]) {
        state.attendance[state.currentDate] = {};
    }
    
    filteredStudents.forEach(student => {
        state.attendance[state.currentDate][student.id] = "off";
    });
    
    saveData();
    renderAttendanceList();
    showToast(`Marked ${filteredStudents.length} students as Tuition Holiday`, "success");
}

// --- Fees View Logic ---
function renderFeesList() {
    const listContainer = elements.feesStudentList;
    listContainer.innerHTML = "";
    
    const monthFees = state.fees[state.currentMonth] || {};
    
    // Filter and search
    const filteredStudents = state.students.filter(student => {
        // Class filter
        if (state.activeClassFilterFees !== "all" && student.class !== state.activeClassFilterFees) {
            return false;
        }
        // Status filter
        const isPaid = monthFees[student.id] === true;
        if (state.activeFeeStatusFilter === "paid" && !isPaid) return false;
        if (state.activeFeeStatusFilter === "pending" && isPaid) return false;
        
        // Search query
        if (state.searchQuery && !student.name.toLowerCase().includes(state.searchQuery)) {
            return false;
        }
        return true;
    });
    
    if (filteredStudents.length === 0) {
        listContainer.innerHTML = `<div style="padding: 40px; text-align: center; color: var(--text-muted);">No students match the current filters.</div>`;
        return;
    }
    
    filteredStudents.forEach(student => {
        const isPaid = monthFees[student.id] === true;
        const initial = student.name.trim().charAt(0).toUpperCase();
        
        const row = document.createElement("div");
        row.className = "student-row";
        
        const feeInfo = calculateStudentMonthlyFee(student.id, state.currentMonth);
        
        let nameDetailsHTML = `
            <div class="student-name-details">
                <span class="student-name">${student.name}</span>
                ${feeInfo.notYetJoined ? `<span class="student-fee-amount" style="font-size: 11px; color: var(--danger); font-weight: 500;">Joined later: ${student.joiningDate.split('-').reverse().join('-')}</span>` : ''}
                ${feeInfo.joinedMidMonth ? `<span class="student-fee-amount" style="font-size: 11px; color: var(--purple); font-weight: 500;">Joined mid-month: ${student.joiningDate.split('-').reverse().join('-')} • ${feeInfo.daysOn}/${feeInfo.daysInMonth} days</span>` : ''}
                ${!feeInfo.notYetJoined && !feeInfo.joinedMidMonth && feeInfo.offCount > 0 ? `<span class="student-fee-amount" style="font-size: 11px; color: var(--text-muted);">Base: ₹${feeInfo.baseFee} • ${feeInfo.offCount} off (${feeInfo.daysOn}/${feeInfo.daysInMonth} days)</span>` : ''}
            </div>
        `;
        
        row.innerHTML = `
            <div class="student-info">
                <div class="student-avatar" style="background-color: var(--purple-light); color: var(--purple);">${initial}</div>
                ${nameDetailsHTML}
            </div>
            <div class="class-col"><span class="class-badge">Class ${student.class}</span></div>
            <div style="font-weight: 600;">₹${feeInfo.calculatedFee.toLocaleString()}</div>
            <div>
                <button class="fee-action-btn ${isPaid ? 'unpay' : 'pay'}" data-id="${student.id}">
                    ${isPaid ? '<span class="material-symbols-rounded">cancel</span> Mark Pending' : '<span class="material-symbols-rounded">check_circle</span> Mark Paid'}
                </button>
            </div>
        `;
        
        // Click action
        row.querySelector(".fee-action-btn").addEventListener("click", () => {
            if (!state.fees[state.currentMonth]) {
                state.fees[state.currentMonth] = {};
            }
            
            state.fees[state.currentMonth][student.id] = !isPaid;
            saveData();
            renderFeesList();
            showToast(`${student.name}'s fees marked as ${!isPaid ? 'Paid' : 'Pending'}`, "success");
        });
        
        listContainer.appendChild(row);
    });
}

// --- Roster View Logic ---
function renderRosterList() {
    const tbody = elements.rosterTableRows;
    tbody.innerHTML = "";
    
    const filteredStudents = state.students.filter(student => {
        // Class dropdown filter
        if (state.activeRosterClassFilter !== "all" && student.class !== state.activeRosterClassFilter) {
            return false;
        }
        // Search
        if (state.searchQuery && !student.name.toLowerCase().includes(state.searchQuery)) {
            return false;
        }
        return true;
    });
    
    elements.rosterCount.textContent = filteredStudents.length;
    
    if (filteredStudents.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--text-muted); padding: 30px;">No students found matching current filters. Click "Add New Student" or upload an Excel sheet.</td></tr>`;
        return;
    }
    
    filteredStudents.forEach(student => {
        const tr = document.createElement("tr");
        const formattedJoining = student.joiningDate ? student.joiningDate.split('-').reverse().join('-') : '-';
        tr.innerHTML = `
            <td>#${student.id}</td>
            <td style="font-weight: 600;">${student.name}</td>
            <td><span class="class-badge">Class ${student.class}</span></td>
            <td style="font-weight: 600;">₹${student.fees.toLocaleString()}</td>
            <td>${formattedJoining}</td>
            <td>
                <button class="action-icon-btn edit" data-id="${student.id}" title="Edit Student">
                    <span class="material-symbols-rounded">edit</span>
                </button>
                <button class="action-icon-btn delete" data-id="${student.id}" title="Delete Student">
                    <span class="material-symbols-rounded">delete</span>
                </button>
            </td>
        `;
        
        // Edit action
        tr.querySelector(".edit").addEventListener("click", () => {
            openStudentModal(student);
        });
        
        // Delete action
        tr.querySelector(".delete").addEventListener("click", () => {
            if (confirm(`Are you sure you want to delete ${student.name}? All their historical attendance and fee details will be kept in database, but they will be removed from future lists.`)) {
                state.students = state.students.filter(s => s.id !== student.id);
                saveData();
                populateClassFilters();
                renderRosterList();
                showToast("Student deleted successfully", "success");
            }
        });
        
        tbody.appendChild(tr);
    });
}

// --- Student Modal Logic ---
function openStudentModal(student = null) {
    if (student) {
        // Edit mode
        elements.modalTitle.textContent = "Edit Student Profile";
        elements.studentEditId.value = student.id;
        elements.studentNameInput.value = student.name;
        elements.studentClassInput.value = student.class;
        elements.studentFeesInput.value = student.fees;
        elements.studentJoiningDateInput.value = student.joiningDate || "";
    } else {
        // Add mode
        elements.modalTitle.textContent = "Add New Student";
        elements.studentEditId.value = "";
        elements.studentForm.reset();
        // Set joining date input default to today
        const today = new Date();
        const yyyy = today.getFullYear();
        const mm = String(today.getMonth() + 1).padStart(2, '0');
        const dd = String(today.getDate()).padStart(2, '0');
        elements.studentJoiningDateInput.value = `${yyyy}-${mm}-${dd}`;
    }
    elements.studentModal.classList.add("active");
}

function closeStudentModal() {
    elements.studentModal.classList.remove("active");
}

function handleStudentFormSubmit(e) {
    e.preventDefault();
    
    const editId = elements.studentEditId.value;
    const name = elements.studentNameInput.value.trim();
    const cls = elements.studentClassInput.value.trim();
    const fees = parseFloat(elements.studentFeesInput.value);
    const joiningDate = elements.studentJoiningDateInput.value;
    
    if (editId) {
        // Update Student
        const idx = state.students.findIndex(s => s.id === parseInt(editId));
        if (idx !== -1) {
            state.students[idx].name = name;
            state.students[idx].class = cls;
            state.students[idx].fees = fees;
            state.students[idx].joiningDate = joiningDate;
            showToast("Student profile updated successfully", "success");
        }
    } else {
        // Add Student
        // Calculate unique ID
        const nextId = state.students.length > 0 ? Math.max(...state.students.map(s => s.id)) + 1 : 1;
        state.students.push({
            id: nextId,
            name: name,
            class: cls,
            fees: fees,
            joiningDate: joiningDate
        });
        showToast("New student added successfully", "success");
    }
    
    saveData();
    closeStudentModal();
    updateAppView();
}

// --- Excel Import Logic ---
function handleExcelImport(e) {
    const file = e.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = function(evt) {
        try {
            const data = new Uint8Array(evt.target.result);
            const workbook = XLSX.read(data, { type: 'array' });
            
            // Assume first sheet
            const sheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];
            
            // Read spreadsheet JSON structure
            const rawRows = XLSX.utils.sheet_to_json(worksheet, { defval: "" });
            
            if (rawRows.length === 0) {
                showToast("The Excel sheet is empty!", "error");
                return;
            }
            
            // Validate required columns
            const sample = rawRows[0];
            const hasClass = 'class' in sample;
            const hasName = 'name' in sample;
            const hasFees = 'fees' in sample;
            
            if (!hasClass || !hasName || !hasFees) {
                showToast("Required columns missing: 'class', 'name', 'fees' must be present.", "error");
                return;
            }
            
            // Map raw Excel rows to student records
            const newStudents = [];
            const newAttendance = { ...state.attendance };
            
            // Resolve selected month-year for imported columns 1-31
            const activeMonthStr = state.currentMonth; // "YYYY-MM"
            
            rawRows.forEach((row, index) => {
                let cls = String(row['class']).trim();
                if (cls.endsWith('.0')) cls = cls.substring(0, cls.length - 2); // remove float suffix
                
                const name = String(row['name']).trim();
                const fees = parseFloat(row['fees']) || 0;
                
                if (!name || name === "Unknown") return;
                
                const sId = index + 1; // Re-index for local app IDs
                
                newStudents.push({
                    id: sId,
                    class: cls,
                    name: name,
                    fees: fees
                });
                
                // Also pull attendance data if columns 1..31 have letters (P, A, L)
                for (let day = 1; day <= 31; day++) {
                    const cellVal = row[day] || row[String(day)];
                    if (cellVal) {
                        const dayStr = String(cellVal).trim().toUpperCase();
                        let statusVal = "";
                        if (dayStr === "P" || dayStr === "PRESENT" || dayStr === "1") statusVal = "present";
                        else if (dayStr === "A" || dayStr === "ABSENT" || dayStr === "0") statusVal = "absent";
                        else if (dayStr === "L" || dayStr === "LATE") statusVal = "late";
                        else if (dayStr === "O" || dayStr === "OFF" || dayStr === "TUITION OFF") statusVal = "off";
                        
                        if (statusVal) {
                            const dateKey = `${activeMonthStr}-${String(day).padStart(2, '0')}`;
                            if (!newAttendance[dateKey]) newAttendance[dateKey] = {};
                            newAttendance[dateKey][sId] = statusVal;
                        }
                    }
                }
            });
            
            if (newStudents.length === 0) {
                showToast("No valid student listings found in Excel sheet.", "error");
                return;
            }
            
            if (confirm(`Found ${newStudents.length} students in the Excel file. Replace your current local database with this imported roster?`)) {
                state.students = newStudents;
                state.attendance = newAttendance;
                saveData();
                updateAppView();
                showToast(`Successfully imported ${newStudents.length} students from Excel!`, "success");
            }
        } catch (error) {
            console.error(error);
            showToast("Failed to parse Excel file.", "error");
        }
    };
    reader.readAsArrayBuffer(file);
    
    // Clear input so upload can trigger again for same file
    elements.excelUploadInput.value = "";
}

// --- Excel Export Logic ---
function handleExcelExport() {
    try {
        const activeMonthParts = state.currentMonth.split('-'); // ["YYYY", "MM"]
        const year = parseInt(activeMonthParts[0]);
        const month = parseInt(activeMonthParts[1]);
        
        // Days in selected month
        const daysInMonth = new Date(year, month, 0).getDate();
        
        // Header Row: ['class', 'name', 'fees', 1, 2, ..., 31, 'payable_fees']
        const headers = ['class', 'name', 'fees'];
        for (let i = 1; i <= 31; i++) {
            headers.push(i);
        }
        headers.push('payable_fees');
        
        const dataRows = [];
        
        // Compile student records
        state.students.forEach(student => {
            const rowObj = {
                'class': isNaN(parseInt(student.class)) ? student.class : parseInt(student.class),
                'name': student.name,
                'fees': student.fees
            };
            
            // Mark attendance for days in month
            for (let day = 1; day <= 31; day++) {
                if (day > daysInMonth) {
                    rowObj[day] = ""; // day doesn't exist in month
                    continue;
                }
                
                const dateKey = `${state.currentMonth}-${String(day).padStart(2, '0')}`;
                const dateRecord = state.attendance[dateKey] || {};
                const status = dateRecord[student.id] || "";
                
                if (status === "present") rowObj[day] = "P";
                else if (status === "absent") rowObj[day] = "A";
                else if (status === "late") rowObj[day] = "L";
                else if (status === "off") rowObj[day] = "O";
                else rowObj[day] = ""; // Blank if unmarked
            }
            
            // Calculate pro-rated monthly fee
            const feeInfo = calculateStudentMonthlyFee(student.id, state.currentMonth);
            rowObj['payable_fees'] = feeInfo.calculatedFee;
            
            dataRows.push(rowObj);
        });
        
        // Generate Workbook
        const worksheet = XLSX.utils.json_to_sheet(dataRows, { header: headers });
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Sheet1");
        
        // Set column widths automatically
        const wscols = [
            { wch: 8 },  // class
            { wch: 20 }, // name
            { wch: 10 }  // fees
        ];
        for (let i = 1; i <= 31; i++) {
            wscols.push({ wch: 4 });
        }
        wscols.push({ wch: 14 }); // payable_fees
        worksheet['!cols'] = wscols;
        
        // Export file
        const monthName = new Date(year, month - 1).toLocaleString('en-US', { month: 'long' });
        const fileName = `Attendance_${monthName}_${year}.xlsx`;
        XLSX.writeFile(workbook, fileName);
        
        showToast(`Attendance exported as ${fileName}`, "success");
    } catch (error) {
        console.error(error);
        showToast("Failed to export Excel file.", "error");
    }
}

// --- Toast Messages ---
function showToast(message, type = "success") {
    elements.toastMessage.textContent = message;
    elements.toastIcon.className = "material-symbols-rounded toast-icon";
    
    // Clear styles
    elements.toastIcon.classList.remove("success", "error", "info");
    
    if (type === "success") {
        elements.toastIcon.textContent = "check_circle";
        elements.toastIcon.classList.add("success");
    } else if (type === "error") {
        elements.toastIcon.textContent = "error";
        elements.toastIcon.classList.add("error");
    } else {
        elements.toastIcon.textContent = "info";
        elements.toastIcon.classList.add("info");
    }
    
    elements.toast.classList.add("active");
    
    // Auto fadeout after 3s
    setTimeout(() => {
        elements.toast.classList.remove("active");
    }, 3000);
}
