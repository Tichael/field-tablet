import React from "react";
import { type LucideIcon } from "lucide-react";
import { Button } from "./button";
import { cn } from "@/lib/utils";

export interface EmptyStateProps {
  icon: LucideIcon | React.ComponentType<{ className?: string }>;
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: {
    label: string;
    onClick: () => void;
    variant?: "default" | "outline" | "secondary";
  };
  dashed?: boolean;
  className?: string;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  dashed = true,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "rounded-2xl p-8 sm:p-12 text-center flex flex-col items-center justify-center space-y-4 bg-card/60 shadow-xs",
        dashed ? "border border-dashed" : "border",
        className,
      )}
    >
      <div className="w-14 h-14 rounded-2xl bg-muted/60 flex items-center justify-center text-muted-foreground/60">
        <Icon className="w-7 h-7" />
      </div>

      <div className="space-y-1.5 max-w-md">
        {typeof title === "string" ? (
          <h3 className="font-semibold text-lg text-foreground tracking-tight">
            {title}
          </h3>
        ) : (
          title
        )}
        {description &&
          (typeof description === "string" ? (
            <p className="text-sm text-muted-foreground">{description}</p>
          ) : (
            description
          ))}
      </div>

      {action && (
        <Button
          variant={action.variant || "outline"}
          size="sm"
          onClick={action.onClick}
          className="mt-2"
        >
          {action.label}
        </Button>
      )}
    </div>
  );
}
