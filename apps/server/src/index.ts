import express from 'express';
import cors from 'cors';
import { ocrRouter } from './routes/ocr';

const app = express();
const PORT = process.env.PORT || 3001;

// CORS setup
app.use(cors({
  origin: '*', // Allow all origins for offline/local environment
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Payload size limit configured for large JSON states
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Log middleware
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// Route registration
// Map '/api/v1/ocr/upload' and '/api/v1/ocr/process'
app.use('/api/v1/ocr', ocrRouter);
// Map '/api/v1/excel/export'
app.use('/api/v1/excel', ocrRouter);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', service: 'express-orchestrator' });
});

// Start listening
app.listen(PORT, () => {
  console.log(`Express orchestrator running on port ${PORT}`);
  console.log(`Shared storage directory is located at: ${process.env.SHARED_STORAGE_DIR || 'default local path'}`);
});
