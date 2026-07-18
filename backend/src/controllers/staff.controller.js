"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.revokeRole = exports.assignRole = exports.getStaff = void 0;
const express_1 = require("express");
const app_1 = require("../app");
const getStaff = async (req, res) => {
    try {
        const users = await app_1.prisma.user.findMany({
            where: {
                role: { in: ['ADMIN', 'RECEPTIONIST', 'TRAINER'] }
            },
            select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                role: true,
                createdAt: true
            },
            orderBy: { createdAt: 'desc' }
        });
        res.json({ status: 'success', data: users });
    }
    catch (error) {
        res.status(500).json({ status: 'error', message: 'Failed to fetch staff' });
    }
};
exports.getStaff = getStaff;
const assignRole = async (req, res) => {
    try {
        const { userId, role } = req.body;
        const user = await app_1.prisma.user.findUnique({ where: { id: userId } });
        if (!user) {
            return res.status(404).json({ status: 'error', message: 'User UUID not found' });
        }
        const updated = await app_1.prisma.user.update({
            where: { id: userId },
            data: { role: role.toUpperCase() }
        });
        res.json({ status: 'success', message: 'Role assigned successfully', data: updated });
    }
    catch (error) {
        res.status(500).json({ status: 'error', message: 'Failed to assign role' });
    }
};
exports.assignRole = assignRole;
const revokeRole = async (req, res) => {
    try {
        const { id } = req.params;
        // Prevent self-revocation for safety
        if (req.user?.id === id) {
            return res.status(400).json({ status: 'error', message: 'Cannot revoke your own admin role' });
        }
        const updated = await app_1.prisma.user.update({
            where: { id },
            data: { role: 'MEMBER' }
        });
        res.json({ status: 'success', message: 'Role revoked', data: updated });
    }
    catch (error) {
        res.status(500).json({ status: 'error', message: 'Failed to revoke role' });
    }
};
exports.revokeRole = revokeRole;
//# sourceMappingURL=staff.controller.js.map