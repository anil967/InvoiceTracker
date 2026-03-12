"use client";

import { motion, useMotionValue, useTransform } from "framer-motion";
import Card from "@/components/ui/Card";
import Icon from "@/components/Icon";

const StatCard = ({
  title,
  value,
  icon = "Activity",
  trend,
  trendValue,
  color = "primary",
  delay = 0
}) => {
  // Motion values for 3D tilt effect
  const x = useMotionValue(0);
  const y = useMotionValue(0);

  // Transform mouse position into rotation degrees
  // Range is intentionally subtle for a clean glassmorphic feel
  const rotateX = useTransform(y, [-0.5, 0.5], [5, -5]);
  const rotateY = useTransform(x, [-0.5, 0.5], [-5, 5]);

  const handleMouseMove = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;

    // Calculate normalized position (-0.5 to 0.5)
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const xPct = mouseX / width - 0.5;
    const yPct = mouseY / height - 0.5;

    x.set(xPct);
    y.set(yPct);
  };

  const handleMouseLeave = () => {
    x.set(0);
    y.set(0);
  };

  // Dynamic color styling based on prop
  const colorStyles = {
    primary: {
      bg: "bg-primary/10",
      text: "text-primary",
      border: "border-primary/20",
      iconBg: "bg-primary/20"
    },
    success: {
      bg: "bg-success/10",
      text: "text-success",
      border: "border-success/20",
      iconBg: "bg-success/20"
    },
    warning: {
      bg: "bg-warning/10",
      text: "text-warning",
      border: "border-warning/20",
      iconBg: "bg-warning/20"
    },
    info: {
      bg: "bg-info/10",
      text: "text-info",
      border: "border-info/20",
      iconBg: "bg-info/20"
    },
    error: {
      bg: "bg-error/10",
      text: "text-error",
      border: "border-error/20",
      iconBg: "bg-error/20"
    },
    orange: {
      bg: "bg-orange-50",
      text: "text-orange-600",
      border: "border-orange-200",
      iconBg: "bg-orange-100"
    }
  };

  const style = colorStyles[color] || colorStyles.primary;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: delay * 0.1, duration: 0.4 }}
      style={{
        perspective: 1000
      }}
      className="h-full"
    >
      <motion.div
        style={{
          rotateX,
          rotateY,
          transformStyle: "preserve-3d"
        }}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        className="h-full"
      >
        <Card className={`h-full relative overflow-hidden group ${style.bg} ${style.border} border bg-opacity-40 backdrop-blur-md`}>
          {/* Shine effect */}
          <div className="absolute inset-0 bg-linear-to-r from-transparent via-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none z-0" />

          <div className="relative z-10 p-1">
            <div className="flex justify-between items-start mb-4">
              <div className={`p-3 rounded-xl ${style.iconBg} shadow-inner`}>
                <Icon name={icon} className={`${style.text}`} size={24} />
              </div>

              {trend && (
                <div className={`flex items-center gap-1 text-xs font-bold py-1 px-2 rounded-full ${trend === 'up' ? 'text-success bg-success/10' : 'text-error bg-error/10'
                  }`}>
                  <Icon name={trend === 'up' ? 'TrendingUp' : 'TrendingDown'} size={14} />
                  <span>{trendValue}</span>
                </div>
              )}
            </div>

            <div className="mt-2">
              <h4 className="text-gray-500 text-sm font-medium uppercase tracking-wide">{title}</h4>
              <h2 className="text-3xl font-bold text-gray-800 mt-1">{value}</h2>
            </div>
          </div>
        </Card>
      </motion.div>
    </motion.div>
  );
};

export default StatCard;