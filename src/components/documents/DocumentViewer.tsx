import { useState, useEffect, useRef } from "react";
import { syncManager } from "../../lib/sync/sync-manager";
import { X, ExternalLink } from "lucide-react";
import { Capacitor } from "@capacitor/core";
// @ts-ignore - plugin missing types or dynamic load
import { FileOpener } from "@capacitor-community/file-opener";
import { Document, Page, pdfjs } from "react-pdf";

// Ensure worker is loaded for PDF.js locally for offline-first capabilities
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url,
).toString();

interface DocumentViewerProps {
  filePath: string;
  onClose: () => void;
}

export function DocumentViewer({ filePath, onClose }: DocumentViewerProps) {
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [numPages, setNumPages] = useState<number | null>(null);
  const [pageNumber, setPageNumber] = useState<number>(1);
  const [scale, setScale] = useState<number>(1);
  
  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [baseDims, setBaseDims] = useState({ width: 0, height: 0 });
  const scaleRef = useRef(scale);
  const scrollPosRef = useRef({ left: 0, top: 0 });

  const isPDF = filePath.toLowerCase().endsWith(".pdf");
  const isImage = /\.(png|jpe?g|gif|webp)$/i.test(filePath);
  const isVideo = /\.(mp4|webm|ogg)$/i.test(filePath);

  useEffect(() => {
    scaleRef.current = scale;
  }, [scale]);

  useEffect(() => {
    loadUrl();
    return () => {
      // Clean up object URLs for PWA
      if (url && url.startsWith("blob:")) {
        URL.revokeObjectURL(url);
      }
    };
  }, [filePath]);

  useEffect(() => {
    setBaseDims({ width: 0, height: 0 });
  }, [url]);

  useEffect(() => {
    const el = contentRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      if (entries[0] && entries[0].contentRect.width > 0) {
        setBaseDims({
          width: entries[0].contentRect.width,
          height: entries[0].contentRect.height,
        });
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [url, pageNumber, isPDF, isImage]);

  // Handle multitouch and ctrl+scroll zooming
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let initialDist: number | null = null;
    let initialScale = 1;

    const onWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const delta = -e.deltaY;
        setScale(s => Math.min(Math.max(0.25, s + (delta * 0.005)), 5));
      }
    };

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        const dist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX, 
          e.touches[0].clientY - e.touches[1].clientY
        );
        initialDist = dist;
        initialScale = scaleRef.current;
      }
    };

    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 2 && initialDist !== null) {
        e.preventDefault(); // Prevent native browser pinch zoom
        const dist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX, 
          e.touches[0].clientY - e.touches[1].clientY
        );
        const ratio = dist / initialDist;
        setScale(Math.min(Math.max(0.25, initialScale * ratio), 5));
      }
    };

    const onTouchEnd = (e: TouchEvent) => {
      if (e.touches.length < 2) {
        initialDist = null;
      }
    };

    container.addEventListener("wheel", onWheel, { passive: false });
    container.addEventListener("touchstart", onTouchStart, { passive: false });
    container.addEventListener("touchmove", onTouchMove, { passive: false });
    container.addEventListener("touchend", onTouchEnd);

    return () => {
      container.removeEventListener("wheel", onWheel);
      container.removeEventListener("touchstart", onTouchStart);
      container.removeEventListener("touchmove", onTouchMove);
      container.removeEventListener("touchend", onTouchEnd);
    };
  }, [url]);

  const loadUrl = async () => {
    try {
      const adapter = syncManager.getAdapter();
      const fileUrl = await adapter.getFileUrl(filePath);
      setUrl(fileUrl);

      // If it's an unsupported file type, try opening it natively
      if (!isPDF && !isImage && !isVideo) {
        openExternal(fileUrl);
      }
    } catch (e) {
      console.error("Failed to load document URL", e);
      setError("Failed to load document");
    }
  };

  const openExternal = async (fileUrl: string) => {
    try {
      if (Capacitor.isNativePlatform()) {
        await FileOpener.open({ filePath: fileUrl, contentType: getContentType(filePath) });
      } else {
        window.open(fileUrl, "_blank");
      }
    } catch (e) {
      console.error("Failed to open externally", e);
      setError("Could not open this file type.");
    }
  };

  const getContentType = (path: string) => {
    if (path.endsWith(".doc") || path.endsWith(".docx")) return "application/msword";
    if (path.endsWith(".xls") || path.endsWith(".xlsx")) return "application/vnd.ms-excel";
    return "application/octet-stream";
  };

  const handleZoomIn = () => setScale(s => Math.min(s + 0.25, 5));
  const handleZoomOut = () => setScale(s => Math.max(s - 0.25, 0.25));
  const handleZoomReset = () => setScale(1);

  const changePage = (delta: number) => {
    if (containerRef.current) {
      scrollPosRef.current = {
        left: containerRef.current.scrollLeft,
        top: containerRef.current.scrollTop
      };
    }
    setPageNumber(p => p + delta);
  };

  const renderContent = () => {
    if (!url) return <div className="animate-pulse p-4">Loading document...</div>;

    if (isPDF) {
      return (
        <div ref={containerRef} className="overflow-auto h-full w-full bg-muted/20 touch-none">
          <div className="min-h-full min-w-full flex p-4 pb-24">
            <div 
              style={{ 
                width: baseDims.width ? baseDims.width * scale : 'auto', 
                height: baseDims.height ? baseDims.height * scale : 'auto',
                margin: 'auto',
                position: 'relative'
              }}
            >
              <div 
                ref={contentRef}
                style={{ 
                   transform: `scale(${scale})`, 
                   transformOrigin: 'top left',
                   position: baseDims.width ? 'absolute' : 'relative',
                   left: 0, top: 0
                }}
              >
                <Document
                  file={url}
                  onLoadSuccess={({ numPages }) => setNumPages(numPages)}
                  onLoadError={(err) => setError(err.message)}
                  className="shadow-xl bg-white"
                >
                  <Page 
                    pageNumber={pageNumber} 
                    scale={1.5} 
                    renderTextLayer={false} 
                    renderAnnotationLayer={false}
                    onLoadSuccess={() => {
                      setTimeout(() => {
                        if (containerRef.current) {
                          containerRef.current.scrollTop = scrollPosRef.current.top;
                          containerRef.current.scrollLeft = scrollPosRef.current.left;
                        }
                      }, 10);
                    }}
                  />
                </Document>
              </div>
            </div>
          </div>
        </div>
      );
    }

    if (isImage) {
      return (
        <div ref={containerRef} className="overflow-auto h-full w-full bg-muted/20 touch-none">
          <div className="min-h-full min-w-full flex p-4">
            <div 
              style={{ 
                width: baseDims.width ? baseDims.width * scale : 'auto', 
                height: baseDims.height ? baseDims.height * scale : 'auto',
                margin: 'auto',
                position: 'relative'
              }}
            >
              <div 
                ref={contentRef}
                style={{ 
                   transform: `scale(${scale})`, 
                   transformOrigin: 'top left',
                   position: baseDims.width ? 'absolute' : 'relative',
                   left: 0, top: 0
                }}
              >
                <img 
                  src={url} 
                  alt={filePath} 
                  className="shadow-lg" 
                  style={baseDims.width ? { width: baseDims.width, height: baseDims.height } : { maxWidth: '100%', maxHeight: '80vh', objectFit: 'contain' }}
                />
              </div>
            </div>
          </div>
        </div>
      );
    }

    if (isVideo) {
      return (
        <div className="flex justify-center items-center h-full w-full bg-black">
          <video src={url} controls className="max-w-full max-h-full" autoPlay />
        </div>
      );
    }

    return (
      <div className="flex flex-col items-center justify-center h-full w-full">
        <p className="mb-4 text-muted-foreground">This file type is not supported in the internal viewer.</p>
        <button 
          onClick={() => url && openExternal(url)}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md shadow hover:bg-primary/90"
        >
          <ExternalLink className="w-5 h-5" />
          Open Externally
        </button>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background">
      <div className="flex items-center justify-between p-4 border-b bg-muted/10 shadow-sm shrink-0">
        <h2 className="text-lg font-semibold truncate flex-1 pr-4" title={filePath}>
          {filePath.split("/").pop()}
        </h2>
        
        <div className="flex items-center gap-4">
          {numPages && (
            <div className="flex items-center bg-background border rounded-lg overflow-hidden shadow-sm">
              <button 
                disabled={pageNumber <= 1} 
                onClick={() => changePage(-1)}
                className="px-3 py-1.5 hover:bg-muted text-foreground font-medium text-sm disabled:opacity-50"
              >
                Prev
              </button>
              <span className="px-2 py-1.5 text-xs font-medium min-w-[4rem] text-center border-x">
                {pageNumber} / {numPages}
              </span>
              <button 
                disabled={pageNumber >= numPages} 
                onClick={() => changePage(1)}
                className="px-3 py-1.5 hover:bg-muted text-foreground font-medium text-sm disabled:opacity-50"
              >
                Next
              </button>
            </div>
          )}

          {(isPDF || isImage) && (
            <div className="flex items-center bg-background border rounded-lg overflow-hidden shadow-sm">
              <button onClick={handleZoomOut} className="px-3 py-1.5 hover:bg-muted text-foreground font-bold">-</button>
              <button onClick={handleZoomReset} className="px-2 py-1.5 text-xs font-medium min-w-[3rem] hover:bg-muted text-center border-x">
                {Math.round(scale * 100)}%
              </button>
              <button onClick={handleZoomIn} className="px-3 py-1.5 hover:bg-muted text-foreground font-bold">+</button>
            </div>
          )}
          
          <button 
            onClick={onClose}
            className="p-2 rounded-full hover:bg-muted transition-colors bg-background border shadow-sm"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>
      
      <div className="flex-1 overflow-hidden relative">
        {error ? (
          <div className="flex items-center justify-center h-full text-destructive p-4 text-center">
            {error}
          </div>
        ) : (
          renderContent()
        )}
      </div>
    </div>
  );
}
