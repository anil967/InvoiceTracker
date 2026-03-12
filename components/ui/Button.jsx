"use client";

import { twMerge } from "tailwind-merge";
import clsx from "clsx";
import Icon from "@/components/Icon";

const Button = ({
  children,
  onClick,
  variant = "primary", // primary, secondary, ghost, glass, danger
  size = "md", // sm, md, lg
  icon,
  iconPosition = "left",
  disabled = false,
  loading = false,
  className = "",
  type = "button",
  ...props
}) => {
  const baseClasses = "btn transition-all duration-300 font-medium tracking-wide flex items-center justify-center gap-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-offset-1";
  
  const variants = {
    primary: "btn-primary shadow-lg shadow-primary/30 hover:shadow-primary/50 text-white border-none",
    secondary: "btn-secondary text-white shadow-md",
    ghost: "btn-ghost hover:bg-base-content/10",
    glass: "glass text-base-content hover:text-primary hover:bg-white/40 border border-white/20 shadow-sm",
    danger: "btn-error text-white shadow-md shadow-error/30",
    outline: "btn-outline border-2 hover:bg-base-content hover:text-base-100"
  };

  const sizes = {
    sm: "btn-sm text-xs px-3",
    md: "btn-md text-sm px-5",
    lg: "btn-lg text-base px-8 h-12",
  };

  const classes = twMerge(
    clsx(
      baseClasses,
      variants[variant],
      sizes[size],
      loading && "opacity-80 cursor-not-allowed",
      className
    )
  );

  return (
    <button
      type={type}
      className={classes}
      onClick={onClick}
      disabled={disabled || loading}
      {...props}
    >
      {loading && <span className="loading loading-spinner loading-xs"></span>}
      {!loading && icon && iconPosition === "left" && <Icon name={icon} size={size === 'sm' ? 16 : 20} />}
      {children}
      {!loading && icon && iconPosition === "right" && <Icon name={icon} size={size === 'sm' ? 16 : 20} />}
    </button>
  );
};

export default Button;