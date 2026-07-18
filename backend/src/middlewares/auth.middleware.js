"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.authorize = exports.authenticate = void 0;
const express_1 = require("express");
const jwt_1 = require("../utils/jwt");
const app_1 = require("../app");
const authenticate = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ status: 'error', message: 'Unauthorized, no token' });
        }
        const token = authHeader.split(' ')[1];
        const decoded = (0, jwt_1.verifyToken)(token);
        // Verify user still exists
        const user = await app_1.prisma.user.findUnique({ where: { id: decoded.id } });
        if (!user) {
            return res.status(401).json({ status: 'error', message: 'Unauthorized, invalid token' });
        }
        req.user = decoded;
        next();
    }
    catch (error) {
        res.status(401).json({ status: 'error', message: 'Unauthorized, invalid token' });
    }
};
exports.authenticate = authenticate;
const authorize = (...roles) => {
    return (req, res, next) => {
        if (!req.user || !roles.includes(req.user.role)) {
            return res.status(403).json({ status: 'error', message: 'Forbidden, insufficient permissions' });
        }
        next();
    };
};
exports.authorize = authorize;
//# sourceMappingURL=auth.middleware.js.map