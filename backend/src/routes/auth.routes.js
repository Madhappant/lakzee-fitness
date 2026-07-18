"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_controller_1 = require("../controllers/auth.controller");
const router = (0, express_1.Router)();
router.post('/register', auth_controller_1.register);
router.post('/login', auth_controller_1.login);
router.post('/request-otp', auth_controller_1.requestOtp);
router.post('/reset-password', auth_controller_1.resetPassword);
router.post('/request-phone-otp', auth_controller_1.requestPhoneOtp);
router.post('/verify-phone', auth_controller_1.verifyPhoneOtp);
exports.default = router;
//# sourceMappingURL=auth.routes.js.map