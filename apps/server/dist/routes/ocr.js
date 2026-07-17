"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ocrRouter = void 0;
const express_1 = require("express");
const multer_1 = __importDefault(require("multer"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const uuid_1 = require("uuid");
const axios_1 = __importDefault(require("axios"));
const zod_1 = require("zod");
const excel_service_1 = require("../services/excel_service");
exports.ocrRouter = (0, express_1.Router)();
// Configure dynamic shared storage path
const SHARED_STORAGE_DIR = process.env.SHARED_STORAGE_DIR ||
    path_1.default.resolve(__dirname, '../../../../shared/storage/tmp');
// Ensure storage directory exists
if (!fs_1.default.existsSync(SHARED_STORAGE_DIR)) {
    fs_1.default.mkdirSync(SHARED_STORAGE_DIR, { recursive: true });
}
// In-memory mapping of fileId to filename
const fileMap = new Map();
// Configure Multer storage
const storage = multer_1.default.diskStorage({
    destination: (req, file, cb) => {
        cb(null, SHARED_STORAGE_DIR);
    },
    filename: (req, file, cb) => {
        const fileId = (0, uuid_1.v4)();
        // Save file prefixed with fileId to keep it unique
        const filename = `${fileId}_${file.originalname}`;
        // Store in mapping
        fileMap.set(fileId, { filename, mimeType: file.mimetype });
        // Attach fileId to request object for use in router
        req.uploadedFileId = fileId;
        cb(null, filename);
    }
});
const upload = (0, multer_1.default)({
    storage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB max
    fileFilter: (req, file, cb) => {
        const allowedTypes = /jpeg|jpg|png|webp/;
        const extName = allowedTypes.test(path_1.default.extname(file.originalname).toLowerCase());
        const mimeType = allowedTypes.test(file.mimetype);
        if (extName && mimeType) {
            cb(null, true);
        }
        else {
            cb(new Error('Only images (.png, .jpg, .jpeg, .webp) are allowed.'));
        }
    }
});
// 1. Ingestion Request
// POST /api/v1/ocr/upload
exports.ocrRouter.post('/upload', upload.single('file'), (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, message: 'No file uploaded.' });
        }
        const fileId = req.uploadedFileId;
        return res.status(201).json({
            success: true,
            message: 'File written locally.',
            data: {
                fileId: fileId,
                filename: req.file.originalname,
                mimeType: req.file.mimetype
            }
        });
    }
    catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
});
// Validate process request
const processSchema = zod_1.z.object({
    fileId: zod_1.z.string(),
    options: zod_1.z.object({
        deskew: zod_1.z.boolean().default(true),
        highContrast: zod_1.z.boolean().default(false)
    }).optional()
});
// 2. Processing Handshake
// POST /api/v1/ocr/process
exports.ocrRouter.post('/process', async (req, res) => {
    try {
        const parsed = processSchema.safeParse(req.body);
        if (!parsed.success) {
            return res.status(400).json({ success: false, errors: parsed.error.format() });
        }
        const { fileId, options } = parsed.data;
        // Resolve filename from memory or disk search
        let targetFile = fileMap.get(fileId);
        let filename = targetFile?.filename;
        if (!filename) {
            // Fallback: search directory for matching fileId
            const files = fs_1.default.readdirSync(SHARED_STORAGE_DIR);
            const matchedFile = files.find(f => f.startsWith(`${fileId}_`));
            if (matchedFile) {
                filename = matchedFile;
                fileMap.set(fileId, { filename, mimeType: 'image/png' }); // fallback mime
            }
        }
        if (!filename) {
            return res.status(404).json({ success: false, message: 'Uploaded file not found.' });
        }
        // Call downstream Python FastAPI OCR engine
        const PYTHON_SERVICE_URL = process.env.PYTHON_SERVICE_URL || 'http://127.0.0.1:8000';
        console.log(`Forwarding OCR process request for ${filename} to ${PYTHON_SERVICE_URL}`);
        const ocrResponse = await axios_1.default.post(`${PYTHON_SERVICE_URL}/api/v1/ocr/process`, {
            filename,
            options
        });
        return res.status(200).json({
            success: true,
            matrix: ocrResponse.data.matrix
        });
    }
    catch (error) {
        console.error('Error forwarding process request to OCR service:', error.message);
        const errorMsg = error.response?.data?.detail || error.message;
        return res.status(500).json({ success: false, message: `OCR engine error: ${errorMsg}` });
    }
});
// 3. Binary Compilation / Excel Export
// POST /api/v1/excel/export
exports.ocrRouter.post('/export', async (req, res) => {
    try {
        const matrix = req.body;
        if (!matrix || !Array.isArray(matrix)) {
            return res.status(400).json({ success: false, message: 'Invalid payload: Matrix is required.' });
        }
        const buffer = await (0, excel_service_1.generateExcel)(matrix);
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename="extracted_table.xlsx"');
        return res.send(buffer);
    }
    catch (error) {
        console.error('Excel generation error:', error);
        return res.status(500).json({ success: false, message: `Failed to compile Excel: ${error.message}` });
    }
});
