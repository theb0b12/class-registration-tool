// ==========================================
// SCHEDULE OPTIMIZER - app.js
// ==========================================

let courses = JSON.parse(localStorage.getItem("optimizer_courses")) || [];
let generatedSchedules = [];
let currentScheduleIndex = 0;
let editingCourseId = null;

const COLORS = [
    "#2563eb", "#10b981", "#8b5cf6", "#f59e0b", 
    "#ec4899", "#06b6d4", "#6366f1", "#14b8a6"
];

const START_HOUR = 8;
const END_HOUR = 20;
const HOUR_HEIGHT = 72; // 72px per hour (1.2px per minute)

// DOM Elements
const courseForm = document.getElementById("course-form");
const formModeLabel = document.getElementById("form-mode-label");
const saveCourseBtn = document.getElementById("save-course-btn");
const cancelEditBtn = document.getElementById("cancel-edit-btn");
const sectionsContainer = document.getElementById("sections-container");
const addMeetingBtn = document.getElementById("add-meeting-btn");
const courseList = document.getElementById("course-list");
const clearAllBtn = document.getElementById("clear-all-btn");
const generateBtn = document.getElementById("generate-btn");
const gridBody = document.getElementById("grid-body");
const navControls = document.getElementById("nav-controls");
const scheduleCounter = document.getElementById("schedule-counter");
const prevBtn = document.getElementById("prev-schedule");
const nextBtn = document.getElementById("next-schedule");
const metricsBar = document.getElementById("schedule-metrics");

// Initialization
document.addEventListener("DOMContentLoaded", () => {
    renderCourseList();
    renderEmptyGrid();
    const initialGroup = sectionsContainer.querySelector(".section-input-group");
    if (initialGroup) updateEndTime(initialGroup);

    courseList.addEventListener("change", (e) => {
    if (e.target.classList.contains("course-toggle")) {
        const id = parseInt(e.target.dataset.id, 10);
        const course = courses.find(c => c.id === id);
        if (course) {
            course.enabled = e.target.checked;
            saveAndRefresh();
            if (generatedSchedules.length > 0) generateSchedules();
        }
    }
});
});

// Event Delegation for Dynamic Section Inputs
sectionsContainer.addEventListener("input", (e) => {
    if (e.target.classList.contains("start-time") || e.target.classList.contains("duration-select")) {
        const group = e.target.closest(".section-input-group");
        if (group) updateEndTime(group);
    }
});

// Add Section Row
addMeetingBtn.addEventListener("click", () => {
    const durationSelect = template.querySelector(".duration-select");
    if (durationSelect) durationSelect.value = "50"; // default to 50 min
});

// Cancel Edit Mode
cancelEditBtn.addEventListener("click", exitEditMode);

// Handle Course Form Submission (Create or Update)
courseForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const name = document.getElementById("course-name").value.trim();
    const sectionGroups = sectionsContainer.querySelectorAll(".section-input-group");
    
    const sections = [];
    sectionGroups.forEach((group, idx) => {
        const secName = group.querySelector(".section-name").value.trim() || `Sec ${idx + 1}`;
        const days = Array.from(group.querySelectorAll(".day-picker input:checked")).map(cb => cb.value);
        const startTime = group.querySelector(".start-time").value;
        const duration = parseInt(group.querySelector(".duration-select").value, 10);

        if (days.length > 0 && startTime) {
            const startMinutes = timeToMinutes(startTime);
            const endMinutes = startMinutes + duration;
            sections.push({
                id: `${Date.now()}-${idx}`,
                name: secName,
                days,
                startTime,
                duration,
                endTime: minutesToTimeStr(endMinutes),
                startMinutes,
                endMinutes
            });
        }
    });

    if (sections.length === 0) {
        alert("Please select at least one day and a start time for a section.");
        return;
    }

    if (editingCourseId !== null) {
        const idx = courses.findIndex(c => c.id === editingCourseId);
        if (idx !== -1) {
            courses[idx] = { ...courses[idx], name, sections };
        }
        exitEditMode();
    } else {
        courses.push({
            id: Date.now(),
            name,
            sections,
            color: COLORS[courses.length % COLORS.length]
        });
        courseForm.reset();
        resetSectionInputs();
    }

    saveAndRefresh();
    if (generatedSchedules.length > 0) generateSchedules();

    if (editingCourseId !== null) {
        const idx = courses.findIndex(c => c.id === editingCourseId);
        if (idx !== -1) {
            courses[idx] = { ...courses[idx], name, sections };
        }
        exitEditMode();
    } else {
        courses.push({
            id: Date.now(),
            name,
            sections,
            enabled: true, // default to included in generation
            color: COLORS[courses.length % COLORS.length]
        });
        courseForm.reset();
        resetSectionInputs();
    }
});

// Clear All Courses
clearAllBtn.addEventListener("click", () => {
    if (courses.length === 0 || confirm("Are you sure you want to clear all saved courses?")) {
        courses = [];
        generatedSchedules = [];
        exitEditMode();
        saveAndRefresh();
        renderEmptyGrid();
        navControls.classList.add("hidden");
        metricsBar.classList.add("hidden");
    }
});

generateBtn.addEventListener("click", generateSchedules);

prevBtn.addEventListener("click", () => {
    if (currentScheduleIndex > 0) {
        currentScheduleIndex--;
        displaySchedule(currentScheduleIndex);
    }
});

nextBtn.addEventListener("click", () => {
    if (currentScheduleIndex < generatedSchedules.length - 1) {
        currentScheduleIndex++;
        displaySchedule(currentScheduleIndex);
    }
});

// ==========================================
// COURSE EDITING & FORM HELPERS
// ==========================================

function createSectionRow(data = null) {
    const div = document.createElement("div");
    div.className = "section-input-group";
    const secName = data ? data.name : "";
    const startTime = data ? data.startTime : "08:00";
    const duration = data ? (data.duration || (data.endMinutes - data.startMinutes)) : 50;
    const selectedDays = data ? data.days : [];

    div.innerHTML = `
        <input type="text" class="section-name" placeholder="Section (e.g. A or Lab 1)" value="${secName}">
        <div class="day-picker">
            ${["M", "T", "W", "Th", "F"].map(d => `
                <label><input type="checkbox" value="${d}" ${selectedDays.includes(d) ? "checked" : ""}> ${d}</label>
            `).join("")}
        </div>
        <div class="time-picker">
            <input type="time" class="start-time" step="900" value="${startTime}" required>
            <select class="duration-select">
                <option value="50" ${duration === 50 ? "selected" : ""}>50 min</option>
                <option value="75" ${duration === 75 ? "selected" : ""}>1 hr 15 min</option>
                <option value="120" ${duration === 120 ? "selected" : ""}>2 hours</option>
            </select>
            <span class="end-time-badge"></span>
        </div>
    `;
    updateEndTime(div);
    return div;
}

window.editCourse = function(id) {
    const course = courses.find(c => c.id === id);
    if (!course) return;

    editingCourseId = id;
    document.getElementById("course-name").value = course.name;
    formModeLabel.textContent = `Editing: ${course.name}`;
    saveCourseBtn.textContent = "Update Course";
    cancelEditBtn.classList.remove("hidden");

    sectionsContainer.innerHTML = `<label>Section Options</label>`;
    course.sections.forEach(sec => {
        sectionsContainer.appendChild(createSectionRow(sec));
    });

    courseForm.scrollIntoView({ behavior: "smooth", block: "nearest" });
};

function exitEditMode() {
    editingCourseId = null;
    formModeLabel.textContent = "Course Name / Code";
    saveCourseBtn.textContent = "Save Course";
    cancelEditBtn.classList.add("hidden");
    courseForm.reset();
    resetSectionInputs();
}

function resetSectionInputs() {
    sectionsContainer.innerHTML = `<label>Section Options</label>`;
    sectionsContainer.appendChild(createSectionRow());
}

function timeToMinutes(timeStr) {
    const [h, m] = timeStr.split(":").map(Number);
    return h * 60 + m;
}

function minutesToTimeStr(mins) {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function formatDisplayTime(mins) {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    const period = h >= 12 ? "PM" : "AM";
    const displayH = h % 12 === 0 ? 12 : h % 12;
    return `${displayH}:${m < 10 ? "0" : ""}${m} ${period}`;
}

function updateEndTime(group) {
    const startTimeInput = group.querySelector(".start-time");
    const durationSelect = group.querySelector(".duration-select");
    const endBadge = group.querySelector(".end-time-badge");

    if (startTimeInput.value && durationSelect.value) {
        const startMins = timeToMinutes(startTimeInput.value);
        const endMins = startMins + parseInt(durationSelect.value, 10);
        endBadge.textContent = formatDisplayTime(endMins);
    } else {
        endBadge.textContent = "--:--";
    }
}

function saveAndRefresh() {
    localStorage.setItem("optimizer_courses", JSON.stringify(courses));
    renderCourseList();
}

function renderCourseList() {
    courseList.innerHTML = "";
    if (courses.length === 0) {
        courseList.innerHTML = `<li class="course-item" style="justify-content:center; color: var(--text-muted); font-size: 0.85rem;">No courses added yet.</li>`;
        return;
    }
    courses.forEach(course => {
        const isEnabled = course.enabled !== false;
        const li = document.createElement("li");
        li.className = "course-item";
        li.innerHTML = `
            <span class="course-item-info">
                <input type="checkbox" class="course-toggle" data-id="${course.id}" ${isEnabled ? "checked" : ""} title="Include in schedule generation">
                <span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${course.color};flex-shrink:0;"></span>
                <strong>${course.name}</strong> (${course.sections.length} opt${course.sections.length > 1 ? 's' : ''})
            </span>
            <div class="course-actions">
                <button type="button" class="edit-btn" onclick="editCourse(${course.id})">Edit</button>
                <button type="button" class="delete-btn" onclick="deleteCourse(${course.id})">&times;</button>
            </div>
        `;
        courseList.appendChild(li);
    });
}

window.deleteCourse = function(id) {
    if (editingCourseId === id) exitEditMode();
    courses = courses.filter(c => c.id !== id);
    saveAndRefresh();
    generatedSchedules = [];
    renderEmptyGrid();
    navControls.classList.add("hidden");
    metricsBar.classList.add("hidden");
};

// ==========================================
// BRANCH-AND-BOUND OPTIMIZATION ENGINE
// ==========================================

function generateSchedules() {
    const activeCourses = courses.filter(c => c.enabled !== false);
    
    if (activeCourses.length === 0) {
        alert("Please enable at least one course to generate schedules.");
        return;
    }

    const orderedCourses = [...activeCourses].sort((a, b) => a.sections.length - b.sections.length);
    const validSchedules = [];

    function search(courseIndex, currentSchedule) {
        if (courseIndex === orderedCourses.length) {
            validSchedules.push([...currentSchedule]);
            return;
        }

        const course = orderedCourses[courseIndex];
        for (const section of course.sections) {
            if (!hasConflict(section, currentSchedule)) {
                currentSchedule.push({ 
                    courseName: course.name, 
                    color: course.color, 
                    ...section 
                });
                search(courseIndex + 1, currentSchedule);
                currentSchedule.pop();
            }
        }
    }

    search(0, []);

    if (validSchedules.length === 0) {
        alert("No valid schedule combinations found without time overlaps.");
        return;
    }

    // Read new constraint inputs
    const maxDailyHoursInput = document.getElementById("max-daily-hours").value;
    const maxDailyMinutes = maxDailyHoursInput ? parseFloat(maxDailyHoursInput) * 60 : null;

    const maxConsecutiveHoursInput = document.getElementById("max-consecutive-hours").value;
    const maxConsecutiveMinutesLimit = maxConsecutiveHoursInput ? parseFloat(maxConsecutiveHoursInput) * 60 : null;

    const mustStartAfterInput = document.getElementById("must-start-after").value;
    const minStartMinutes = mustStartAfterInput ? timeToMinutes(mustStartAfterInput) : null;

    const mustFinishByInput = document.getElementById("must-finish-by").value;
    const maxEndMinutes = mustFinishByInput ? timeToMinutes(mustFinishByInput) : null;

    const weightGap = parseFloat(document.getElementById("weight-gap").value);
    const weightSpan = parseFloat(document.getElementById("weight-span").value);
    const weightDaysOff = parseFloat(document.getElementById("weight-days-off").value);
    const timePref = document.getElementById("pref-time").value;

    const evaluated = [];
    validSchedules.forEach(sched => {
        // Time window filters (Must Start After / Must Finish By)
        if (minStartMinutes !== null && sched.some(s => s.startMinutes < minStartMinutes)) return;
        if (maxEndMinutes !== null && sched.some(s => s.endMinutes > maxEndMinutes)) return;

        const metrics = getScheduleMetrics(sched);
        
        // Max Daily School Hours filter
        if (maxDailyMinutes !== null && metrics.maxDailySpanMinutes > maxDailyMinutes) return;

        // Max Consecutive Class Hours (gap < 30m) filter
        if (maxConsecutiveMinutesLimit !== null && metrics.maxConsecutiveMinutes > maxConsecutiveMinutesLimit) return;

        evaluated.push({ schedule: sched, metrics });
    });

    if (evaluated.length === 0) {
        alert("No schedules found matching your strict daily hours, consecutive class limits, or time window constraints.");
        return;
    }

    const maxGap = Math.max(1, ...evaluated.map(e => e.metrics.totalGapMinutes));
    const maxSpan = Math.max(1, ...evaluated.map(e => e.metrics.totalSpanMinutes));

    evaluated.forEach(item => {
        item.score = calculateNormalizedScore(
            item.metrics, maxGap, maxSpan, weightGap, weightSpan, weightDaysOff, timePref
        );
    });

    evaluated.sort((a, b) => b.score - a.score);
    generatedSchedules = evaluated;
    currentScheduleIndex = 0;

    navControls.classList.remove("hidden");
    metricsBar.classList.remove("hidden");
    displaySchedule(0);
}

function hasConflict(newSec, currentSched) {
    for (const item of currentSched) {
        for (const day of newSec.days) {
            if (item.days.includes(day)) {
                if (newSec.startMinutes < item.endMinutes && newSec.endMinutes > item.startMinutes) {
                    return true;
                }
            }
        }
    }
    return false;
}

function getScheduleMetrics(sched) {
    const days = ["M", "T", "W", "Th", "F"];
    let totalGapMinutes = 0;
    let totalSpanMinutes = 0;
    let maxDailySpanMinutes = 0;
    let maxConsecutiveMinutes = 0;
    let totalStartMinutes = 0;
    let classCount = 0;
    let freeDays = 0;

    days.forEach(day => {
        const dayClasses = sched.filter(s => s.days.includes(day))
                                .sort((a, b) => a.startMinutes - b.startMinutes);
        if (dayClasses.length === 0) {
            freeDays++;
        } else {
            const firstStart = dayClasses[0].startMinutes;
            const lastEnd = dayClasses[dayClasses.length - 1].endMinutes;
            const daySpan = lastEnd - firstStart;

            totalSpanMinutes += daySpan;
            if (daySpan > maxDailySpanMinutes) {
                maxDailySpanMinutes = daySpan;
            }

            // Calculate consecutive blocks (gaps < 30 mins)
            let currentBlockDuration = 0;
            dayClasses.forEach((c, idx) => {
                const duration = c.endMinutes - c.startMinutes;
                if (idx === 0) {
                    currentBlockDuration = duration;
                } else {
                    const gap = c.startMinutes - dayClasses[idx - 1].endMinutes;
                    if (gap < 30) {
                        currentBlockDuration += duration;
                    } else {
                        if (currentBlockDuration > maxConsecutiveMinutes) {
                            maxConsecutiveMinutes = currentBlockDuration;
                        }
                        currentBlockDuration = duration;
                    }
                }
            });
            if (currentBlockDuration > maxConsecutiveMinutes) {
                maxConsecutiveMinutes = currentBlockDuration;
            }

            for (let i = 0; i < dayClasses.length - 1; i++) {
                const gap = dayClasses[i + 1].startMinutes - dayClasses[i].endMinutes;
                if (gap > 0) totalGapMinutes += gap;
            }

            dayClasses.forEach(c => {
                totalStartMinutes += c.startMinutes;
                classCount++;
            });
        }
    });

    return {
        totalGapMinutes,
        totalSpanMinutes,
        maxDailySpanMinutes,
        maxConsecutiveMinutes,
        freeDays,
        avgStartMinutes: classCount > 0 ? totalStartMinutes / classCount : 0
    };
}

function calculateNormalizedScore(metrics, maxGap, maxSpan, weightGap, weightSpan, weightDaysOff, timePref) {
    let score = 0;

    // 0 to 100 normalized sub-scores
    const gapScore = (1 - metrics.totalGapMinutes / maxGap) * 100;
    const spanScore = (1 - metrics.totalSpanMinutes / maxSpan) * 100;
    const freeDayScore = (metrics.freeDays / 5) * 100;

    score += gapScore * weightGap;
    score += spanScore * weightSpan;
    score += freeDayScore * weightDaysOff;

    if (timePref === "early") {
        // Peak bonus for 8:00 AM (480m), tapering toward 5:00 PM (1020m)
        const earlyScore = Math.max(0, (1020 - metrics.avgStartMinutes) / 540) * 100;
        score += earlyScore * 6;
    } else if (timePref === "late") {
        // Peak bonus for later start times
        const lateScore = Math.max(0, (metrics.avgStartMinutes - 480) / 540) * 100;
        score += lateScore * 6;
    }

    return score;
}

// ==========================================
// RENDERING FUNCTIONS
// ==========================================

function renderEmptyGrid() {
    gridBody.innerHTML = "";
    
    const timeCol = document.createElement("div");
    timeCol.className = "time-column";
    for (let h = START_HOUR; h < END_HOUR; h++) {
        const label = document.createElement("div");
        label.className = "time-slot-label";
        label.textContent = `${h % 12 === 0 ? 12 : h % 12} ${h >= 12 ? 'PM' : 'AM'}`;
        timeCol.appendChild(label);
    }
    gridBody.appendChild(timeCol);

    const days = ["M", "T", "W", "Th", "F"];
    days.forEach((day, idx) => {
        const dayCol = document.createElement("div");
        dayCol.className = "day-column";
        dayCol.style.gridColumn = `${idx + 2}`;
        dayCol.style.height = `${(END_HOUR - START_HOUR) * HOUR_HEIGHT}px`;
        gridBody.appendChild(dayCol);
    });
}

function displaySchedule(index) {
    if (!generatedSchedules[index]) return;
    
    const { schedule, metrics } = generatedSchedules[index];
    scheduleCounter.textContent = `Schedule ${index + 1} of ${generatedSchedules.length}`;
    
    const totalGapHours = (metrics.totalGapMinutes / 60).toFixed(1);
    const maxConsecutiveHours = (metrics.maxConsecutiveMinutes / 60).toFixed(1);
    metricsBar.textContent = `Gaps: ${totalGapHours} hrs | Max in Row: ${maxConsecutiveHours} hrs | Free Days: ${metrics.freeDays}`;
    gridBody.innerHTML = "";
    
    const timeCol = document.createElement("div");
    timeCol.className = "time-column";
    for (let h = START_HOUR; h < END_HOUR; h++) {
        const label = document.createElement("div");
        label.className = "time-slot-label";
        label.textContent = `${h % 12 === 0 ? 12 : h % 12} ${h >= 12 ? 'PM' : 'AM'}`;
        timeCol.appendChild(label);
    }
    gridBody.appendChild(timeCol);

    const days = ["M", "T", "W", "Th", "F"];
    const pxPerMinute = HOUR_HEIGHT / 60;

    days.forEach((day, dayIdx) => {
        const dayCol = document.createElement("div");
        dayCol.className = "day-column";
        dayCol.style.gridColumn = `${dayIdx + 2}`;
        dayCol.style.height = `${(END_HOUR - START_HOUR) * HOUR_HEIGHT}px`;

        const dayClasses = schedule.filter(s => s.days.includes(day));
        dayClasses.forEach(item => {
            const block = document.createElement("div");
            block.className = "class-block";
            block.style.backgroundColor = item.color;

            const topPx = (item.startMinutes - (START_HOUR * 60)) * pxPerMinute;
            const heightPx = (item.endMinutes - item.startMinutes) * pxPerMinute;

            block.style.top = `${topPx}px`;
            block.style.height = `${Math.max(heightPx, 36)}px`;
            block.innerHTML = `<strong>${item.courseName}</strong> · ${item.name}<br>${formatDisplayTime(item.startMinutes)} - ${formatDisplayTime(item.endMinutes)}`;

            dayCol.appendChild(block);
        });

        gridBody.appendChild(dayCol);
    });
}