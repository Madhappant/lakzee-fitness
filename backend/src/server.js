"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const app_1 = __importDefault(require("./app"));
const app_2 = require("./app");
const PORT = process.env.PORT || 5000;
async function bootstrap() {
    try {
        // Test database connection
        await app_2.prisma.$connect();
        console.log('📦 Connected to Database');
        app_1.default.listen(PORT, () => {
            console.log(`🚀 Server is running on port ${PORT}`);
            console.log(`⚙️  Environment: ${process.env.NODE_ENV}`);
        });
    }
    catch (error) {
        console.error('❌ Failed to start server:', error);
        await app_2.prisma.$disconnect();
        process.exit(1);
    }
}
bootstrap();
//# sourceMappingURL=server.js.map