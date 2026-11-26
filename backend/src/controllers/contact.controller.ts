import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../app';

const contactInquirySchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(100),
  phone: z.string().trim().min(5, 'Valid phone number is required').max(30),
  email: z.string().trim().email('Invalid email').optional().or(z.literal('')),
  goal: z.string().trim().min(1, 'Fitness goal is required').max(50),
  message: z.string().trim().max(1000).optional().or(z.literal('')),
});

export const submitConsultationInquiry = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const validated = contactInquirySchema.parse(req.body);

    const inquiry = await prisma.consultationInquiry.create({
      data: {
        name: validated.name,
        phone: validated.phone,
        email: validated.email || null,
        goal: validated.goal,
        message: validated.message || null,
      },
    });

    res.status(201).json({
      status: 'success',
      message: 'Consultation request submitted successfully',
      data: { id: inquiry.id },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        status: 'error',
        message: 'Validation failed',
        errors: (error as any).errors,
      });
    }
    next(error);
  }
};
