"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.prisma = void 0;
const express_1 = __importStar(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const morgan_1 = __importDefault(require("morgan"));
const client_1 = require("@prisma/client");
const app = (0, express_1.default)();
exports.prisma = new client_1.PrismaClient();
// Middlewares
app.use((0, cors_1.default)({ origin: process.env.CLIENT_URL || '*' }));
app.use((0, helmet_1.default)({ crossOriginResourcePolicy: false }));
app.use((0, morgan_1.default)('dev'));
app.use(express_1.default.json());
app.use(express_1.default.urlencoded({ extended: true }));
const path_1 = __importDefault(require("path"));
app.use('/uploads', express_1.default.static(path_1.default.join(__dirname, '../uploads')));
const auth_routes_1 = __importDefault(require("./routes/auth.routes"));
const member_routes_1 = __importDefault(require("./routes/member.routes"));
const plan_routes_1 = __importDefault(require("./routes/plan.routes"));
const subscription_routes_1 = __importDefault(require("./routes/subscription.routes"));
// Basic Health Check Route
app.get('/health', (req, res) => {
    res.status(200).json({ status: 'success', message: 'Lakzee Fitness API is running' });
});
const swagger_ui_express_1 = __importDefault(require("swagger-ui-express"));
const swagger_json_1 = __importDefault(require("./swagger.json"));
const attendance_routes_1 = __importDefault(require("./routes/attendance.routes"));
const settings_routes_1 = __importDefault(require("./routes/settings.routes"));
const dashboard_routes_1 = __importDefault(require("./routes/dashboard.routes"));
const staff_routes_1 = __importDefault(require("./routes/staff.routes"));
const reports_routes_1 = __importDefault(require("./routes/reports.routes"));
const portal_routes_1 = __importDefault(require("./routes/portal.routes"));
const diet_workout_routes_1 = __importDefault(require("./routes/diet-workout.routes"));
const notification_routes_1 = __importDefault(require("./routes/notification.routes"));
app.use('/api-docs', swagger_ui_express_1.default.serve, swagger_ui_express_1.default.setup(swagger_json_1.default));
// Routes
app.use('/api/auth', auth_routes_1.default);
app.use('/api/members', member_routes_1.default);
app.use('/api/plans', plan_routes_1.default);
app.use('/api/subscriptions', subscription_routes_1.default);
app.use('/api/attendance', attendance_routes_1.default);
app.use('/api/settings', settings_routes_1.default);
app.use('/api/dashboard', dashboard_routes_1.default);
app.use('/api/staff', staff_routes_1.default);
app.use('/api/reports', reports_routes_1.default);
app.use('/api/portal', portal_routes_1.default);
app.use('/api/plans-routines', diet_workout_routes_1.default);
app.use('/api/notifications', notification_routes_1.default);
// Global Error Handler
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(err.status || 500).json({
        status: 'error',
        message: err.message || 'Internal Server Error',
        ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
    });
});
exports.default = app;
//# sourceMappingURL=app.js.map