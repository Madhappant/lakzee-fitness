/* eslint-disable @typescript-eslint/no-explicit-any */
import { Request, Response } from 'express';
import { prisma } from '../app';
import { asyncHandler } from '../middlewares/error.middleware';
import { BadRequestError } from '../utils/errors';
import { performMemberCheckIn, performMemberCheckOut } from '../services/attendance.service';

export const checkIn = asyncHandler(async (req: Request, res: Response) => {
  const { lakzeeId } = req.body;
  const result = await performMemberCheckIn(prisma, lakzeeId);

  res.status(201).json({
    status: 'success',
    message: `Checked in ${result.memberName}`,
    data: result.attendance,
  });
});

export const getTodayAttendance = asyncHandler(async (req: Request, res: Response) => {
  const { start, end } = req.query;

  let startDate = new Date();
  startDate.setHours(0, 0, 0, 0);

  if (start) {
    const parsedStart = new Date(start as string);
    if (isNaN(parsedStart.getTime())) {
      throw new BadRequestError('Invalid start date');
    }
    startDate = parsedStart;
  }

  const whereClause: any = {
    checkIn: { gte: startDate },
  };

  if (end) {
    const parsedEnd = new Date(end as string);
    if (isNaN(parsedEnd.getTime())) {
      throw new BadRequestError('Invalid end date');
    }
    whereClause.checkIn.lte = parsedEnd;
  }

  const logs = await prisma.attendance.findMany({
    where: whereClause,
    select: {
      id: true,
      memberId: true,
      checkIn: true,
      checkOut: true,
      date: true,
      member: {
        select: {
          id: true,
          memberId: true,
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              phone: true,
            },
          },
        },
      },
    },
    orderBy: { checkIn: 'desc' },
  });

  res.json({ status: 'success', data: logs });
});

export const checkOut = asyncHandler(async (req: Request, res: Response) => {
  const { lakzeeId } = req.body;
  const result = await performMemberCheckOut(prisma, lakzeeId);

  res.json({
    status: 'success',
    message: `Checked out ${result.memberName}`,
    data: result.attendance,
  });
});
