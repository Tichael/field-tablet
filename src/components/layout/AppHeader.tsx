import React from "react";
import { useTranslation } from "react-i18next";
import { ChevronLeft } from "lucide-react";
import { Button } from "../ui/button";
import { cn } from "@/lib/utils";

export interface AppHeaderProps {
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  onBack?: () => void;
  backLabel?: string;
  start?: React.ReactNode;
  center?: React.ReactNode;
  actions?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
  size?: "default" | "compact";
  sticky?: boolean;
}

export function AppHeader({
  title,
  subtitle,
  onBack,
  backLabel,
  start,
  center,
  actions,
  children,
  className,
  size = "default",
  sticky = true,
}: AppHeaderProps) {
  const { t } = useTranslation();

  const isCompact = size === "compact";
  const heightClass = isCompact ? "h-13" : "h-16";

  return (
    <header
      className={cn(
        "border-b bg-background/95 backdrop-blur-md text-foreground shadow-xs z-20 shrink-0",
        sticky && "sticky top-0",
        className,
      )}
    >
      <div
        className={cn(
          "w-full px-4 sm:px-6 flex items-center justify-between gap-3 relative",
          heightClass,
        )}
      >
        {/* Left / Start Section */}
        <div className="flex items-center gap-3 min-w-0 flex-1 sm:flex-initial z-10">
          {onBack && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onBack}
              className="rounded-full shrink-0 text-muted-foreground hover:text-foreground"
              title={backLabel || t("common.back")}
              aria-label={backLabel || t("common.back")}
            >
              <ChevronLeft className="w-5 h-5" />
            </Button>
          )}

          {start}

          {(title || subtitle) && (
            <div className="min-w-0 flex-1">
              {title &&
                (typeof title === "string" ? (
                  <h1
                    title={title}
                    className={cn(
                      "font-bold truncate tracking-tight text-foreground",
                      isCompact ? "text-base" : "text-lg sm:text-xl",
                    )}
                  >
                    {title}
                  </h1>
                ) : (
                  title
                ))}
              {subtitle &&
                (typeof subtitle === "string" ? (
                  <p className="text-xs text-muted-foreground truncate leading-tight mt-0.5">
                    {subtitle}
                  </p>
                ) : (
                  subtitle
                ))}
            </div>
          )}
        </div>

        {/* Center Section (optional view switchers, pagination, etc.) */}
        {center && (
          <div className="hidden md:flex items-center justify-center absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none">
            <div className="pointer-events-auto">{center}</div>
          </div>
        )}

        {/* Right / Actions Section */}
        {actions && (
          <div className="flex items-center gap-2 shrink-0 z-10">{actions}</div>
        )}
      </div>

      {/* Sub-bar / Children (e.g. section pills, breadcrumbs, tabs) */}
      {children && (
        <div className="w-full px-4 sm:px-6 pb-2.5 pt-0.5 overflow-x-auto">
          {children}
        </div>
      )}
    </header>
  );
}
