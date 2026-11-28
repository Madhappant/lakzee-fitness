import { Router } from 'express';
import { createExpense, getExpenses, updateExpense, deleteExpense } from '../controllers/expense.controller';
import { requireAuth, requireRole } from '../middlewares/auth.middleware';
import { validateRequest } from '../middlewares/validate.middleware';
import { createExpenseBodySchema, updateExpenseBodySchema } from '../validators/domain.schemas';

const router = Router();

router.use(requireAuth);

router.post('/', requireRole(['ADMIN', 'RECEPTIONIST', 'STAFF']), validateRequest({ body: createExpenseBodySchema }), createExpense);
router.get('/', requireRole(['ADMIN', 'RECEPTIONIST', 'STAFF']), getExpenses);
router.put('/:id', requireRole(['ADMIN', 'RECEPTIONIST', 'STAFF']), validateRequest({ body: updateExpenseBodySchema }), updateExpense);
router.delete('/:id', requireRole(['SUPER_ADMIN', 'ADMIN']), deleteExpense);

export default router;
