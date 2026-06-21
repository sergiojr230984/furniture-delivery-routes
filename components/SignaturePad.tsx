"use client";

import { useRef, useState, useEffect } from "react";
import { Eraser } from "lucide-react";

// Lightweight canvas signature capture. Calls onSave with a PNG blob.
export default function SignaturePad({
  onSave,
  saving,
}: {
  onSave: (blob: Blob, signerName: string) => void;
  saving: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const [hasInk, setHasInk] = useState(false);
  const [signerName, setSignerName] = useState("");

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    // Match the backing store to the displayed size for crisp lines.
    const ratio = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * ratio;
    canvas.height = rect.height * ratio;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.scale(ratio, ratio);
      ctx.lineWidth = 2;
      ctx.lineCap = "round";
      ctx.strokeStyle = "#111827";
    }
  }, []);

  function pos(e: React.PointerEvent) {
    const rect = canvasRef.current!.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  function start(e: React.PointerEvent) {
    e.preventDefault();
    drawing.current = true;
    const ctx = canvasRef.current!.getContext("2d")!;
    const { x, y } = pos(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
  }

  function move(e: React.PointerEvent) {
    if (!drawing.current) return;
    e.preventDefault();
    const ctx = canvasRef.current!.getContext("2d")!;
    const { x, y } = pos(e);
    ctx.lineTo(x, y);
    ctx.stroke();
    setHasInk(true);
  }

  function end() {
    drawing.current = false;
  }

  function clear() {
    const canvas = canvasRef.current!;
    canvas.getContext("2d")!.clearRect(0, 0, canvas.width, canvas.height);
    setHasInk(false);
  }

  function save() {
    canvasRef.current!.toBlob((blob) => {
      if (blob) onSave(blob, signerName.trim());
    }, "image/png");
  }

  return (
    <div className="space-y-2">
      <input
        className="input"
        placeholder="Signer name"
        value={signerName}
        onChange={(e) => setSignerName(e.target.value)}
      />
      <canvas
        ref={canvasRef}
        onPointerDown={start}
        onPointerMove={move}
        onPointerUp={end}
        onPointerLeave={end}
        className="h-40 w-full touch-none rounded-lg border-2 border-dashed border-gray-300 bg-white"
      />
      <div className="flex gap-2">
        <button type="button" onClick={clear} className="btn-secondary flex-1">
          <Eraser className="h-4 w-4" /> Clear
        </button>
        <button
          type="button"
          onClick={save}
          disabled={!hasInk || saving}
          className="btn-primary flex-1"
        >
          Save signature
        </button>
      </div>
    </div>
  );
}
