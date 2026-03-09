"use client";

/**
 * components/UnityGamePlayer.tsx
 *
 * Loads and mounts the Unity WebGL build.
 * Bridge wiring (auth, session, marketplace) is handled externally
 * by useUnityBridge — this component only manages the canvas lifecycle.
 *
 * Props:
 *   buildPath          — relative path to Unity build folder (e.g. "/unity-build")
 *   onUnityInstanceReady — called with the raw Unity instance once loaded
 *   onUnityReady         — called after instance is ready + short settle delay
 *   isVisible            — controls canvas visibility (Unity stays mounted)
 *   className            — forwarded to wrapper div
 */

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

interface UnityBuildConfig {
  dataUrl: string;
  frameworkUrl: string;
  codeUrl: string;
  streamingAssetsUrl: string;
  companyName: string;
  productName: string;
  productVersion: string;
}

declare global {
  interface Window {
    createUnityInstance: (
      canvas: HTMLCanvasElement,
      config: UnityBuildConfig,
      onProgress?: (progress: number) => void,
    ) => Promise<any>;
  }
}

interface UnityGamePlayerProps {
  buildPath: string;
  onUnityInstanceReady?: (instance: any) => void;
  onUnityReady?: () => void;
  isVisible?: boolean;
  className?: string;
}

export default function UnityGamePlayer({
  buildPath,
  onUnityInstanceReady,
  onUnityReady,
  isVisible = true,
  className,
}: UnityGamePlayerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const loadedRef = useRef(false);

  const [loadingProgress, setLoadingProgress] = useState(0);
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (loadedRef.current || !canvasRef.current) return;

    let mounted = true;

    const load = async () => {
      try {
        // Inject Unity loader script once
        const script = document.createElement("script");
        script.src = `${buildPath}/Build/build.loader.js`;

        await new Promise<void>((resolve, reject) => {
          script.onload = () => resolve();
          script.onerror = () =>
            reject(new Error("Failed to load Unity loader script"));
          document.head.appendChild(script);
        });

        if (!mounted || !canvasRef.current) return;

        const config: UnityBuildConfig = {
          dataUrl: `${buildPath}/Build/build.data`,
          frameworkUrl: `${buildPath}/Build/build.framework.js`,
          codeUrl: `${buildPath}/Build/build.wasm`,
          streamingAssetsUrl: "StreamingAssets",
          companyName: "Blockchain Gods",
          productName: "Node Defenders",
          productVersion: "0.1.0",
        };

        const instance = await window.createUnityInstance(
          canvasRef.current,
          config,
          (progress) => {
            if (mounted) setLoadingProgress(Math.round(progress * 100));
          },
        );

        if (!mounted) return;

        loadedRef.current = true;
        setLoadingProgress(100);
        setIsReady(true);

        onUnityInstanceReady?.(instance);

        // Short settle delay before signalling ready
        setTimeout(() => {
          if (mounted) onUnityReady?.();
        }, 500);
      } catch (err) {
        if (mounted) {
          const msg =
            err instanceof Error ? err.message : "Failed to load Unity";
          setError(msg);
        }
      }
    };

    load();

    return () => {
      mounted = false;
    };
    // Run once — buildPath won't change at runtime
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [buildPath]);

  if (error) {
    return (
      <div className="w-full h-full bg-slate-900 flex items-center justify-center">
        <div className="text-center space-y-3 p-6">
          <p className="text-red-400 font-mono text-sm">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-red-600/20 border border-red-600/40 text-red-400 rounded font-mono text-xs hover:bg-red-600/30 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("w-full h-full relative bg-slate-900", className)}>
      {/* Unity canvas — always mounted, visibility toggled */}
      <canvas
        ref={canvasRef}
        id="unity-canvas"
        className={cn(
          "w-full h-full",
          isVisible && isReady ? "block" : "hidden",
        )}
      />

      {/* Loading screen — shown until Unity is ready */}
      {!isReady && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center space-y-4">
            {/* Cyberpunk loading indicator */}
            <div className="relative w-48 mx-auto">
              <div className="h-0.5 w-full bg-slate-800 rounded">
                <div
                  className="h-full bg-cyan-400 rounded transition-all duration-300"
                  style={{ width: `${loadingProgress}%` }}
                />
              </div>
              {/* Scanline glow */}
              <div
                className="absolute top-0 h-full bg-cyan-400/30 blur-sm rounded transition-all duration-300"
                style={{ width: `${loadingProgress}%` }}
              />
            </div>
            <p className="text-cyan-400/60 font-mono text-xs tracking-widest uppercase">
              Loading {loadingProgress < 100 ? `${loadingProgress}%` : "..."}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
