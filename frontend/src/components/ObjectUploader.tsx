import { useState } from "react";
import type { ReactNode } from "react";
import Uppy from "@uppy/core";
import Dashboard from "@uppy/react/dashboard";
import "@uppy/core/css/style.min.css";
import "@uppy/dashboard/css/style.min.css";
import XHRUpload from "@uppy/xhr-upload";
import type { UploadResult } from "@uppy/core";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

interface ObjectUploaderProps {
  maxNumberOfFiles?: number;
  maxFileSize?: number;
  allowedFileTypes?: string[];
  mode?: "modal" | "inline";
  endpoint?: string;
  onComplete?: (result: any) => void;
  buttonClassName?: string;
  children?: ReactNode;
}

export function ObjectUploader({
  maxNumberOfFiles = 1,
  maxFileSize = 104857600,
  allowedFileTypes,
  mode = "modal",
  endpoint = "/api/objects/upload",
  onComplete,
  buttonClassName,
  children,
  extraData = {},
}: ObjectUploaderProps & { extraData?: Record<string, string> }) {
  const [showModal, setShowModal] = useState(false);
  const [uppy] = useState(() =>
    new Uppy({
      restrictions: {
        maxNumberOfFiles,
        maxFileSize,
        allowedFileTypes,
      },
      meta: extraData,
      autoProceed: true,
    })
      .use(XHRUpload, {
        endpoint,
        fieldName: "file",
        formData: true,
      })
      .on("upload-success", (file, response) => {
        if (file) {
          console.log("Uppy upload-success:", file.name, response);
        }
      })
      .on("complete", (result) => {
        console.log("Uppy complete:", result);
        onComplete?.(result);
        setShowModal(false);
      })
      .on("error", (error) => {
        console.error("Uppy error:", error);
      })
  );

  if (mode === "inline") {
    return (
      <div className="w-full border rounded-lg overflow-hidden bg-background">
        <Dashboard
          uppy={uppy}
          proudlyDisplayPoweredByUppy={false}
          height={300}
          width="100%"
          hideUploadButton
        />
      </div>
    );
  }

  return (
    <div>
      <Button 
        type="button" 
        variant="outline" 
        onClick={() => setShowModal(true)} 
        className={buttonClassName}
      >
        {children}
      </Button>

      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="sm:max-w-[600px] p-0 overflow-hidden">
          <div className="p-4">
            <Dashboard
              uppy={uppy}
              proudlyDisplayPoweredByUppy={false}
              height={350}
              width="100%"
            />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
