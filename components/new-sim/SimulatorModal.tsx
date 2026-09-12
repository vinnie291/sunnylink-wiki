'use client';

import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import SimulatorLab, { type SimulatorLabProps } from './SimulatorLab';
import styles from './SimulatorLab.module.css';

/** Native modal provides focus containment, Escape dismissal and inert background. */
export default function SimulatorModal(props: SimulatorLabProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = dialogRef.current;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialog?.showModal();
    return () => {
      dialog?.close();
      document.body.style.overflow = overflow;
      if (opener?.isConnected) opener.focus({ preventScroll: true });
    };
  }, []);
  return createPortal(
    <dialog ref={dialogRef} className={styles.modal} aria-label="Driving Lab simulator"
      onCancel={event => { event.preventDefault(); props.onClose?.(); }}>
      <SimulatorLab {...props} embedded />
    </dialog>, document.body,
  );
}
