"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateMember = exports.deleteMember = exports.getMemberById = exports.getMembers = exports.createMember = void 0;
const express_1 = require("express");
const app_1 = require("../app");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const createMember = async (req, res) => {
    try {
        const { email, password, firstName, lastName, phone, ...profileData } = req.body;
        // Check if user exists
        const existingUser = await app_1.prisma.user.findUnique({ where: { email } });
        if (existingUser) {
            return res.status(400).json({ status: 'error', message: 'Email already exists' });
        }
        const hashedPassword = await bcryptjs_1.default.hash(password, 10);
        const memberId = `LZ-${Math.floor(1000 + Math.random() * 9000)}`;
        const newMember = await app_1.prisma.user.create({
            data: {
                email,
                password: hashedPassword,
                firstName,
                lastName,
                phone,
                role: 'MEMBER',
                memberProfile: {
                    create: {
                        memberId,
                        ...profileData,
                        dob: profileData.dob ? new Date(profileData.dob) : undefined
                    }
                }
            },
            include: {
                memberProfile: true
            }
        });
        res.status(201).json({ status: 'success', data: newMember });
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ status: 'error', message: 'Failed to create member' });
    }
};
exports.createMember = createMember;
const getMembers = async (req, res) => {
    try {
        const members = await app_1.prisma.user.findMany({
            where: { role: 'MEMBER' },
            include: { memberProfile: true }
        });
        res.json({ status: 'success', data: members });
    }
    catch (error) {
        res.status(500).json({ status: 'error', message: 'Failed to fetch members' });
    }
};
exports.getMembers = getMembers;
const getMemberById = async (req, res) => {
    try {
        const { id } = req.params;
        const member = await app_1.prisma.user.findUnique({
            where: { id },
            include: { memberProfile: true, assignedMembers: true }
        });
        if (!member) {
            return res.status(404).json({ status: 'error', message: 'Member not found' });
        }
        res.json({ status: 'success', data: member });
    }
    catch (error) {
        res.status(500).json({ status: 'error', message: 'Failed to fetch member' });
    }
};
exports.getMemberById = getMemberById;
const deleteMember = async (req, res) => {
    try {
        const { id } = req.params;
        // User deletion will cascade and delete the MemberProfile due to the schema relation
        await app_1.prisma.user.delete({
            where: { id }
        });
        res.json({ status: 'success', message: 'Member deleted successfully' });
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ status: 'error', message: 'Failed to delete member' });
    }
};
exports.deleteMember = deleteMember;
const updateMember = async (req, res) => {
    try {
        const { id } = req.params;
        const { firstName, lastName, phone, ...profileData } = req.body;
        // Check if user exists
        const existingUser = await app_1.prisma.user.findUnique({
            where: { id },
            include: { memberProfile: true }
        });
        if (!existingUser) {
            return res.status(404).json({ status: 'error', message: 'Member not found' });
        }
        const updatedMember = await app_1.prisma.user.update({
            where: { id },
            data: {
                firstName,
                lastName,
                phone,
                memberProfile: {
                    update: {
                        ...profileData,
                        dob: profileData.dob ? new Date(profileData.dob) : undefined
                    }
                }
            },
            include: {
                memberProfile: true
            }
        });
        res.json({ status: 'success', data: updatedMember });
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ status: 'error', message: 'Failed to update member' });
    }
};
exports.updateMember = updateMember;
//# sourceMappingURL=member.controller.js.map