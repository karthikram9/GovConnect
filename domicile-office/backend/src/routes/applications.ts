import { Router, Request, Response } from 'express';
import {
  getAllApplications,
  getApplication,
  createApplication,
  reviewApplication
} from '../services/applicationService.js';
import { authenticateToken } from '../middleware/authenticateToken.js';
import { requireRole, requireDepartment } from '../middleware/rbac.js';

const router = Router();

// Enforce authentication, department boundary, and role for all application routes
router.use(authenticateToken);
router.use(requireDepartment('domicile'));
router.use(requireRole(['ADMIN', 'REVIEW_OFFICER']));

router.get('/', (_req: Request, res: Response) => {
  const list = getAllApplications();
  res.status(200).json(list);
});

router.get('/:applicationId', (req: Request, res: Response) => {
  const app = getApplication(req.params.applicationId);
  if (!app) {
    res.status(404).json({ error: 'NOT_FOUND', message: 'Application not found.' });
    return;
  }
  res.status(200).json(app);
});

router.post('/', (req: Request, res: Response) => {
  const { applicantName, dateOfBirth, address } = req.body;
  if (!applicantName || !dateOfBirth || !address) {
    res.status(400).json({ error: 'INVALID_INPUT', message: 'applicantName, dateOfBirth, and address are required.' });
    return;
  }
  const created = createApplication({ applicantName, dateOfBirth, address });
  res.status(201).json(created);
});

router.post('/:applicationId/review', (req: Request, res: Response) => {
  const { decision, officerNotes } = req.body as {
    decision?: 'APPROVE' | 'REJECT';
    officerNotes?: string;
  };

  if (!decision || (decision !== 'APPROVE' && decision !== 'REJECT')) {
    res.status(400).json({
      error: 'INVALID_DECISION',
      message: 'decision must be either "APPROVE" or "REJECT".'
    });
    return;
  }

  // Lifecycle Authorization Check: Only applications in NEEDS_MANUAL_REVIEW may be reviewed
  const existingApp = getApplication(req.params.applicationId);
  if (!existingApp) {
    res.status(404).json({ error: 'NOT_FOUND', message: 'Application not found.' });
    return;
  }

  if (existingApp.status !== 'NEEDS_MANUAL_REVIEW') {
    res.status(409).json({
      error: 'INVALID_LIFECYCLE_STATE',
      message: `Application cannot be reviewed. Current state is "${existingApp.status}", but only applications in "NEEDS_MANUAL_REVIEW" can be reviewed.`
    });
    return;
  }

  const result = reviewApplication({
    applicationId: req.params.applicationId,
    decision,
    officerNotes: officerNotes || 'Adjudicated by demo administrative officer.'
  });

  if (!result.success) {
    res.status(404).json({ error: 'REVIEW_FAILED', message: result.error });
    return;
  }

  res.status(200).json(result);
});

export default router;
