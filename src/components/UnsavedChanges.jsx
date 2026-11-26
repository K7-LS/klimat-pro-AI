import { createContext, useContext, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import "./UnsavedChanges.css";

export const ModalDraftContext = createContext(null);

export function useModalDraft(dirty) {
  const context = useContext(ModalDraftContext);
  const key = useId();
  const drafts = context?.drafts;
  useLayoutEffect(() => {
    if (!dirty || !drafts) return;
    drafts.add(key);
    return () => { drafts.delete(key); };
  }, [dirty, drafts, key]);
  return context?.requestClose;
}

export function formHasChanges(current, initial) {
  return current !== initial && JSON.stringify(current) !== JSON.stringify(initial);
}

export function useGuardedClose(onClose, hasChanges, busy = false) {
  const [pending, setPending] = useState(false);
  const requestClose = () => {
    if (busy) return;
    if (hasChanges()) setPending(true);
    else onClose();
  };
  return {
    requestClose,
    confirmation: pending && <UnsavedChangesDialog
      onContinue={() => setPending(false)}
      onDiscard={() => {
        setPending(false);
        if (!busy) onClose();
      }}
    />,
  };
}

export function useBackdropDismiss(requestClose) {
  const startedOnBackdrop = useRef(false);
  return {
    onPointerDown: event => { startedOnBackdrop.current = event.target === event.currentTarget; },
    onClick: event => {
      if (event.target === event.currentTarget && startedOnBackdrop.current) requestClose();
      startedOnBackdrop.current = false;
    },
  };
}

function UnsavedChangesDialog({ onContinue, onDiscard }) {
  const dialog = useRef(null);
  const titleId = useId();
  const descriptionId = useId();
  useEffect(() => {
    const element = dialog.current;
    element.showModal();
    return () => { element.close(); };
  }, []);
  return createPortal(
    <dialog ref={dialog} className="kp-unsaved-dialog" role="alertdialog"
      aria-labelledby={titleId} aria-describedby={descriptionId}
      onCancel={event => { event.preventDefault(); onContinue(); }}
      onClick={event => event.stopPropagation()}>
      <h3 id={titleId}>Закрыть без сохранения?</h3>
      <p id={descriptionId}>Несохранённые изменения будут потеряны.</p>
      <div className="kp-unsaved-actions">
        <button type="button" autoFocus onClick={onContinue}>Продолжить редактирование</button>
        <button type="button" onClick={onDiscard}>Закрыть без сохранения</button>
      </div>
    </dialog>, document.body
  );
}
