import { Router, Request, Response } from 'express';
import { authenticate } from '../middleware/authenticate';
import { tenantIsolation } from '../middleware/tenantIsolation';
import { authorize } from '../middleware/authorize';
import { generateAttendanceReport } from '../services/reportService';
import { generateCsvReport, generatePdfReport } from '../services/reportExportService';

const router = Router();

// GET /attendance/export - Export attendance report as PDF or CSV (Admin only)
// NOTE: This route MUST be registered BEFORE /attendance to avoid route conflicts
router.get(
  '/attendance/export',
  authenticate,
  tenantIsolation,
  authorize('Admin'),
  async (req: Request, res: Response): Promise<void> => {
    const { start_date, end_date, group_id, person_id, format } = req.query;

    // Validate format parameter
    if (!format) {
      res.status(400).json({ error: 'format is required (pdf or csv)' });
      return;
    }

    const formatStr = (format as string).toLowerCase();
    if (formatStr !== 'pdf' && formatStr !== 'csv') {
      res.status(400).json({ error: 'format must be either pdf or csv' });
      return;
    }

    // Validate required params
    if (!start_date) {
      res.status(400).json({ error: 'start_date is required' });
      return;
    }

    if (!end_date) {
      res.status(400).json({ error: 'end_date is required' });
      return;
    }

    // Validate date format (YYYY-MM-DD)
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(start_date as string)) {
      res.status(400).json({ error: 'start_date must be in YYYY-MM-DD format' });
      return;
    }

    if (!dateRegex.test(end_date as string)) {
      res.status(400).json({ error: 'end_date must be in YYYY-MM-DD format' });
      return;
    }

    try {
      const report = await generateAttendanceReport({
        organizationId: req.organizationId!,
        startDate: start_date as string,
        endDate: end_date as string,
        groupId: group_id as string | undefined,
        personId: person_id as string | undefined,
      });

      if (formatStr === 'csv') {
        const csv = generateCsvReport(report);
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename="attendance-report.csv"');
        res.status(200).send(csv);
      } else {
        const pdfBuffer = await generatePdfReport(report);
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'attachment; filename="attendance-report.pdf"');
        res.status(200).send(pdfBuffer);
      }
    } catch (error) {
      throw error;
    }
  }
);

// GET /attendance - Generate attendance report (Admin only)
router.get(
  '/attendance',
  authenticate,
  tenantIsolation,
  authorize('Admin'),
  async (req: Request, res: Response): Promise<void> => {
    const { start_date, end_date, group_id, person_id } = req.query;

    // Validate required params
    if (!start_date) {
      res.status(400).json({ error: 'start_date is required' });
      return;
    }

    if (!end_date) {
      res.status(400).json({ error: 'end_date is required' });
      return;
    }

    // Validate date format (YYYY-MM-DD)
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(start_date as string)) {
      res.status(400).json({ error: 'start_date must be in YYYY-MM-DD format' });
      return;
    }

    if (!dateRegex.test(end_date as string)) {
      res.status(400).json({ error: 'end_date must be in YYYY-MM-DD format' });
      return;
    }

    try {
      const report = await generateAttendanceReport({
        organizationId: req.organizationId!,
        startDate: start_date as string,
        endDate: end_date as string,
        groupId: group_id as string | undefined,
        personId: person_id as string | undefined,
      });

      res.status(200).json({ report });
    } catch (error) {
      throw error;
    }
  }
);

export default router;
