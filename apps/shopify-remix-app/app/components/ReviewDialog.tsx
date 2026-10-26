import { useEffect, useRef, type CSSProperties, type ReactNode } from "react";

export function ReviewDialog({ children, labelledBy, busy, onClose, style }: {
  children: ReactNode;
  labelledBy: string;
  busy: boolean;
  onClose: () => void;
  style: CSSProperties;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current!;
    dialog.showModal();
    return () => dialog.close();
  }, []);
  return (
    <>
      <dialog ref={ref} className="review-dialog" aria-labelledby={labelledBy} aria-busy={busy}
        onCancel={(event) => { event.preventDefault(); if (!busy) onClose(); }}
        style={{ padding: 0, border: 0, color: "#0F172A", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif", ...style }}>
        {children}
      </dialog>
      <style>{`.review-dialog{overflow-wrap:anywhere}.review-dialog::backdrop{background:rgba(15,23,42,.5)}.review-dialog :focus-visible{outline:2px solid #2563EB;outline-offset:2px}.review-dialog button{min-height:44px}.review-dialog button[aria-label^="Close"]{min-width:44px}`}</style>
    </>
  );
}
