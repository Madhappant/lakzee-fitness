import { Router } from 'express';
import { createExpense, getExpenses, updateExpense, deleteExpense } from '../controllers/expense.controller';
import { authenticate, authorize } from '../middlewares/auth.middleware';

const router = Router();

router.use(authenticate);
router.use(authorize('ADMIN', 'RECEPTIONIST')); // Allow Admin and Receptionist to manage expenses

router.post('/', createExpense);
router.get('/', getExpenses);
router.put('/:id', updateExpense);
router.delete('/:id', deleteExpense);

export default router;
