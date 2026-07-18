"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const diet_workout_controller_1 = require("../controllers/diet-workout.controller");
const auth_middleware_1 = require("../middlewares/auth.middleware");
const router = (0, express_1.Router)();
// Routes for ADMIN to assign plans to a specific member
router.post('/diet/:memberId', auth_middleware_1.authenticate, (0, auth_middleware_1.authorize)(['ADMIN', 'TRAINER']), diet_workout_controller_1.assignDietPlan);
router.get('/diet/:memberId', auth_middleware_1.authenticate, (0, auth_middleware_1.authorize)(['ADMIN', 'TRAINER', 'MEMBER']), diet_workout_controller_1.getMemberDietPlan);
router.post('/workout/:memberId', auth_middleware_1.authenticate, (0, auth_middleware_1.authorize)(['ADMIN', 'TRAINER']), diet_workout_controller_1.assignWorkoutRoutine);
router.get('/workout/:memberId', auth_middleware_1.authenticate, (0, auth_middleware_1.authorize)(['ADMIN', 'TRAINER', 'MEMBER']), diet_workout_controller_1.getMemberWorkoutRoutine);
exports.default = router;
//# sourceMappingURL=diet-workout.routes.js.map