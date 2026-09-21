import { createContext, useCallback, useContext, useRef, useState, ReactNode } from 'react';
import ConfirmDialog, { ConfirmOptions } from '../components/ConfirmDialog';

type ConfirmFn = (options: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFn | null>(null);

interface Pending {
  options: ConfirmOptions;
  resolve: (confirmed: boolean) => void;
}

// Promise-based confirmation for every edit-save and delete in the app:
//
//   const confirm = useConfirm();
//   if (!(await confirm({ title: 'ลบเอกสาร?', message: '...', tone: 'danger' }))) return;
//   ...do the delete
//
// A second confirm() while one is already open answers the first with `false`, so two popups can
// never stack and nothing is left awaiting forever.
export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [options, setOptions] = useState<ConfirmOptions | null>(null);
  const pendingRef = useRef<Pending | null>(null);

  const confirm = useCallback<ConfirmFn>((next) => new Promise<boolean>((resolve) => {
    pendingRef.current?.resolve(false);
    pendingRef.current = { options: next, resolve };
    setOptions(next);
  }), []);

  const handleResult = useCallback((confirmed: boolean) => {
    const pending = pendingRef.current;
    if (!pending) return;
    pendingRef.current = null;
    setOptions(null);
    pending.resolve(confirmed);
  }, []);

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <ConfirmDialog options={options} onResult={handleResult} />
    </ConfirmContext.Provider>
  );
}

export function useConfirm(): ConfirmFn {
  const confirm = useContext(ConfirmContext);
  if (!confirm) throw new Error('useConfirm must be used inside <ConfirmProvider>');
  return confirm;
}
