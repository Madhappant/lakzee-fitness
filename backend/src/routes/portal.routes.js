"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const portal_controller_1 = require("../controllers/portal.controller");
const auth_middleware_1 = require("../middlewares/auth.middleware");
const upload_middleware_1 = require("../middlewares/upload.middleware");
const router = (0, express_1.Router)();
// All portal routes require the user to be authenticated and have the MEMBER role
router.use(auth_middleware_1.authenticate);
router.use((0, auth_middleware_1.authorize)('MEMBER'));
router.get('/me', portal_controller_1.getMyProfile);
router.get('/attendance', portal_controller_1.getMyAttendance);
router.get('/subscriptions', portal_controller_1.getMySubscriptions);
router.post('/photo', upload_middleware_1.upload.single('photo'), portal_controller_1.uploadPhoto);
router.get('/diet', portal_controller_1.getMyDietPlan);
router.get('/workout', portal_controller_1.getMyWorkoutRoutine);
exports.default = router;
//# sourceMappingURL=portal.routes.js.map