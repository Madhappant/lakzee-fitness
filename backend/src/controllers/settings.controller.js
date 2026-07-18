"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateSettings = exports.getSettings = void 0;
const express_1 = require("express");
const app_1 = require("../app");
const getSettings = async (req, res) => {
    try {
        let settings = await app_1.prisma.settings.findUnique({ where: { id: "1" } });
        if (!settings) {
            settings = await app_1.prisma.settings.create({ data: { id: "1", gymName: "Lakzee Fitness Studio" } });
        }
        res.json({ status: 'success', data: settings });
    }
    catch (error) {
        res.status(500).json({ status: 'error', message: 'Failed to fetch settings' });
    }
};
exports.getSettings = getSettings;
const updateSettings = async (req, res) => {
    try {
        const updated = await app_1.prisma.settings.upsert({
            where: { id: "1" },
            update: req.body,
            create: { id: "1", ...req.body }
        });
        res.json({ status: 'success', data: updated });
    }
    catch (error) {
        res.status(500).json({ status: 'error', message: 'Failed to update settings' });
    }
};
exports.updateSettings = updateSettings;
//# sourceMappingURL=settings.controller.js.map