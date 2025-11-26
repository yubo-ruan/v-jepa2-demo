"use client";

import { useCallback, useState } from "react";
import { saveAs } from "file-saver";
import JSZip from "jszip";

export type ExportFormat = "gif" | "png-sequence" | "webm";

export interface ExportProgress {
  stage: "rendering" | "encoding" | "compressing" | "done";
  progress: number; // 0-100
  currentFrame?: number;
  totalFrames?: number;
}

interface ExportAnimationOptions {
  width?: number;
  height?: number;
  fps?: number;
  quality?: number; // 1-10 for GIF
  filename?: string;
}

/**
 * Hook for exporting SVG animations to various formats.
 * Captures each frame by rendering to canvas and encoding.
 */
export function useExportAnimation() {
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState<ExportProgress | null>(null);

  /**
   * Capture an SVG element as a canvas image
   */
  const captureSvgToCanvas = useCallback(
    async (
      svgElement: SVGSVGElement,
      width: number,
      height: number
    ): Promise<HTMLCanvasElement> => {
      return new Promise((resolve, reject) => {
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Could not get canvas context"));
          return;
        }

        // Serialize SVG to string
        const svgString = new XMLSerializer().serializeToString(svgElement);
        const svgBlob = new Blob([svgString], { type: "image/svg+xml;charset=utf-8" });
        const url = URL.createObjectURL(svgBlob);

        const img = new Image();
        img.onload = () => {
          // Fill background
          ctx.fillStyle = "#18181b"; // zinc-900
          ctx.fillRect(0, 0, width, height);
          ctx.drawImage(img, 0, 0, width, height);
          URL.revokeObjectURL(url);
          resolve(canvas);
        };
        img.onerror = () => {
          URL.revokeObjectURL(url);
          reject(new Error("Failed to load SVG image"));
        };
        img.src = url;
      });
    },
    []
  );

  /**
   * Capture a DOM element (including children) to canvas
   */
  const captureDomToCanvas = useCallback(
    async (
      element: HTMLElement,
      width: number,
      height: number
    ): Promise<HTMLCanvasElement> => {
      // Use html2canvas-style approach with native APIs
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Could not get canvas context");

      // Fill background
      ctx.fillStyle = "#18181b";
      ctx.fillRect(0, 0, width, height);

      // Find all SVGs and render them
      const svgs = element.querySelectorAll("svg");
      for (const svg of svgs) {
        const rect = svg.getBoundingClientRect();
        const parentRect = element.getBoundingClientRect();

        // Calculate position relative to parent
        const x = rect.left - parentRect.left;
        const y = rect.top - parentRect.top;
        const svgWidth = rect.width;
        const svgHeight = rect.height;

        try {
          const svgCanvas = await captureSvgToCanvas(
            svg as SVGSVGElement,
            svgWidth * 2, // 2x for retina
            svgHeight * 2
          );
          ctx.drawImage(svgCanvas, x, y, svgWidth, svgHeight);
        } catch {
          console.warn("Failed to capture SVG", svg);
        }
      }

      return canvas;
    },
    [captureSvgToCanvas]
  );

  /**
   * Export as GIF using gif.js
   */
  const exportAsGif = useCallback(
    async (
      frames: HTMLCanvasElement[],
      options: ExportAnimationOptions = {}
    ): Promise<Blob> => {
      const { fps = 2, quality = 10, width = 600, height = 400 } = options;

      // Dynamically import gif.js (it uses web workers)
      const GIF = (await import("gif.js")).default;

      return new Promise((resolve, reject) => {
        const gif = new GIF({
          workers: 2,
          quality,
          width,
          height,
          workerScript: "/gif.worker.js",
        });

        frames.forEach((canvas, index) => {
          gif.addFrame(canvas, { delay: 1000 / fps, copy: true });
          setExportProgress({
            stage: "encoding",
            progress: Math.round(((index + 1) / frames.length) * 50),
            currentFrame: index + 1,
            totalFrames: frames.length,
          });
        });

        gif.on("progress", (p: number) => {
          setExportProgress({
            stage: "encoding",
            progress: 50 + Math.round(p * 50),
          });
        });

        gif.on("finished", (blob: Blob) => {
          resolve(blob);
        });

        gif.on("error", (err: Error) => {
          reject(err);
        });

        gif.render();
      });
    },
    []
  );

  /**
   * Export as PNG sequence in a ZIP file
   */
  const exportAsPngSequence = useCallback(
    async (
      frames: HTMLCanvasElement[],
      options: ExportAnimationOptions = {}
    ): Promise<Blob> => {
      const { filename = "animation" } = options;
      const zip = new JSZip();
      const folder = zip.folder(filename);

      if (!folder) throw new Error("Failed to create zip folder");

      for (let i = 0; i < frames.length; i++) {
        const canvas = frames[i];
        const blob = await new Promise<Blob>((resolve, reject) => {
          canvas.toBlob(
            (b) => (b ? resolve(b) : reject(new Error("Failed to create blob"))),
            "image/png"
          );
        });

        const frameNum = String(i + 1).padStart(4, "0");
        folder.file(`frame_${frameNum}.png`, blob);

        setExportProgress({
          stage: "compressing",
          progress: Math.round(((i + 1) / frames.length) * 100),
          currentFrame: i + 1,
          totalFrames: frames.length,
        });
      }

      return await zip.generateAsync({ type: "blob" });
    },
    []
  );

  /**
   * Export as WebM video using MediaRecorder
   */
  const exportAsWebm = useCallback(
    async (
      frames: HTMLCanvasElement[],
      options: ExportAnimationOptions = {}
    ): Promise<Blob> => {
      const { fps = 2, width = 600, height = 400 } = options;

      // Create a canvas for rendering
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Could not get canvas context");

      // Check if MediaRecorder supports webm
      const mimeType = MediaRecorder.isTypeSupported("video/webm;codecs=vp9")
        ? "video/webm;codecs=vp9"
        : "video/webm";

      const stream = canvas.captureStream(fps);
      const recorder = new MediaRecorder(stream, { mimeType });
      const chunks: Blob[] = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };

      return new Promise((resolve, reject) => {
        recorder.onstop = () => {
          resolve(new Blob(chunks, { type: mimeType }));
        };

        recorder.onerror = () => {
          reject(new Error("Recording failed"));
        };

        recorder.start();

        // Render frames
        let frameIndex = 0;
        const frameDuration = 1000 / fps;

        const renderFrame = () => {
          if (frameIndex >= frames.length) {
            recorder.stop();
            return;
          }

          ctx.clearRect(0, 0, width, height);
          ctx.drawImage(frames[frameIndex], 0, 0, width, height);

          setExportProgress({
            stage: "encoding",
            progress: Math.round(((frameIndex + 1) / frames.length) * 100),
            currentFrame: frameIndex + 1,
            totalFrames: frames.length,
          });

          frameIndex++;
          setTimeout(renderFrame, frameDuration);
        };

        renderFrame();
      });
    },
    []
  );

  /**
   * Main export function - renders frames and exports in chosen format
   */
  const exportAnimation = useCallback(
    async (
      renderFrame: (frameIndex: number) => Promise<HTMLCanvasElement>,
      totalFrames: number,
      format: ExportFormat,
      options: ExportAnimationOptions = {}
    ) => {
      const { filename = "vjepa2-animation" } = options;

      setIsExporting(true);
      setExportProgress({ stage: "rendering", progress: 0 });

      try {
        // Render all frames
        const frames: HTMLCanvasElement[] = [];
        for (let i = 0; i < totalFrames; i++) {
          const canvas = await renderFrame(i);
          frames.push(canvas);
          setExportProgress({
            stage: "rendering",
            progress: Math.round(((i + 1) / totalFrames) * 100),
            currentFrame: i + 1,
            totalFrames,
          });
        }

        // Export in chosen format
        let blob: Blob;
        let extension: string;

        switch (format) {
          case "gif":
            blob = await exportAsGif(frames, options);
            extension = "gif";
            break;
          case "png-sequence":
            blob = await exportAsPngSequence(frames, options);
            extension = "zip";
            break;
          case "webm":
            blob = await exportAsWebm(frames, options);
            extension = "webm";
            break;
          default:
            throw new Error(`Unsupported format: ${format}`);
        }

        // Download
        setExportProgress({ stage: "done", progress: 100 });
        saveAs(blob, `${filename}.${extension}`);

        return true;
      } catch (error) {
        console.error("Export failed:", error);
        throw error;
      } finally {
        setIsExporting(false);
        setTimeout(() => setExportProgress(null), 2000);
      }
    },
    [exportAsGif, exportAsPngSequence, exportAsWebm]
  );

  return {
    exportAnimation,
    captureSvgToCanvas,
    captureDomToCanvas,
    isExporting,
    exportProgress,
  };
}
