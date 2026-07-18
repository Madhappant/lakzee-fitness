"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const staff_controller_1 = require("../controllers/staff.controller");
const auth_middleware_1 = require("../middlewares/auth.middleware");
const router = (0, express_1.Router)();
router.use(auth_middleware_1.authenticate);
router.use((0, auth_middleware_1.authorize)('ADMIN')); // Only Admins can manage staff roles
router.get('/', staff_controller_1.getStaff);
router.post('/assign', staff_controller_1.assignRole);
router.post('/:id/revoke', staff_controller_1.revokeRole);
exports.default = router;
//# sourceMappingURL=staff.routes.js.map