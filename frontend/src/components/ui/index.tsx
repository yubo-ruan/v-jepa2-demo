"use client";

import { ReactNode, InputHTMLAttributes, SelectHTMLAttributes, ButtonHTMLAttributes, useEffect, useRef, useCallback } from "react";

// Focus ring styles for accessibility
const focusRing = "focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-900";

// Common style constants
export const styles = {
  card: "bg-zinc-800 rounded-xl border border-zinc-700 p-6",
  cardTitle: "text-base font-semibold text-zinc-300 mb-5",
  input: `w-full px-4 py-2.5 bg-zinc-700 text-white rounded-lg border-none outline-none text-sm ${focusRing}`,
  slider: `w-full h-2 bg-zinc-700 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:bg-indigo-500 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:shadow-lg ${focusRing}`,
  checkbox: `w-4 h-4 rounded bg-zinc-700 border-zinc-600 text-indigo-500 focus:ring-indigo-500 focus:ring-offset-0 ${focusRing}`,
  checkboxAmber: `w-4 h-4 rounded bg-zinc-700 border-zinc-600 text-amber-500 focus:ring-amber-500 focus:ring-offset-0 ${focusRing}`,
  radio: `w-4 h-4 bg-zinc-700 border-zinc-600 text-indigo-500 focus:ring-indigo-500 focus:ring-offset-0 ${focusRing}`,
  buttonPrimary: `px-4 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white rounded-lg transition-all text-sm font-medium shadow-lg shadow-indigo-500/25 hover:scale-[1.02] active:scale-[0.98] ${focusRing}`,
  buttonSecondary: `px-4 py-2.5 bg-zinc-700 hover:bg-zinc-600 text-white rounded-lg transition-colors text-sm ${focusRing}`,
  buttonDanger: `px-4 py-2.5 bg-red-600/20 hover:bg-red-600/30 text-red-400 rounded-lg transition-colors text-sm ${focusRing}`,
  label: "block text-sm text-zinc-400 mb-2",
  tooltip: "absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-zinc-700 text-xs text-zinc-200 rounded-lg opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-10",
  // Accessible dropzone styles
  dropzone: `min-h-[200px] bg-zinc-900 rounded-lg border-2 border-dashed border-zinc-600 hover:border-indigo-500 hover:bg-indigo-500/5 transition-all cursor-pointer flex flex-col items-center justify-center gap-4 group p-8 relative overflow-hidden ${focusRing}`,
};

// Export focus ring for use in other components
export { focusRing };

// Card Component
interface CardProps {
  children: ReactNode;
  className?: string;
  title?: string;
  warning?: boolean;
}

export function Card({ children, className = "", title, warning = false }: CardProps) {
  return (
    <div className={`${styles.card} ${warning ? "border-amber-600/50" : ""} ${className}`}>
      {title && <h3 className={styles.cardTitle}>{title}</h3>}
      {children}
    </div>
  );
}

// Button Component
interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "danger" | "ghost";
  children: ReactNode;
  icon?: ReactNode;
}

export function Button({ variant = "secondary", children, icon, className = "", ...props }: ButtonProps) {
  const variantStyles = {
    primary: styles.buttonPrimary,
    secondary: styles.buttonSecondary,
    danger: styles.buttonDanger,
    ghost: "px-4 py-2.5 text-zinc-400 hover:text-white transition-colors text-sm",
  };

  return (
    <button className={`${variantStyles[variant]} flex items-center gap-2 ${className}`} {...props}>
      {icon}
      {children}
    </button>
  );
}

// Slider Component
interface SliderProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
  label: string;
  value: number;
  helpText?: string;
  leftLabel?: string;
  rightLabel?: string;
}

export function Slider({ label, value, helpText, leftLabel, rightLabel, className = "", ...props }: SliderProps) {
  return (
    <div className={className}>
      <div className="flex justify-between text-sm mb-2">
        <span className="text-zinc-300 flex items-center gap-2">
          {label}
          {helpText && (
            <span className="group relative">
              <HelpIcon />
              <span className={styles.tooltip}>{helpText}</span>
            </span>
          )}
        </span>
        <span className="text-zinc-400 font-medium">{value}</span>
      </div>
      <input type="range" value={value} className={styles.slider} {...props} />
      {(leftLabel || rightLabel) && (
        <div className="flex justify-between text-xs text-zinc-600 mt-1">
          <span>{leftLabel}</span>
          <span>{rightLabel}</span>
        </div>
      )}
    </div>
  );
}

// Checkbox Component
interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
  label: string;
}

export function Checkbox({ label, className = "", ...props }: CheckboxProps) {
  return (
    <label className={`flex items-center gap-3 cursor-pointer ${className}`}>
      <input type="checkbox" className={styles.checkbox} {...props} />
      <span className="text-sm text-zinc-300">{label}</span>
    </label>
  );
}

// Radio Component
interface RadioProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
  label: string;
}

export function Radio({ label, className = "", ...props }: RadioProps) {
  return (
    <label className={`flex items-center gap-3 cursor-pointer ${className}`}>
      <input type="radio" className={styles.radio} {...props} />
      <span className="text-sm text-zinc-300">{label}</span>
    </label>
  );
}

// Select Component
interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  options: { value: string; label: string }[];
}

export function Select({ label, options, className = "", ...props }: SelectProps) {
  return (
    <div className={className}>
      {label && <label className={styles.label}>{label}</label>}
      <select className={styles.input} {...props}>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}

// Tooltip Component
interface TooltipProps {
  text: string;
  children: ReactNode;
}

export function Tooltip({ text, children }: TooltipProps) {
  return (
    <div className="group relative">
      {children}
      <span className={styles.tooltip}>{text}</span>
    </div>
  );
}

// Toast Component
interface ToastProps {
  message: string;
  visible: boolean;
  type?: "success" | "error" | "info";
}

export function Toast({ message, visible, type = "success" }: ToastProps) {
  if (!visible) return null;

  const typeStyles = {
    success: "bg-green-600",
    error: "bg-red-600",
    info: "bg-blue-600",
  };

  const icons = {
    success: <CheckCircleIcon />,
    error: <ErrorCircleIcon />,
    info: <InfoCircleIcon />,
  };

  return (
    <div className={`fixed top-20 right-8 z-50 ${typeStyles[type]} text-white px-4 py-3 rounded-lg shadow-lg flex items-center gap-2 animate-in slide-in-from-top-2 duration-300`}>
      {icons[type]}
      {message}
    </div>
  );
}

// Empty State Component
interface EmptyStateProps {
  icon: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="w-20 h-20 rounded-full bg-zinc-900 flex items-center justify-center mb-4">
        {icon}
      </div>
      <p className="text-zinc-400 text-sm font-medium">{title}</p>
      {description && (
        <p className="text-zinc-600 text-xs mt-2 max-w-xs">{description}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

// Stat Card Component
interface StatCardProps {
  label: string;
  value: string | number;
  color?: string;
}

export function StatCard({ label, value, color = "text-zinc-200" }: StatCardProps) {
  return (
    <div className="bg-zinc-900 rounded-lg p-4">
      <p className="text-xs text-zinc-500 mb-1">{label}</p>
      <p className={`text-xl font-semibold ${color}`}>{value}</p>
    </div>
  );
}

// Loading Skeleton Component
interface SkeletonProps {
  className?: string;
  width?: string;
  height?: string;
}

export function Skeleton({ className = "", width, height }: SkeletonProps) {
  return (
    <div
      className={`bg-zinc-700 rounded animate-pulse ${className}`}
      style={{ width, height }}
    />
  );
}

// Loading Spinner Component
interface SpinnerProps {
  size?: "sm" | "md" | "lg";
  className?: string;
}

export function Spinner({ size = "md", className = "" }: SpinnerProps) {
  const sizeStyles = {
    sm: "w-4 h-4 border-2",
    md: "w-5 h-5 border-2",
    lg: "w-8 h-8 border-3",
  };

  return (
    <div className={`${sizeStyles[size]} border-indigo-500 border-t-transparent rounded-full animate-spin ${className}`} />
  );
}

// Simple icon components used in UI components
function HelpIcon() {
  return (
    <svg className="w-4 h-4 text-zinc-500 hover:text-zinc-300 cursor-help" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function CheckCircleIcon() {
  return (
    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
      <path fillRule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12zm13.36-1.814a.75.75 0 10-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 00-1.06 1.06l2.25 2.25a.75.75 0 001.14-.094l3.75-5.25z" clipRule="evenodd" />
    </svg>
  );
}

function ErrorCircleIcon() {
  return (
    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
      <path fillRule="evenodd" d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25zm-1.72 6.97a.75.75 0 10-1.06 1.06L10.94 12l-1.72 1.72a.75.75 0 101.06 1.06L12 13.06l1.72 1.72a.75.75 0 101.06-1.06L13.06 12l1.72-1.72a.75.75 0 10-1.06-1.06L12 10.94l-1.72-1.72z" clipRule="evenodd" />
    </svg>
  );
}

function InfoCircleIcon() {
  return (
    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
      <path fillRule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12zm8.706-1.442c1.146-.573 2.437.463 2.126 1.706l-.709 2.836.042-.02a.75.75 0 01.67 1.34l-.04.022c-1.147.573-2.438-.463-2.127-1.706l.71-2.836-.042.02a.75.75 0 11-.671-1.34l.041-.022zM12 9a.75.75 0 100-1.5.75.75 0 000 1.5z" clipRule="evenodd" />
    </svg>
  );
}

// Modal Component with accessibility features
interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  size?: "sm" | "md" | "lg" | "xl";
}

export function Modal({ isOpen, onClose, title, children, size = "md" }: ModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const previousActiveElement = useRef<HTMLElement | null>(null);

  // Handle Escape key
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === "Escape") {
      onClose();
    }
  }, [onClose]);

  // Focus trap and keyboard handling
  useEffect(() => {
    if (isOpen) {
      // Store the previously focused element
      previousActiveElement.current = document.activeElement as HTMLElement;

      // Add escape key listener
      document.addEventListener("keydown", handleKeyDown);

      // Focus the modal
      setTimeout(() => {
        modalRef.current?.focus();
      }, 0);

      // Prevent body scroll
      document.body.style.overflow = "hidden";

      return () => {
        document.removeEventListener("keydown", handleKeyDown);
        document.body.style.overflow = "";

        // Restore focus to previous element
        previousActiveElement.current?.focus();
      };
    }
  }, [isOpen, handleKeyDown]);

  // Handle focus trap
  const handleTabKey = (e: React.KeyboardEvent) => {
    if (e.key !== "Tab" || !modalRef.current) return;

    const focusableElements = modalRef.current.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    if (e.shiftKey && document.activeElement === firstElement) {
      e.preventDefault();
      lastElement?.focus();
    } else if (!e.shiftKey && document.activeElement === lastElement) {
      e.preventDefault();
      firstElement?.focus();
    }
  };

  if (!isOpen) return null;

  const sizeStyles = {
    sm: "max-w-md",
    md: "max-w-lg",
    lg: "max-w-2xl",
    xl: "max-w-4xl",
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />
      {/* Modal */}
      <div
        ref={modalRef}
        tabIndex={-1}
        onKeyDown={handleTabKey}
        className={`relative bg-zinc-800 rounded-xl border border-zinc-700 w-full ${sizeStyles[size]} mx-4 shadow-2xl animate-in fade-in zoom-in-95 duration-200 ${focusRing}`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-700">
          <h2 id="modal-title" className="text-lg font-semibold text-zinc-200">{title}</h2>
          <button
            onClick={onClose}
            aria-label="Close modal"
            className={`p-1 text-zinc-400 hover:text-white hover:bg-zinc-700 rounded transition-colors ${focusRing}`}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        {/* Content */}
        <div className="p-6 max-h-[70vh] overflow-y-auto">
          {children}
        </div>
      </div>
    </div>
  );
}
