import { useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useFormatters } from "@/lib/format";
import { Upload, FileText, X, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface FileDropzoneProps {
  onFileSelect: (file: File) => void;
  acceptedTypes?: string[];
  maxSize?: number; // in MB
}

export const FileDropzone = ({ 
  onFileSelect, 
  acceptedTypes = [".pdf", ".docx", ".doc", ".txt"],
  maxSize = 10
}: FileDropzoneProps) => {
  const { t } = useTranslation("instructor");
  const { formatNumber } = useFormatters();
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);

  const validateFile = useCallback((file: File): boolean => {
    const extension = "." + file.name.split('.').pop()?.toLowerCase();
    if (!acceptedTypes.includes(extension)) {
      setError(t("syllabus.dropzone.invalidType", { types: acceptedTypes.join(", ") }));
      return false;
    }
    if (file.size > maxSize * 1024 * 1024) {
      setError(t("syllabus.dropzone.tooLarge", { size: t("syllabus.dropzone.sizeMB", { value: formatNumber(maxSize) }) }));
      return false;
    }
    setError(null);
    return true;
  }, [acceptedTypes, maxSize, t, formatNumber]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const file = e.dataTransfer.files[0];
    if (file && validateFile(file)) {
      setSelectedFile(file);
      onFileSelect(file);
    }
  }, [onFileSelect, validateFile]);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && validateFile(file)) {
      setSelectedFile(file);
      onFileSelect(file);
    }
  };

  const clearFile = () => {
    setSelectedFile(null);
    setError(null);
  };

  const formatFileSize = (bytes: number): string => {
    const opts = { maximumFractionDigits: 1 };
    if (bytes < 1024) return t("syllabus.dropzone.sizeB", { value: formatNumber(bytes) });
    if (bytes < 1024 * 1024) return t("syllabus.dropzone.sizeKB", { value: formatNumber(bytes / 1024, opts) });
    return t("syllabus.dropzone.sizeMB", { value: formatNumber(bytes / (1024 * 1024), opts) });
  };

  return (
    <div className="space-y-4">
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={cn(
          "relative border-2 border-dashed rounded-2xl p-8 transition-all duration-300 cursor-pointer group",
          isDragging 
            ? "border-primary bg-primary/5 scale-[1.02]" 
            : "border-border hover:border-primary/50 hover:bg-muted/50",
          selectedFile && "border-success bg-success/5",
          error && "border-destructive bg-destructive/5"
        )}
      >
        <input
          type="file"
          accept={acceptedTypes.join(",")}
          onChange={handleFileInput}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
        />

        <div className="flex flex-col items-center text-center">
          {/* Icon */}
          <div className={cn(
            "w-16 h-16 rounded-2xl flex items-center justify-center mb-4 transition-all duration-300",
            isDragging 
              ? "bg-primary/10 scale-110" 
              : "bg-muted group-hover:bg-primary/10",
            selectedFile && "bg-success/10",
            error && "bg-destructive/10"
          )}>
            {selectedFile ? (
              <CheckCircle2 className="w-8 h-8 text-success" />
            ) : (
              <Upload className={cn(
                "w-8 h-8 transition-all duration-300",
                isDragging ? "text-primary scale-110" : "text-muted-foreground group-hover:text-primary"
              )} />
            )}
          </div>

          {/* Text */}
          {selectedFile ? (
            <div className="space-y-1">
              <p className="font-medium text-success">{t("syllabus.dropzone.fileSelected")}</p>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <FileText className="w-4 h-4" />
                <span dir="ltr">{selectedFile.name}</span>
                <span className="text-xs">({formatFileSize(selectedFile.size)})</span>
              </div>
            </div>
          ) : (
            <>
              <p className="font-medium mb-1">
                {isDragging ? t("syllabus.dropzone.drop") : t("syllabus.dropzone.drag")}
              </p>
              <p className="text-sm text-muted-foreground mb-3">
                {t("syllabus.dropzone.browse")}
              </p>
              <div className="flex flex-wrap justify-center gap-2">
                {acceptedTypes.map((type) => (
                  <span 
                    key={type}
                    className="px-2 py-1 rounded-lg bg-muted text-xs font-medium text-muted-foreground uppercase"
                  >
                    {type.replace(".", "")}
                  </span>
                ))}
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                {t("syllabus.dropzone.maxSize", { size: t("syllabus.dropzone.sizeMB", { value: formatNumber(maxSize) }) })}
              </p>
            </>
          )}
        </div>

        {/* Animated Border Glow */}
        {isDragging && (
          <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-primary/20 via-accent/20 to-primary/20 blur-xl -z-10 animate-pulse" />
        )}
      </div>

      {/* Error Message */}
      {error && (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-destructive/10 text-destructive text-sm animate-fade-in">
          <X className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Clear Button */}
      {selectedFile && (
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={clearFile}
          className="w-full"
        >
          <X className="w-4 h-4 me-2" />
          {t("syllabus.dropzone.remove")}
        </Button>
      )}
    </div>
  );
};
