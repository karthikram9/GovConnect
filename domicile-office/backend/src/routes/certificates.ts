import { Router, Request, Response } from 'express';
import { getAllCertificates, getCertificate } from '../services/applicationService.js';

const router = Router();

router.get('/', (_req: Request, res: Response) => {
  const list = getAllCertificates();
  res.status(200).json(list);
});

router.get('/:certificateId', (req: Request, res: Response) => {
  const cert = getCertificate(req.params.certificateId);
  if (!cert) {
    res.status(404).json({ error: 'NOT_FOUND', message: 'Certificate not found.' });
    return;
  }
  res.status(200).json(cert);
});

export default router;
