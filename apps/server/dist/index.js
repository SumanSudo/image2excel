"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const ocr_1 = require("./routes/ocr");
const app = (0, express_1.default)();
const PORT = process.env.PORT || 3001;
// CORS setup
app.use((0, cors_1.default)({
    origin: '*', // Allow all origins for offline/local environment
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
// Payload size limit configured for large JSON states
app.use(express_1.default.json({ limit: '50mb' }));
app.use(express_1.default.urlencoded({ limit: '50mb', extended: true }));
// Log middleware
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    next();
});
// Route registration
// Map '/api/v1/ocr/upload' and '/api/v1/ocr/process'
app.use('/api/v1/ocr', ocr_1.ocrRouter);
// Map '/api/v1/excel/export'
app.use('/api/v1/excel', ocr_1.ocrRouter);
// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ status: 'healthy', service: 'express-orchestrator' });
});
// Start listening
app.listen(PORT, () => {
    console.log(`Express orchestrator running on port ${PORT}`);
    console.log(`Shared storage directory is located at: ${process.env.SHARED_STORAGE_DIR || 'default local path'}`);
});
