import { useState, useCallback } from 'react';

export interface GridCell {
  text: string;
  confidence: number;
  isHeader?: boolean;
}

export function useSpreadsheetHistory(initialMatrix: GridCell[][]) {
  const [past, setPast] = useState<GridCell[][][]>([]);
  const [present, setPresent] = useState<GridCell[][]>(initialMatrix);
  const [future, setFuture] = useState<GridCell[][][]>([]);

  const pushState = useCallback((newPresent: GridCell[][]) => {
    setPast(prev => [...prev, present]);
    setPresent(newPresent);
    setFuture([]);
  }, [present]);

  const undo = useCallback(() => {
    if (past.length === 0) return;
    const previous = past[past.length - 1];
    const newPast = past.slice(0, past.length - 1);
    
    setPast(newPast);
    setFuture(prev => [present, ...prev]);
    setPresent(previous);
  }, [past, present]);

  const redo = useCallback(() => {
    if (future.length === 0) return;
    const next = future[0];
    const newFuture = future.slice(1);
    
    setPast(prev => [...prev, present]);
    setPresent(next);
    setFuture(newFuture);
  }, [future, present]);

  const updateCell = useCallback((rowIdx: number, colIdx: number, text: string) => {
    const newPresent = present.map((row, r) => 
      row.map((cell, c) => {
        if (r === rowIdx && c === colIdx) {
          // If the text was changed, set confidence to 1.0 (manual override)
          return { ...cell, text, confidence: cell.text === text ? cell.confidence : 1.0 };
        }
        return cell;
      })
    );
    pushState(newPresent);
  }, [present, pushState]);

  const setMatrix = useCallback((newMatrix: GridCell[][]) => {
    setPast([]);
    setPresent(newMatrix);
    setFuture([]);
  }, []);

  const addRow = useCallback(() => {
    const numCols = present[0]?.length || 1;
    const newRow: GridCell[] = Array.from({ length: numCols }, () => ({
      text: '',
      confidence: 1.0,
      isHeader: false
    }));
    pushState([...present, newRow]);
  }, [present, pushState]);

  const deleteRow = useCallback((rowIdx: number) => {
    if (present.length <= 1) return; // Keep at least one row
    const newPresent = present.filter((_, idx) => idx !== rowIdx);
    pushState(newPresent);
  }, [present, pushState]);

  const addColumn = useCallback(() => {
    const newPresent = present.map((row, r_idx) => [
      ...row,
      { text: '', confidence: 1.0, isHeader: r_idx === 0 }
    ]);
    pushState(newPresent);
  }, [present, pushState]);

  const deleteColumn = useCallback((colIdx: number) => {
    const numCols = present[0]?.length || 0;
    if (numCols <= 1) return; // Keep at least one column
    const newPresent = present.map(row => row.filter((_, idx) => idx !== colIdx));
    pushState(newPresent);
  }, [present, pushState]);

  return {
    matrix: present,
    setMatrix,
    updateCell,
    addRow,
    deleteRow,
    addColumn,
    deleteColumn,
    undo,
    redo,
    canUndo: past.length > 0,
    canRedo: future.length > 0
  };
}
