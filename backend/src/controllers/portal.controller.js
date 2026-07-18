"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getMyWorkoutRoutine = exports.getMyDietPlan = exports.uploadPhoto = exports.getMySubscriptions = exports.getMyAttendance = exports.getMyProfile = void 0;
const express_1 = require("express");
const app_1 = require("../app");
const getMyProfile = async (req, res) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ status: 'error', message: 'Unauthorized' });
        }
        const memberProfile = await app_1.prisma.memberProfile.findUnique({
            where: { userId },
            include: {
                user: {
                    select: {
                        firstName: true,
                        lastName: true,
                        email: true,
                        phone: true,
                    }
                },
                trainer: {
                    select: {
                        firstName: true,
                        lastName: true,
                    }
                },
                subscriptions: {
                    where: {
                        status: 'ACTIVE'
                    },
                    include: {
                        plan: true
                    },
                    orderBy: {
                        createdAt: 'desc'
                    },
                    take: 1
                }
            }
        });
        if (!memberProfile) {
            return res.status(404).json({ status: 'error', message: 'Member profile not found' });
        }
        res.json({ status: 'success', data: memberProfile });
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ status: 'error', message: 'Failed to fetch profile' });
    }
};
exports.getMyProfile = getMyProfile;
const getMyAttendance = async (req, res) => {
    try {
        const userId = req.user?.id;
        if (!userId)
            return res.status(401).json({ status: 'error', message: 'Unauthorized' });
        const memberProfile = await app_1.prisma.memberProfile.findUnique({ where: { userId } });
        if (!memberProfile)
            return res.status(404).json({ status: 'error', message: 'Member not found' });
        const attendance = await app_1.prisma.attendance.findMany({
            where: { memberId: memberProfile.id },
            orderBy: { checkIn: 'desc' },
            take: 30 // last 30 visits
        });
        res.json({ status: 'success', data: attendance });
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ status: 'error', message: 'Failed to fetch attendance' });
    }
};
exports.getMyAttendance = getMyAttendance;
const getMySubscriptions = async (req, res) => {
    try {
        const userId = req.user?.id;
        if (!userId)
            return res.status(401).json({ status: 'error', message: 'Unauthorized' });
        const memberProfile = await app_1.prisma.memberProfile.findUnique({ where: { userId } });
        if (!memberProfile)
            return res.status(404).json({ status: 'error', message: 'Member not found' });
        const subscriptions = await app_1.prisma.subscription.findMany({
            where: { memberId: memberProfile.id },
            orderBy: { createdAt: 'desc' },
            include: {
                plan: true
            }
        });
        res.json({ status: 'success', data: subscriptions });
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ status: 'error', message: 'Failed to fetch subscriptions' });
    }
};
exports.getMySubscriptions = getMySubscriptions;
const uploadPhoto = async (req, res) => {
    try {
        const userId = req.user?.id;
        if (!userId)
            return res.status(401).json({ status: 'error', message: 'Unauthorized' });
        if (!req.file) {
            return res.status(400).json({ status: 'error', message: 'No file uploaded' });
        }
        const memberProfile = await app_1.prisma.memberProfile.findUnique({ where: { userId } });
        if (!memberProfile)
            return res.status(404).json({ status: 'error', message: 'Member not found' });
        // Store the relative URL to the uploaded file
        const photoUrl = `/uploads/${req.file.filename}`;
        const updatedProfile = await app_1.prisma.memberProfile.update({
            where: { userId },
            data: { photoUrl }
        });
        res.json({ status: 'success', data: { photoUrl: updatedProfile.photoUrl } });
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ status: 'error', message: 'Failed to upload photo' });
    }
};
exports.uploadPhoto = uploadPhoto;
const getMyDietPlan = async (req, res) => {
    try {
        const userId = req.user?.id;
        if (!userId)
            return res.status(401).json({ status: 'error', message: 'Unauthorized' });
        const memberProfile = await app_1.prisma.memberProfile.findUnique({ where: { userId } });
        if (!memberProfile)
            return res.status(404).json({ status: 'error', message: 'Member not found' });
        const activeDietPlan = await app_1.prisma.dietPlan.findFirst({
            where: { memberId: memberProfile.id, isActive: true },
            orderBy: { createdAt: 'desc' }
        });
        res.json({ status: 'success', data: activeDietPlan });
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ status: 'error', message: 'Failed to fetch diet plan' });
    }
};
exports.getMyDietPlan = getMyDietPlan;
const getMyWorkoutRoutine = async (req, res) => {
    try {
        const userId = req.user?.id;
        if (!userId)
            return res.status(401).json({ status: 'error', message: 'Unauthorized' });
        const memberProfile = await app_1.prisma.memberProfile.findUnique({ where: { userId } });
        if (!memberProfile)
            return res.status(404).json({ status: 'error', message: 'Member not found' });
        const activeRoutine = await app_1.prisma.workoutRoutine.findFirst({
            where: { memberId: memberProfile.id, isActive: true },
            orderBy: { createdAt: 'desc' }
        });
        res.json({ status: 'success', data: activeRoutine });
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ status: 'error', message: 'Failed to fetch workout routine' });
    }
};
exports.getMyWorkoutRoutine = getMyWorkoutRoutine;
//# sourceMappingURL=portal.controller.js.map