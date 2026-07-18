"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const attendance_controller_1 = require("../controllers/attendance.controller");
const auth_middleware_1 = require("../middlewares/auth.middleware");
const router = (0, express_1.Router)();
router.use(auth_middleware_1.authenticate);
router.post('/checkin', (0, auth_middleware_1.authorize)('ADMIN', 'RECEPTIONIST'), attendance_controller_1.checkIn);
router.get('/', (0, auth_middleware_1.authorize)('ADMIN', 'RECEPTIONIST', 'TRAINER'), attendance_controller_1.getTodayAttendance);
exports.default = router;
//# sourceMappingURL=attendance.routes.js.map