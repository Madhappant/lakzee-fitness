import { Router } from 'express';
import { ingestClientTelemetry } from '../controllers/metrics.controller';
import { validateRequest } from '../middlewares/validate.middleware';
import { clientTelemetryBodySchema } from '../validators/domain.schemas';

const router = Router();

router.post('/client', validateRequest({ body: clientTelemetryBodySchema }), ingestClientTelemetry);

export default router;
