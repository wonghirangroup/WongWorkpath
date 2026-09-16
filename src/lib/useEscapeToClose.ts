import { useEffect } from 'react';

// Every modal in the app is expected to close on Escape — the one truly universal "get me out of
// here" convention, and the cheapest one to support (unlike backdrop-click, which several forms
// deliberately disable so an accidental click outside can't discard unsaved input). Pass `isOpen`
// so the listener only attaches while the modal is actually mounted/visible.
export function useEscapeToClose(isOpen: boolean, onClose: () => void) {
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);
}
