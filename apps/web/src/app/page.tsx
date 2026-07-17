'use client';

import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { 
  FileText, 
  UploadCloud, 
  RefreshCw, 
  Download, 
  AlertTriangle, 
  CheckCircle2, 
  Settings2,
  Binary
} from 'lucide-react';
import { useSpreadsheetHistory, GridCell } from '../hooks/useSpreadsheetHistory';
import Spreadsheet from '../components/Spreadsheet';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [fileId, setFileId] = useState<string | null>(null);
  
  // OCR Options
  const [deskew, setDeskew] = useState(true);
  const [highContrast, setHighContrast] = useState(false);
  
  // Processing States
  const [isProcessing, setIsProcessing] = useState(false);
  const [processStep, setProcessStep] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  
  // Spreadsheet state mapping
  const {
    matrix,
    setMatrix,
    updateCell,
    addRow,
    deleteRow,
    addColumn,
    deleteColumn,
    undo,
    redo,
    canUndo,
    canRedo
  } = useSpreadsheetHistory([]);

  // Handle Drag & Drop
  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const droppedFile = acceptedFiles[0];
    if (!droppedFile) return;

    setFile(droppedFile);
    setError(null);
    setMatrix([]);
    setFileId(null);
    
    // Auto-trigger upload and process pipeline
    await uploadAndProcess(droppedFile);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.png', '.jpg', '.jpeg', '.webp']
    },
    maxFiles: 1,
    disabled: isProcessing
  });

  const uploadAndProcess = async (targetFile: File) => {
    setIsProcessing(true);
    setError(null);
    
    try {
      // Step 1: Upload Image to Express Server
      setProcessStep('Uploading document to server...');
      const formData = new FormData();
      formData.append('file', targetFile);

      const uploadRes = await fetch(`${API_BASE_URL}/ocr/upload`, {
        method: 'POST',
        body: formData
      });

      if (!uploadRes.ok) {
        const errorData = await uploadRes.json();
        throw new Error(errorData.message || 'File upload failed');
      }

      const uploadData = await uploadRes.json();
      const uploadedFileId = uploadData.data.fileId;
      setFileId(uploadedFileId);

      // Step 2: Trigger Engine Analysis Handshake
      setProcessStep('Triggering engine analysis...');
      const processRes = await fetch(`${API_BASE_URL}/ocr/process`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          fileId: uploadedFileId,
          options: {
            deskew,
            highContrast
          }
        })
      });

      if (!processRes.ok) {
        const errorData = await processRes.json();
        throw new Error(errorData.message || 'OCR parsing failed');
      }

      const processData = await processRes.json();
      setMatrix(processData.matrix);
      setProcessStep('Finished processing!');
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'An error occurred during extraction.');
    } finally {
      setIsProcessing(false);
      setProcessStep('');
    }
  };

  // Trigger reprocessing if options change
  const handleReprocess = async () => {
    if (!file) return;
    if (fileId) {
      // Re-trigger from existing fileId to save uploading again
      setIsProcessing(true);
      setError(null);
      setMatrix([]);
      
      try {
        setProcessStep('Rerunning OCR parsing with updated parameters...');
        const processRes = await fetch(`${API_BASE_URL}/ocr/process`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            fileId,
            options: {
              deskew,
              highContrast
            }
          })
        });

        if (!processRes.ok) {
          const errorData = await processRes.json();
          throw new Error(errorData.message || 'OCR parsing failed');
        }

        const processData = await processRes.json();
        setMatrix(processData.matrix);
      } catch (err: any) {
        setError(err.message || 'Reprocessing failed.');
      } finally {
        setIsProcessing(false);
        setProcessStep('');
      }
    } else {
      await uploadAndProcess(file);
    }
  };

  // Export current spreadsheet to Excel bin stream
  const handleExport = async () => {
    if (matrix.length === 0) return;
    
    try {
      const res = await fetch(`${API_BASE_URL}/excel/export`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(matrix)
      });

      if (!res.ok) {
        throw new Error('Excel compilation failed');
      }

      const blob = await res.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.setAttribute('download', `image2excel_${new Date().getTime()}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.parentNode?.removeChild(link);
    } catch (err: any) {
      alert(`Export error: ${err.message}`);
    }
  };

  // Reset uploader
  const handleReset = () => {
    setFile(null);
    setFileId(null);
    setMatrix([]);
    setError(null);
  };

  return (
    <main className="min-h-screen bg-[#09090b] text-[#f4f4f5] px-4 py-8 md:px-8">
      {/* Header and Branding */}
      <header className="max-w-6xl mx-auto mb-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-[#27272a]/60 pb-6">
        <div>
          <div className="flex items-center space-x-3 mb-1">
            <div className="p-2 rounded-xl bg-blue-600/10 border border-blue-500/30 text-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.1)]">
              <Binary size={24} />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-white">Image2Excel</h1>
          </div>
          <p className="text-[#a1a1aa] text-sm">
            Free, local-first OCR engine to convert images of tables into Excel spreadsheets.
          </p>
        </div>
        
        {matrix.length > 0 && (
          <div className="flex items-center space-x-3">
            <button
              onClick={handleReset}
              className="px-4 py-2 rounded-xl bg-[#18181b] border border-[#27272a] text-[#a1a1aa] hover:text-white hover:bg-zinc-800 transition text-sm font-medium"
            >
              Convert Another Image
            </button>
            <button
              onClick={handleExport}
              className="flex items-center space-x-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-medium shadow-lg shadow-blue-600/20 transition text-sm"
            >
              <Download size={16} />
              <span>Export to Excel</span>
            </button>
          </div>
        )}
      </header>

      {/* Main Workspace Layout */}
      <section className="max-w-6xl mx-auto">
        {matrix.length === 0 ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Uploader & Configuration panel */}
            <div className="lg:col-span-2 space-y-6">
              {/* Dropzone container */}
              <div 
                {...getRootProps()} 
                className={`
                  border-2 border-dashed rounded-3xl p-10 flex flex-col items-center justify-center min-h-[350px] transition cursor-pointer text-center bg-white/[0.01] backdrop-blur-md shadow-2xl
                  ${isDragActive ? 'border-blue-500 bg-blue-500/[0.02]' : 'border-[#27272a] hover:border-zinc-700'}
                  ${isProcessing ? 'pointer-events-none opacity-50' : ''}
                `}
              >
                <input {...getInputProps()} />
                
                {isProcessing ? (
                  <div className="flex flex-col items-center space-y-4">
                    <div className="p-4 rounded-full bg-blue-600/10 text-blue-500 animate-spin border border-dashed border-blue-500/40">
                      <RefreshCw size={36} />
                    </div>
                    <div className="space-y-1">
                      <h3 className="text-lg font-semibold text-white">Extracting Grid...</h3>
                      <p className="text-sm text-[#a1a1aa] font-mono">{processStep}</p>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center space-y-4">
                    <div className="p-4 rounded-full bg-zinc-900 border border-[#27272a] text-[#a1a1aa] group-hover:text-white transition">
                      <UploadCloud size={36} />
                    </div>
                    <div className="space-y-1">
                      <h3 className="text-lg font-semibold text-white">Drag & drop your table image</h3>
                      <p className="text-sm text-[#a1a1aa] max-w-sm">
                        Supports PNG, JPG, JPEG, and WEBP. Processing runs locally on your device.
                      </p>
                    </div>
                    <button className="px-5 py-2 rounded-xl bg-zinc-800 text-zinc-300 hover:bg-zinc-700 hover:text-white transition text-xs font-semibold">
                      Browse Files
                    </button>
                  </div>
                )}
              </div>

              {/* Error Callout */}
              {error && (
                <div className="p-4 rounded-2xl bg-red-950/20 border border-red-900/50 flex items-start space-x-3 text-red-400">
                  <AlertTriangle className="mt-0.5 shrink-0" size={18} />
                  <div className="space-y-1">
                    <h4 className="font-semibold text-sm">Parsing Failed</h4>
                    <p className="text-xs text-red-400/80">{error}</p>
                  </div>
                </div>
              )}
            </div>

            {/* Side Configuration Options */}
            <div className="p-6 rounded-3xl bg-[#18181b] border border-[#27272a] space-y-6">
              <div className="flex items-center space-x-2 border-b border-[#27272a] pb-4">
                <Settings2 size={16} className="text-[#a1a1aa]" />
                <h3 className="font-semibold text-sm text-white">OCR Engine Parameters</h3>
              </div>

              {/* Toggle Switches */}
              <div className="space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <label className="text-sm font-medium text-zinc-200 block">Deskew Image</label>
                    <p className="text-xs text-[#a1a1aa]">
                      Detect skew angle using Hough Lines and auto-rotate the table to horizontal.
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={deskew}
                    onChange={(e) => setDeskew(e.target.checked)}
                    disabled={isProcessing}
                    className="w-4 h-4 mt-1 rounded border-zinc-700 bg-zinc-800 text-blue-600 focus:ring-blue-500"
                  />
                </div>

                <div className="flex items-start justify-between gap-3 pt-2">
                  <div className="space-y-1">
                    <label className="text-sm font-medium text-zinc-200 block">Enhance Contrast</label>
                    <p className="text-xs text-[#a1a1aa]">
                      Apply Adaptive Gaussian thresholding to improve contrast on low-quality scans.
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={highContrast}
                    onChange={(e) => setHighContrast(e.target.checked)}
                    disabled={isProcessing}
                    className="w-4 h-4 mt-1 rounded border-zinc-700 bg-zinc-800 text-blue-600 focus:ring-blue-500"
                  />
                </div>
              </div>

              {file && !isProcessing && (
                <div className="border-t border-[#27272a] pt-4 mt-6">
                  <div className="p-3 bg-zinc-900/60 border border-zinc-800 rounded-2xl flex items-center space-x-3 mb-4">
                    <FileText size={24} className="text-blue-500" />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs text-[#a1a1aa] truncate">{file.name}</p>
                      <p className="text-[10px] text-zinc-500">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                    </div>
                  </div>
                  <button
                    onClick={handleReprocess}
                    className="w-full flex items-center justify-center space-x-2 py-2.5 rounded-xl bg-zinc-800 text-zinc-300 hover:bg-zinc-700 hover:text-white text-xs font-semibold transition"
                  >
                    <RefreshCw size={14} />
                    <span>Reprocess Image</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        ) : (
          /* Spreadsheet Display View */
          <div className="space-y-6">
            <div className="p-4 bg-zinc-900/40 border border-zinc-800/80 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center space-x-3">
                <div className="p-2 rounded-lg bg-green-500/10 text-green-500 border border-green-500/20">
                  <CheckCircle2 size={16} />
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-white">Extraction Successful</h4>
                  <p className="text-xs text-[#a1a1aa]">Review and edit cells before downloading.</p>
                </div>
              </div>
              
              <div className="text-xs text-zinc-500 bg-zinc-950 px-3 py-1.5 rounded-xl border border-zinc-800 font-mono">
                {file?.name}
              </div>
            </div>

            {/* Interactive Grid component */}
            <Spreadsheet
              matrix={matrix}
              updateCell={updateCell}
              addRow={addRow}
              deleteRow={deleteRow}
              addColumn={addColumn}
              deleteColumn={deleteColumn}
              undo={undo}
              redo={redo}
              canUndo={canUndo}
              canRedo={canRedo}
            />
          </div>
        )}
      </section>
    </main>
  );
}
