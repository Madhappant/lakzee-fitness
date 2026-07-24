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

const generateEmailHtml = (otp: string, context: "password reset" | "phone verification") => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: 'Helvetica Neue', Arial, sans-serif; background-color: #f4f4f5; margin: 0; padding: 0; color: #18181b; }
    .container { max-width: 600px; margin: 40px auto; background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.05); }
    .header { background: #000000; padding: 30px 20px; text-align: center; }
    .header img { max-width: 150px; height: auto; }
    .content { padding: 40px 30px; line-height: 1.6; }
    .title { font-size: 24px; font-weight: 700; color: #18181b; margin-bottom: 20px; }
    .otp-box { background: linear-gradient(135deg, #fbbf24 0%, #d97706 100%); color: #ffffff; text-align: center; padding: 20px; border-radius: 12px; margin: 30px 0; font-size: 36px; font-weight: 800; letter-spacing: 8px; box-shadow: 0 4px 15px rgba(217, 119, 6, 0.3); }
    .footer { background: #fafafa; padding: 20px 30px; text-align: center; font-size: 13px; color: #71717a; border-top: 1px solid #e4e4e7; }
    p { margin-bottom: 16px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <img src="https://lakzee-fitness.vercel.app/logo.png" alt="Lakzee Fitness" />
    </div>
    <div class="content">
      <h1 class="title">Secure Your Account</h1>
      <p>Hello there,</p>
      <p>We received a request for a <strong>${context}</strong> for your Lakzee Fitness account. At Lakzee Fitness, your security and privacy are our highest priorities. We utilize robust encryption and verification systems to ensure that your personal information and membership details remain completely safe.</p>
      <p>To proceed with your request, please use the 6-digit One-Time Password (OTP) provided below. This code is unique to your current session and will securely authenticate your identity.</p>
      
      <div class="otp-box">${otp}</div>
      
      <p>For your security, this code will expire automatically in 10 minutes. Please do not share this code with anyone, including Lakzee Fitness staff. If you did not initiate this ${context}, please ignore this email—your account remains completely secure and no changes will be made.</p>
      <p>Thank you for choosing Lakzee Fitness. Let's keep pushing towards your fitness goals together!</p>
      <p>Best regards,<br><strong>The Lakzee Fitness Team</strong></p>
    </div>
    <div class="footer">
      &copy; ${new Date().getFullYear()} Lakzee Fitness. All rights reserved.<br>
      If you need assistance, please contact support via the Lakzee Fitness app.
    </div>
  </div>
</body>
</html>
`;

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

        await transporter.sendMail({
          from: `"Lakzee Fitness" <${process.env.SMTP_USER}>`,
          to: email, // Sending to registered email
          subject: "Your Password Reset OTP",
          text: `Your Lakzee Fitness OTP is: ${otp}. Please check your HTML email for details.`,
          html: generateEmailHtml(otp, "password reset"),
        });
        console.log(`[SMTP] Real email sent to ${email}`);
      } catch (mailError: any) {
        console.error("Failed to send real email via SMTP", mailError);
        let errorMessage = "Failed to send email. Please check your SMTP configuration.";
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

        await transporter.sendMail({
          from: `"Lakzee Fitness" <${process.env.SMTP_USER}>`,
          to: email, // Sending to registered email
          subject: "Verify Your New Phone Number",
          text: `Your Lakzee Fitness Phone Verification OTP is: ${otp}. Please check your HTML email for details.`,
          html: generateEmailHtml(otp, "phone verification"),
        });
      } catch (mailError: any) {
        console.error("Failed to send real email via SMTP", mailError);
        let errorMessage = "Failed to send email. Please check your SMTP configuration.";
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
