"use client";

import { ReactNode, InputHTMLAttributes, SelectHTMLAttributes, ButtonHTMLAttributes } from "react";

// Common style constants
export const styles = {
  card: "bg-zinc-800 rounded-xl border border-zinc-700 p-6",
  cardTitle: "text-base font-semibold text-zinc-300 mb-5",
  input: "w-full px-4 py-2.5 bg-zinc-700 text-white rounded-lg border-none outline-none text-sm",
  slider: "w-full h-2 bg-zinc-700 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:bg-indigo-500 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:shadow-lg",
  checkbox: "w-4 h-4 rounded bg-zinc-700 border-zinc-600 text-indigo-500 focus:ring-indigo-500 focus:ring-offset-0",
  checkboxAmber: "w-4 h-4 rounded bg-zinc-700 border-zinc-600 text-amber-500 focus:ring-amber-500 focus:ring-offset-0",
  radio: "w-4 h-4 bg-zinc-700 border-zinc-600 text-indigo-500 focus:ring-indigo-500 focus:ring-offset-0",
  buttonPrimary: "px-4 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white rounded-lg transition-all text-sm font-medium shadow-lg shadow-indigo-500/25 hover:scale-[1.02] active:scale-[0.98]",
  buttonSecondary: "px-4 py-2.5 bg-zinc-700 hover:bg-zinc-600 text-white rounded-lg transition-colors text-sm",
  buttonDanger: "px-4 py-2.5 bg-red-600/20 hover:bg-red-600/30 text-red-400 rounded-lg transition-colors text-sm",
  label: "block text-sm text-zinc-400 mb-2",
  tooltip: "absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-zinc-700 text-xs text-zinc-200 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-10",
};

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
}

export function Toast({ message, visible }: ToastProps) {
  if (!visible) return null;
  return (
    <div className="fixed top-20 right-8 z-50 bg-green-600 text-white px-4 py-3 rounded-lg shadow-lg flex items-center gap-2 animate-in slide-in-from-top-2 duration-300">
      <CheckCircleIcon />
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
