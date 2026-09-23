// src/components/ui/Button.tsx
import type { ButtonHTMLAttributes } from "react";
import { btnClass, type ButtonVariant } from "./dzClass";

export function Button({
  variant = "primary",
  className = "",
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant }) {
  return <button className={btnClass(variant, className)} {...rest} />;
}
