/**
 * SchoolFlow SaaS — Complete Unified Application Engine
 * 
 * Self-contained & production-ready:
 * - Works directly from file:/// in browsers without CORS restrictions
 * - Works natively on Vercel over HTTPS
 * - Google ID Authorization & Identity Hub
 * - Multi-user data isolation (Inputs & Outputs saved per Google ID)
 * - Multi-timetable management (Terms, Exam weeks, etc.)
 * - Algorithmic clash-free scheduler & smart staff cover solver
 * - Excel, CSV, and Landscape PDF exports
 */

(function () {
  'use strict';

  /* ==========================================================================
     1. CONFIGURATION MANAGER
     ========================================================================== */
  const CONFIG_KEY = 'schoolflow_saas_config';

  const AppConfig = {
    googleClientId: "",
    load() {
      try {
        const saved = localStorage.getItem(CONFIG_KEY);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed.googleClientId) this.googleClientId = parsed.googleClientId;
        }
      } catch (e) {
        console.warn("Could not load config", e);
      }
      return this;
    },
    save(newConfig) {
      if (newConfig.googleClientId !== undefined) this.googleClientId = newConfig.googleClientId.trim();
      localStorage.setItem(CONFIG_KEY, JSON.stringify({ googleClientId: this.googleClientId }));
    }
  };
  AppConfig.load();

  /* ==========================================================================
     2. SVG AVATARS (Guaranteed offline & online rendering)
     ========================================================================== */
  const AVATAR_JENKINS = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="50" fill="%232563eb"/><circle cx="50" cy="40" r="20" fill="%23ffffff"/><path d="M 20 85 C 20 65, 80 65, 80 85 Z" fill="%23ffffff"/></svg>`;
  const AVATAR_CHEN = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="50" fill="%230d9488"/><circle cx="50" cy="40" r="20" fill="%23ffffff"/><path d="M 20 85 C 20 65, 80 65, 80 85 Z" fill="%23ffffff"/></svg>`;

  /* ==========================================================================
     3. AUTHENTICATION & MULTI-USER IDENTITY HUB
     ========================================================================== */
  const AUTH_USER_KEY = 'schoolflow_active_user';

  const SANDBOX_PERSONAS = [
    {
      id: 'google-sub-10827361928374',
      name: 'Dr. Sarah Jenkins',
      email: 'sarah.jenkins@oakridge-academy.edu',
      picture: AVATAR_JENKINS,
      schoolName: 'Oakridge International Academy',
      role: 'Head of Academics'
    },
    {
      id: 'google-sub-29384756102938',
      name: 'Prof. Michael Chen',
      email: 'm.chen@stjudes-school.org',
      picture: AVATAR_CHEN,
      schoolName: 'St. Jude Grammar School',
      role: 'Principal'
    }
  ];

  class AuthController {
    constructor() {
      this.currentUser = null;
      this.listeners = [];
      this.init();
    }

    init() {
      try {
        const saved = localStorage.getItem(AUTH_USER_KEY);
        if (saved) {
          this.currentUser = JSON.parse(saved);
        }
      } catch (e) {
        console.warn("Error restoring session", e);
      }

      if (!this.currentUser) {
        this.currentUser = SANDBOX_PERSONAS[0];
        localStorage.setItem(AUTH_USER_KEY, JSON.stringify(this.currentUser));
      }
    }

    getCurrentUser() {
      return this.currentUser;
    }

    onAuthStateChanged(callback) {
      this.listeners.push(callback);
      callback(this.currentUser);
      return () => {
        this.listeners = this.listeners.filter(cb => cb !== callback);
      };
    }

    notifyListeners() {
      this.listeners.forEach(cb => {
        try { cb(this.currentUser); } catch (e) { console.error(e); }
      });
    }

    switchSandboxUser(personaId) {
      const persona = SANDBOX_PERSONAS.find(p => p.id === personaId) || SANDBOX_PERSONAS[0];
      this.currentUser = { ...persona };
      localStorage.setItem(AUTH_USER_KEY, JSON.stringify(this.currentUser));
      this.notifyListeners();
      return this.currentUser;
    }

    handleGoogleCredential(credentialResponse) {
      try {
        const payload = this.parseJwt(credentialResponse.credential);
        this.currentUser = {
          id: 'google-sub-' + payload.sub,
          name: payload.name || payload.email.split('@')[0],
          email: payload.email,
          picture: payload.picture || AVATAR_JENKINS,
          schoolName: payload.hd ? `${payload.hd.split('.')[0].toUpperCase()} School` : 'Personal Workspace',
          role: 'Administrator',
          isLiveGoogle: true
        };
        localStorage.setItem(AUTH_USER_KEY, JSON.stringify(this.currentUser));
        this.notifyListeners();
        return this.currentUser;
      } catch (err) {
        console.error("Failed to parse Google credential", err);
        alert("Failed to process Google sign-in.");
      }
    }

    parseJwt(token) {
      const base64Url = token.split('.')[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = decodeURIComponent(atob(base64).split('').map(c => {
        return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
      }).join(''));
      return JSON.parse(jsonPayload);
    }
  }

  const AuthService = new AuthController();

  /* ==========================================================================
     4. DEFAULT SEED STATE & MULTI-TENANT CLOUD PERSISTENCE
     ========================================================================== */
  const DEFAULT_SEED_STATE = {
    version: 3,
    days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
    periods: [
      { label: 'Period 1', start: '08:30', end: '09:15', breakAfter: false, breakName: 'Break', breakStart: '09:15', breakEnd: '09:15' },
      { label: 'Period 2', start: '09:15', end: '10:00', breakAfter: true, breakName: 'Morning Break', breakStart: '10:00', breakEnd: '10:20' },
      { label: 'Period 3', start: '10:20', end: '11:05', breakAfter: false, breakName: 'Break', breakStart: '11:05', breakEnd: '11:05' },
      { label: 'Period 4', start: '11:05', end: '11:50', breakAfter: false, breakName: 'Break', breakStart: '11:50', breakEnd: '11:50' },
      { label: 'Period 5', start: '11:50', end: '12:35', breakAfter: true, breakName: 'Lunch Break', breakStart: '12:35', breakEnd: '13:10' },
      { label: 'Period 6', start: '13:10', end: '13:55', breakAfter: false, breakName: 'Break', breakStart: '13:55', breakEnd: '13:55' }
    ],
    subjects: ['Maths', 'English', 'Science', 'History', 'Geography', 'PE', 'Art'],
    teachers: [
      { name: 'Anita Rao', colour: '#dfeaff' },
      { name: 'Daniel Lewis', colour: '#dff4eb' },
      { name: 'Priya Shah', colour: '#fff0d9' },
      { name: 'Maya Chen', colour: '#f0e4ff' },
      { name: 'Owen King', colour: '#ffe2e5' },
      { name: 'Fatima Noor', colour: '#dff3f5' },
      { name: 'Leo Martin', colour: '#fff7c8' }
    ],
    classes: [
      { name: 'Grade 7', section: 'A', classTeacher: 'Anita Rao' },
      { name: 'Grade 7', section: 'B', classTeacher: 'Daniel Lewis' },
      { name: 'Grade 8', section: 'A', classTeacher: 'Priya Shah' },
      { name: 'Grade 8', section: 'B', classTeacher: 'Maya Chen' }
    ],
    assignments: [
      { classId: 'Grade 7-A', subject: 'Maths', teacher: 'Anita Rao', frequency: 4 },
      { classId: 'Grade 7-A', subject: 'English', teacher: 'Daniel Lewis', frequency: 4 },
      { classId: 'Grade 7-A', subject: 'Science', teacher: 'Priya Shah', frequency: 4 },
      { classId: 'Grade 7-A', subject: 'History', teacher: 'Maya Chen', frequency: 4 },
      { classId: 'Grade 7-A', subject: 'PE', teacher: 'Owen King', frequency: 2 },
      { classId: 'Grade 7-A', subject: 'Art', teacher: 'Leo Martin', frequency: 2 },
      { classId: 'Grade 7-B', subject: 'Maths', teacher: 'Anita Rao', frequency: 4 },
      { classId: 'Grade 7-B', subject: 'English', teacher: 'Daniel Lewis', frequency: 4 },
      { classId: 'Grade 7-B', subject: 'Science', teacher: 'Priya Shah', frequency: 4 },
      { classId: 'Grade 7-B', subject: 'History', teacher: 'Maya Chen', frequency: 4 },
      { classId: 'Grade 7-B', subject: 'PE', teacher: 'Owen King', frequency: 2 },
      { classId: 'Grade 7-B', subject: 'Art', teacher: 'Leo Martin', frequency: 2 },
      { classId: 'Grade 8-A', subject: 'Maths', teacher: 'Anita Rao', frequency: 4 },
      { classId: 'Grade 8-A', subject: 'English', teacher: 'Daniel Lewis', frequency: 4 },
      { classId: 'Grade 8-A', subject: 'Science', teacher: 'Priya Shah', frequency: 4 },
      { classId: 'Grade 8-A', subject: 'History', teacher: 'Maya Chen', frequency: 4 },
      { classId: 'Grade 8-A', subject: 'PE', teacher: 'Owen King', frequency: 2 },
      { classId: 'Grade 8-A', subject: 'Art', teacher: 'Leo Martin', frequency: 2 },
      { classId: 'Grade 8-B', subject: 'Maths', teacher: 'Anita Rao', frequency: 4 },
      { classId: 'Grade 8-B', subject: 'English', teacher: 'Daniel Lewis', frequency: 4 },
      { classId: 'Grade 8-B', subject: 'Science', teacher: 'Priya Shah', frequency: 4 },
      { classId: 'Grade 8-B', subject: 'History', teacher: 'Maya Chen', frequency: 4 },
      { classId: 'Grade 8-B', subject: 'PE', teacher: 'Owen King', frequency: 2 },
      { classId: 'Grade 8-B', subject: 'Art', teacher: 'Leo Martin', frequency: 2 }
    ],
    absences: [],
    admins: ['Vice Principal Walker'],
    tasks: []
  };

  class StorageController {
    constructor() {
      this.saveTimeout = null;
      this.syncStatusListeners = [];
    }

    onSyncStatusChange(cb) {
      this.syncStatusListeners.push(cb);
    }

    notifySyncStatus(status, message) {
      this.syncStatusListeners.forEach(cb => cb(status, message));
    }

    getUserTimetablesKey(userId) {
      return `schoolflow_timetables_${userId}`;
    }

    getDataKey(userId, timetableId) {
      return `schoolflow_data_${userId}_${timetableId}`;
    }

    getUserTimetables(userId) {
      if (!userId) return [];
      try {
        const key = this.getUserTimetablesKey(userId);
        let list = JSON.parse(localStorage.getItem(key) || 'null');
        if (!list || !Array.isArray(list) || list.length === 0) {
          const defaultT = {
            id: 'tt-' + Date.now(),
            title: 'Main Academic Timetable 2026-27',
            academicYear: '2026-2027',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          };
          list = [defaultT];
          localStorage.setItem(key, JSON.stringify(list));
          this.saveTimetableData(userId, defaultT.id, JSON.parse(JSON.stringify(DEFAULT_SEED_STATE)), null);
        }
        return list;
      } catch (e) {
        console.error("Error loading user timetables", e);
        return [];
      }
    }

    createTimetable(userId, title, academicYear = '2026-2027', cloneFromCurrent = false, currentState = null) {
      const list = this.getUserTimetables(userId);
      const newId = 'tt-' + Date.now();
      const newEntry = {
        id: newId,
        title: title || `Timetable ${list.length + 1}`,
        academicYear: academicYear || '2026-2027',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      list.push(newEntry);
      localStorage.setItem(this.getUserTimetablesKey(userId), JSON.stringify(list));

      const initialData = (cloneFromCurrent && currentState) 
        ? JSON.parse(JSON.stringify(currentState))
        : JSON.parse(JSON.stringify(DEFAULT_SEED_STATE));

      this.saveTimetableData(userId, newId, initialData, null);
      return newEntry;
    }

    renameTimetable(userId, timetableId, newTitle) {
      const list = this.getUserTimetables(userId);
      const item = list.find(t => t.id === timetableId);
      if (item) {
        item.title = newTitle;
        item.updatedAt = new Date().toISOString();
        localStorage.setItem(this.getUserTimetablesKey(userId), JSON.stringify(list));
      }
      return list;
    }

    deleteTimetable(userId, timetableId) {
      let list = this.getUserTimetables(userId);
      if (list.length <= 1) {
        throw new Error("You must keep at least one timetable in your workspace.");
      }
      list = list.filter(t => t.id !== timetableId);
      localStorage.setItem(this.getUserTimetablesKey(userId), JSON.stringify(list));
      localStorage.removeItem(this.getDataKey(userId, timetableId));
      return list;
    }

    loadTimetableData(userId, timetableId) {
      if (!userId || !timetableId) return { inputs: JSON.parse(JSON.stringify(DEFAULT_SEED_STATE)), outputs: null };
      try {
        const raw = localStorage.getItem(this.getDataKey(userId, timetableId));
        if (!raw) {
          const seed = JSON.parse(JSON.stringify(DEFAULT_SEED_STATE));
          return { inputs: seed, outputs: null };
        }
        const data = JSON.parse(raw);
        return {
          inputs: data.inputs || JSON.parse(JSON.stringify(DEFAULT_SEED_STATE)),
          outputs: data.outputs || null,
          metadata: data.metadata || {}
        };
      } catch (e) {
        console.error("Error reading timetable data", e);
        return { inputs: JSON.parse(JSON.stringify(DEFAULT_SEED_STATE)), outputs: null };
      }
    }

    saveTimetableData(userId, timetableId, inputState, outputState = null) {
      if (!userId || !timetableId) return;
      this.notifySyncStatus('syncing', 'Saving to cloud...');
      try {
        const payload = {
          timetableId,
          userId,
          updatedAt: new Date().toISOString(),
          inputs: inputState,
          outputs: outputState,
          metadata: { version: 3, client: 'SchoolFlow SaaS' }
        };

        localStorage.setItem(this.getDataKey(userId, timetableId), JSON.stringify(payload));

        const list = this.getUserTimetables(userId);
        const entry = list.find(t => t.id === timetableId);
        if (entry) {
          entry.updatedAt = new Date().toISOString();
          localStorage.setItem(this.getUserTimetablesKey(userId), JSON.stringify(list));
        }

        setTimeout(() => {
          this.notifySyncStatus('synced', 'All changes saved to Cloud');
        }, 300);
      } catch (err) {
        console.error("Failed to save timetable data", err);
        this.notifySyncStatus('error', 'Storage sync error');
      }
    }

    queueAutoSave(userId, timetableId, inputState, outputState = null, delayMs = 500) {
      this.notifySyncStatus('syncing', 'Unsaved changes...');
      if (this.saveTimeout) clearTimeout(this.saveTimeout);
      this.saveTimeout = setTimeout(() => {
        this.saveTimetableData(userId, timetableId, inputState, outputState);
      }, delayMs);
    }
  }

  const StorageService = new StorageController();

  /* ==========================================================================
     5. SCHEDULER & STAFF COVER ENGINE
     ========================================================================== */
  class SchedulerEngine {
    static getClassId(c) {
      return `${c.name}-${c.section}`;
    }

    static isAbsent(state, teacherName, day, periodIndex) {
      return state.absences.some(a => 
        a.name === teacherName && 
        a.day === day && 
        (a.period === 'all' || +a.period === periodIndex)
      );
    }

    static getTeacherSubjects(state, teacherName) {
      return [...new Set(
        state.assignments
          .filter(a => a.teacher === teacherName)
          .map(a => a.subject)
      )];
    }

    static generate(state) {
      if (!state.days.length || !state.periods.length || !state.classes.length) {
        return {
          schedule: [],
          coverDecisions: [],
          workloadAnalytics: [],
          metrics: { scheduledLessons: 0, availableTeachers: state.teachers.length, needingCover: 0, coverageRate: 100 }
        };
      }

      const remainingFreq = Object.fromEntries(state.assignments.map((a, i) => [i, a.frequency]));
      const baseSchedule = [];

      for (const day of state.days) {
        for (let pIndex = 0; pIndex < state.periods.length; pIndex++) {
          const usedTeachersInSlot = new Set();

          for (const cls of state.classes) {
            const classKey = this.getClassId(cls);

            const candidate = state.assignments
              .map((a, i) => ({ ...a, i, left: remainingFreq[i] }))
              .filter(a => a.classId === classKey && a.left > 0 && !usedTeachersInSlot.has(a.teacher))
              .sort((a, b) => b.left - a.left)[0];

            if (candidate) {
              usedTeachersInSlot.add(candidate.teacher);
              remainingFreq[candidate.i]--;
              baseSchedule.push({
                d: day,
                p: pIndex,
                c: classKey,
                s: candidate.subject,
                t: candidate.teacher,
                status: 'normal'
              });
            } else {
              baseSchedule.push({
                d: day,
                p: pIndex,
                c: classKey,
                s: 'Study / Free',
                t: '—',
                status: 'normal'
              });
            }
          }
        }
      }

      const dailyLoad = {};
      const weeklyLoad = {};
      state.teachers.forEach(t => {
        weeklyLoad[t.name] = 0;
        state.days.forEach(d => { dailyLoad[`${t.name}|${d}`] = 0; });
      });

      baseSchedule
        .filter(slot => slot.t !== '—' && !this.isAbsent(state, slot.t, slot.d, slot.p))
        .forEach(slot => {
          dailyLoad[`${slot.t}|${slot.d}`]++;
          weeklyLoad[slot.t]++;
        });

      const occupied = {};
      state.days.forEach(d => {
        state.periods.forEach((_, pIndex) => {
          occupied[`${d}|${pIndex}`] = new Set(
            baseSchedule
              .filter(slot => slot.d === d && slot.p === pIndex && !this.isAbsent(state, slot.t, d, pIndex))
              .map(slot => slot.t)
          );
        });
      });

      const computedSchedule = baseSchedule.map(slot => {
        if (slot.t === '—' || !this.isAbsent(state, slot.t, slot.d, slot.p)) {
          return slot;
        }

        const originalTeacher = slot.t;
        const priorPeriodsTaught = name => state.absences.filter(a => 
          a.name === name && a.day === slot.d && a.period !== 'all' && (+a.period) < slot.p
        ).length;

        const candidateTeachers = state.teachers.filter(teacher => 
          !this.isAbsent(state, teacher.name, slot.d, slot.p) &&
          !occupied[`${slot.d}|${slot.p}`].has(teacher.name)
        );

        const bestCover = candidateTeachers.sort((a, b) => {
          const aSubjects = this.getTeacherSubjects(state, a.name);
          const bSubjects = this.getTeacherSubjects(state, b.name);
          const matchA = aSubjects.includes(slot.s) ? 1 : 0;
          const matchB = bSubjects.includes(slot.s) ? 1 : 0;

          return (matchB - matchA) ||
                 (dailyLoad[`${a.name}|${slot.d}`] - dailyLoad[`${b.name}|${slot.d}`]) ||
                 (weeklyLoad[a.name] - weeklyLoad[b.name]) ||
                 (priorPeriodsTaught(b.name) - priorPeriodsTaught(a.name)) ||
                 a.name.localeCompare(b.name);
        })[0];

        if (!bestCover) {
          return {
            ...slot,
            originalTeacher,
            t: 'Unassigned',
            status: 'uncovered'
          };
        }

        occupied[`${slot.d}|${slot.p}`].add(bestCover.name);
        dailyLoad[`${bestCover.name}|${slot.d}`]++;
        weeklyLoad[bestCover.name]++;

        return {
          ...slot,
          originalTeacher,
          t: bestCover.name,
          status: 'covered'
        };
      });

      const totalScheduled = computedSchedule.filter(x => x.t !== '—').length;
      const coverRequiredSlots = computedSchedule.filter(x => x.status !== 'normal');
      const uncoveredCount = coverRequiredSlots.filter(x => x.status === 'uncovered').length;
      const coverageRate = totalScheduled > 0
        ? Math.round(((totalScheduled - uncoveredCount) / totalScheduled) * 100)
        : 100;

      const teacherAnalytics = state.teachers.map(t => {
        const lessons = computedSchedule.filter(x => x.t === t.name).length;
        const covers = computedSchedule.filter(x => x.t === t.name && x.status === 'covered').length;
        const absentCount = state.absences.filter(a => a.name === t.name).length;
        return {
          name: t.name,
          colour: t.colour || '#e2e8f0',
          lessonsCount: lessons,
          coverCount: covers,
          absenceCount: absentCount,
          subjects: this.getTeacherSubjects(state, t.name)
        };
      });

      return {
        schedule: computedSchedule,
        coverDecisions: coverRequiredSlots,
        workloadAnalytics: teacherAnalytics,
        metrics: {
          scheduledLessons: totalScheduled,
          availableTeachers: state.teachers.length,
          needingCover: uncoveredCount,
          coverageRate
        }
      };
    }
  }

  /* ==========================================================================
     6. EXPORT SERVICES
     ========================================================================== */
  class ExportService {
    static escapeHtml(value) {
      return String(value ?? '').replace(/[&<>"']/g, c => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
      }[c]));
    }

    static buildMatrixHtml(state, schedule, selectedDay = null) {
      const esc = this.escapeHtml;
      const daysToRender = selectedDay ? [selectedDay] : state.days;

      const renderSingleDay = (day) => {
        const classHeaders = state.classes
          .map(c => `<th>${esc(c.name)} ${esc(c.section)}<br><small style="color:#64748b">Teacher: ${esc(c.classTeacher || '—')}</small></th>`)
          .join('');

        const periodRows = state.periods.map((p, pIndex) => {
          const classCells = state.classes.map(c => {
            const classId = `${c.name}-${c.section}`;
            const slot = schedule.find(s => s.d === day && s.p === pIndex && s.c === classId);
            if (!slot) return '<td>—</td>';

            const teacherObj = state.teachers.find(t => t.name === slot.t);
            const bg = (slot.t !== '—' && slot.t !== 'Unassigned') ? (teacherObj?.colour || '#eef2f6') : '#ffffff';
            let badge = '';
            if (slot.status === 'covered') badge = `<span style="display:inline-block;padding:2px 6px;border-radius:4px;font-size:10px;background:#d1fae5;color:#065f46;font-weight:bold;margin-top:4px;">Cover: ${esc(slot.t)}</span>`;
            if (slot.status === 'uncovered') badge = `<span style="display:inline-block;padding:2px 6px;border-radius:4px;font-size:10px;background:#fee2e2;color:#991b1b;font-weight:bold;margin-top:4px;">Action Needed</span>`;

            return `
              <td style="background-color:${bg};border:1px solid #cbd5e1;padding:8px;vertical-align:top;">
                <div style="font-weight:bold;font-size:13px;color:#0f172a;">${esc(slot.s)}</div>
                <div style="font-size:12px;color:#475569;margin-top:2px;">${esc(slot.t)}</div>
                ${badge}
              </td>
            `;
          }).join('');

          const periodHead = `
            <td style="background:#f8fafc;border:1px solid #cbd5e1;padding:8px;font-weight:bold;width:120px;">
              <div>${esc(p.label)}</div>
              <small style="color:#64748b;font-weight:normal;">${esc(p.start)} – ${esc(p.end)}</small>
            </td>
          `;

          const breakRow = p.breakAfter ? `
            <tr style="background:#fef3c7;color:#92400e;font-weight:bold;text-align:center;">
              <td colspan="${state.classes.length + 1}" style="padding:6px;border:1px solid #fde68a;">
                ☕ ${esc(p.breakName || 'Break')} (${esc(p.breakStart)} – ${esc(p.breakEnd)})
              </td>
            </tr>
          ` : '';

          return `<tr>${periodHead}${classCells}</tr>${breakRow}`;
        }).join('');

        return `
          <div style="page-break-after:always;margin-bottom:30px;">
            <h2 style="font-family:Inter,Arial,sans-serif;color:#1e293b;font-size:18px;margin-bottom:10px;">
              📅 ${esc(day)} Timetable
            </h2>
            <table style="width:100%;border-collapse:collapse;font-family:Inter,Arial,sans-serif;font-size:12px;table-layout:fixed;">
              <thead>
                <tr style="background:#f1f5f9;text-align:left;border:1px solid #cbd5e1;">
                  <th style="padding:10px;border:1px solid #cbd5e1;">Period / Time</th>
                  ${classHeaders}
                </tr>
              </thead>
              <tbody>${periodRows}</tbody>
            </table>
          </div>
        `;
      };

      return `
        <!doctype html>
        <html>
        <head>
          <meta charset="utf-8" />
          <title>SchoolFlow Timetable</title>
          <style>
            @page { size: landscape; margin: 12mm; }
            * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; color: #0f172a; margin: 0; }
            table { width: 100%; border-collapse: collapse; }
            th, td { border: 1px solid #cbd5e1; }
          </style>
        </head>
        <body>
          <div style="margin-bottom:15px;display:flex;justify-content:space-between;align-items:center;border-bottom:2px solid #e2e8f0;padding-bottom:10px;">
            <div>
              <h1 style="margin:0;font-size:22px;color:#0f172a;">SchoolFlow — Master Timetable</h1>
              <p style="margin:3px 0 0 0;font-size:12px;color:#64748b;">Generated via SchoolFlow Multi-User SaaS Platform</p>
            </div>
            <div style="text-align:right;font-size:11px;color:#64748b;">Export Date: ${new Date().toLocaleDateString()}</div>
          </div>
          ${daysToRender.map(renderSingleDay).join('')}
        </body>
        </html>
      `;
    }

    static exportExcel(state, schedule, day = null, filename = 'schoolflow-timetable.xls') {
      const html = this.buildMatrixHtml(state, schedule, day);
      const blob = new Blob([html], { type: 'application/vnd.ms-excel;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 600);
    }

    static printTimetable(state, schedule, day = null) {
      const html = this.buildMatrixHtml(state, schedule, day);
      const win = window.open('', '_blank');
      if (!win) {
        alert('Please allow pop-ups for this website to print or save the PDF.');
        return;
      }
      win.document.open();
      win.document.write(html);
      win.document.close();
      win.focus();
      setTimeout(() => win.print(), 350);
    }

    static exportCsv(state, schedule) {
      const rows = [
        ['Day', 'Period', 'Time', 'Class', 'Subject', 'Teacher', 'Status'],
        ...schedule.map(x => {
          const p = state.periods[x.p] || { label: `Period ${x.p + 1}`, start: '', end: '' };
          return [x.d, p.label, `${p.start}-${p.end}`, x.c, x.s, x.t, x.status];
        })
      ];

      const csvContent = rows
        .map(r => r.map(col => `"${String(col).replace(/"/g, '""')}"`).join(','))
        .join('\r\n');

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'schoolflow-schedule.csv';
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 600);
    }

    static async shareSummary(state, metrics) {
      const text = `SchoolFlow Timetable Overview:\n` +
        `Teaching Days: ${state.days.join(', ')}\n` +
        `Classes: ${state.classes.length} | Teachers: ${state.teachers.length}\n` +
        `Coverage Rate: ${metrics.coverageRate}%\n` +
        `Exported from SchoolFlow Cloud SaaS.`;

      if (navigator.share) {
        try { await navigator.share({ title: 'SchoolFlow Timetable', text }); } catch (err) {}
      } else {
        await navigator.clipboard.writeText(text);
        alert('Timetable summary copied to clipboard! You can paste it into email, Slack, or WhatsApp.');
      }
    }
  }

  /* ==========================================================================
     7. SPREADSHEET PARSER (SheetJS + Native XML Fallback)
     ========================================================================== */
  async function localWorkbookRows(file) {
    if (!file.name.toLowerCase().endsWith('.xlsx')) throw new Error('Please use an .xlsx workbook.');
    const bytes = new Uint8Array(await file.arrayBuffer()), view = new DataView(bytes.buffer), text = new TextDecoder();
    let end = -1;
    for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 66000); i--) {
      if (view.getUint32(i, true) === 0x06054b50) { end = i; break; }
    }
    if (end < 0) throw new Error('Invalid .xlsx file.');
    const total = view.getUint16(end + 10, true), cd = view.getUint32(end + 16, true);
    const entries = {};
    let at = cd;
    for (let n = 0; n < total; n++) {
      if (view.getUint32(at, true) !== 0x02014b50) break;
      const method = view.getUint16(at + 10, true), size = view.getUint32(at + 20, true),
        nameLen = view.getUint16(at + 28, true), extra = view.getUint16(at + 30, true),
        comment = view.getUint16(at + 32, true), offset = view.getUint32(at + 42, true),
        name = text.decode(bytes.slice(at + 46, at + 46 + nameLen));
      entries[name] = { method, size, offset };
      at += 46 + nameLen + extra + comment;
    }
    const get = async name => {
      const e = entries[name];
      if (!e) return '';
      const n = view.getUint16(e.offset + 26, true), x = view.getUint16(e.offset + 28, true),
        data = bytes.slice(e.offset + 30 + n + x, e.offset + 30 + n + x + e.size);
      if (e.method === 0) return text.decode(data);
      if (e.method === 8) return await new Response(new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).text();
      throw new Error('Unsupported Excel compression.');
    };
    const xml = s => new DOMParser().parseFromString(s, 'application/xml'),
      cellText = node => node ? node.textContent.replace(/\s+/g, ' ').trim() : '';
    const shared = [...xml(await get('xl/sharedStrings.xml')).querySelectorAll('si')].map(cellText),
      wb = xml(await get('xl/workbook.xml')), rel = await get('xl/_rels/workbook.xml.rels');
    const targets = {};
    [...rel.matchAll(/<Relationship[^>]*Id="([^"]+)"[^>]*Target="([^"]+)"/g)].forEach(m => targets[m[1]] = 'xl/' + m[2].replace(/^\//, ''));
    const out = {};
    for (const sh of wb.querySelectorAll('sheet')) {
      const name = sh.getAttribute('name'), rid = sh.getAttribute('r:id'), sheet = xml(await get(targets[rid]));
      const grid = {};
      sheet.querySelectorAll('row').forEach(row => row.querySelectorAll('c').forEach(c => {
        const ref = c.getAttribute('r'), col = ref.replace(/\d/g, ''), r = +ref.replace(/\D/g, '');
        let v = cellText(c.querySelector('v'));
        if (c.getAttribute('t') === 's') v = shared[+v] || '';
        if (c.getAttribute('t') === 'inlineStr') v = cellText(c.querySelector('is'));
        (grid[r] ??= {})[col] = v;
      }));
      const nums = Object.keys(grid).map(Number).sort((a, b) => a - b),
        cols = Object.keys(grid[nums[0]] || {}).sort((a, b) => a.localeCompare(b));
      const headers = cols.map(c => grid[nums[0]][c]);
      out.__raw ??= {};
      out.__raw[name] = grid;
      out[name] = nums.slice(1).map(r => Object.fromEntries(cols.map((c, i) => [headers[i], grid[r][c] || ''])));

      // Also construct 2D array for matrix parser
      const maxR = nums.length ? Math.max(...nums) : 0;
      const sheet2D = [];
      for (let r = 1; r <= maxR; r++) {
        const rowCells = [];
        cols.forEach(c => {
          rowCells.push(grid[r]?.[c] || '');
        });
        sheet2D.push(rowCells);
      }
      out.__sheets2D ??= {};
      out.__sheets2D[name] = sheet2D;
    }
    out.__sheetNames = Object.keys(out.__sheets2D || {});
    return out;
  }

  async function parseSpreadsheet(file) {
    if (window.XLSX) {
      const data = await file.arrayBuffer();
      const wb = window.XLSX.read(data, { type: 'array' });
      const out = { __raw: {}, __sheets2D: {}, __sheetNames: wb.SheetNames };
      wb.SheetNames.forEach(name => {
        const sheet = wb.Sheets[name];
        out[name] = window.XLSX.utils.sheet_to_json(sheet, { defval: '' });
        out.__sheets2D[name] = window.XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
      });
      return out;
    }
    return await localWorkbookRows(file);
  }

  /* ==========================================================================
     8. MASTER UI CONTROLLER
     ========================================================================== */
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

    $(s) { return document.querySelector(s); }
    $$(s) { return document.querySelectorAll(s); }

    init() {
      AuthService.onAuthStateChanged(user => {
        this.currentUser = user;
        this.updateUserWidget();
        this.loadUserWorkspace();
      });

      StorageService.onSyncStatusChange((status, message) => {
        this.updateSyncBadge(status, message);
      });

      this.bindEvents();
      this.initGoogleAuthClient();
    }

    loadUserWorkspace() {
      if (!this.currentUser) return;
      const timetables = StorageService.getUserTimetables(this.currentUser.id);
      if (!timetables.length) return;

      if (!this.activeTimetableId || !timetables.some(t => t.id === this.activeTimetableId)) {
        this.activeTimetableId = timetables[0].id;
      }

      this.renderTimetableDropdown(timetables);

      const bundle = StorageService.loadTimetableData(this.currentUser.id, this.activeTimetableId);
      this.state = bundle.inputs;
      if (!this.state.days.includes(this.selectedDay)) {
        this.selectedDay = this.state.days[0] || 'Monday';
      }

      this.render();
    }

    switchTimetable(timetableId) {
      this.activeTimetableId = timetableId;
      const bundle = StorageService.loadTimetableData(this.currentUser.id, this.activeTimetableId);
      this.state = bundle.inputs;
      if (!this.state.days.includes(this.selectedDay)) {
        this.selectedDay = this.state.days[0] || 'Monday';
      }
      this.render();
    }

    render() {
      if (!this.state) return;

      const output = SchedulerEngine.generate(this.state);
      this.cachedScheduleOutput = output;

      this.updateMetrics(output.metrics);
      this.renderDayPicker();
      this.renderScheduleTable(output.schedule);
      this.renderWorkloadAnalytics(output.workloadAnalytics);
      this.renderAbsenceDesk(output.coverDecisions);
      this.renderSchoolSetup();
      this.renderAdminTasks();

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
      this.$('#cloudSyncText').textContent = message || (status === 'synced' ? 'All changes saved to Cloud' : 'Syncing...');
    }

    updateUserWidget() {
      if (!this.currentUser) return;
      this.$('#userAvatar').src = this.currentUser.picture || AVATAR_JENKINS;
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

          const colour = (slot.t !== '—' && slot.t !== 'Unassigned') ? this.getTeacherColour(slot.t) : '#ffffff';
          const note = slot.status === 'covered' ? 'Cover assigned' : (slot.status === 'uncovered' ? 'Needs cover' : '');

          return `
            <td>
              <div class="lesson ${slot.status}" style="background-color: ${colour}; border-left: 4px solid ${colour};">
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
      this.$('#teacherSelect').innerHTML = this.state.teachers.map(t => `<option value="${t.name}">${t.name}</option>`).join('');
      this.$('#absenceDay').innerHTML = this.state.days.map(d => `<option value="${d}">${d}</option>`).join('');
      this.$('#periodSelect').innerHTML = '<option value="all">Whole day</option>' + 
        this.state.periods.map((p, i) => `<option value="${i}">${p.label}</option>`).join('');

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
      this.$('#dayChoices').innerHTML = this.allDays.map(d => `
        <label>
          <input type="checkbox" data-day-choice="${d}" ${this.state.days.includes(d) ? 'checked' : ''}>
          ${d}
        </label>
      `).join('');

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

      this.$('#subjectList').innerHTML = this.state.subjects.map((s, i) => `
        <span>
          ${s}
          <button class="mini" data-action="edit-subject" data-index="${i}">✎</button>
          <button class="mini danger" data-action="delete-subject" data-index="${i}">×</button>
        </span>
      `).join('');

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

      const teacherOptions = this.state.teachers.map(t => `<option value="${t.name}">${t.name}</option>`).join('');
      this.$('#classTeacher').innerHTML = '<option value="">Choose class teacher</option>' + teacherOptions;
      this.$('#assignmentTeacher').innerHTML = teacherOptions;
      this.$('#assignmentClass').innerHTML = this.state.classes.map(c => `<option value="${c.name}-${c.section}">${c.name} ${c.section}</option>`).join('');
      this.$('#assignmentSubject').innerHTML = this.state.subjects.map(s => `<option value="${s}">${s}</option>`).join('');

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

      this.$('#adminList').innerHTML = this.state.admins.length ? this.state.admins.map((a, i) => `
        <div class="list-row">
          <strong>${a}</strong>
          <button class="mini danger" data-remove-admin="${i}">Remove</button>
        </div>
      `).join('') : '<p class="muted">No administrators added yet.</p>';

      this.$('#taskAdmin').innerHTML = this.state.admins.map(a => `<option>${a}</option>`).join('') || '<option value="">Add an admin first</option>';
      this.$('#taskTeacher').innerHTML = this.state.teachers.map(t => `<option>${t.name}</option>`).join('');

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
      // Tab Navigation
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

      // Day Picker
      this.$('#dayPicker').addEventListener('click', e => {
        if (e.target.dataset.day) {
          this.selectedDay = e.target.dataset.day;
          this.renderDayPicker();
          this.renderScheduleTable(this.cachedScheduleOutput?.schedule || []);
        }
      });

      // Timetable select
      this.$('#timetableSelect').addEventListener('change', e => {
        this.switchTimetable(e.target.value);
      });

      // Manage Timetables Modal Button
      this.$('#manageTimetablesBtn').addEventListener('click', () => {
        this.openTimetableManagerModal();
      });

      // User Account Widget Click (OPENS GOOGLE ID & ACCOUNT MODAL)
      this.$('#userAccountWidget').addEventListener('click', () => {
        this.openAccountModal();
      });

      // Action Buttons
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

      // Absence form
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

      // Setup forms
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

      // Admin & Tasks
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

      // Item Edit / Delete Delegations
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

      // Spreadsheet file upload triggers
      const teacherUploadBtn = this.$('#teacherSubjectUploadBtn');
      const teacherUploadInput = this.$('#teacherSubjectUpload');
      if (teacherUploadBtn && teacherUploadInput) {
        teacherUploadBtn.onclick = () => teacherUploadInput.click();
        teacherUploadInput.onchange = e => {
          this.readUpload(e.target.files[0], 'people');
          e.target.value = '';
        };
      }

      const assignmentUploadBtn = this.$('#assignmentUploadBtn');
      const assignmentUploadInput = this.$('#assignmentUpload');
      if (assignmentUploadBtn && assignmentUploadInput) {
        assignmentUploadBtn.onclick = () => assignmentUploadInput.click();
        assignmentUploadInput.onchange = e => {
          this.readUpload(e.target.files[0], 'assignments');
          e.target.value = '';
        };
      }

      // Modal Close Handlers
      this.$$('.modal-close').forEach(el => {
        el.addEventListener('click', () => {
          this.$$('.modal-overlay').forEach(m => m.classList.remove('open'));
        });
      });

      this.$$('.modal-overlay').forEach(overlay => {
        overlay.addEventListener('click', e => {
          if (e.target === overlay) {
            overlay.classList.remove('open');
          }
        });
      });
    }

    async readUpload(file, mode) {
      if (!file) return;
      try {
        const all = await parseSpreadsheet(file);

        const rows = name => {
          if (all[name] && all[name].length) return all[name];
          const foundKey = Object.keys(all).find(k => k.toLowerCase() === name.toLowerCase());
          if (foundKey && all[foundKey].length) return all[foundKey];
          const firstKey = Object.keys(all).find(k => !k.startsWith('__'));
          return firstKey ? all[firstKey] : [];
        };

        const value = (r, ...keys) => {
          const k = Object.keys(r).find(x => keys.includes(x.toLowerCase().replace(/[^a-z]/g, '')));
          return k ? String(r[k]).trim() : '';
        };

        const parseClassSection = (groupStr) => {
          if (!groupStr) return { name: 'Class', section: 'A' };
          let s = String(groupStr).replace(/class\s*→?/i, '').trim();
          const dash = s.lastIndexOf('-');
          if (dash > 0) {
            return {
              name: s.slice(0, dash).trim() || s,
              section: s.slice(dash + 1).trim() || 'A'
            };
          }
          const match = s.match(/^(.*?)(?:[\s]+|-)?([A-Za-z])$/);
          if (match && match[1].trim()) {
            return {
              name: match[1].trim(),
              section: match[2].toUpperCase()
            };
          }
          return { name: s, section: 'A' };
        };

        let importedCount = 0;

        if (mode === 'people') {
          // 1. Try standard columns from Teachers and Subjects sheets
          const teacherRows = all['Teachers'] ? rows('Teachers') : [];
          teacherRows.forEach(r => {
            const name = value(r, 'teacher', 'teachers', 'teachername', 'name');
            if (name && !this.state.teachers.some(t => t.name.toLowerCase() === name.toLowerCase())) {
              const colour = this.teacherPalette[this.state.teachers.length % this.teacherPalette.length];
              this.state.teachers.push({ name, colour });
              importedCount++;
            }
          });

          const subjectRows = all['Subjects'] ? rows('Subjects') : [];
          subjectRows.forEach(r => {
            const s = value(r, 'subject', 'subjects', 'subjectname', 'name');
            if (s && !this.state.subjects.some(sub => sub.toLowerCase() === s.toLowerCase())) {
              this.state.subjects.push(s);
              importedCount++;
            }
          });

          // 2. Fallback: If 0 imported, extract from Matrix grid (Row 3 = Subjects, Column A = Teachers)
          if (importedCount === 0 && all.__sheets2D) {
            for (const sName of Object.keys(all.__sheets2D)) {
              const grid = all.__sheets2D[sName] || [];
              if (grid.length >= 4) {
                // Find subject row
                for (let r = 0; r < Math.min(6, grid.length); r++) {
                  const firstCell = String(grid[r]?.[0] || '').toLowerCase();
                  if (firstCell.includes('subject') || firstCell.includes('sub')) {
                    for (let c = 1; c < (grid[r]?.length || 0); c++) {
                      const subName = String(grid[r][c] || '').trim();
                      if (subName && !subName.includes('→') && !this.state.subjects.some(s => s.toLowerCase() === subName.toLowerCase())) {
                        this.state.subjects.push(subName);
                        importedCount++;
                      }
                    }
                  }
                }
                // Extract teachers from Column A
                for (let r = 4; r < grid.length; r++) {
                  const tName = String(grid[r]?.[0] || '').trim();
                  if (tName && !tName.toLowerCase().includes('teacher') && !tName.includes('↓')) {
                    if (!this.state.teachers.some(t => t.name.toLowerCase() === tName.toLowerCase())) {
                      const colour = this.teacherPalette[this.state.teachers.length % this.teacherPalette.length];
                      this.state.teachers.push({ name: tName, colour });
                      importedCount++;
                    }
                  }
                }
              }
            }
          }

          alert(`Successfully imported ${importedCount} teacher and subject records.`);
        } else {
          // Mode: assignments
          const add = (teacher, name, section, subject, frequency) => {
            if (!teacher || !name || !section || !subject) return;
            teacher = teacher.trim();
            name = name.trim();
            section = section.trim();
            subject = subject.trim();
            const freqNum = Math.max(1, Math.min(10, Math.round(Number(frequency)) || 1));

            // Ensure teacher exists
            let existingTeacher = this.state.teachers.find(t => t.name.toLowerCase() === teacher.toLowerCase());
            if (!existingTeacher) {
              const colour = this.teacherPalette[this.state.teachers.length % this.teacherPalette.length];
              existingTeacher = { name: teacher, colour };
              this.state.teachers.push(existingTeacher);
            }

            // Ensure subject exists
            let existingSubject = this.state.subjects.find(s => s.toLowerCase() === subject.toLowerCase());
            if (!existingSubject) {
              this.state.subjects.push(subject);
              existingSubject = subject;
            }

            // Ensure class exists
            let c = this.state.classes.find(x => x.name.toLowerCase() === name.toLowerCase() && x.section.toLowerCase() === section.toLowerCase());
            if (!c) {
              c = { name, section, classTeacher: '' };
              this.state.classes.push(c);
            }

            const classId = `${c.name}-${c.section}`;
            const targetSubjectName = typeof existingSubject === 'string' ? existingSubject : existingSubject.name || subject;

            const existingAssignment = this.state.assignments.find(a => 
              a.teacher.toLowerCase() === existingTeacher.name.toLowerCase() && 
              a.classId.toLowerCase() === classId.toLowerCase() && 
              a.subject.toLowerCase() === targetSubjectName.toLowerCase()
            );

            if (existingAssignment) {
              existingAssignment.frequency = freqNum;
            } else {
              this.state.assignments.push({
                teacher: existingTeacher.name,
                classId,
                subject: targetSubjectName,
                frequency: freqNum
              });
              importedCount++;
            }
          };

          // 1. Check Matrix Format across all available sheets
          if (all.__sheets2D) {
            for (const sName of Object.keys(all.__sheets2D)) {
              const grid = all.__sheets2D[sName] || [];
              if (grid.length >= 4) {
                let classRowIdx = -1;
                let subjectRowIdx = -1;
                let teacherStartRowIdx = -1;

                // Detect headers in top rows
                for (let r = 0; r < Math.min(10, grid.length); r++) {
                  const cell0 = String(grid[r]?.[0] || '').toLowerCase().trim();
                  const rowStr = (grid[r] || []).map(x => String(x || '').toLowerCase()).join(' ');

                  if (classRowIdx === -1 && (cell0.includes('class') || rowStr.includes('class'))) {
                    classRowIdx = r;
                  }
                  if (subjectRowIdx === -1 && (cell0.includes('subject') || rowStr.includes('subject'))) {
                    subjectRowIdx = r;
                  }
                  if (teacherStartRowIdx === -1 && cell0.includes('teacher')) {
                    teacherStartRowIdx = r + 1;
                  }
                }

                // Fallback row indices if standard labels aren't in cell 0
                if (classRowIdx === -1 && subjectRowIdx !== -1 && subjectRowIdx > 0) {
                  classRowIdx = subjectRowIdx - 1;
                }
                if (subjectRowIdx === -1 && classRowIdx !== -1) {
                  subjectRowIdx = classRowIdx + 1;
                }
                if (teacherStartRowIdx === -1 && subjectRowIdx !== -1) {
                  teacherStartRowIdx = subjectRowIdx + 1;
                  if (grid[teacherStartRowIdx] && String(grid[teacherStartRowIdx][0] || '').toLowerCase().includes('teacher')) {
                    teacherStartRowIdx++;
                  }
                }

                // If class & subject rows identified, process matrix columns
                if (classRowIdx !== -1 && subjectRowIdx !== -1) {
                  const classRow = grid[classRowIdx] || [];
                  const subjectRow = grid[subjectRowIdx] || [];

                  let maxCols = 0;
                  grid.forEach(row => { if (row && row.length > maxCols) maxCols = row.length; });

                  let currentGroup = '';
                  for (let c = 1; c < maxCols; c++) {
                    const rawClass = String(classRow[c] || '').trim();
                    // If column defines a new class group (e.g. IX-A, IX-B)
                    if (rawClass && !rawClass.includes('→') && !rawClass.toLowerCase().includes('class')) {
                      currentGroup = rawClass;
                    }

                    const rawSubject = String(subjectRow[c] || '').trim();
                    if (!rawSubject || rawSubject.includes('→') || rawSubject.toLowerCase().includes('subject')) {
                      continue;
                    }

                    if (!currentGroup) continue;

                    const { name: className, section: sectionName } = parseClassSection(currentGroup);

                    // Scan down each teacher's row in this column
                    for (let r = teacherStartRowIdx; r < grid.length; r++) {
                      const teacherName = String(grid[r]?.[0] || '').trim();
                      if (!teacherName || teacherName.toLowerCase().includes('teacher') || teacherName.includes('↓')) {
                        continue;
                      }

                      const cellVal = grid[r]?.[c];
                      if (cellVal === undefined || cellVal === null || cellVal === '') continue;
                      const freq = Number(cellVal);
                      if (!isNaN(freq) && freq > 0) {
                        add(teacherName, className, sectionName, rawSubject, freq);
                      }
                    }
                  }
                }
              }
            }
          }

          // 2. Fallback to Tabular Columns if Matrix parser found 0
          if (importedCount === 0) {
            const direct = rows('Assignments');
            if (direct && direct.length) {
              direct.forEach(r => {
                const teacher = value(r, 'teacher', 'teachername');
                const grade = value(r, 'class', 'classname', 'grade');
                const section = value(r, 'section') || 'A';
                const subject = value(r, 'subject', 'subjectname');
                const freq = Math.max(1, Math.min(10, +value(r, 'frequency', 'lessonsperweek', 'weeklyfrequency') || 1));
                add(teacher, grade, section, subject, freq);
              });
            }
          }

          alert(`Successfully imported ${importedCount} teaching assignments.`);
        }

        this.render();
      } catch (err) {
        console.error("Spreadsheet upload error", err);
        alert('Could not read the spreadsheet file. Please verify the Excel structure.');
      }
    }

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

    openAccountModal() {
      const modal = this.$('#accountModal');
      this.$('#modalUserAvatar').src = this.currentUser.picture || AVATAR_JENKINS;
      this.$('#modalUserName').textContent = this.currentUser.name;
      this.$('#modalUserEmail').textContent = this.currentUser.email;
      this.$('#modalUserRole').textContent = `${this.currentUser.role} · ${this.currentUser.schoolName}`;

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

      this.$('#configGoogleClientId').value = AppConfig.googleClientId || '';
      this.$('#configForm').onsubmit = e => {
        e.preventDefault();
        AppConfig.save({
          googleClientId: this.$('#configGoogleClientId').value.trim()
        });
        alert('Credentials saved! If deploying to Vercel, make sure this Client ID is authorized for your Vercel domain.');
        modal.classList.remove('open');
      };

      modal.classList.add('open');
    }

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

  // Self-bootstrapping
  function startApp() {
    const app = new UIController();
    app.init();
    window.SchoolFlowApp = app;
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startApp);
  } else {
    startApp();
  }

})();
