
const STORAGE_KEY = 'streak_tracker_data';

// State
let state = {
    checkedDates: {}, // Object for O(1) lookup: { "YYYY-MM-DD": true }
    repairedDates: {}, // New: Track which dates were repaired
    repairs: 0,
    // We don't strictly track 'lastRepairEarned' here, simpler to just trigger on crossing thresholds.
    // However, to prevent farming, we just check on action.
};

// DOM Elements
const currentStreakEl = document.getElementById('current-streak');
const repairsCountEl = document.getElementById('repairs-count');
const checkInBtn = document.getElementById('check-in-btn');
const statusMessageEl = document.getElementById('status-message');
const calendarGrid = document.getElementById('calendar-grid');
const monthYearDisplay = document.getElementById('month-year-display');
const prevMonthBtn = document.getElementById('prev-month');
const nextMonthBtn = document.getElementById('next-month');
const overlay = document.getElementById('celebration-overlay');

// Date Helpers
// Normalize today to midnight to avoid time comparison issues
const today = new Date();
today.setHours(0, 0, 0, 0);

let currentViewDate = new Date(today.getFullYear(), today.getMonth(), 1);

function dateToString(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

// Initialization
function init() {
    loadData();
    renderApp();

    checkInBtn.addEventListener('click', handleCheckIn);
    prevMonthBtn.addEventListener('click', () => changeMonth(-1));
    nextMonthBtn.addEventListener('click', () => changeMonth(1));

    // Seed data as requested (Jan 1 - Feb 14)
    seedHistory(); // Re-enabled with safety check
    renderApp();
}

function seedHistory() {
    // Safety: If Jan 1 is already checked, assume seeded.
    if (state.checkedDates['2026-01-01']) return;

    // Only seed if we haven't already (check if Jan 1 is there)
    // OR just force it since user asked. Let's force it to ensure they get the data.
    const start = new Date(2026, 0, 1); // Jan 1 2026
    const end = new Date(2026, 1, 13);  // Feb 13 2026 (Excluding 14-16)

    let current = new Date(start);
    while (current <= end) {
        state.checkedDates[dateToString(current)] = true;
        current.setDate(current.getDate() + 1);
    }

    // Explicitly uncheck requested dates (14, 15, 16)
    const uncheck = [
        new Date(2026, 1, 14),
        new Date(2026, 1, 15),
        new Date(2026, 1, 16)
    ];
    uncheck.forEach(d => {
        delete state.checkedDates[dateToString(d)];
    });

    // Set repairs to 4 (43 days / 10 = 4)
    if (state.repairs < 4) state.repairs = 4;

    saveData();
}

// Data Management
function loadData() {
    const rawData = localStorage.getItem(STORAGE_KEY);
    if (rawData) {
        state = JSON.parse(rawData);
    }
}

function saveData() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    renderApp();
}

// Logic
function calculateStreak() {
    let streak = 0;

    // Check consecutive days starting from Today going backwards
    // If today is not checked, start from yesterday
    let checkDate = new Date(today);
    const todayStr = dateToString(checkDate);

    if (!state.checkedDates[todayStr]) {
        checkDate.setDate(checkDate.getDate() - 1);
    }

    // Loop backwards
    while (true) {
        const dateStr = dateToString(checkDate);
        if (state.checkedDates[dateStr]) {
            streak++;
            checkDate.setDate(checkDate.getDate() - 1);
        } else {
            break;
        }
    }
    return streak;
}

// Calculate only determining non-repaired days in the current streak
function calculateRealStreak() {
    let realStreak = 0;

    let checkDate = new Date(today);
    const todayStr = dateToString(checkDate);

    if (!state.checkedDates[todayStr]) {
        checkDate.setDate(checkDate.getDate() - 1);
    }

    while (true) {
        const dateStr = dateToString(checkDate);
        if (state.checkedDates[dateStr]) {
            // Only count if NOT repaired
            if (!state.repairedDates || !state.repairedDates[dateStr]) {
                realStreak++;
            }
            checkDate.setDate(checkDate.getDate() - 1);
        } else {
            break;
        }
    }
    return realStreak;
}

function handleCheckIn() {
    const todayStr = dateToString(today);
    if (state.checkedDates[todayStr]) return;

    // Check previous REAL streak
    const previousRealStreak = calculateRealStreak();

    state.checkedDates[todayStr] = true;

    const newRealStreak = calculateRealStreak();

    // Earn repair based on REAL streak (every 10 real days)
    if (Math.floor(newRealStreak / 10) > Math.floor(previousRealStreak / 10)) {
        state.repairs++;
        showStatus("Repair Earned!", "success");
    }

    showCelebration();
    saveData();
}

function handleRepair(dateStr) {
    if (state.repairs > 0) {
        // Confirm
        // In a real app custom modal is better, but confirm() is fine for MVP
        if (confirm(`Use 1 repair to restore streak for ${dateStr}? (Won't count for new repairs)`)) {
            state.repairs--;
            state.checkedDates[dateStr] = true;

            // Mark as repaired
            if (!state.repairedDates) state.repairedDates = {};
            state.repairedDates[dateStr] = true;

            showStatus("Streak Restored!");
            saveData();
        }
    }
}

function showStatus(msg, type = 'info') {
    statusMessageEl.textContent = msg;
    statusMessageEl.style.color = type === 'success' ? 'var(--success-color)' : 'var(--text-secondary)';
    setTimeout(() => {
        statusMessageEl.textContent = "";
        statusMessageEl.style.color = 'var(--text-secondary)';
    }, 3000);
}

// Rendering
function renderApp() {
    const streak = calculateStreak();
    currentStreakEl.textContent = streak;
    repairsCountEl.textContent = state.repairs;

    const todayStr = dateToString(today);
    if (state.checkedDates[todayStr]) {
        checkInBtn.disabled = true;
        checkInBtn.querySelector('.btn-text').textContent = '₍₍⚞(˶˃ ꒳ ˂˶)⚟⁾⁾';
        checkInBtn.classList.add('checked');
    } else {
        checkInBtn.disabled = false;
        checkInBtn.querySelector('.btn-text').textContent = 'Check In Today';
        checkInBtn.classList.remove('checked');
    }

    renderCalendar();
}

function renderCalendar() {
    calendarGrid.innerHTML = '';

    const year = currentViewDate.getFullYear();
    const month = currentViewDate.getMonth();

    monthYearDisplay.textContent = new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(currentViewDate);

    // Month details
    const firstDayOfMonth = new Date(year, month, 1).getDay(); // 0 = Sunday
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    // Calendar Labels (Sun-Sat)
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    days.forEach(day => {
        const el = document.createElement('div');
        el.className = 'calendar-day-label';
        el.textContent = day;
        calendarGrid.appendChild(el);
    });

    // Empty cells for padding
    for (let i = 0; i < firstDayOfMonth; i++) {
        const el = document.createElement('div');
        calendarGrid.appendChild(el); // Empty cell
    }

    // Days
    for (let i = 1; i <= daysInMonth; i++) {
        const date = new Date(year, month, i);
        // Ensure date is midnight for comparison
        date.setHours(0, 0, 0, 0);

        const dateStr = dateToString(date);
        const el = document.createElement('div');
        el.className = 'day-cell current-month';
        el.textContent = i;

        // Styles
        if (date.getTime() === today.getTime()) {
            el.classList.add('today');
        }

        if (state.checkedDates[dateStr]) {
            el.classList.add('checked');
            if (state.repairedDates && state.repairedDates[dateStr]) {
                el.classList.add('repaired');
            }
        } else if (date < today) {
            // Past date not checked
            el.classList.add('missed');
            // Repair logic
            if (state.repairs > 0) {
                el.classList.add('repairable');
                el.title = "Click to repair";
                el.addEventListener('click', () => handleRepair(dateStr));
            }
        }

        calendarGrid.appendChild(el);
    }
}

function changeMonth(delta) {
    currentViewDate.setMonth(currentViewDate.getMonth() + delta);
    renderCalendar();
}

function showCelebration() {
    overlay.classList.remove('hidden');
    // Confetti logic could be added here
    setTimeout(() => {
        overlay.classList.add('hidden');
    }, 1500);
}

// Start
init();

// PWA Service Worker Registration
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js')
            .then(reg => console.log('Service Worker registered!', reg))
            .catch(err => console.log('Service Worker registration failed: ', err));
    });
}
