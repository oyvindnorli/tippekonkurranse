/**
 * Date Navigation Component
 * Handles date filtering and navigation for matches
 */

// Global variables (shared with app-firebase.js)
export let selectedDate = null;

export function setSelectedDate(date) {
    selectedDate = date;
}

export function changeDay(offset) {
    if (!selectedDate) {
        // If no date selected, start from today
        selectedDate = new Date();
        selectedDate.setHours(0, 0, 0, 0);
    }

    selectedDate.setDate(selectedDate.getDate() + offset);
    updateDateDisplay();

    // Trigger filter update in main app
    if (window.applyDateFilter) {
        window.applyDateFilter();
    }
}

export function showDatePicker() {
    const modal = document.getElementById('datePickerModal');
    const picker = document.getElementById('datePicker');

    // Set current value
    const dateToShow = selectedDate || new Date();
    picker.value = dateToShow.toISOString().split('T')[0];

    modal.style.display = 'block';
}

export function closeDatePicker() {
    const modal = document.getElementById('datePickerModal');
    modal.style.display = 'none';
}

export function selectDate() {
    const picker = document.getElementById('datePicker');
    selectedDate = new Date(picker.value);
    selectedDate.setHours(0, 0, 0, 0);

    closeDatePicker();
    updateDateDisplay();

    // Trigger filter update in main app
    if (window.applyDateFilter) {
        window.applyDateFilter();
    }
}

export function selectToday() {
    selectedDate = new Date();
    selectedDate.setHours(0, 0, 0, 0);

    closeDatePicker();
    updateDateDisplay();

    // Trigger filter update in main app
    if (window.applyDateFilter) {
        window.applyDateFilter();
    }
}

export function updateDateDisplay() {
    const dateLabel = document.getElementById('dateLabel');

    // Guard: Element may not exist yet during initialization
    if (!dateLabel) return;

    if (!selectedDate) {
        dateLabel.textContent = 'Alle dager';
        return;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    // Check if it's today, tomorrow, or yesterday
    if (selectedDate.getTime() === today.getTime()) {
        dateLabel.textContent = 'I dag';
    } else if (selectedDate.getTime() === tomorrow.getTime()) {
        dateLabel.textContent = 'I morgen';
    } else if (selectedDate.getTime() === yesterday.getTime()) {
        dateLabel.textContent = 'I går';
    } else {
        // Format: "Fredag 1. nov"
        const options = { weekday: 'long', day: 'numeric', month: 'short' };
        const formatted = selectedDate.toLocaleDateString('no-NO', options);
        dateLabel.textContent = formatted.charAt(0).toUpperCase() + formatted.slice(1);
    }
}

export function initDateNavigation() {
    // Show all dates by default (no date filter)
    selectedDate = null;
}

// Make functions globally available for onclick handlers
window.changeDay = changeDay;
window.showDatePicker = showDatePicker;
window.closeDatePicker = closeDatePicker;
window.selectDate = selectDate;
window.selectToday = selectToday;
