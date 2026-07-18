"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const plan_controller_1 = require("../controllers/plan.controller");
const auth_middleware_1 = require("../middlewares/auth.middleware");
const router = (0, express_1.Router)();
router.get('/', plan_controller_1.getPlans); // Publicly accessible to see plans
router.use(auth_middleware_1.authenticate);
router.post('/', (0, auth_middleware_1.authorize)('ADMIN'), plan_controller_1.createPlan);
router.put('/:id', (0, auth_middleware_1.authorize)('ADMIN'), plan_controller_1.updatePlan);
router.delete('/:id', (0, auth_middleware_1.authorize)('ADMIN'), plan_controller_1.deletePlan);
exports.default = router;
//# sourceMappingURL=plan.routes.js.map