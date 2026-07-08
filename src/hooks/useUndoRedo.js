import { useState, useCallback, useRef } from "react";

/**
 * useUndoRedo — lightweight history stack for any state value.
 *
 * Usage:
 *   const { state, set, undo, redo, canUndo, canRedo } = useUndoRedo(initialValue);
 *
 * - `set(newValue)` replaces current state and pushes old value to history.
 * - `undo()` steps back one level.
 * - `redo()` steps forward one level.
 * - History is capped at `maxHistory` entries (default 20) to avoid memory bloat.
 */
export function useUndoRedo(initialValue, maxHistory = 20) {
  const [state, setState] = useState(initialValue);
  const pastRef = useRef([]);   // history of states before current
  const futureRef = useRef([]); // states undone (available to redo)

  const set = useCallback((newValue) => {
    setState(prev => {
      // Push current state onto past stack
      pastRef.current = [...pastRef.current.slice(-maxHistory + 1), prev];
      // Clear future stack — new action invalidates redo history
      futureRef.current = [];
      return typeof newValue === "function" ? newValue(prev) : newValue;
    });
  }, [maxHistory]);

  const undo = useCallback(() => {
    if (pastRef.current.length === 0) return;
    setState(current => {
      const previous = pastRef.current[pastRef.current.length - 1];
      pastRef.current = pastRef.current.slice(0, -1);
      futureRef.current = [current, ...futureRef.current.slice(0, maxHistory - 1)];
      return previous;
    });
  }, [maxHistory]);

  const redo = useCallback(() => {
    if (futureRef.current.length === 0) return;
    setState(current => {
      const next = futureRef.current[0];
      futureRef.current = futureRef.current.slice(1);
      pastRef.current = [...pastRef.current.slice(-maxHistory + 1), current];
      return next;
    });
  }, [maxHistory]);

  const canUndo = pastRef.current.length > 0;
  const canRedo = futureRef.current.length > 0;

  return { state, set, undo, redo, canUndo, canRedo };
}
