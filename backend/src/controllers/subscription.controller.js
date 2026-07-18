"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteSubscription = exports.updateSubscription = exports.getPaymentStats = exports.getSubscriptions = exports.createSubscription = void 0;
const express_1 = require("express");
const app_1 = require("../app");
const createSubscription = async (req, res) => {
    try {
        const { memberId, planId, startDate, paymentStatus = 'PAID' } = req.body;
        const plan = await app_1.prisma.membershipPlan.findUnique({ where: { id: planId } });
        if (!plan)
            return res.status(404).json({ status: 'error', message: 'Plan not found' });
        const start = new Date(startDate);
        const end = new Date(start);
        end.setDate(end.getDate() + plan.durationDays);
        const subscription = await app_1.prisma.subscription.create({
            data: {
                memberId,
                planId,
                startDate: start,
                endDate: end,
                status: 'ACTIVE',
                paymentStatus
            }
        });
        res.status(201).json({ status: 'success', data: subscription });
    }
    catch (error) {
        res.status(500).json({ status: 'error', message: 'Failed to create subscription' });
    }
};
exports.createSubscription = createSubscription;
const getSubscriptions = async (req, res) => {
    try {
        // Auto-expire subscriptions whose endDate has passed
        const today = new Date();
        await app_1.prisma.subscription.updateMany({
            where: {
                status: 'ACTIVE',
                endDate: { lt: today }
            },
            data: { status: 'EXPIRED' }
        });
        const subscriptions = await app_1.prisma.subscription.findMany({
            include: { plan: true, member: { include: { user: true } } }
        });
        res.json({ status: 'success', data: subscriptions });
    }
    catch (error) {
        res.status(500).json({ status: 'error', message: 'Failed to fetch subscriptions' });
    }
};
exports.getSubscriptions = getSubscriptions;
const getPaymentStats = async (req, res) => {
    try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
        // Today's Collection (Only Paid)
        const todaysSubs = await app_1.prisma.subscription.findMany({
            where: { createdAt: { gte: today }, paymentStatus: 'PAID' },
            include: { plan: true }
        });
        const todaysCollection = todaysSubs.reduce((acc, sub) => acc + (sub.plan?.price || 0), 0);
        // This Month Collection (Only Paid)
        const monthSubs = await app_1.prisma.subscription.findMany({
            where: { createdAt: { gte: firstDayOfMonth }, paymentStatus: 'PAID' },
            include: { plan: true }
        });
        const thisMonth = monthSubs.reduce((acc, sub) => acc + (sub.plan?.price || 0), 0);
        // Total Records
        const totalRecords = await app_1.prisma.subscription.count();
        res.json({
            status: 'success',
            data: { todaysCollection, thisMonth, totalRecords }
        });
    }
    catch (error) {
        res.status(500).json({ status: 'error', message: 'Failed to fetch payment stats' });
    }
};
exports.getPaymentStats = getPaymentStats;
const updateSubscription = async (req, res) => {
    try {
        const { id } = req.params;
        const { planId, startDate, status, paymentStatus } = req.body;
        const subscription = await app_1.prisma.subscription.findUnique({ where: { id } });
        if (!subscription)
            return res.status(404).json({ status: 'error', message: 'Subscription not found' });
        let endDate = subscription.endDate;
        if (planId || startDate) {
            const plan = await app_1.prisma.membershipPlan.findUnique({ where: { id: planId || subscription.planId } });
            if (plan) {
                const start = new Date(startDate || subscription.startDate);
                endDate = new Date(start);
                endDate.setDate(endDate.getDate() + plan.durationDays);
            }
        }
        const updatedSub = await app_1.prisma.subscription.update({
            where: { id },
            data: {
                ...(planId && { planId }),
                ...(startDate && { startDate: new Date(startDate) }),
                ...(startDate || planId ? { endDate } : {}),
                ...(status && { status }),
                ...(paymentStatus && { paymentStatus }),
            }
        });
        res.json({ status: 'success', data: updatedSub });
    }
    catch (error) {
        res.status(500).json({ status: 'error', message: 'Failed to update subscription' });
    }
};
exports.updateSubscription = updateSubscription;
const deleteSubscription = async (req, res) => {
    try {
        const { id } = req.params;
        await app_1.prisma.subscription.delete({ where: { id } });
        res.json({ status: 'success', message: 'Subscription deleted successfully' });
    }
    catch (error) {
        res.status(500).json({ status: 'error', message: 'Failed to delete subscription' });
    }
};
exports.deleteSubscription = deleteSubscription;
//# sourceMappingURL=subscription.controller.js.map