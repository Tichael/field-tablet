import { useRef, useEffect, useState, useCallback } from "react";
import { Button } from "../ui/button";
import { RotateCcw, PenTool, Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface SignaturePadProps {
  value?: string | null;
  onChange: (dataUrl: string | null) => void;
  disabled?: boolean;
  className?: string;
}

export function SignaturePad({
  value,
  onChange,
  disabled = false,
  className,
}: SignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const isDrawingRef = useRef(false);
  const emittedValueRef = useRef<string | null>(value ?? null);
  const [hasDrawn, setHasDrawn] = useState(Boolean(value));

  // Helper to load an image URL onto canvas
  const drawImageUrl = useCallback((dataUrl: string) => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const rect = container.getBoundingClientRect();
    const img = new Image();
    img.onload = () => {
      ctx.clearRect(0, 0, rect.width, rect.height);
      ctx.drawImage(img, 0, 0, rect.width, rect.height);
      setHasDrawn(true);
    };
    img.src = dataUrl;
  }, []);

  // Initialize and size canvas with high DPI
  const setupCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const rect = container.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;

    const dpr = window.devicePixelRatio || 1;

    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.scale(dpr, dpr);
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#0f172a"; // Crisp dark ink

    // Render current value onto newly sized canvas
    const currentVal = emittedValueRef.current || value;
    if (currentVal && currentVal.startsWith("data:image")) {
      drawImageUrl(currentVal);
    }
  }, [value, drawImageUrl]);

  useEffect(() => {
    setupCanvas();

    const container = containerRef.current;
    if (!container) return;

    const resizeObserver = new ResizeObserver(() => {
      setupCanvas();
    });
    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
    };
  }, [setupCanvas]);

  // Handle external value changes (e.g. form reset or initial submission load)
  useEffect(() => {
    if (value === emittedValueRef.current) {
      return;
    }
    emittedValueRef.current = value ?? null;
    if (value && value.startsWith("data:image")) {
      drawImageUrl(value);
    } else if (!value) {
      const canvas = canvasRef.current;
      const container = containerRef.current;
      if (canvas && container) {
        const ctx = canvas.getContext("2d");
        const rect = container.getBoundingClientRect();
        if (ctx) ctx.clearRect(0, 0, rect.width, rect.height);
      }
      setHasDrawn(false);
    }
  }, [value, drawImageUrl]);

  const getCoordinates = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (disabled) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    isDrawingRef.current = true;
    canvas.setPointerCapture(e.pointerId);

    const { x, y } = getCoordinates(e);

    // Render a small dot on pointer down so single taps / dots are recorded
    ctx.fillStyle = "#0f172a";
    ctx.beginPath();
    ctx.arc(x, y, 1.25, 0, Math.PI * 2);
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(x, y);
    setHasDrawn(true);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current || disabled) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const { x, y } = getCoordinates(e);
    ctx.lineTo(x, y);
    ctx.stroke();
    setHasDrawn(true);
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current) return;
    isDrawingRef.current = false;

    const canvas = canvasRef.current;
    if (!canvas) return;
    try {
      canvas.releasePointerCapture(e.pointerId);
    } catch {
      // Ignored if pointer not captured
    }

    // Export PNG data URL
    const dataUrl = canvas.toDataURL("image/png");
    emittedValueRef.current = dataUrl;
    onChange(dataUrl);
  };

  const handleClear = () => {
    if (disabled) return;
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const rect = container.getBoundingClientRect();
    ctx.clearRect(0, 0, rect.width, rect.height);
    setHasDrawn(false);
    emittedValueRef.current = null;
    onChange(null);
  };

  return (
    <div className={cn("space-y-2", className)}>
      <div
        ref={containerRef}
        className={cn(
          "relative w-full h-36 sm:h-44 border-2 border-dashed rounded-xl bg-white dark:bg-slate-100 overflow-hidden shadow-inner touch-none transition-colors",
          disabled && "opacity-60 cursor-not-allowed",
          hasDrawn ? "border-primary/40" : "border-muted-foreground/30",
        )}
      >
        <canvas
          ref={canvasRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          className="absolute inset-0 w-full h-full cursor-crosshair touch-none"
        />

        {!hasDrawn && !disabled && (
          <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center text-slate-400">
            <PenTool className="w-5 h-5 mb-1 opacity-50" />
            <span className="text-xs font-medium">
              Sign here using finger or stylus
            </span>
          </div>
        )}

        {hasDrawn && (
          <div className="absolute top-2 right-2 pointer-events-none bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded text-[11px] font-medium flex items-center gap-1">
            <Check className="w-3 h-3" />
            <span>Signed</span>
          </div>
        )}
      </div>

      <div className="flex justify-between items-center px-1">
        <p className="text-[11px] text-muted-foreground">
          Signatures are embedded directly into generated PDF copies.
        </p>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={handleClear}
          disabled={disabled || !hasDrawn}
          className="h-7 text-xs gap-1.5 text-muted-foreground hover:text-destructive"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Clear</span>
        </Button>
      </div>
    </div>
  );
}
