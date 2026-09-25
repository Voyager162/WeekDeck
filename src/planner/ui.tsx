import { useEffect, useRef, type ReactNode, type ButtonHTMLAttributes } from 'react';
import {
  BookOpen,
  BriefcaseBusiness,
  Coffee,
  Dumbbell,
  Heart,
  Music2,
  Pencil,
  Sparkles,
  X,
  PanelsTopLeft,
} from 'lucide-react';
import type { Template } from './model';

export function Brand() {
  return (
    <div className="brand">
      <span className="brand-symbol">
        <PanelsTopLeft size={20} strokeWidth={1.7} />
      </span>
      <span>
        Weekdeck<span className="brand-period">.</span>
      </span>
    </div>
  );
}
export function IconButton({
  label,
  children,
  className = '',
  ...props
}: { label: string; children: ReactNode } & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={`icon-button ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
export function TemplateIcon({ name, size = 18 }: { name: Template['icon']; size?: number }) {
  const Icon = {
    book: BookOpen,
    briefcase: BriefcaseBusiness,
    coffee: Coffee,
    music: Music2,
    pencil: Pencil,
    heart: Heart,
    dumbbell: Dumbbell,
    sparkles: Sparkles,
  }[name];
  return <Icon size={size} strokeWidth={1.8} />;
}
export function Modal({
  title,
  children,
  onClose,
  wide = false,
  busy = false,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
  busy?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current!;
    dialog.showModal();
    return () => dialog.close();
  }, []);
  return (
    <dialog
      className={wide ? 'wide-dialog' : ''}
      ref={ref}
      aria-label={title}
      onCancel={(e) => {
        e.preventDefault();
        if (!busy) onClose();
      }}
    >
      <header className="dialog-heading">
        <h2 id="dialog-heading">{title}</h2>
        <IconButton label="Close" onClick={onClose} disabled={busy}>
          <X size={20} />
        </IconButton>
      </header>
      {children}
    </dialog>
  );
}
export function Toggle({
  label,
  checked,
  onChange,
  disabled = false,
  detail,
}: {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
  detail?: string;
}) {
  return (
    <label className="toggle-row">
      <span>
        <strong>{label}</strong>
        {detail && <small>{detail}</small>}
      </span>
      <input
        type="checkbox"
        role="switch"
        aria-label={label}
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span className="toggle-track" aria-hidden="true" />
    </label>
  );
}
