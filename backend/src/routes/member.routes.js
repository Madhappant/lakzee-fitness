"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const member_controller_1 = require("../controllers/member.controller");
const auth_middleware_1 = require("../middlewares/auth.middleware");
const router = (0, express_1.Router)();
router.use(auth_middleware_1.authenticate);
router.post('/', (0, auth_middleware_1.authorize)('ADMIN', 'RECEPTIONIST'), member_controller_1.createMember);
router.get('/', (0, auth_middleware_1.authorize)('ADMIN', 'RECEPTIONIST', 'TRAINER'), member_controller_1.getMembers);
router.get('/:id', (0, auth_middleware_1.authorize)('ADMIN', 'RECEPTIONIST', 'TRAINER', 'MEMBER'), member_controller_1.getMemberById);
router.put('/:id', (0, auth_middleware_1.authorize)('ADMIN', 'RECEPTIONIST'), member_controller_1.updateMember);
router.delete('/:id', (0, auth_middleware_1.authorize)('ADMIN'), member_controller_1.deleteMember);
exports.default = router;
//# sourceMappingURL=member.routes.js.map