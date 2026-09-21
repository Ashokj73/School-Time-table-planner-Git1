/**
 * SchoolFlow SaaS - Export & Report Generation Hub
 * 
 * Generates:
 * - Day-wise Excel (.xls)
 * - Weekly Master Matrix Excel (.xls)
 * - Printable Landscape PDF Views
 * - Structured CSV data
 */

export class ExportService {
  static escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, c => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    }[c]));
  }

  static getTeacherColour(teachers, name) {
    const t = teachers.find(x => x.name === name);
    return t?.colour || '#eef2f6';
  }

  // Generate Matrix Table HTML for Excel and Print
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

          const bg = slot.t !== '—' && slot.t !== 'Unassigned' ? this.getTeacherColour(state.teachers, slot.t) : '#ffffff';
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
            <tbody>
              ${periodRows}
            </tbody>
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
          <div style="text-align:right;font-size:11px;color:#64748b;">
            Export Date: ${new Date().toLocaleDateString()}
          </div>
        </div>
        ${daysToRender.map(renderSingleDay).join('')}
      </body>
      </html>
    `;
  }

  // Export to Excel (.xls HTML table blob format, supported by MS Excel & Google Sheets)
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

  // Trigger Print / Save as PDF modal
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

  // Export CSV
  static exportCsv(state, schedule) {
    const rows = [
      ['Day', 'Period', 'Time', 'Class', 'Subject', 'Teacher', 'Status'],
      ...schedule.map(x => {
        const p = state.periods[x.p] || { label: `Period ${x.p + 1}`, start: '', end: '' };
        return [
          x.d,
          p.label,
          `${p.start}-${p.end}`,
          x.c,
          x.s,
          x.t,
          x.status
        ];
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

  // Share summary
  static async shareSummary(state, metrics) {
    const text = `SchoolFlow Timetable Overview:\n` +
      `Teaching Days: ${state.days.join(', ')}\n` +
      `Classes: ${state.classes.length} | Teachers: ${state.teachers.length}\n` +
      `Coverage Rate: ${metrics.coverageRate}%\n` +
      `Exported from SchoolFlow Cloud SaaS.`;

    if (navigator.share) {
      try {
        await navigator.share({ title: 'SchoolFlow Timetable', text });
      } catch (err) {
        // user dismissed share dialog
      }
    } else {
      await navigator.clipboard.writeText(text);
      alert('Timetable summary copied to clipboard! You can paste it into email, Slack, or WhatsApp.');
    }
  }
}
