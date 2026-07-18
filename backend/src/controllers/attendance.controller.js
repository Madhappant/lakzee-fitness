"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getTodayAttendance = exports.checkIn = void 0;
const express_1 = require("express");
const app_1 = require("../app");
const checkIn = async (req, res) => {
    try {
        const { lakzeeId } = req.body; // e.g. LZ-1234
        // Find member by Lakzee ID
        const member = await app_1.prisma.memberProfile.findUnique({
            where: { memberId: lakzeeId },
            include: { user: true }
        });
        if (!member) {
            return res.status(404).json({ status: 'error', message: 'Member not found' });
        }
        // Check if member has an active subscription
        const activeSub = await app_1.prisma.subscription.findFirst({
            where: {
                memberId: member.id,
                status: 'ACTIVE',
                paymentStatus: 'PAID'
            }
        });
        if (!activeSub) {
            return res.status(403).json({ status: 'error', message: 'Member does not have an active, paid subscription' });
        }
        // Check if already checked in today
        const todayStart = new Date(new Date().setHours(0, 0, 0, 0));
        const existingCheckIn = await app_1.prisma.attendance.findFirst({
            where: {
                memberId: member.id,
                date: todayStart
            }
        });
        if (existingCheckIn) {
            return res.status(400).json({ status: 'error', message: 'Member is already checked in for today' });
        }
        // Create checkin record
        const attendance = await app_1.prisma.attendance.create({
            data: {
                memberId: member.id,
                date: new Date(new Date().setHours(0, 0, 0, 0)), // Normalize to start of day
            }
        });
        res.status(201).json({
            status: 'success',
            message: `Checked in ${member.user.firstName} ${member.user.lastName}`,
            data: attendance
        });
    }
    catch (error) {
        res.status(500).json({ status: 'error', message: 'Check-in failed' });
    }
};
exports.checkIn = checkIn;
const getTodayAttendance = async (req, res) => {
    try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const logs = await app_1.prisma.attendance.findMany({
            where: {
                date: {
                    gte: today,
                }
            },
            include: {
                member: {
                    include: { user: true }
                }
            },
            orderBy: { checkIn: 'desc' }
        });
        res.json({ status: 'success', data: logs });
    }
    catch (error) {
        res.status(500).json({ status: 'error', message: 'Failed to fetch attendance logs' });
    }
};
exports.getTodayAttendance = getTodayAttendance;
//# sourceMappingURL=attendance.controller.js.map