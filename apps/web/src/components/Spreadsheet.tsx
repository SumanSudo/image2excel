'use client';

import React, { useState, useEffect, useRef } from 'react';
import { GridCell } from '../hooks/useSpreadsheetHistory';
import { Trash2, Plus, CornerDownLeft, Undo2, Redo2 } from 'lucide-react';

interface SpreadsheetProps {
  matrix: GridCell[][];
  updateCell: (rowIdx: number, colIdx: number, text: string) => void;
  addRow: () => void;
  deleteRow: (rowIdx: number) => void;
  addColumn: () => void;
  deleteColumn: (colIdx: number) => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
}

export default function Spreadsheet({
  matrix,
  updateCell,
  addRow,
  deleteRow,
  addColumn,
  deleteColumn,
  undo,
  redo,
  canUndo,
  canRedo
}: SpreadsheetProps) {
  const [selectedCell, setSelectedCell] = useState<{ r: number; c: number } | null>(null);
  const [editingCell, setEditingCell] = useState<{ r: number; c: number } | null>(null);
  const [editValue, setEditValue] = useState<string>('');
  
  const gridRef = useRef<HTMLTableElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const numRows = matrix.length;
  const numCols = matrix[0]?.length || 0;

  // Auto-focus input when editing starts
  useEffect(() => {
    if (editingCell && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editingCell]);

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!selectedCell) return;
    
    const { r, c } = selectedCell;
    const isEditing = editingCell !== null;

    if (isEditing) {
      if (e.key === 'Enter') {
        e.preventDefault();
        commitEdit();
        // Move selection down
        if (r < numRows - 1) {
          setSelectedCell({ r: r + 1, c });
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        setEditingCell(null);
      } else if (e.key === 'Tab') {
        e.preventDefault();
        commitEdit();
        // Move selection right
        if (e.shiftKey) {
          if (c > 0) setSelectedCell({ r, c: c - 1 });
        } else {
          if (c < numCols - 1) setSelectedCell({ r, c: c + 1 });
        }
      }
      return;
    }

    // Key handlers for navigation mode (not editing)
    switch (e.key) {
      case 'ArrowUp':
        e.preventDefault();
        if (r > 0) setSelectedCell({ r: r - 1, c });
        break;
      case 'ArrowDown':
        e.preventDefault();
        if (r < numRows - 1) setSelectedCell({ r: r + 1, c });
        break;
      case 'ArrowLeft':
        e.preventDefault();
        if (c > 0) setSelectedCell({ r, c: c - 1 });
        break;
      case 'ArrowRight':
        e.preventDefault();
        if (c < numCols - 1) setSelectedCell({ r, c: c + 1 });
        break;
      case 'Enter':
        e.preventDefault();
        startEditing(r, c);
        break;
      case 'Tab':
        e.preventDefault();
        if (e.shiftKey) {
          if (c > 0) setSelectedCell({ r, c: c - 1 });
        } else {
          if (c < numCols - 1) setSelectedCell({ r, c: c + 1 });
        }
        break;
      case 'Backspace':
      case 'Delete':
        // Delete cell contents
        updateCell(r, c, '');
        break;
      default:
        // Handle direct typing to start editing
        if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
          startEditing(r, c, e.key);
        }
        break;
    }
  };

  const startEditing = (r: number, c: number, initialChar = '') => {
    setEditingCell({ r, c });
    setEditValue(initialChar || matrix[r][c]?.text || '');
  };

  const commitEdit = () => {
    if (!editingCell) return;
    updateCell(editingCell.r, editingCell.c, editValue);
    setEditingCell(null);
  };

  // Click outside to commit edit and close
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (editingCell && inputRef.current && !inputRef.current.contains(e.target as Node)) {
        commitEdit();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [editingCell, editValue]);

  if (numRows === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-12 border border-dashed border-zinc-800 rounded-2xl bg-white/[0.02] backdrop-blur-md">
        <p className="text-zinc-400">No data structure parsed yet. Drop an image to begin.</p>
      </div>
    );
  }

  return (
    <div className="w-full flex flex-col space-y-4">
      {/* Spreadsheet toolbar */}
      <div className="flex items-center justify-between bg-zinc-900/60 backdrop-blur-md p-3 border border-zinc-800 rounded-xl">
        <div className="flex items-center space-x-2">
          <button
            onClick={undo}
            disabled={!canUndo}
            className="p-2 rounded-lg bg-zinc-800 text-zinc-300 hover:bg-zinc-700 hover:text-white disabled:opacity-30 disabled:pointer-events-none transition"
            title="Undo (Ctrl+Z)"
          >
            <Undo2 size={16} />
          </button>
          <button
            onClick={redo}
            disabled={!canRedo}
            className="p-2 rounded-lg bg-zinc-800 text-zinc-300 hover:bg-zinc-700 hover:text-white disabled:opacity-30 disabled:pointer-events-none transition"
            title="Redo (Ctrl+Y)"
          >
            <Redo2 size={16} />
          </button>
          <div className="h-6 w-px bg-zinc-800 mx-1" />
          <button
            onClick={addRow}
            className="flex items-center space-x-1 px-3 py-1.5 rounded-lg bg-zinc-800 text-zinc-300 hover:bg-zinc-700 hover:text-white text-xs font-medium transition"
          >
            <Plus size={14} />
            <span>Add Row</span>
          </button>
          <button
            onClick={addColumn}
            className="flex items-center space-x-1 px-3 py-1.5 rounded-lg bg-zinc-800 text-zinc-300 hover:bg-zinc-700 hover:text-white text-xs font-medium transition"
          >
            <Plus size={14} />
            <span>Add Col</span>
          </button>
        </div>
        <div className="text-xs text-zinc-500 flex items-center space-x-3">
          <span className="flex items-center space-x-1">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500/20 border border-amber-500" />
            <span>Low Confidence (&lt;75%)</span>
          </span>
          <span>•</span>
          <span>Use arrows to navigate, double click / Enter to edit</span>
        </div>
      </div>

      {/* Spreadsheet Workspace */}
      <div 
        className="w-full overflow-auto max-h-[600px] border border-zinc-800 rounded-xl bg-zinc-950/80 backdrop-blur-md"
        onKeyDown={handleKeyDown}
        tabIndex={0}
      >
        <table ref={gridRef} className="w-full border-collapse table-fixed text-left text-zinc-200">
          <thead>
            <tr className="bg-zinc-900 border-b border-zinc-800 select-none">
              {/* Header column deletions */}
              <th className="w-12 text-center p-2 border-r border-zinc-800 text-[10px] text-zinc-500">
                #
              </th>
              {Array.from({ length: numCols }).map((_, cIdx) => (
                <th 
                  key={`col-header-${cIdx}`} 
                  className="p-2 border-r border-zinc-800 text-center relative group min-w-[120px]"
                >
                  <span className="text-[11px] font-mono text-zinc-400">
                    Col {String.fromCharCode(65 + (cIdx % 26))}{cIdx >= 26 ? Math.floor(cIdx / 26) : ''}
                  </span>
                  {numCols > 1 && (
                    <button
                      onClick={() => deleteColumn(cIdx)}
                      className="absolute right-1 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-red-500/20 text-zinc-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition"
                      title="Delete Column"
                    >
                      <Trash2 size={12} />
                    </button>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {matrix.map((row, rIdx) => (
              <tr 
                key={`row-${rIdx}`} 
                className="border-b border-zinc-900 hover:bg-white/[0.01] group transition"
              >
                {/* Row deletion indicator & index */}
                <td className="p-2 border-r border-zinc-900 bg-zinc-900/30 text-center text-xs font-mono text-zinc-500 relative select-none">
                  <span className="group-hover:opacity-0 transition">{rIdx + 1}</span>
                  {numRows > 1 && (
                    <button
                      onClick={() => deleteRow(rIdx)}
                      className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 p-1 rounded hover:bg-red-500/20 text-zinc-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition"
                      title="Delete Row"
                    >
                      <Trash2 size={12} />
                    </button>
                  )}
                </td>
                
                {/* Data Cells */}
                {row.map((cell, cIdx) => {
                  const isSelected = selectedCell?.r === rIdx && selectedCell?.c === cIdx;
                  const isEditing = editingCell?.r === rIdx && editingCell?.c === cIdx;
                  const isLowConfidence = cell.confidence < 0.75;
                  const isHeader = cell.isHeader || rIdx === 0;

                  return (
                    <td
                      key={`cell-${rIdx}-${cIdx}`}
                      onClick={() => setSelectedCell({ r: rIdx, c: cIdx })}
                      onDoubleClick={() => startEditing(rIdx, cIdx)}
                      className={`
                        p-2 border-r border-zinc-900 min-h-[40px] align-middle select-none relative cursor-cell overflow-hidden text-ellipsis whitespace-nowrap text-sm
                        ${isSelected ? 'outline outline-2 outline-blue-500 outline-offset-[-2px] z-10' : ''}
                        ${isLowConfidence && !isEditing ? 'bg-amber-500/5 hover:bg-amber-500/10' : ''}
                        ${isHeader ? 'font-semibold text-zinc-100 bg-zinc-900/10' : 'text-zinc-300'}
                      `}
                      title={isLowConfidence ? `Confidence: ${Math.round(cell.confidence * 100)}%` : undefined}
                    >
                      {/* Cell Confidence indicator for low confidence */}
                      {isLowConfidence && !isEditing && (
                        <div className="absolute right-0 top-0 bottom-0 w-0.5 bg-amber-500" />
                      )}

                      {isEditing ? (
                        <input
                          ref={inputRef}
                          type="text"
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          className="w-full bg-zinc-800 text-white rounded px-1.5 py-0.5 text-sm border border-blue-500 outline-none"
                        />
                      ) : (
                        <span>{cell.text || <span className="text-zinc-600 font-light italic text-xs">empty</span>}</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
