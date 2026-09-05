import { useState, useRef } from "react";
import type { FormField, FormAttachment } from "../../types/form";
import { useConfigStore } from "../../store/config-store";
import { optimizePhoto, fileToBase64, formatBytes } from "../../lib/forms/media-utils";
import { Button } from "../ui/button";
import {
  Camera,
  Video,
  Image as ImageIcon,
  Trash2,
  Play,
  Eye,
  Loader2,
  FolderOpen,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface MediaAttachmentFieldProps {
  field: FormField;
  value: FormAttachment | FormAttachment[] | undefined;
  onChange: (val: any) => void;
  hasError?: boolean;
  disabled?: boolean;
  onViewMedia?: (pathOrUrl: string) => void;
}

export function MediaAttachmentField({
  field,
  value,
  onChange,
  hasError,
  disabled,
  onViewMedia,
}: MediaAttachmentFieldProps) {
  const isPhoto = field.type === "photo";
  const allowMultiple = Boolean(field.allowMultiple);
  const photoQuality = useConfigStore(
    (state) => state.config?.media?.photoQuality || "2mp",
  );

  const [isProcessing, setIsProcessing] = useState(false);
  const [activePreviewUrl, setActivePreviewUrl] = useState<string | null>(null);

  // Hidden inputs for camera capture vs gallery selection
  const captureInputRef = useRef<HTMLInputElement>(null);
  const pickInputRef = useRef<HTMLInputElement>(null);

  const attachments: FormAttachment[] = Array.isArray(value)
    ? value
    : value
      ? [value]
      : [];

  const handleFilesSelected = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setIsProcessing(true);

    try {
      const newAttachments: FormAttachment[] = [];

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (isPhoto) {
          const processed = await optimizePhoto(file, photoQuality);
          newAttachments.push({
            id: `att_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
            name: file.name || `photo_${Date.now()}.jpg`,
            filename: "",
            path: "",
            type: "photo",
            mimeType: processed.mimeType,
            size: processed.size,
            uploadedAt: new Date().toISOString(),
            dataUrl: processed.dataUrl,
          });
        } else {
          const processed = await fileToBase64(file);
          newAttachments.push({
            id: `att_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
            name: file.name || `video_${Date.now()}.mp4`,
            filename: "",
            path: "",
            type: "video",
            mimeType: processed.mimeType || "video/mp4",
            size: processed.size,
            uploadedAt: new Date().toISOString(),
            dataUrl: processed.dataUrl,
          });
        }

        if (!allowMultiple) break;
      }

      if (allowMultiple) {
        onChange([...attachments, ...newAttachments]);
      } else {
        onChange(newAttachments[0]);
      }
    } catch (e) {
      console.error("Failed to process media attachment:", e);
      alert("Could not process attachment file.");
    } finally {
      setIsProcessing(false);
      if (captureInputRef.current) captureInputRef.current.value = "";
      if (pickInputRef.current) pickInputRef.current.value = "";
    }
  };

  const handleRemove = (id: string) => {
    if (allowMultiple) {
      onChange(attachments.filter((a) => a.id !== id));
    } else {
      onChange(undefined);
    }
  };

  const handleView = (att: FormAttachment) => {
    const url = att.dataUrl || att.path;
    if (!url) return;
    if (onViewMedia && att.path) {
      onViewMedia(att.path);
    } else {
      setActivePreviewUrl(url);
    }
  };

  return (
    <div className="space-y-3">
      {/* Hidden file inputs */}
      <input
        ref={captureInputRef}
        type="file"
        accept={isPhoto ? "image/*" : "video/*"}
        capture="environment"
        multiple={allowMultiple}
        className="hidden"
        disabled={disabled || isProcessing}
        onChange={(e) => handleFilesSelected(e.target.files)}
      />
      <input
        ref={pickInputRef}
        type="file"
        accept={isPhoto ? "image/*" : "video/*"}
        multiple={allowMultiple}
        className="hidden"
        disabled={disabled || isProcessing}
        onChange={(e) => handleFilesSelected(e.target.files)}
      />

      {/* Action Buttons: Camera Capture vs Gallery */}
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="default"
          onClick={() => captureInputRef.current?.click()}
          disabled={disabled || isProcessing}
          className={cn(
            "min-h-[44px] px-4 gap-2 font-semibold text-sm",
            hasError && "border-destructive ring-destructive/20",
          )}
        >
          {isProcessing ? (
            <Loader2 className="w-4 h-4 animate-spin text-primary" />
          ) : isPhoto ? (
            <Camera className="w-4 h-4 text-primary" />
          ) : (
            <Video className="w-4 h-4 text-blue-500" />
          )}
          <span>{isPhoto ? "Take Photo" : "Record Video"}</span>
        </Button>

        <Button
          type="button"
          variant="ghost"
          size="default"
          onClick={() => pickInputRef.current?.click()}
          disabled={disabled || isProcessing}
          className="min-h-[44px] px-3 gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <FolderOpen className="w-4 h-4" />
          <span>{isPhoto ? "Choose Photo" : "Choose Video"}</span>
        </Button>

        {isProcessing && (
          <span className="text-xs text-muted-foreground animate-pulse">
            Processing {isPhoto ? "photo" : "video"}...
          </span>
        )}
      </div>

      {/* Attachment Previews */}
      {attachments.length > 0 && (
        <div
          className={cn(
            "grid gap-3 pt-1",
            isPhoto
              ? "grid-cols-2 sm:grid-cols-3 md:grid-cols-4"
              : "grid-cols-1 sm:grid-cols-2",
          )}
        >
          {attachments.map((att, idx) => {
            const previewUrl = att.dataUrl || att.path;
            const displayName = att.name || att.filename || `File ${idx + 1}`;

            if (isPhoto) {
              return (
                <div
                  key={att.id || idx}
                  className="group relative border rounded-xl overflow-hidden bg-card shadow-xs flex flex-col"
                >
                  <div className="relative aspect-4/3 bg-muted/40 overflow-hidden flex items-center justify-center">
                    {previewUrl ? (
                      <img
                        src={previewUrl}
                        alt={displayName}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <ImageIcon className="w-8 h-8 text-muted-foreground/40" />
                    )}

                    {/* Overlay Action Buttons */}
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                      <Button
                        type="button"
                        variant="secondary"
                        size="icon-sm"
                        onClick={() => handleView(att)}
                        className="rounded-full shadow"
                        title="View Photo"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </Button>
                      {!disabled && (
                        <Button
                          type="button"
                          variant="destructive"
                          size="icon-sm"
                          onClick={() => handleRemove(att.id)}
                          className="rounded-full shadow"
                          title="Remove Photo"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      )}
                    </div>
                  </div>

                  <div className="p-2 text-xs flex items-center justify-between border-t bg-card">
                    <span className="truncate font-medium text-foreground max-w-[110px]" title={displayName}>
                      {displayName}
                    </span>
                    <span className="text-[10px] text-muted-foreground font-mono shrink-0">
                      {formatBytes(att.size)}
                    </span>
                  </div>
                </div>
              );
            }

            // Video Card
            return (
              <div
                key={att.id || idx}
                className="border rounded-xl p-3 bg-card shadow-xs flex items-center justify-between gap-3"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-10 h-10 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-600 dark:text-blue-400 shrink-0">
                    <Video className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-foreground truncate" title={displayName}>
                      {displayName}
                    </p>
                    <p className="text-[10px] text-muted-foreground font-mono">
                      {formatBytes(att.size)}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <Button
                    type="button"
                    variant="outline"
                    size="xs"
                    onClick={() => handleView(att)}
                    className="gap-1 text-xs"
                    title="Play Video"
                  >
                    <Play className="w-3.5 h-3.5 text-blue-500 fill-blue-500" />
                    <span>Play</span>
                  </Button>
                  {!disabled && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-xs"
                      onClick={() => handleRemove(att.id)}
                      className="text-muted-foreground hover:text-destructive"
                      title="Remove Video"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Simple in-line modal preview if clicked and DocumentViewer is not invoked */}
      {activePreviewUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 animate-in fade-in duration-150">
          <div className="bg-background rounded-2xl max-w-2xl w-full max-h-[85vh] overflow-hidden flex flex-col shadow-2xl border">
            <div className="p-3 border-b flex justify-between items-center bg-muted/20">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Attachment Preview
              </span>
              <Button
                size="xs"
                variant="ghost"
                onClick={() => setActivePreviewUrl(null)}
              >
                Close
              </Button>
            </div>
            <div className="p-4 overflow-auto flex items-center justify-center bg-muted/10 min-h-[250px]">
              {isPhoto ? (
                <img
                  src={activePreviewUrl}
                  alt="Preview"
                  className="max-h-[65vh] max-w-full object-contain rounded-lg shadow"
                />
              ) : (
                <video
                  src={activePreviewUrl}
                  controls
                  autoPlay
                  className="max-h-[65vh] max-w-full rounded-lg shadow"
                />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
