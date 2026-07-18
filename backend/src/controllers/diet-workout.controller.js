"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getMemberWorkoutRoutine = exports.assignWorkoutRoutine = exports.getMemberDietPlan = exports.assignDietPlan = void 0;
const express_1 = require("express");
const app_1 = require("../app");
const assignDietPlan = async (req, res) => {
    try {
        const { memberId } = req.params;
        const { title, notes, mealsData } = req.body;
        const assignedBy = req.user?.id;
        // We can archive old active plans by marking them inactive
        await app_1.prisma.dietPlan.updateMany({
            where: { memberId, isActive: true },
            data: { isActive: false }
        });
        const newDietPlan = await app_1.prisma.dietPlan.create({
            data: {
                memberId,
                title,
                notes,
                mealsData: JSON.stringify(mealsData),
                assignedBy,
            }
        });
        res.status(201).json({ status: 'success', data: newDietPlan });
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ status: 'error', message: 'Failed to assign diet plan' });
    }
};
exports.assignDietPlan = assignDietPlan;
const getMemberDietPlan = async (req, res) => {
    try {
        const { memberId } = req.params;
        const activeDietPlan = await app_1.prisma.dietPlan.findFirst({
            where: { memberId, isActive: true },
            orderBy: { createdAt: 'desc' }
        });
        res.json({ status: 'success', data: activeDietPlan });
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ status: 'error', message: 'Failed to fetch diet plan' });
    }
};
exports.getMemberDietPlan = getMemberDietPlan;
const assignWorkoutRoutine = async (req, res) => {
    try {
        const { memberId } = req.params;
        const { title, notes, exercisesData } = req.body;
        const assignedBy = req.user?.id;
        await app_1.prisma.workoutRoutine.updateMany({
            where: { memberId, isActive: true },
            data: { isActive: false }
        });
        const newRoutine = await app_1.prisma.workoutRoutine.create({
            data: {
                memberId,
                title,
                notes,
                exercisesData: JSON.stringify(exercisesData),
                assignedBy,
            }
        });
        res.status(201).json({ status: 'success', data: newRoutine });
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ status: 'error', message: 'Failed to assign workout routine' });
    }
};
exports.assignWorkoutRoutine = assignWorkoutRoutine;
const getMemberWorkoutRoutine = async (req, res) => {
    try {
        const { memberId } = req.params;
        const activeRoutine = await app_1.prisma.workoutRoutine.findFirst({
            where: { memberId, isActive: true },
            orderBy: { createdAt: 'desc' }
        });
        res.json({ status: 'success', data: activeRoutine });
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ status: 'error', message: 'Failed to fetch workout routine' });
    }
};
exports.getMemberWorkoutRoutine = getMemberWorkoutRoutine;
//# sourceMappingURL=diet-workout.controller.js.map