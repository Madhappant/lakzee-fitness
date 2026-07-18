"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const settings_controller_1 = require("../controllers/settings.controller");
const auth_middleware_1 = require("../middlewares/auth.middleware");
const router = (0, express_1.Router)();
router.get('/', settings_controller_1.getSettings); // Public so frontend can fetch gym name
router.use(auth_middleware_1.authenticate);
router.put('/', (0, auth_middleware_1.authorize)('ADMIN'), settings_controller_1.updateSettings);
exports.default = router;
//# sourceMappingURL=settings.routes.js.map