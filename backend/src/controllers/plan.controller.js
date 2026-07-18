"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deletePlan = exports.updatePlan = exports.getPlans = exports.createPlan = void 0;
const express_1 = require("express");
const app_1 = require("../app");
const createPlan = async (req, res) => {
    try {
        const plan = await app_1.prisma.membershipPlan.create({ data: req.body });
        res.status(201).json({ status: 'success', data: plan });
    }
    catch (error) {
        res.status(500).json({ status: 'error', message: 'Failed to create plan' });
    }
};
exports.createPlan = createPlan;
const getPlans = async (req, res) => {
    try {
        const plans = await app_1.prisma.membershipPlan.findMany({ where: { isActive: true } });
        res.json({ status: 'success', data: plans });
    }
    catch (error) {
        res.status(500).json({ status: 'error', message: 'Failed to fetch plans' });
    }
};
exports.getPlans = getPlans;
const updatePlan = async (req, res) => {
    try {
        const { id } = req.params;
        const plan = await app_1.prisma.membershipPlan.update({
            where: { id },
            data: req.body
        });
        res.json({ status: 'success', data: plan });
    }
    catch (error) {
        res.status(500).json({ status: 'error', message: 'Failed to update plan' });
    }
};
exports.updatePlan = updatePlan;
const deletePlan = async (req, res) => {
    try {
        const { id } = req.params;
        await app_1.prisma.membershipPlan.delete({ where: { id } });
        res.json({ status: 'success', message: 'Plan deleted successfully' });
    }
    catch (error) {
        res.status(500).json({ status: 'error', message: 'Failed to delete plan' });
    }
};
exports.deletePlan = deletePlan;
//# sourceMappingURL=plan.controller.js.map