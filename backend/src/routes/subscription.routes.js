"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const subscription_controller_1 = require("../controllers/subscription.controller");
const auth_middleware_1 = require("../middlewares/auth.middleware");
const router = (0, express_1.Router)();
router.use(auth_middleware_1.authenticate);
router.post('/', (0, auth_middleware_1.authorize)('ADMIN', 'RECEPTIONIST'), subscription_controller_1.createSubscription);
router.get('/', (0, auth_middleware_1.authorize)('ADMIN', 'RECEPTIONIST'), subscription_controller_1.getSubscriptions);
router.get('/stats', (0, auth_middleware_1.authorize)('ADMIN', 'RECEPTIONIST'), subscription_controller_1.getPaymentStats);
router.put('/:id', (0, auth_middleware_1.authorize)('ADMIN', 'RECEPTIONIST'), subscription_controller_1.updateSubscription);
router.delete('/:id', (0, auth_middleware_1.authorize)('ADMIN', 'RECEPTIONIST'), subscription_controller_1.deleteSubscription);
exports.default = router;
//# sourceMappingURL=subscription.routes.js.map