import { useState, useCallback } from "react";
import { notify } from "@/components/ui/sonner";
import { useT } from "@/lib/i18n";

export const useFileUpload = () => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const t = useT();

  const handleRawFileSelect = useCallback((file: File) => {
    const lowerName = file.name.toLowerCase();
    const isPptx = lowerName.endsWith(".pptx");
    if (!isPptx) {
      notify.error(t("customTemplate.upload.invalidFileTitle"), t("customTemplate.upload.invalidFileMessage"));
      return;
    }

    const maxSize = 100 * 1024 * 1024;
    if (file.size > maxSize) {
      notify.error(t("customTemplate.upload.tooLargeTitle"), t("customTemplate.upload.tooLargeMessage"));
      return;
    }

    setSelectedFile(file);
  }, [t]);

  const handleFileSelect = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;
      handleRawFileSelect(file);
    },
    [handleRawFileSelect]
  );

  const removeFile = useCallback(() => {
    setSelectedFile(null);
  }, []);

  return {
    selectedFile,
    handleFileSelect,
    handleRawFileSelect,
    removeFile,
  };
};
