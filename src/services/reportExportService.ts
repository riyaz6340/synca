import PDFDocument from 'pdfkit';
import { ReportOutput } from './reportService';

/**
 * Generate a CSV string from the attendance report data.
 * Columns: Person Name, Days Present, Days Absent, Days Late, Days On Leave, Attendance %
 */
export function generateCsvReport(report: ReportOutput): string {
  const header = 'Person Name,Days Present,Days Absent,Days Late,Days On Leave,Attendance %';
  const rows = report.persons.map((p) => {
    // Escape commas and quotes in person name
    const name = p.personName.includes(',') || p.personName.includes('"')
      ? `"${p.personName.replace(/"/g, '""')}"`
      : p.personName;
    return `${name},${p.daysPresent},${p.daysAbsent},${p.daysLate},${p.daysOnLeave},${p.attendancePercentage}`;
  });

  return [header, ...rows].join('\n');
}

/**
 * Generate a PDF buffer from the attendance report data.
 * Includes a title, summary section, and a table of per-person data.
 */
export function generatePdfReport(report: ReportOutput): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 50 });
      const chunks: Buffer[] = [];

      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', (err: Error) => reject(err));

      // Title
      doc.fontSize(18).text('Attendance Report', { align: 'center' });
      doc.moveDown();

      // Summary Section
      doc.fontSize(12).text('Summary', { underline: true });
      doc.moveDown(0.5);
      doc.fontSize(10);
      doc.text(`Total Days: ${report.totalDays}`);
      doc.text(`Days Present: ${report.summary.daysPresent}`);
      doc.text(`Days Absent: ${report.summary.daysAbsent}`);
      doc.text(`Days Late: ${report.summary.daysLate}`);
      doc.text(`Days On Leave: ${report.summary.daysOnLeave}`);
      doc.text(`Overall Attendance: ${report.summary.attendancePercentage}%`);
      doc.moveDown();

      // Table Header
      doc.fontSize(12).text('Per-Person Breakdown', { underline: true });
      doc.moveDown(0.5);

      // Table column headers
      const tableTop = doc.y;
      const col1 = 50;
      const col2 = 200;
      const col3 = 260;
      const col4 = 320;
      const col5 = 380;
      const col6 = 450;

      doc.fontSize(9).font('Helvetica-Bold');
      doc.text('Person Name', col1, tableTop, { width: 140 });
      doc.text('Present', col2, tableTop, { width: 50 });
      doc.text('Absent', col3, tableTop, { width: 50 });
      doc.text('Late', col4, tableTop, { width: 50 });
      doc.text('On Leave', col5, tableTop, { width: 60 });
      doc.text('Att. %', col6, tableTop, { width: 50 });

      doc.font('Helvetica').fontSize(9);
      let y = tableTop + 20;

      for (const person of report.persons) {
        // Add a new page if needed
        if (y > 700) {
          doc.addPage();
          y = 50;
        }

        doc.text(person.personName, col1, y, { width: 140 });
        doc.text(String(person.daysPresent), col2, y, { width: 50 });
        doc.text(String(person.daysAbsent), col3, y, { width: 50 });
        doc.text(String(person.daysLate), col4, y, { width: 50 });
        doc.text(String(person.daysOnLeave), col5, y, { width: 60 });
        doc.text(String(person.attendancePercentage), col6, y, { width: 50 });

        y += 18;
      }

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}
