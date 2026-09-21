/**
 * SchoolFlow SaaS - Timetable Scheduling & Smart Cover Engine
 * 
 * Capabilities:
 * - Algorithmic clash-free weekly timetable distribution
 * - Intelligent absence coverage solver:
 *   1. Subject expertise match prioritized
 *   2. Least daily teaching load prioritized
 *   3. Least weekly teaching load prioritized
 *   4. Recovery from prior period duties
 * - Teacher workload metrics & coverage analytics
 */

export class SchedulerEngine {
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

  /**
   * Generates the weekly timetable and computes coverage assignments
   * @param {Object} state - current input configuration
   * @returns {Object} { schedule, coverDecisions, workloadAnalytics, metrics }
   */
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

    // 1. Initial Schedule Distribution
    for (const day of state.days) {
      for (let pIndex = 0; pIndex < state.periods.length; pIndex++) {
        const usedTeachersInSlot = new Set();

        for (const cls of state.classes) {
          const classKey = this.getClassId(cls);

          // Find candidate assignments for this class that have remaining quota and teacher isn't double-booked
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

    // 2. Teacher Workload Baseline
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

    // 3. Busy Teachers Tracker
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

    // 4. Absence & Cover Resolution
    const computedSchedule = baseSchedule.map(slot => {
      if (slot.t === '—' || !this.isAbsent(state, slot.t, slot.d, slot.p)) {
        return slot;
      }

      const originalTeacher = slot.t;
      const priorPeriodsTaught = name => state.absences.filter(a => 
        a.name === name && 
        a.day === slot.d && 
        a.period !== 'all' && 
        (+a.period) < slot.p
      ).length;

      // Find best available cover candidate
      const candidateTeachers = state.teachers.filter(teacher => 
        !this.isAbsent(state, teacher.name, slot.d, slot.p) &&
        !occupied[`${slot.d}|${slot.p}`].has(teacher.name)
      );

      const bestCover = candidateTeachers.sort((a, b) => {
        const aSubjects = this.getTeacherSubjects(state, a.name);
        const bSubjects = this.getTeacherSubjects(state, b.name);
        const matchA = aSubjects.includes(slot.s) ? 1 : 0;
        const matchB = bSubjects.includes(slot.s) ? 1 : 0;

        // Sorting hierarchy: Match subject -> Lowest daily load -> Lowest weekly load -> Prior recovery -> Name
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

    // 5. Workload Analytics & Summary Metrics
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
