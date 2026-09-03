import { Request, Response } from 'express';
import { prisma } from '../app';

export const createExpense = async (req: Request, res: Response) => {
  try {
    const { title, category, amount, date, paymentMethod, notes } = req.body;
    
    const expense = await prisma.expense.create({
      data: {
        title,
        category,
        amount: Number(amount),
        date: date ? new Date(date) : new Date(),
        paymentMethod,
        notes
      }
    });

    res.status(201).json({ status: 'success', data: expense });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message || 'Failed to create expense' });
  }
};

export const getExpenses = async (req: Request, res: Response) => {
  try {
    const { month, year } = req.query;
    
    let whereClause: any = {};
    
    if (month && year) {
      const startDate = new Date(Number(year), Number(month) - 1, 1);
      const endDate = new Date(Number(year), Number(month), 0, 23, 59, 59, 999);
      whereClause.date = {
        gte: startDate,
        lte: endDate
      };
    }

    const expenses = await prisma.expense.findMany({
      where: whereClause,
      orderBy: { date: 'desc' }
    });

    res.json({ status: 'success', data: expenses });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: 'Failed to fetch expenses' });
  }
};

export const updateExpense = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { title, category, amount, date, paymentMethod, notes } = req.body;

    const expense = await prisma.expense.update({
      where: { id: id as string },
      data: {
        title,
        category,
        amount: amount !== undefined ? Number(amount) : undefined,
        date: date ? new Date(date) : undefined,
        paymentMethod,
        notes
      }
    });

    res.json({ status: 'success', data: expense });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: 'Failed to update expense' });
  }
};

export const deleteExpense = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await prisma.expense.delete({ where: { id: id as string } });
    res.json({ status: 'success', message: 'Expense deleted successfully' });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: 'Failed to delete expense' });
  }
};
