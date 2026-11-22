"use client";
// Обрезка идёт в браузере: нужны canvas, указатели и колесо мыши, на сервере их нет.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Camera, Check, Crop, RotateCw, Trash, Undo2, X } from "lucide-react";
import { imagePresets, maxFileBytes, maxSidePixels, type PresetId } from "./image-presets";

export type ImageValues = Record<string, string>;
type View = { scale: number; x: number; y: number };
type Source = { canvas: HTMLCanvasElement; width: number; height: number; naturalWidth: number; naturalHeight: number };

const STAGE = { width: 520, height: 360, pad: 20 };

function frameRect(preset: PresetId, stageWidth: number, stageHeight: number) {
  const { width, height } = imagePresets[preset];
  const available = { width: stageWidth - STAGE.pad * 2, height: stageHeight - STAGE.pad * 2 };
  const scale = Math.min(available.width / width, available.height / height);
  const frameWidth = width * scale;
  const frameHeight = height * scale;
  return { x: (stageWidth - frameWidth) / 2, y: (stageHeight - frameHeight) / 2, width: frameWidth, height: frameHeight };
}

function coverView(source: Source, preset: PresetId, stageWidth: number, stageHeight: number): View {
  const frame = frameRect(preset, stageWidth, stageHeight);
  const scale = Math.max(frame.width / source.width, frame.height / source.height);
  return { scale, x: frame.x + (frame.width - source.width * scale) / 2, y: frame.y + (frame.height - source.height * scale) / 2 };
}

function clampView(view: View, source: Source, preset: PresetId, stageWidth: number, stageHeight: number): View {
  const frame = frameRect(preset, stageWidth, stageHeight);
  const minScale = Math.max(frame.width / source.width, frame.height / source.height);
  const scale = Math.min(Math.max(view.scale, minScale), minScale * 8);
  const width = source.width * scale;
  const height = source.height * scale;
  return { scale, x: Math.min(frame.x, Math.max(frame.x + frame.width - width, view.x)), y: Math.min(frame.y, Math.max(frame.y + frame.height - height, view.y)) };
}

// Крупным кадрам нужен запас по весу, мелким — нет: предел считается от размера рамки.
function limitFor(preset: PresetId) {
  const { width, height } = imagePresets[preset];
  return width * height > 1_500_000 ? 2_100_000 : 790_000;
}

function encode(canvas: HTMLCanvasElement, limit: number) {
  for (const quality of [0.88, 0.78, 0.68, 0.56, 0.44, 0.34]) {
    const webp = canvas.toDataURL("image/webp", quality);
    if (webp.startsWith("data:image/webp") && webp.length < limit) return webp;
    if (!webp.startsWith("data:image/webp")) {
      const jpeg = canvas.toDataURL("image/jpeg", quality);
      if (jpeg.length < limit) return jpeg;
    }
  }
  throw new Error("Картинка слишком тяжёлая даже после сжатия. Выберите другую.");
}

function rotateCanvas(source: Source): Source {
  const canvas = document.createElement("canvas");
  canvas.width = source.height;
  canvas.height = source.width;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Браузер не дал обработать картинку.");
  context.translate(canvas.width / 2, canvas.height / 2);
  context.rotate(Math.PI / 2);
  context.drawImage(source.canvas, -source.width / 2, -source.height / 2);
  return { canvas, width: canvas.width, height: canvas.height, naturalWidth: source.naturalHeight, naturalHeight: source.naturalWidth };
}

export function ImagePicker({ label, presets, value, onChange, help, previewPreset }: { label: string; presets: PresetId[]; value: ImageValues; onChange: (next: ImageValues) => void; help?: string; previewPreset?: PresetId }) {
  const [open, setOpen] = useState(false);
  const [source, setSource] = useState<Source | null>(null);
  const [index, setIndex] = useState(0);
  const [view, setView] = useState<View>({ scale: 1, x: 0, y: 0 });
  const [crops, setCrops] = useState<ImageValues>({});
  const [error, setError] = useState("");
  const [lowRes, setLowRes] = useState("");
  const [accepted, setAccepted] = useState(false);
  const [device, setDevice] = useState(presets[0]);
  const [stage, setStage] = useState({ width: STAGE.width, height: STAGE.height });
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const holderRef = useRef<HTMLDivElement>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef<{ distance: number; scale: number } | null>(null);
  const handle = useRef<{ distance: number; scale: number } | null>(null);
  const preset = presets[Math.min(index, presets.length - 1)];
  const target = imagePresets[preset];

  useEffect(() => {
    if (!open || !holderRef.current) return;
    const element = holderRef.current;
    const observer = new ResizeObserver(() => {
      const width = Math.max(260, Math.min(STAGE.width, element.clientWidth));
      const next = { width, height: Math.round(width * (STAGE.height / STAGE.width)) };
      setStage(next);
      setView((current) => (source ? clampView(current, source, preset, next.width, next.height) : current));
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [open, preset, source]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !source) return;
    const context = canvas.getContext("2d");
    if (!context) return;
    const ratio = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = stage.width * ratio;
    canvas.height = stage.height * ratio;
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.clearRect(0, 0, stage.width, stage.height);
    context.fillStyle = "#11181d";
    context.fillRect(0, 0, stage.width, stage.height);
    context.imageSmoothingQuality = "high";
    context.drawImage(source.canvas, view.x, view.y, source.width * view.scale, source.height * view.scale);
    const frame = frameRect(preset, stage.width, stage.height);
    context.fillStyle = "rgba(10,14,17,0.66)";
    context.fillRect(0, 0, stage.width, frame.y);
    context.fillRect(0, frame.y + frame.height, stage.width, stage.height - frame.y - frame.height);
    context.fillRect(0, frame.y, frame.x, frame.height);
    context.fillRect(frame.x + frame.width, frame.y, stage.width - frame.x - frame.width, frame.height);
    context.strokeStyle = "#ffffff";
    context.lineWidth = 2;
    context.strokeRect(frame.x, frame.y, frame.width, frame.height);
    context.strokeStyle = "rgba(255,255,255,0.35)";
    context.lineWidth = 1;
    for (let line = 1; line < 3; line += 1) {
      context.beginPath();
      context.moveTo(frame.x + (frame.width / 3) * line, frame.y);
      context.lineTo(frame.x + (frame.width / 3) * line, frame.y + frame.height);
      context.moveTo(frame.x, frame.y + (frame.height / 3) * line);
      context.lineTo(frame.x + frame.width, frame.y + (frame.height / 3) * line);
      context.stroke();
    }
    context.fillStyle = "#ffffff";
    for (const corner of [[frame.x, frame.y], [frame.x + frame.width, frame.y], [frame.x, frame.y + frame.height], [frame.x + frame.width, frame.y + frame.height]]) {
      context.fillRect(corner[0] - 5, corner[1] - 5, 10, 10);
    }
  }, [preset, source, stage.height, stage.width, view]);

  useEffect(() => { draw(); }, [draw]);

  function reset(next: Source, frameIndex: number) {
    setView(coverView(next, presets[frameIndex], stage.width, stage.height));
  }

  async function pick(file: File | undefined) {
    setError(""); setLowRes(""); setAccepted(false); setCrops({});
    if (!file) return;
    if (!file.type.startsWith("image/")) { setError("Это не картинка. Выберите файл JPG, PNG или WebP."); return; }
    if (file.size > maxFileBytes) { setError(`Файл ${(file.size / 1024 / 1024).toFixed(1)} МБ, а можно до 15 МБ. Выберите картинку полегче.`); return; }
    const url = URL.createObjectURL(file);
    try {
      const image = await new Promise<HTMLImageElement>((resolve, reject) => { const element = new window.Image(); element.onload = () => resolve(element); element.onerror = () => reject(new Error("Не удалось открыть картинку. Возможно, файл повреждён.")); element.src = url; });
      if (image.naturalWidth > maxSidePixels || image.naturalHeight > maxSidePixels) throw new Error(`Картинка ${image.naturalWidth} × ${image.naturalHeight} точек — слишком большая. Максимум ${maxSidePixels} точек по стороне.`);
      const limit = 2600;
      const shrink = Math.min(1, limit / Math.max(image.naturalWidth, image.naturalHeight));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(image.naturalWidth * shrink));
      canvas.height = Math.max(1, Math.round(image.naturalHeight * shrink));
      canvas.getContext("2d")?.drawImage(image, 0, 0, canvas.width, canvas.height);
      const next: Source = { canvas, width: canvas.width, height: canvas.height, naturalWidth: image.naturalWidth, naturalHeight: image.naturalHeight };
      setSource(next);
      setIndex(0);
      setDevice(presets[0]);
      reset(next, 0);
      setOpen(true);
      const smallest = presets.reduce((min, item) => (imagePresets[item].width < imagePresets[min].width ? item : min), presets[0]);
      const needed = imagePresets[smallest];
      if (image.naturalWidth < needed.width || image.naturalHeight < needed.height) {
        setLowRes(`Картинка мелкая, на большом экране будет размытой. Нужна хотя бы ${needed.width} × ${needed.height} точек, у вас ${image.naturalWidth} × ${image.naturalHeight}.`);
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Не удалось открыть картинку.");
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  function render(frame: PresetId, state: View, from: Source) {
    const box = frameRect(frame, stage.width, stage.height);
    const size = imagePresets[frame];
    const canvas = document.createElement("canvas");
    canvas.width = size.width;
    canvas.height = size.height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Браузер не дал обработать картинку.");
    context.imageSmoothingQuality = "high";
    const factor = size.width / box.width;
    context.drawImage(from.canvas, (state.x - box.x) * factor, (state.y - box.y) * factor, from.width * state.scale * factor, from.height * state.scale * factor);
    return encode(canvas, limitFor(frame));
  }

  // Превью режется из того же положения рамки, поэтому показывает ровно то, что выбрал владелец.
  function renderPreview(state: View, from: Source): ImageValues {
    return previewPreset ? { preview: render(previewPreset, state, from) } : {};
  }

  function confirmFrame() {
    if (!source) return;
    try {
      const next = { ...crops, [preset]: render(preset, view, source) };
      setCrops(next);
      setError("");
      if (index + 1 < presets.length) { setIndex(index + 1); reset(source, index + 1); setDevice(presets[index + 1]); }
      else { onChange({ ...next, ...renderPreview(view, source) }); setOpen(false); setSource(null); }
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Не удалось обрезать картинку."); }
  }

  function applyToAll() {
    if (!source) return;
    try {
      const next: ImageValues = { ...crops, [preset]: render(preset, view, source) };
      for (const frame of presets) if (!next[frame]) next[frame] = render(frame, coverView(source, frame, stage.width, stage.height), source);
      setCrops(next);
      onChange({ ...next, ...renderPreview(view, source) });
      setOpen(false);
      setSource(null);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Не удалось обрезать картинку."); }
  }

  function onPointerDown(event: React.PointerEvent<HTMLCanvasElement>) {
    if (!source) return;
    (event.target as HTMLCanvasElement).setPointerCapture(event.pointerId);
    const rect = event.currentTarget.getBoundingClientRect();
    const point = { x: event.clientX - rect.left, y: event.clientY - rect.top };
    pointers.current.set(event.pointerId, point);
    if (pointers.current.size === 1) {
      const frame = frameRect(preset, stage.width, stage.height);
      const center = { x: frame.x + frame.width / 2, y: frame.y + frame.height / 2 };
      const nearCorner = [[frame.x, frame.y], [frame.x + frame.width, frame.y], [frame.x, frame.y + frame.height], [frame.x + frame.width, frame.y + frame.height]].some((corner) => Math.hypot(corner[0] - point.x, corner[1] - point.y) <= 14);
      handle.current = nearCorner ? { distance: Math.hypot(point.x - center.x, point.y - center.y), scale: view.scale } : null;
    }
    if (pointers.current.size === 2) {
      const [first, second] = [...pointers.current.values()];
      pinch.current = { distance: Math.hypot(first.x - second.x, first.y - second.y), scale: view.scale };
      handle.current = null;
    }
  }

  const zoomAt = useCallback((nextScale: number, anchor: { x: number; y: number }) => {
    if (!source) return;
    setView((current) => {
      const factor = nextScale / current.scale;
      return clampView({ scale: nextScale, x: anchor.x - (anchor.x - current.x) * factor, y: anchor.y - (anchor.y - current.y) * factor }, source, preset, stage.width, stage.height);
    });
  }, [preset, source, stage.height, stage.width]);

  function onPointerMove(event: React.PointerEvent<HTMLCanvasElement>) {
    if (!source || !pointers.current.has(event.pointerId)) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const point = { x: event.clientX - rect.left, y: event.clientY - rect.top };
    const previous = pointers.current.get(event.pointerId)!;
    pointers.current.set(event.pointerId, point);
    if (pointers.current.size >= 2 && pinch.current) {
      const [first, second] = [...pointers.current.values()];
      const distance = Math.hypot(first.x - second.x, first.y - second.y);
      if (pinch.current.distance > 0) zoomAt(pinch.current.scale * (distance / pinch.current.distance), { x: (first.x + second.x) / 2, y: (first.y + second.y) / 2 });
      return;
    }
    if (handle.current) {
      const frame = frameRect(preset, stage.width, stage.height);
      const center = { x: frame.x + frame.width / 2, y: frame.y + frame.height / 2 };
      const distance = Math.hypot(point.x - center.x, point.y - center.y);
      if (handle.current.distance > 0) zoomAt(handle.current.scale * (handle.current.distance / Math.max(8, distance)), center);
      return;
    }
    setView((current) => clampView({ ...current, x: current.x + (point.x - previous.x), y: current.y + (point.y - previous.y) }, source, preset, stage.width, stage.height));
  }

  function onPointerUp(event: React.PointerEvent<HTMLCanvasElement>) {
    pointers.current.delete(event.pointerId);
    if (pointers.current.size < 2) pinch.current = null;
    if (pointers.current.size === 0) handle.current = null;
  }

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !open) return;
    const onWheel = (event: WheelEvent) => {
      if (!source) return;
      event.preventDefault();
      const rect = canvas.getBoundingClientRect();
      zoomAt(view.scale * (event.deltaY < 0 ? 1.12 : 1 / 1.12), { x: event.clientX - rect.left, y: event.clientY - rect.top });
    };
    canvas.addEventListener("wheel", onWheel, { passive: false });
    return () => canvas.removeEventListener("wheel", onWheel);
  }, [open, source, view.scale, zoomAt]);

  useEffect(() => { if (!open) return; const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") { setOpen(false); setSource(null); } }; window.addEventListener("keydown", onKey); return () => window.removeEventListener("keydown", onKey); }, [open]);

  const filled = useMemo(() => presets.filter((item) => value[item]), [presets, value]);
  const preview = value[device] ?? value[presets[0]] ?? "";
  const minScale = source ? Math.max(frameRect(preset, stage.width, stage.height).width / source.width, frameRect(preset, stage.width, stage.height).height / source.height) : 1;

  return <section className="admin-image-field">
    <div className="admin-image-head"><strong>{label}</strong><span className="admin-muted">{presets.length > 1 ? `${filled.length} из ${presets.length} размеров` : `${target.width} × ${target.height} точек`}</span></div>
    {help && <p className="admin-muted">{help}</p>}
    {target.note && <p className="admin-muted">{target.note}</p>}
    {filled.length > 0 && <div className="admin-image-preview">
      {presets.length > 1 && <div className="admin-tabs admin-tabs-sm">{presets.map((item) => <button className={device === item ? "is-active" : ""} key={item} onClick={() => setDevice(item)} type="button">{imagePresets[item].short}</button>)}</div>}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {preview ? <img alt={`Предпросмотр: ${imagePresets[device]?.label ?? label}`} className="admin-image-shot" src={preview} style={{ aspectRatio: `${imagePresets[device]?.width ?? target.width} / ${imagePresets[device]?.height ?? target.height}` }} /> : <p className="admin-muted">Для этого размера картинка ещё не обрезана.</p>}
    </div>}
    <div className="admin-image-actions">
      <label className="admin-button">{filled.length ? "Заменить картинку" : "Выбрать картинку"}<input accept="image/*" className="sr-only" onChange={async (event) => { void (await pick(event.target.files?.[0])); event.target.value = ""; }} type="file" /></label>
      <label className="admin-ghost-button admin-image-camera"><Camera size={16} />Камера<input accept="image/*" capture="environment" className="sr-only" onChange={async (event) => { void (await pick(event.target.files?.[0])); event.target.value = ""; }} type="file" /></label>
      {filled.length > 0 && <button className="admin-ghost-button" onClick={() => { if (window.confirm("Убрать картинку?")) onChange({}); }} type="button"><Trash size={16} />Убрать</button>}
    </div>
    {error && !open && <p className="admin-error" role="alert">{error}</p>}

    {open && source && <div className="admin-dialog-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) { setOpen(false); setSource(null); } }}>
      <div className="admin-crop-dialog" aria-label="Обрезка картинки" role="dialog">
        <header><div><h2><Crop size={18} /> {imagePresets[preset].label}</h2><p className="admin-muted">Для этого места нужно {target.width} × {target.height} точек. Ваша картинка {source.naturalWidth} × {source.naturalHeight} — выберите рамкой, какую часть показать.</p></div><button aria-label="Закрыть" onClick={() => { setOpen(false); setSource(null); }} type="button"><X size={20} /></button></header>
        {presets.length > 1 && <div className="admin-tabs admin-tabs-sm">{presets.map((item, position) => <button className={item === preset ? "is-active" : ""} key={item} onClick={() => { setIndex(position); reset(source, position); }} type="button">{imagePresets[item].short} {crops[item] ? "✓" : ""}</button>)}</div>}
        {index > 0 && <p className="admin-note">Проверьте, не обрезало ли текст на этом размере.</p>}
        {lowRes && !accepted && <div className="admin-warning" role="alert"><p>{lowRes}</p><div className="admin-image-actions"><button className="admin-ghost-button" onClick={() => setAccepted(true)} type="button">Всё равно поставить</button><label className="admin-button">Выбрать другую<input accept="image/*" className="sr-only" onChange={async (event) => { void (await pick(event.target.files?.[0])); event.target.value = ""; }} type="file" /></label></div></div>}
        <div className="admin-crop-stage" ref={holderRef}>
          <canvas height={stage.height} onPointerCancel={onPointerUp} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} ref={canvasRef} style={{ width: stage.width, height: stage.height, touchAction: "none" }} width={stage.width} />
        </div>
        <div className="admin-crop-tools">
          <label className="admin-field">Приближение<input max={minScale * 8} min={minScale} onChange={(event) => zoomAt(Number(event.target.value), { x: stage.width / 2, y: stage.height / 2 })} step={minScale / 40} type="range" value={view.scale} /></label>
          <button className="admin-ghost-button" onClick={() => { const rotated = rotateCanvas(source); setSource(rotated); setView(coverView(rotated, preset, stage.width, stage.height)); }} type="button"><RotateCw size={16} />Повернуть</button>
          <button className="admin-ghost-button" onClick={() => reset(source, index)} type="button"><Undo2 size={16} />Сбросить</button>
        </div>
        {error && <p className="admin-error" role="alert">{error}</p>}
        <footer>
          {presets.length > 1 && <button className="admin-ghost-button" onClick={applyToAll} type="button">Одну картинку на все размеры</button>}
          <button className="admin-button" onClick={confirmFrame} type="button"><Check size={16} />{index + 1 < presets.length ? "Готово, дальше" : "Готово"}</button>
        </footer>
      </div>
    </div>}
  </section>;
}

export function SingleImageField({ preset, value, onChange, label, help }: { preset: PresetId; value: string; onChange: (next: string) => void; label: string; help?: string }) {
  return <ImagePicker help={help} label={label} onChange={(next) => onChange(next[preset] ?? "")} presets={[preset]} value={value ? { [preset]: value } : {}} />;
}
