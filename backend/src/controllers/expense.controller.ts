import { Response } from 'express';
import { AuthRequest } from '../middlewares/auth.middleware';
import { asyncHandler } from '../middlewares/error.middleware';
import { billingService } from '../services/billing.service';
import { sendSuccess } from '../utils/response';
import { resolveWriteBranchId } from '../utils/tenant';

export const createExpense = asyncHandler(async (req: AuthRequest, res: Response) => {
  const branchId = resolveWriteBranchId({
    userRole: req.user?.role,
    userBranchId: req.user?.branchId,
    requestedBranchId: req.body.branchId ?? req.tenant?.branchId,
  });
  const expense = await billingService.createExpense({ ...req.body, branchId });
  return sendSuccess(res, { statusCode: 201, data: expense });
});

export const getExpenses = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { month, year } = req.validated?.query ?? req.query;
  const expenses = await billingService.listExpenses(month, year, req.tenant?.branchId);
  return sendSuccess(res, {
    data: expenses,
    meta: { total: expenses.length, branchId: req.tenant?.branchId ?? 'all' },
  });
});

export const updateExpense = asyncHandler(async (req: AuthRequest, res: Response) => {
  const expense = await billingService.updateExpense(req.params.id as string, req.body, req.tenant);
  return sendSuccess(res, { data: expense });
});

export const deleteExpense = asyncHandler(async (req: AuthRequest, res: Response) => {
  await billingService.deleteExpense(req.params.id as string, req.tenant);
  return sendSuccess(res, { message: 'Expense deleted successfully' });
});
