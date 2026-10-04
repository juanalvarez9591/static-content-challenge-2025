import { useEffect, useRef } from 'react';

export function ConfirmDialog({ title, message, confirmLabel, onConfirm, onCancel }) {
  const dialog = useRef(null);

  useEffect(() => {
    dialog.current.showModal();
  }, []);

  const closeOnBackdropClick = (event) => {
    if (event.target === event.currentTarget) onCancel();
  };

  return (
    <dialog ref={dialog} className="modal" aria-labelledby="modal-title" onCancel={onCancel} onClick={closeOnBackdropClick}>
      <h2 id="modal-title">{title}</h2>
      <p>{message}</p>
      <div className="form-actions">
        <button type="button" className="danger" onClick={onConfirm}>{confirmLabel}</button>
        <button type="button" className="secondary" onClick={onCancel}>Cancel</button>
      </div>
    </dialog>
  );
}
