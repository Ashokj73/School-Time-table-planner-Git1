/**
 * SchoolFlow SaaS - Master UI Controller & Interaction Layer
 */

import { AuthService, SANDBOX_PERSONAS } from './auth.js';
import { StorageService } from './storage.js';
import { SchedulerEngine } from './scheduler.js';
import { ExportService } from './exports.js';
import { AppConfig } from './config.js';

class UIController {
  constructor() {
    this.currentUser = null;
    this.activeTimetableId = null;
    this.state = null;
    this.selectedDay = 'Monday';
    this.cachedScheduleOutput = null;

    this.allDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    this.teacherPalette = ['#dfeaff', '#dff4eb', '#fff0d9', '#f0e4ff', '#ffe2e5', '#dff3f5', '#fff7c8', '#e7e7ff', '#e5f0d6', '#fbe5d6'];
  }

  init() {
    // 1. Listen for Auth Changes
    AuthService.onAuthStateChanged(user => {
      this.currentUser = user;
      this.updateUserWidget();
      this.loadUserWorkspace();
    });

    // 2. Listen for Cloud Sync Status Changes
    StorageService.onSyncStatusChange((status, message) => {
      this.updateSyncBadge(status, message);
    });

    // 3. Bind Global Navigation & Modal Events
    this.bindEvents();

    // 4. Initialize Google Identity Services (if client ID configured)
    this.initGoogleAuthClient();
  }

  // Helper for DOM queries
  $(selector) {
    return document.querySelector(selector);
  }

  $$(selector) {
    return document.querySelectorAll(selector);
  }

  // Load the current active user's workspace & timetables
  loadUserWorkspace() {
    if (!this.currentUser) return;

    const timetables = StorageService.getUserTimetables(this.currentUser.id);
    if (!timetables.length) return;

    // Default to the first timetable or previously selected
    if (!this.activeTimetableId || !timetables.some(t => t.id === this.activeTimetableId)) {
      this.activeTimetableId = timetables[0].id;
    }

    this.renderTimetableDropdown(timetables);

    // Load data for active timetable
    const bundle = StorageService.loadTimetableData(this.currentUser.id, this.activeTimetableId);
    this.state = bundle.inputs;
    if (!this.state.days.includes(this.selectedDay)) {
      this.selectedDay = this.state.days[0] || 'Monday';
    }

    this.render();
  }

  // Switch active timetable
  switchTimetable(timetableId) {
    this.activeTimetableId = timetableId;
    const bundle = StorageService.loadTimetableData(this.currentUser.id, this.activeTimetableId);
    this.state = bundle.inputs;
    if (!this.state.days.includes(this.selectedDay)) {
      this.selectedDay = this.state.days[0] || 'Monday';
    }
    this.render();
  }

  // Trigger re-computation of schedule, analytics, and persist both inputs & outputs
  render() {
    if (!this.state) return;

    // 1. Generate full schedule & analytics using engine
    const output = SchedulerEngine.generate(this.state);
    this.cachedScheduleOutput = output;

    // 2. Update summary metrics in header
    this.updateMetrics(output.metrics);

    // 3. Render Timetable Matrix view
    this.renderDayPicker();
    this.renderScheduleTable(output.schedule);
    this.renderWorkloadAnalytics(output.workloadAnalytics);

    // 4. Render Absence Desk view
    this.renderAbsenceDesk(output.coverDecisions);

    // 5. Render School Setup controls
    this.renderSchoolSetup();

    // 6. Render Admin & Staff Tasks
    this.renderAdminTasks();

    // 7. Auto-save Input and Output state to Cloud (debounced)
    StorageService.queueAutoSave(
      this.currentUser.id,
      this.activeTimetableId,
      this.state,
      output
    );
  }

  updateMetrics(metrics) {
    this.$('#lessonCount').textContent = metrics.scheduledLessons;
    this.$('#availableCount').textContent = metrics.availableTeachers;
    this.$('#coverCount').textContent = metrics.needingCover;
    this.$('#coverageRate').textContent = `${metrics.coverageRate}%`;
  }

  updateSyncBadge(status, message) {
    const badge = this.$('#cloudSyncBadge');
    if (!badge) return;
    badge.className = `cloud-sync-badge ${status}`;
    this.$('#cloudSyncText').textContent = message || (status === 'synced' ? 'Cloud Synced' : 'Syncing...');
  }

  updateUserWidget() {
    if (!this.currentUser) return;
    this.$('#userAvatar').src = this.currentUser.picture || 'https://ui-avatars.com/api/?name=User&background=2563eb&color=fff';
    this.$('#userName').textContent = this.currentUser.name;
    this.$('#userSchool').textContent = this.currentUser.schoolName || 'School Workspace';
  }

  renderTimetableDropdown(timetables) {
    const select = this.$('#timetableSelect');
    if (!select) return;
    select.innerHTML = timetables.map(t => 
      `<option value="${t.id}" ${t.id === this.activeTimetableId ? 'selected' : ''}>${t.title}</option>`
    ).join('');
  }

  renderDayPicker() {
    const picker = this.$('#dayPicker');
    if (!picker) return;
    picker.innerHTML = this.state.days.map(d => 
      `<button data-day="${d}" class="${d === this.selectedDay ? 'active' : ''}">${d.slice(0, 3)}</button>`
    ).join('');
    this.$('#scheduleTitle').textContent = `${this.selectedDay || 'Weekly'} Timetable`;
  }

  getTeacherColour(name) {
    const teacher = this.state.teachers.find(t => t.name === name);
    if (!teacher) return '#eef2f6';
    if (!teacher.colour) {
      const idx = this.state.teachers.indexOf(teacher);
      teacher.colour = this.teacherPalette[idx % this.teacherPalette.length];
    }
    return teacher.colour;
  }

  renderScheduleTable(schedule) {
    const table = this.$('#scheduleTable');
    if (!table) return;

    const classHeaders = this.state.classes.map(c => 
      `<th>${c.name} ${c.section}<br><small>Class teacher: ${c.classTeacher || '—'}</small></th>`
    ).join('');

    const thead = `<thead><tr><th>Period / Time</th>${classHeaders}</tr></thead>`;

    const tbody = `<tbody>` + this.state.periods.map((period, pIndex) => {
      const classCells = this.state.classes.map(cls => {
        const classId = `${cls.name}-${cls.section}`;
        const slot = schedule.find(s => s.d === this.selectedDay && s.p === pIndex && s.c === classId);
        if (!slot) return '<td>—</td>';

        const colour = slot.t !== '—' && slot.t !== 'Unassigned' ? this.getTeacherColour(slot.t) : '#ffffff';
        const note = slot.status === 'covered' ? 'Cover assigned' : (slot.status === 'uncovered' ? 'Needs cover' : '');

        return `
          <td>
            <div class="lesson ${slot.status}" style="background-color: ${colour}; border-left-color: ${colour}">
              <strong>${slot.s}</strong>
              <span>${slot.t}</span>
              ${note ? `<em>${note}</em>` : ''}
            </div>
          </td>
        `;
      }).join('');

      const periodHeader = `
        <td class="period">
          ${period.label}<br>
          <small>${period.start}–${period.end}</small>
        </td>
      `;

      const breakRow = period.breakAfter ? `
        <tr class="break-row">
          <td colspan="${this.state.classes.length + 1}">
            ☕ ${period.breakName || 'Break'} · ${period.breakStart || period.end}–${period.breakEnd || period.end}
          </td>
        </tr>
      ` : '';

      return `<tr>${periodHeader}${classCells}</tr>${breakRow}`;
    }).join('') + `</tbody>`;

    table.innerHTML = thead + tbody;
  }

  renderWorkloadAnalytics(analytics) {
    const wrap = this.$('#teacherAnalytics');
    if (!wrap) return;
    wrap.innerHTML = analytics.map(t => `
      <div class="list-row">
        <strong>
          <i class="teacher-swatch" style="background:${t.colour}"></i>
          ${t.name}
        </strong>
        <span>
          ${t.lessonsCount} lessons/week · ${t.coverCount} covers · ${t.absenceCount} absences
        </span>
      </div>
    `).join('') || '<p class="muted">Add teachers to see workload analytics.</p>';
  }

  renderAbsenceDesk(coverDecisions) {
    // Populate form dropdowns
    this.$('#teacherSelect').innerHTML = this.state.teachers.map(t => `<option value="${t.name}">${t.name}</option>`).join('');
    this.$('#absenceDay').innerHTML = this.state.days.map(d => `<option value="${d}">${d}</option>`).join('');
    this.$('#periodSelect').innerHTML = '<option value="all">Whole day</option>' + 
      this.state.periods.map((p, i) => `<option value="${i}">${p.label}</option>`).join('');

    // Absences list
    const absenceList = this.$('#absenceList');
    absenceList.innerHTML = this.state.absences.length ? this.state.absences.map((a, i) => `
      <div class="absence list-row">
        <div>
          <strong>${a.name}</strong>
          <span>${a.day} · ${a.period === 'all' ? 'Whole day' : (this.state.periods[a.period]?.label || 'Period ' + a.period)}</span>
        </div>
        <button class="mini danger" data-remove-absence="${i}">Remove</button>
      </div>
    `).join('') : '<p class="muted">No absences recorded today.</p>';

    // Coverage decisions
    const coverageList = this.$('#coverageList');
    coverageList.innerHTML = coverDecisions.length ? coverDecisions.map(x => `
      <div class="coverage ${x.status === 'uncovered' ? 'bad' : ''}">
        <div>
          <strong>${x.d} · ${x.c} · ${this.state.periods[x.p]?.label || 'P' + (x.p + 1)}</strong>
          <span>${x.s} — ${x.status === 'covered' ? 'Cover: ' + x.t + ' (replacing ' + x.originalTeacher + ')' : 'No available cover teacher'}</span>
        </div>
        <span>${x.status === 'covered' ? 'Covered' : 'Action needed'}</span>
      </div>
    `).join('') : '<p class="muted">No cover changes are required.</p>';
  }

  renderSchoolSetup() {
    // Teaching days
    this.$('#dayChoices').innerHTML = this.allDays.map(d => `
      <label>
        <input type="checkbox" data-day-choice="${d}" ${this.state.days.includes(d) ? 'checked' : ''}>
        ${d}
      </label>
    `).join('');

    // Periods
    this.$('#periodList').innerHTML = this.state.periods.map((p, i) => `
      <div class="period-row">
        <strong>P${i + 1}</strong>
        <input data-period="${i}" data-field="start" type="time" value="${p.start}">
        <input data-period="${i}" data-field="end" type="time" value="${p.end}">
        <label>
          <input data-period="${i}" data-field="breakAfter" type="checkbox" ${p.breakAfter ? 'checked' : ''}>
          Break after
        </label>
        ${p.breakAfter ? `
          <input data-period="${i}" data-field="breakName" type="text" placeholder="Break title" value="${p.breakName || 'Break'}" style="width:110px;">
          <input data-period="${i}" data-field="breakStart" type="time" value="${p.breakStart || p.end}">
          <input data-period="${i}" data-field="breakEnd" type="time" value="${p.breakEnd || p.end}">
        ` : ''}
        <button class="mini danger" data-action="delete-period" data-index="${i}">Delete</button>
      </div>
    `).join('');

    this.$('#addPeriod').disabled = this.state.periods.length >= 12;

    // Subjects
    this.$('#subjectList').innerHTML = this.state.subjects.map((s, i) => `
      <span>
        ${s}
        <button class="mini" data-action="edit-subject" data-index="${i}">✎</button>
        <button class="mini danger" data-action="delete-subject" data-index="${i}">×</button>
      </span>
    `).join('');

    // Teachers
    this.$('#teacherList').innerHTML = this.state.teachers.map((t, i) => `
      <div class="list-row">
        <strong>
          <i class="teacher-swatch" style="background:${t.colour}"></i>
          ${t.name}
        </strong>
        <div>
          <button class="mini" data-action="edit-teacher" data-index="${i}">Edit</button>
          <button class="mini danger" data-action="delete-teacher" data-index="${i}">Delete</button>
        </div>
      </div>
    `).join('');

    // Classes
    this.$('#classList').innerHTML = this.state.classes.map((c, i) => `
      <div class="list-row">
        <strong>${c.name} ${c.section}</strong>
        <span>Class teacher: ${c.classTeacher || 'Not assigned'}</span>
        <div>
          <button class="mini" data-action="edit-class" data-index="${i}">Edit</button>
          <button class="mini danger" data-action="delete-class" data-index="${i}">Delete</button>
        </div>
      </div>
    `).join('');

    // Assignments form selects
    const teacherOptions = this.state.teachers.map(t => `<option value="${t.name}">${t.name}</option>`).join('');
    this.$('#classTeacher').innerHTML = '<option value="">Choose class teacher</option>' + teacherOptions;
    this.$('#assignmentTeacher').innerHTML = teacherOptions;
    this.$('#assignmentClass').innerHTML = this.state.classes.map(c => `<option value="${c.name}-${c.section}">${c.name} ${c.section}</option>`).join('');
    this.$('#assignmentSubject').innerHTML = this.state.subjects.map(s => `<option value="${s}">${s}</option>`).join('');

    // Assignments list
    this.$('#assignmentList').innerHTML = this.state.assignments.map((a, i) => `
      <div class="list-row">
        <strong>${a.classId} · ${a.subject}</strong>
        <span>${a.teacher} · ${a.frequency} lessons/week</span>
        <div>
          <button class="mini" data-action="edit-assignment" data-index="${i}">Edit</button>
          <button class="mini danger" data-action="delete-assignment" data-index="${i}">Delete</button>
        </div>
      </div>
    `).join('');
  }

  renderAdminTasks() {
    this.state.admins ??= [];
    this.state.tasks ??= [];

    // Admin list
    this.$('#adminList').innerHTML = this.state.admins.length ? this.state.admins.map((a, i) => `
      <div class="list-row">
        <strong>${a}</strong>
        <button class="mini danger" data-remove-admin="${i}">Remove</button>
      </div>
    `).join('') : '<p class="muted">No administrators added yet.</p>';

    // Select options for task form
    this.$('#taskAdmin').innerHTML = this.state.admins.map(a => `<option>${a}</option>`).join('') || '<option value="">Add an admin first</option>';
    this.$('#taskTeacher').innerHTML = this.state.teachers.map(t => `<option>${t.name}</option>`).join('');

    // Task list
    this.$('#taskList').innerHTML = this.state.tasks.length ? this.state.tasks.map((t, i) => `
      <div class="coverage ${t.done ? '' : 'bad'}">
        <div>
          <strong>${t.teacher} · ${t.title}</strong>
          <span>Assigned by ${t.admin} ${t.due ? ' · Due ' + t.due.replace('T', ' ') : ''}</span>
        </div>
        <div>
          <button class="mini" data-task-toggle="${i}">${t.done ? 'Reopen' : 'Complete'}</button>
          <button class="mini danger" data-task-delete="${i}">Delete</button>
        </div>
      </div>
    `).join('') : '<p class="muted">No pending administrative tasks.</p>';
  }

  bindEvents() {
    // 1. Tab Switching
    this.$$('.nav-tabs button').forEach(btn => {
      btn.addEventListener('click', () => {
        this.$$('.nav-tabs button').forEach(b => b.classList.remove('active'));
        this.$$('.view').forEach(v => v.classList.remove('active'));
        btn.classList.add('active');
        const viewId = btn.dataset.view;
        const targetView = this.$('#' + viewId);
        if (targetView) targetView.classList.add('active');
      });
    });

    // 2. Day Picker Click
    this.$('#dayPicker').addEventListener('click', e => {
      if (e.target.dataset.day) {
        this.selectedDay = e.target.dataset.day;
        this.renderDayPicker();
        this.renderScheduleTable(this.cachedScheduleOutput?.schedule || []);
      }
    });

    // 3. Timetable Switcher dropdown
    this.$('#timetableSelect').addEventListener('change', e => {
      this.switchTimetable(e.target.value);
    });

    // 4. Timetable Manager Modal trigger
    this.$('#manageTimetablesBtn').addEventListener('click', () => {
      this.openTimetableManagerModal();
    });

    // 5. User Account Widget / Settings Modal trigger
    this.$('#userAccountWidget').addEventListener('click', () => {
      this.openAccountModal();
    });

    // 6. Exports & Action Buttons
    this.$('#dayExcelBtn').onclick = () => ExportService.exportExcel(this.state, this.cachedScheduleOutput.schedule, this.selectedDay, `schoolflow-${this.selectedDay.toLowerCase()}-timetable.xls`);
    this.$('#weekExcelBtn').onclick = () => ExportService.exportExcel(this.state, this.cachedScheduleOutput.schedule, null, 'schoolflow-weekly-timetable.xls');
    this.$('#dayPrintBtn').onclick = () => ExportService.printTimetable(this.state, this.cachedScheduleOutput.schedule, this.selectedDay);
    this.$('#weekPrintBtn').onclick = () => ExportService.printTimetable(this.state, this.cachedScheduleOutput.schedule, null);
    this.$('#downloadBtn').onclick = () => ExportService.exportCsv(this.state, this.cachedScheduleOutput.schedule);
    this.$('#shareBtn').onclick = () => ExportService.shareSummary(this.state, this.cachedScheduleOutput.metrics);
    this.$('#rescheduleBtn').onclick = () => this.render();
    this.$('#saveSnapshotBtn').onclick = () => {
      StorageService.saveTimetableData(this.currentUser.id, this.activeTimetableId, this.state, this.cachedScheduleOutput);
      alert('Snapshot and timetable outputs saved successfully to cloud!');
    };

    // 7. Absence Form
    this.$('#absenceForm').onsubmit = e => {
      e.preventDefault();
      const teacher = this.$('#teacherSelect').value;
      const day = this.$('#absenceDay').value;
      const period = this.$('#periodSelect').value;
      this.state.absences.push({ name: teacher, day, period });
      this.selectedDay = day;
      this.render();
    };

    this.$('#absenceList').onclick = e => {
      const idx = e.target.dataset.removeAbsence;
      if (idx !== undefined) {
        this.state.absences.splice(+idx, 1);
        this.render();
      }
    };

    // 8. Setup Controls & Forms
    this.$('#dayChoices').onchange = e => {
      const day = e.target.dataset.dayChoice;
      if (day) {
        this.state.days = e.target.checked
          ? [...this.state.days, day].sort((a, b) => this.allDays.indexOf(a) - this.allDays.indexOf(b))
          : this.state.days.filter(x => x !== day);
        this.render();
      }
    };

    this.$('#periodList').onchange = e => {
      const i = e.target.dataset.period;
      if (i !== undefined) {
        const field = e.target.dataset.field;
        this.state.periods[i][field] = field === 'breakAfter' ? e.target.checked : e.target.value;
        this.render();
      }
    };

    this.$('#addPeriod').onclick = () => {
      if (this.state.periods.length < 12) {
        const last = this.state.periods.at(-1);
        this.state.periods.push({
          label: `Period ${this.state.periods.length + 1}`,
          start: last?.end || '08:30',
          end: '14:40',
          breakAfter: false
        });
        this.render();
      }
    };

    this.$('#subjectForm').onsubmit = e => {
      e.preventDefault();
      const val = this.$('#subjectName').value.trim();
      if (val && !this.state.subjects.includes(val)) {
        this.state.subjects.push(val);
      }
      e.target.reset();
      this.render();
    };

    this.$('#teacherForm').onsubmit = e => {
      e.preventDefault();
      const val = this.$('#teacherName').value.trim();
      if (val && !this.state.teachers.some(t => t.name === val)) {
        const colour = this.teacherPalette[this.state.teachers.length % this.teacherPalette.length];
        this.state.teachers.push({ name: val, colour });
      }
      e.target.reset();
      this.render();
    };

    this.$('#classForm').onsubmit = e => {
      e.preventDefault();
      const cls = {
        name: this.$('#className').value.trim(),
        section: this.$('#sectionName').value.trim(),
        classTeacher: this.$('#classTeacher').value
      };
      if (cls.name && cls.section && !this.state.classes.some(x => x.name === cls.name && x.section === cls.section)) {
        this.state.classes.push(cls);
      }
      e.target.reset();
      this.render();
    };

    this.$('#assignmentForm').onsubmit = e => {
      e.preventDefault();
      this.state.assignments.push({
        teacher: this.$('#assignmentTeacher').value,
        classId: this.$('#assignmentClass').value,
        subject: this.$('#assignmentSubject').value,
        frequency: +this.$('#assignmentFrequency').value
      });
      this.render();
    };

    // 9. Admin tasks & handlers
    this.$('#adminForm').onsubmit = e => {
      e.preventDefault();
      const name = this.$('#adminName').value.trim();
      if (name && !this.state.admins.includes(name)) {
        this.state.admins.push(name);
      }
      e.target.reset();
      this.render();
    };

    this.$('#adminList').onclick = e => {
      const idx = e.target.dataset.removeAdmin;
      if (idx !== undefined) {
        this.state.admins.splice(+idx, 1);
        this.render();
      }
    };

    this.$('#taskForm').onsubmit = e => {
      e.preventDefault();
      const admin = this.$('#taskAdmin').value;
      const teacher = this.$('#taskTeacher').value;
      const title = this.$('#taskTitle').value.trim();
      const due = this.$('#taskDue').value;
      if (!admin) return alert('Please add an administrator first.');
      if (title) {
        this.state.tasks.unshift({ admin, teacher, title, due, done: false });
        e.target.reset();
        this.render();
      }
    };

    this.$('#taskList').onclick = e => {
      if (e.target.dataset.taskToggle !== undefined) {
        const t = this.state.tasks[+e.target.dataset.taskToggle];
        if (t) t.done = !t.done;
        this.render();
      }
      if (e.target.dataset.taskDelete !== undefined) {
        this.state.tasks.splice(+e.target.dataset.taskDelete, 1);
        this.render();
      }
    };

    // 10. Item Edit / Delete Delegations
    document.addEventListener('click', e => {
      const btn = e.target.closest('[data-action]');
      if (!btn) return;
      const action = btn.dataset.action;
      const index = +btn.dataset.index;

      if (action === 'delete-period') {
        if (this.state.periods.length <= 1) return alert('A timetable needs at least one period.');
        if (!confirm(`Delete ${this.state.periods[index].label}?`)) return;
        this.state.periods.splice(index, 1);
        this.state.periods.forEach((p, n) => p.label = `Period ${n + 1}`);
        this.render();
      } else if (action === 'delete-subject') {
        const sub = this.state.subjects[index];
        if (confirm(`Delete subject "${sub}"? This will also remove associated assignments.`)) {
          this.state.subjects.splice(index, 1);
          this.state.assignments = this.state.assignments.filter(a => a.subject !== sub);
          this.render();
        }
      } else if (action === 'edit-subject') {
        const oldName = this.state.subjects[index];
        const newName = prompt('New subject name:', oldName)?.trim();
        if (newName && newName !== oldName) {
          this.state.subjects[index] = newName;
          this.state.assignments.forEach(a => { if (a.subject === oldName) a.subject = newName; });
          this.render();
        }
      } else if (action === 'delete-teacher') {
        const name = this.state.teachers[index].name;
        if (confirm(`Delete teacher "${name}"?`)) {
          this.state.teachers.splice(index, 1);
          this.state.assignments = this.state.assignments.filter(a => a.teacher !== name);
          this.state.classes.forEach(c => { if (c.classTeacher === name) c.classTeacher = ''; });
          this.render();
        }
      } else if (action === 'edit-teacher') {
        const t = this.state.teachers[index];
        const newName = prompt('Teacher name:', t.name)?.trim();
        if (newName && newName !== t.name) {
          const old = t.name;
          t.name = newName;
          this.state.assignments.forEach(a => { if (a.teacher === old) a.teacher = newName; });
          this.state.classes.forEach(c => { if (c.classTeacher === old) c.classTeacher = newName; });
          this.state.absences.forEach(a => { if (a.name === old) a.name = newName; });
          this.render();
        }
      } else if (action === 'delete-class') {
        const c = this.state.classes[index];
        const classId = `${c.name}-${c.section}`;
        if (confirm(`Delete class "${classId}"?`)) {
          this.state.classes.splice(index, 1);
          this.state.assignments = this.state.assignments.filter(a => a.classId !== classId);
          this.render();
        }
      } else if (action === 'edit-class') {
        const c = this.state.classes[index];
        const oldId = `${c.name}-${c.section}`;
        const name = prompt('Grade / Class name:', c.name)?.trim();
        const section = prompt('Section:', c.section)?.trim();
        const teacher = prompt('Class teacher:', c.classTeacher)?.trim();
        if (name && section) {
          c.name = name;
          c.section = section;
          c.classTeacher = teacher || '';
          const newId = `${name}-${section}`;
          this.state.assignments.forEach(a => { if (a.classId === oldId) a.classId = newId; });
          this.render();
        }
      } else if (action === 'delete-assignment') {
        const a = this.state.assignments[index];
        if (confirm(`Delete assignment ${a.classId} - ${a.subject}?`)) {
          this.state.assignments.splice(index, 1);
          this.render();
        }
      } else if (action === 'edit-assignment') {
        const a = this.state.assignments[index];
        const freq = prompt(`Weekly lessons for ${a.classId} (${a.subject}):`, a.frequency);
        if (freq && !isNaN(+freq)) {
          a.frequency = Math.max(1, Math.min(10, +freq));
          this.render();
        }
      }
    });

    // 11. Modal Close Handlers
    this.$$('.modal-close, .modal-backdrop').forEach(el => {
      el.addEventListener('click', () => {
        this.$$('.modal-overlay').forEach(m => m.classList.remove('open'));
      });
    });
  }

  // Timetable Manager Modal
  openTimetableManagerModal() {
    const modal = this.$('#timetableModal');
    const list = StorageService.getUserTimetables(this.currentUser.id);
    const container = this.$('#timetableListContainer');

    container.innerHTML = list.map(t => `
      <div class="list-row" style="background:${t.id === this.activeTimetableId ? 'var(--primary-subtle)' : ''}">
        <div>
          <strong>${t.title}</strong>
          <span>${t.academicYear} · Updated ${new Date(t.updatedAt).toLocaleDateString()}</span>
        </div>
        <div>
          ${t.id !== this.activeTimetableId ? `<button class="mini" data-switch-tt="${t.id}">Switch</button>` : '<b>Active</b>'}
          <button class="mini" data-rename-tt="${t.id}">Rename</button>
          <button class="mini danger" data-delete-tt="${t.id}">Delete</button>
        </div>
      </div>
    `).join('');

    container.onclick = e => {
      const sw = e.target.dataset.switchTt;
      if (sw) {
        this.switchTimetable(sw);
        modal.classList.remove('open');
        this.renderTimetableDropdown(StorageService.getUserTimetables(this.currentUser.id));
      }
      const ren = e.target.dataset.renameTt;
      if (ren) {
        const newTitle = prompt('New timetable name:');
        if (newTitle && newTitle.trim()) {
          StorageService.renameTimetable(this.currentUser.id, ren, newTitle.trim());
          this.openTimetableManagerModal();
          this.renderTimetableDropdown(StorageService.getUserTimetables(this.currentUser.id));
        }
      }
      const del = e.target.dataset.deleteTt;
      if (del) {
        if (confirm('Are you sure you want to delete this timetable?')) {
          try {
            StorageService.deleteTimetable(this.currentUser.id, del);
            this.loadUserWorkspace();
            this.openTimetableManagerModal();
          } catch (err) {
            alert(err.message);
          }
        }
      }
    };

    // New Timetable form
    this.$('#newTimetableForm').onsubmit = e => {
      e.preventDefault();
      const title = this.$('#newTimetableTitle').value.trim();
      const year = this.$('#newTimetableYear').value.trim();
      const clone = this.$('#cloneCurrentCheckbox').checked;

      if (title) {
        const created = StorageService.createTimetable(this.currentUser.id, title, year, clone, this.state);
        this.switchTimetable(created.id);
        modal.classList.remove('open');
        this.renderTimetableDropdown(StorageService.getUserTimetables(this.currentUser.id));
        e.target.reset();
      }
    };

    modal.classList.add('open');
  }

  // Account & Google Identity Modal
  openAccountModal() {
    const modal = this.$('#accountModal');
    
    // Fill current user info
    this.$('#modalUserAvatar').src = this.currentUser.picture || '';
    this.$('#modalUserName').textContent = this.currentUser.name;
    this.$('#modalUserEmail').textContent = this.currentUser.email;
    this.$('#modalUserRole').textContent = `${this.currentUser.role} · ${this.currentUser.schoolName}`;

    // Render Sandbox Personas
    const personaContainer = this.$('#personaList');
    personaContainer.innerHTML = SANDBOX_PERSONAS.map(p => `
      <div class="persona-item ${p.id === this.currentUser.id ? 'selected' : ''}" data-persona-id="${p.id}">
        <img src="${p.picture}" alt="${p.name}">
        <div>
          <strong>${p.name}</strong>
          <div style="font-size:12px;color:var(--neutral-500);">${p.role} · ${p.schoolName}</div>
          <div style="font-size:11px;color:var(--neutral-400);">${p.email}</div>
        </div>
      </div>
    `).join('');

    personaContainer.onclick = e => {
      const item = e.target.closest('[data-persona-id]');
      if (!item) return;
      AuthService.switchSandboxUser(item.dataset.personaId);
      modal.classList.remove('open');
    };

    // Config form
    this.$('#configGoogleClientId').value = AppConfig.googleClientId || '';
    this.$('#configForm').onsubmit = e => {
      e.preventDefault();
      AppConfig.save({
        googleClientId: this.$('#configGoogleClientId').value.trim()
      });
      alert('SaaS credentials saved! Reload the page to activate Google Identity Services button.');
      modal.classList.remove('open');
    };

    modal.classList.add('open');
  }

  // Initialize official Google Identity Services button if configured
  initGoogleAuthClient() {
    if (!window.google || !AppConfig.googleClientId) return;
    try {
      window.google.accounts.id.initialize({
        client_id: AppConfig.googleClientId,
        callback: (resp) => {
          AuthService.handleGoogleCredential(resp);
        }
      });
      const btnContainer = this.$('#gsiButtonContainer');
      if (btnContainer) {
        window.google.accounts.id.renderButton(btnContainer, {
          theme: 'outline',
          size: 'large',
          text: 'signin_with',
          shape: 'pill'
        });
      }
    } catch (e) {
      console.warn("Google Identity Services initialization:", e);
    }
  }
}

// Initialize Application once DOM is loaded
window.addEventListener('DOMContentLoaded', () => {
  const app = new UIController();
  app.init();
  window.SchoolFlowApp = app;
});
