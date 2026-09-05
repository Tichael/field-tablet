import React from "react";
import { useTranslation } from "react-i18next";
import { X } from "lucide-react";
import { Button } from "./button";
import { cn } from "@/lib/utils";

export interface AppDialogProps {
  isOpen: boolean;
  onClose: () => void;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  maxWidth?: "sm" | "md" | "lg" | "xl" | "2xl";
  className?: string;
}

export function AppDialog({
  isOpen,
  onClose,
  title,
  subtitle,
  children,
  footer,
  maxWidth = "lg",
  className,
}: AppDialogProps) {
  const { t } = useTranslation();

  if (!isOpen) return null;

  const maxWidthClass = {
    sm: "max-w-sm",
    md: "max-w-md",
    lg: "max-w-lg",
    xl: "max-w-xl",
    "2xl": "max-w-2xl",
  }[maxWidth];

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 animate-in fade-in duration-150 text-foreground"
    >
      <div
        className={cn(
          "bg-background rounded-2xl shadow-2xl border w-full overflow-hidden flex flex-col max-h-[90vh]",
          maxWidthClass,
          className,
        )}
      >
        {/* Dialog Header */}
        <div className="p-4 sm:p-5 border-b flex items-center justify-between bg-muted/20 shrink-0">
          <div className="min-w-0 flex-1 pr-2">
            {typeof title === "string" ? (
              <h3 className="font-bold text-lg truncate text-foreground">
                {title}
              </h3>
            ) : (
              title
            )}
            {subtitle &&
              (typeof subtitle === "string" ? (
                <p className="text-xs text-muted-foreground mt-0.5 truncate">
                  {subtitle}
                </p>
              ) : (
                subtitle
              ))}
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="rounded-full shrink-0 text-muted-foreground hover:text-foreground"
            title={t("common.close")}
            aria-label={t("common.close")}
          >
            <X className="w-5 h-5" />
          </Button>
        </div>

        {/* Dialog Body */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1">{children}</div>

        {/* Dialog Footer */}
        {footer && (
          <div className="p-4 border-t flex items-center justify-end gap-2 bg-muted/10 shrink-0">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
