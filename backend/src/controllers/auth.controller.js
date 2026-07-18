"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyPhoneOtp = exports.requestPhoneOtp = exports.resetPassword = exports.requestOtp = exports.login = exports.register = void 0;
const express_1 = require("express");
const app_1 = require("../app");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const jwt_1 = require("../utils/jwt");
const zod_1 = require("zod");
const nodemailer_1 = __importDefault(require("nodemailer"));
const registerSchema = zod_1.z.object({
    email: zod_1.z.string().email(),
    password: zod_1.z.string().min(6),
    firstName: zod_1.z.string().min(1),
    lastName: zod_1.z.string().min(1),
});
const loginSchema = zod_1.z.object({
    email: zod_1.z.string().email(),
    password: zod_1.z.string(),
});
const requestOtpSchema = zod_1.z.object({
    email: zod_1.z.string().email(),
});
const resetSchema = zod_1.z.object({
    email: zod_1.z.string().email(),
    otp: zod_1.z.string().length(6),
    newPassword: zod_1.z.string().min(6),
});
const requestPhoneOtpSchema = zod_1.z.object({
    email: zod_1.z.string().email(),
    newPhone: zod_1.z.string().min(5),
});
const verifyPhoneSchema = zod_1.z.object({
    email: zod_1.z.string().email(),
    otp: zod_1.z.string().length(6),
});
const register = async (req, res, next) => {
    try {
        const { email, password, firstName, lastName } = registerSchema.parse(req.body);
        const existingUser = await app_1.prisma.user.findUnique({ where: { email } });
        if (existingUser) {
            return res.status(400).json({ status: 'error', message: 'Email already exists' });
        }
        const salt = await bcryptjs_1.default.genSalt(10);
        const hashedPassword = await bcryptjs_1.default.hash(password, salt);
        const user = await app_1.prisma.user.create({
            data: {
                email,
                password: hashedPassword,
                firstName,
                lastName,
                // Default role is MEMBER as per schema
            },
        });
        const token = (0, jwt_1.generateToken)(user);
        res.status(201).json({
            status: 'success',
            data: {
                user: { id: user.id, email: user.email, role: user.role, firstName: user.firstName, lastName: user.lastName },
                token,
            },
        });
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            return res.status(400).json({ status: 'error', message: 'Validation failed', errors: error.errors });
        }
        next(error);
    }
};
exports.register = register;
const login = async (req, res, next) => {
    try {
        const { email, password } = loginSchema.parse(req.body);
        const user = await app_1.prisma.user.findUnique({ where: { email } });
        if (!user) {
            return res.status(401).json({ status: 'error', message: 'Invalid credentials' });
        }
        const isMatch = await bcryptjs_1.default.compare(password, user.password);
        if (!isMatch) {
            return res.status(401).json({ status: 'error', message: 'Invalid credentials' });
        }
        const token = (0, jwt_1.generateToken)(user);
        res.status(200).json({
            status: 'success',
            data: {
                user: { id: user.id, email: user.email, role: user.role, firstName: user.firstName, lastName: user.lastName },
                token,
            },
        });
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            return res.status(400).json({ status: 'error', message: 'Validation failed', errors: error.errors });
        }
        next(error);
    }
};
exports.login = login;
const requestOtp = async (req, res, next) => {
    try {
        const { email } = requestOtpSchema.parse(req.body);
        const user = await app_1.prisma.user.findUnique({ where: { email } });
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
        await app_1.prisma.user.update({
            where: { email },
            data: {
                resetOtp: otp,
                resetOtpExpiry: expiry
            }
        });
        // SIMULATED SMS -> NOW ETHEREAL EMAIL
        let transporter;
        if (process.env.SMTP_USER && process.env.SMTP_PASS) {
            transporter = nodemailer_1.default.createTransport({
                service: 'gmail',
                auth: {
                    user: process.env.SMTP_USER,
                    pass: process.env.SMTP_PASS,
                },
            });
        }
        else {
            let testAccount = await nodemailer_1.default.createTestAccount();
            transporter = nodemailer_1.default.createTransport({
                host: "smtp.ethereal.email",
                port: 587,
                secure: false,
                auth: {
                    user: testAccount.user,
                    pass: testAccount.pass,
                },
            });
        }
        let info = await transporter.sendMail({
            from: '"Lakzee Fitness" <noreply@lakzeefitness.com>',
            to: email, // Sending to registered email
            subject: "Your Password Reset OTP",
            text: `Your Lakzee Fitness OTP is: ${otp}`,
            html: `<b>Your Lakzee Fitness OTP is: ${otp}</b>`,
        });
        console.log(`\n\n========================================`);
        console.log(`📧 EMAIL SENT TO ${email}`);
        console.log(`🔒 Your Lakzee Fitness OTP is: ${otp}`);
        console.log(`🔗 Preview URL: %s`, nodemailer_1.default.getTestMessageUrl(info));
        console.log(`========================================\n\n`);
        res.status(200).json({
            status: 'success',
            message: 'OTP has been sent to your registered email address.',
            simulatedOtp: otp, // Kept for UI convenience if needed
            phoneMasked: email,
            previewUrl: nodemailer_1.default.getTestMessageUrl(info)
        });
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            return res.status(400).json({ status: 'error', message: 'Validation failed', errors: error.errors });
        }
        next(error);
    }
};
exports.requestOtp = requestOtp;
const resetPassword = async (req, res, next) => {
    try {
        const { email, otp, newPassword } = resetSchema.parse(req.body);
        const user = await app_1.prisma.user.findUnique({ where: { email } });
        if (!user || user.resetOtp !== otp) {
            return res.status(400).json({ status: 'error', message: 'Invalid OTP or email' });
        }
        if (!user.resetOtpExpiry || user.resetOtpExpiry < new Date()) {
            return res.status(400).json({ status: 'error', message: 'OTP has expired' });
        }
        const salt = await bcryptjs_1.default.genSalt(10);
        const hashedPassword = await bcryptjs_1.default.hash(newPassword, salt);
        await app_1.prisma.user.update({
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
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            return res.status(400).json({ status: 'error', message: 'Validation failed', errors: error.errors });
        }
        next(error);
    }
};
exports.resetPassword = resetPassword;
const requestPhoneOtp = async (req, res, next) => {
    try {
        const { email, newPhone } = requestPhoneOtpSchema.parse(req.body);
        const user = await app_1.prisma.user.findUnique({ where: { email } });
        if (!user) {
            return res.status(404).json({ status: 'error', message: 'User not found' });
        }
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        const expiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
        await app_1.prisma.user.update({
            where: { email },
            data: {
                pendingPhone: newPhone,
                phoneOtp: otp,
                phoneOtpExpiry: expiry
            }
        });
        let transporter;
        if (process.env.SMTP_USER && process.env.SMTP_PASS) {
            transporter = nodemailer_1.default.createTransport({
                service: 'gmail',
                auth: {
                    user: process.env.SMTP_USER,
                    pass: process.env.SMTP_PASS,
                },
            });
        }
        else {
            let testAccount = await nodemailer_1.default.createTestAccount();
            transporter = nodemailer_1.default.createTransport({
                host: "smtp.ethereal.email",
                port: 587,
                secure: false,
                auth: {
                    user: testAccount.user,
                    pass: testAccount.pass,
                },
            });
        }
        let info = await transporter.sendMail({
            from: '"Lakzee Fitness" <noreply@lakzeefitness.com>',
            to: email, // Sending to registered email
            subject: "Verify Your New Phone Number",
            text: `Your Lakzee Fitness Phone Verification OTP is: ${otp}`,
            html: `<b>Your Lakzee Fitness Phone Verification OTP is: ${otp}</b>`,
        });
        console.log(`\n\n========================================`);
        console.log(`📧 EMAIL SENT TO ${email} (for phone verification)`);
        console.log(`🔒 Your Lakzee Fitness Phone Verification OTP is: ${otp}`);
        console.log(`🔗 Preview URL: %s`, nodemailer_1.default.getTestMessageUrl(info));
        console.log(`========================================\n\n`);
        res.status(200).json({
            status: 'success',
            message: 'OTP has been sent to your registered email address.',
            simulatedOtp: otp,
            phoneMasked: email,
            previewUrl: nodemailer_1.default.getTestMessageUrl(info)
        });
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            return res.status(400).json({ status: 'error', message: 'Validation failed', errors: error.errors });
        }
        next(error);
    }
};
exports.requestPhoneOtp = requestPhoneOtp;
const verifyPhoneOtp = async (req, res, next) => {
    try {
        const { email, otp } = verifyPhoneSchema.parse(req.body);
        const user = await app_1.prisma.user.findUnique({ where: { email } });
        if (!user || user.phoneOtp !== otp) {
            return res.status(400).json({ status: 'error', message: 'Invalid OTP' });
        }
        if (!user.phoneOtpExpiry || user.phoneOtpExpiry < new Date()) {
            return res.status(400).json({ status: 'error', message: 'OTP has expired' });
        }
        if (!user.pendingPhone) {
            return res.status(400).json({ status: 'error', message: 'No pending phone number to update' });
        }
        const updatedUser = await app_1.prisma.user.update({
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
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            return res.status(400).json({ status: 'error', message: 'Validation failed', errors: error.errors });
        }
        next(error);
    }
};
exports.verifyPhoneOtp = verifyPhoneOtp;
//# sourceMappingURL=auth.controller.js.map