import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import axios from 'axios';
import { z } from 'zod';
import { generateExcel } from '../services/excel_service';

export const ocrRouter = Router();

// Configure dynamic shared storage path
const SHARED_STORAGE_DIR = process.env.SHARED_STORAGE_DIR || 
  path.resolve(__dirname, '../../../../shared/storage/tmp');

// Ensure storage directory exists
if (!fs.existsSync(SHARED_STORAGE_DIR)) {
  fs.mkdirSync(SHARED_STORAGE_DIR, { recursive: true });
}

// In-memory mapping of fileId to filename
const fileMap = new Map<string, { filename: string; mimeType: string }>();

// Configure Multer storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, SHARED_STORAGE_DIR);
  },
  filename: (req, file, cb) => {
    const fileId = uuidv4();
    // Save file prefixed with fileId to keep it unique
    const filename = `${fileId}_${file.originalname}`;
    // Store in mapping
    fileMap.set(fileId, { filename, mimeType: file.mimetype });
    // Attach fileId to request object for use in router
    (req as any).uploadedFileId = fileId;
    cb(null, filename);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB max
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|webp/;
    const extName = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimeType = allowedTypes.test(file.mimetype);
    if (extName && mimeType) {
      cb(null, true);
    } else {
      cb(new Error('Only images (.png, .jpg, .jpeg, .webp) are allowed.'));
    }
  }
});

// 1. Ingestion Request
// POST /api/v1/ocr/upload
ocrRouter.post('/upload', upload.single('file'), (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded.' });
    }
    
    const fileId = (req as any).uploadedFileId;
    
    return res.status(201).json({
      success: true,
      message: 'File written locally.',
      data: {
        fileId: fileId,
        filename: req.file.originalname,
        mimeType: req.file.mimetype
      }
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// Validate process request
const processSchema = z.object({
  fileId: z.string(),
  options: z.object({
    deskew: z.boolean().default(true),
    highContrast: z.boolean().default(false)
  }).optional()
});

// 2. Processing Handshake
// POST /api/v1/ocr/process
ocrRouter.post('/process', async (req: Request, res: Response) => {
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
      const files = fs.readdirSync(SHARED_STORAGE_DIR);
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
    
    const ocrResponse = await axios.post(`${PYTHON_SERVICE_URL}/api/v1/ocr/process`, {
      filename,
      options
    });
    
    return res.status(200).json({
      success: true,
      matrix: ocrResponse.data.matrix
    });
  } catch (error: any) {
    console.error('Error forwarding process request to OCR service:', error.message);
    const errorMsg = error.response?.data?.detail || error.message;
    return res.status(500).json({ success: false, message: `OCR engine error: ${errorMsg}` });
  }
});

// 3. Binary Compilation / Excel Export
// POST /api/v1/excel/export
ocrRouter.post('/export', async (req: Request, res: Response) => {
  try {
    const matrix = req.body;
    if (!matrix || !Array.isArray(matrix)) {
      return res.status(400).json({ success: false, message: 'Invalid payload: Matrix is required.' });
    }
    
    const buffer = await generateExcel(matrix);
    
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="extracted_table.xlsx"');
    return res.send(buffer);
  } catch (error: any) {
    console.error('Excel generation error:', error);
    return res.status(500).json({ success: false, message: `Failed to compile Excel: ${error.message}` });
  }
});
