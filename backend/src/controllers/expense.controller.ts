/* eslint-disable @typescript-eslint/no-explicit-any */
import { Request, Response } from 'express';
import { prisma } from '../app';
import { z } from 'zod';
import { asyncHandler } from '../middlewares/error.middleware';
import { BadRequestError } from '../utils/errors';

const createExpenseSchema = z.object({
  title: z.string().trim().min(1, 'Title is required').max(150),
  category: z.enum(['SALARY', 'MAINTENANCE', 'RENT', 'WATER', 'ELECTRICITY', 'CLEANING', 'OTHER']).default('OTHER'),
  amount: z.preprocess((v) => Number(v), z.number().min(0, 'Amount must be positive')),
  date: z.string().refine((s) => !s || !isNaN(Date.parse(s)), 'Invalid date').optional(),
  paymentMethod: z.enum(['CASH', 'UPI', 'BANK_TRANSFER', 'CREDIT_CARD']).default('CASH'),
  notes: z.string().max(1000).optional(),
});

const updateExpenseSchema = createExpenseSchema.partial();

export const createExpense = asyncHandler(async (req: Request, res: Response) => {
  const validated = createExpenseSchema.parse(req.body);

  const expense = await prisma.expense.create({
    data: {
      title: validated.title,
      category: validated.category,
      amount: Math.round(validated.amount * 100) / 100,
      date: validated.date ? new Date(validated.date) : new Date(),
      paymentMethod: validated.paymentMethod,
      notes: validated.notes,
    },
  });

  res.status(201).json({ status: 'success', data: expense });
});

export const getExpenses = asyncHandler(async (req: Request, res: Response) => {
  const { month, year } = req.query;
  const whereClause: any = {};

  if (month && year) {
    const m = Number(month);
    const y = Number(year);
    if (isNaN(m) || isNaN(y) || m < 1 || m > 12 || y < 2000 || y > 2100) {
      throw new BadRequestError('Invalid month or year parameter');
    }
    const startDate = new Date(y, m - 1, 1);
    const endDate = new Date(y, m, 0, 23, 59, 59, 999);
    whereClause.date = { gte: startDate, lte: endDate };
  }

  const expenses = await prisma.expense.findMany({
    where: whereClause,
    orderBy: { date: 'desc' },
  });

  res.json({ status: 'success', data: expenses });
});

export const updateExpense = asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const validated = updateExpenseSchema.parse(req.body);

  const expense = await prisma.expense.update({
    where: { id },
    data: {
      ...(validated.title !== undefined && { title: validated.title }),
      ...(validated.category !== undefined && { category: validated.category }),
      ...(validated.amount !== undefined && { amount: Math.round(validated.amount * 100) / 100 }),
      ...(validated.date !== undefined && { date: validated.date ? new Date(validated.date) : new Date() }),
      ...(validated.paymentMethod !== undefined && { paymentMethod: validated.paymentMethod }),
      ...(validated.notes !== undefined && { notes: validated.notes }),
    },
  });

  res.json({ status: 'success', data: expense });
});

export const deleteExpense = asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id as string;
  await prisma.expense.delete({ where: { id } });
  res.json({ status: 'success', message: 'Expense deleted successfully' });
});
