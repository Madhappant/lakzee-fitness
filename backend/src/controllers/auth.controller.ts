import { Request, Response, NextFunction } from 'express';
import { prisma } from '../app';
import bcrypt from 'bcryptjs';
import { generateToken } from '../utils/jwt';
import { z } from 'zod';
import nodemailer from 'nodemailer';

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

const requestOtpSchema = z.object({
  email: z.string().email(),
});

const resetSchema = z.object({
  email: z.string().email(),
  otp: z.string().length(6),
  newPassword: z.string().min(6),
});

const requestPhoneOtpSchema = z.object({
  email: z.string().email(),
  newPhone: z.string().min(5),
});

const verifyPhoneSchema = z.object({
  email: z.string().email(),
  otp: z.string().length(6),
});

export const register = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password, firstName, lastName } = registerSchema.parse(req.body);

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return res.status(400).json({ status: 'error', message: 'Email already exists' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        firstName,
        lastName,
        // Default role is MEMBER as per schema
      },
    });

    const token = generateToken(user);

    res.status(201).json({
      status: 'success',
      data: {
        user: { id: user.id, email: user.email, role: user.role, firstName: user.firstName, lastName: user.lastName },
        token,
      },
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ status: 'error', message: 'Validation failed', errors: (error as any).errors });
    }
    next(error);
  }
};

export const login = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password } = loginSchema.parse(req.body);

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return res.status(401).json({ status: 'error', message: 'Invalid credentials' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ status: 'error', message: 'Invalid credentials' });
    }

    const token = generateToken(user);

    res.status(200).json({
      status: 'success',
      data: {
        user: { id: user.id, email: user.email, role: user.role, firstName: user.firstName, lastName: user.lastName },
        token,
      },
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ status: 'error', message: 'Validation failed', errors: (error as any).errors });
    }
    next(error);
  }
};

export const requestOtp = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email } = requestOtpSchema.parse(req.body);

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      // Return 200 even if user not found to prevent email enumeration
      return res.status(200).json({ status: 'success', message: 'If the email exists, an OTP has been sent.' });
    }
    
    // Check if phone exists (for a real SMS system, we'd need this)
    // For now we simulate it even if phone is null, but we can mention it
    const phone = user.phone || "XXXXXX1234";

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    await prisma.user.update({
      where: { email },
      data: {
        resetOtp: otp,
        resetOtpExpiry: expiry
      }
    });

    let previewUrl = "";
    if (process.env.SMTP_USER && process.env.SMTP_PASS) {
      try {
        const transporter = nodemailer.createTransport({
          host: 'smtp.gmail.com',
          port: 465,
          secure: true, // Use true for port 465, false for 587
          auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS,
          },
          connectionTimeout: 8000, // Fail fast after 8 seconds
          greetingTimeout: 8000,
          socketTimeout: 8000,
        });
        
        // Fast-fail if credentials are bad or connection is blocked
        await transporter.verify();

        const resetHtml = `
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 10px; background-color: #fafafa;">
  <div style="text-align: center; margin-bottom: 20px;">
    <img src="https://lakzee-fitness.vercel.app/logo.png" alt="Lakzee Fitness Logo" style="max-width: 150px; height: auto;" />
  </div>
  <h2 style="color: #333333; text-align: center;">Your Password Reset Request</h2>
  <p style="color: #555555; line-height: 1.6; font-size: 16px;">
    Hello,<br><br>
    We received a request to reset the password associated with your Lakzee Fitness account. We understand how important it is to keep your account secure and accessible. To proceed with resetting your password, please use the One-Time Password (OTP) provided below.
  </p>
  <div style="text-align: center; margin: 30px 0;">
    <span style="display: inline-block; padding: 15px 30px; font-size: 28px; font-weight: bold; color: #d4af37; background-color: #fff8e1; border: 2px dashed #d4af37; border-radius: 8px; letter-spacing: 5px;">
      ${otp}
    </span>
  </div>
  <p style="color: #555555; line-height: 1.6; font-size: 16px;">
    This verification code is valid for the next 10 minutes. Please do not share this code with anyone, including our support team, as it grants access to modify your account credentials. If you did not request a password reset, you can safely ignore this email and your account will remain secure. Your security and fitness journey are our top priorities!
  </p>
  <hr style="border: none; border-top: 1px solid #dddddd; margin: 30px 0;" />
  <p style="color: #888888; font-size: 12px; text-align: center; line-height: 1.5;">
    &copy; ${new Date().getFullYear()} Lakzee Fitness. All rights reserved.<br>
    Train Hard, Stay Fit.
  </p>
</div>
        `;

        await transporter.sendMail({
          from: `"Lakzee Fitness" <${process.env.SMTP_USER}>`,
          to: email, // Sending to registered email
          subject: "Your Password Reset OTP",
          text: `Your Lakzee Fitness OTP is: ${otp}`,
          html: resetHtml,
        });
        console.log(`[SMTP] Real email sent to ${email}`);
      } catch (mailError: any) {
        console.error("Failed to send real email via SMTP", mailError);
        let errorMessage = `Failed to send email: ${mailError.message || mailError}`;
        if (mailError.message?.includes("Invalid login")) {
           errorMessage = "SMTP Authentication Failed. If using Gmail, you MUST use an 'App Password', not your regular password.";
        }
        return res.status(500).json({ status: 'error', message: errorMessage });
      }
    } else {
      console.log(`\n\n========================================`);
      console.log(`[MOCK] NO SMTP CONFIGURED - MOCK EMAIL SENT TO ${email}`);
      console.log(`[MOCK] Your Lakzee Fitness OTP is: ${otp}`);
      console.log(`========================================\n\n`);
    }

    res.status(200).json({
      status: 'success',
      message: 'OTP has been sent to your registered email address.',
      phoneMasked: email
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ status: 'error', message: 'Validation failed', errors: (error as any).errors });
    }
    next(error);
  }
};

export const resetPassword = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, otp, newPassword } = resetSchema.parse(req.body);

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || user.resetOtp !== otp) {
      return res.status(400).json({ status: 'error', message: 'Invalid OTP or email' });
    }

    if (!user.resetOtpExpiry || user.resetOtpExpiry < new Date()) {
      return res.status(400).json({ status: 'error', message: 'OTP has expired' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    await prisma.user.update({
      where: { email },
      data: { 
        password: hashedPassword,
        resetOtp: null,
        resetOtpExpiry: null
      }
    });

    res.status(200).json({
      status: 'success',
      message: 'Password reset successfully',
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ status: 'error', message: 'Validation failed', errors: (error as any).errors });
    }
    next(error);
  }
};

export const requestPhoneOtp = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, newPhone } = requestPhoneOtpSchema.parse(req.body);

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return res.status(404).json({ status: 'error', message: 'User not found' });
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    await prisma.user.update({
      where: { email },
      data: {
        pendingPhone: newPhone,
        phoneOtp: otp,
        phoneOtpExpiry: expiry
      }
    });

    if (process.env.SMTP_USER && process.env.SMTP_PASS) {
      try {
        const transporter = nodemailer.createTransport({
          host: 'smtp.gmail.com',
          port: 465,
          secure: true,
          auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS,
          },
          connectionTimeout: 8000,
          greetingTimeout: 8000,
          socketTimeout: 8000,
        });
        
        await transporter.verify();

        const phoneHtml = `
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 10px; background-color: #fafafa;">
  <div style="text-align: center; margin-bottom: 20px;">
    <img src="https://lakzee-fitness.vercel.app/logo.png" alt="Lakzee Fitness Logo" style="max-width: 150px; height: auto;" />
  </div>
  <h2 style="color: #333333; text-align: center;">Phone Verification Request</h2>
  <p style="color: #555555; line-height: 1.6; font-size: 16px;">
    Hello,<br><br>
    We received a request to update the phone number associated with your Lakzee Fitness account. Keeping your contact information up-to-date helps us ensure you receive important gym announcements and membership updates. To verify and confirm this change, please use the One-Time Password (OTP) provided below.
  </p>
  <div style="text-align: center; margin: 30px 0;">
    <span style="display: inline-block; padding: 15px 30px; font-size: 28px; font-weight: bold; color: #d4af37; background-color: #fff8e1; border: 2px dashed #d4af37; border-radius: 8px; letter-spacing: 5px;">
      ${otp}
    </span>
  </div>
  <p style="color: #555555; line-height: 1.6; font-size: 16px;">
    This verification code is valid for the next 10 minutes. Please do not share this code with anyone, as it authorizes changes to your personal account profile. If you did not request a phone number update, you can safely ignore this email and your profile will remain unchanged. Thank you for being a valued member of our fitness community!
  </p>
  <hr style="border: none; border-top: 1px solid #dddddd; margin: 30px 0;" />
  <p style="color: #888888; font-size: 12px; text-align: center; line-height: 1.5;">
    &copy; ${new Date().getFullYear()} Lakzee Fitness. All rights reserved.<br>
    Train Hard, Stay Fit.
  </p>
</div>
        `;

        await transporter.sendMail({
          from: `"Lakzee Fitness" <${process.env.SMTP_USER}>`,
          to: email, // Sending to registered email
          subject: "Verify Your New Phone Number",
          text: `Your Lakzee Fitness Phone Verification OTP is: ${otp}`,
          html: phoneHtml,
        });
      } catch (mailError: any) {
        console.error("Failed to send real email via SMTP", mailError);
        let errorMessage = `Failed to send email: ${mailError.message || mailError}`;
        if (mailError.message?.includes("Invalid login")) {
           errorMessage = "SMTP Authentication Failed. If using Gmail, you MUST use an 'App Password', not your regular password.";
        }
        return res.status(500).json({ status: 'error', message: errorMessage });
      }
    } else {
      console.log(`\n\n========================================`);
      console.log(`[MOCK] NO SMTP CONFIGURED - MOCK EMAIL SENT TO ${email} (for phone verification)`);
      console.log(`[MOCK] Your Lakzee Fitness Phone Verification OTP is: ${otp}`);
      console.log(`========================================\n\n`);
    }

    res.status(200).json({
      status: 'success',
      message: 'OTP has been sent to your registered email address.',
      phoneMasked: email
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ status: 'error', message: 'Validation failed', errors: (error as any).errors });
    }
    next(error);
  }
};

export const verifyPhoneOtp = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, otp } = verifyPhoneSchema.parse(req.body);

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || user.phoneOtp !== otp) {
      return res.status(400).json({ status: 'error', message: 'Invalid OTP' });
    }

    if (!user.phoneOtpExpiry || user.phoneOtpExpiry < new Date()) {
      return res.status(400).json({ status: 'error', message: 'OTP has expired' });
    }

    if (!user.pendingPhone) {
      return res.status(400).json({ status: 'error', message: 'No pending phone number to update' });
    }

    const updatedUser = await prisma.user.update({
      where: { email },
      data: { 
        phone: user.pendingPhone,
        pendingPhone: null,
        phoneOtp: null,
        phoneOtpExpiry: null
      }
    });

    res.status(200).json({
      status: 'success',
      message: 'Phone number updated successfully',
      data: {
        user: { id: updatedUser.id, email: updatedUser.email, role: updatedUser.role, firstName: updatedUser.firstName, lastName: updatedUser.lastName, phone: updatedUser.phone }
      }
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ status: 'error', message: 'Validation failed', errors: (error as any).errors });
    }
    next(error);
  }
};
