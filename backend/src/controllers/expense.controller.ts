import { Request, Response } from 'express';
import { prisma } from '../app';
import { z } from 'zod';

const createExpenseSchema = z.object({
  title: z.string().trim().min(1, 'Title is required').max(150),
  category: z.enum(['SALARY', 'MAINTENANCE', 'RENT', 'WATER', 'ELECTRICITY', 'CLEANING', 'OTHER']).default('OTHER'),
  amount: z.preprocess((v) => Number(v), z.number().min(0, 'Amount must be positive')),
  date: z.string().refine((s) => !s || !isNaN(Date.parse(s)), 'Invalid date').optional(),
  paymentMethod: z.enum(['CASH', 'UPI', 'BANK_TRANSFER', 'CREDIT_CARD']).default('CASH'),
  notes: z.string().max(1000).optional(),
});

const updateExpenseSchema = createExpenseSchema.partial();

export const createExpense = async (req: Request, res: Response) => {
  try {
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
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ status: 'error', message: 'Validation failed', errors: (error as any).errors });
    }
    res.status(500).json({ status: 'error', message: error.message || 'Failed to create expense' });
  }
};

export const getExpenses = async (req: Request, res: Response) => {
  try {
    const { month, year } = req.query;

    const whereClause: any = {};

    if (month && year) {
      const m = Number(month);
      const y = Number(year);
      if (isNaN(m) || isNaN(y) || m < 1 || m > 12 || y < 2000 || y > 2100) {
        return res.status(400).json({ status: 'error', message: 'Invalid month or year parameter' });
      }
      const startDate = new Date(y, m - 1, 1);
      const endDate = new Date(y, m, 0, 23, 59, 59, 999);
      whereClause.date = {
        gte: startDate,
        lte: endDate,
      };
    }

    const expenses = await prisma.expense.findMany({
      where: whereClause,
      orderBy: { date: 'desc' },
    });

    res.json({ status: 'success', data: expenses });
  } catch {
    res.status(500).json({ status: 'error', message: 'Failed to fetch expenses' });
  }
};

export const updateExpense = async (req: Request, res: Response) => {
  try {
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
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ status: 'error', message: 'Validation failed', errors: (error as any).errors });
    }
    if (error?.code === 'P2025') {
      return res.status(404).json({ status: 'error', message: 'Expense not found' });
    }
    res.status(500).json({ status: 'error', message: 'Failed to update expense' });
  }
};

export const deleteExpense = async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    await prisma.expense.delete({ where: { id } });
    res.json({ status: 'success', message: 'Expense deleted successfully' });
  } catch (error: any) {
    if (error?.code === 'P2025') {
      return res.status(404).json({ status: 'error', message: 'Expense not found' });
    }
    res.status(500).json({ status: 'error', message: 'Failed to delete expense' });
  }
};
