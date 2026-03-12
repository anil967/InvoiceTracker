"use client";

import * as LucideIcons from "lucide-react";

const Icon = ({ name, size = 24, className = "", ...rest }) => {
  if (!LucideIcons) return null;

  // Try modern name or traditional name
  const IconComponent = LucideIcons[name] || LucideIcons.CircleHelp || LucideIcons.HelpCircle || LucideIcons.Activity;

  if (!IconComponent) return <span className={className}>?</span>;

  return <IconComponent size={size} className={className} {...rest} />;
};

export default Icon;