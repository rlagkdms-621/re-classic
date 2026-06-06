"use client";

import { useEffect, useRef, useState } from "react";

type ToolMode = "add" | "remove";
type BgMode = "solid" | "blur" | "marker" | "transparent";
type TrimMode = "auto" | "marker" | "white" | "edge";
type OutputFormat = "image/png" | "image/jpeg" | "image/webp";

type ImageItem = {
  file: File;
  fileName: string;
  image: HTMLImageElement;
};

type Rect = {
  x: number;
  y: number;
  width: number;
  height: number;
  label?: string;
};

const MARKER_A = "#ff0048";
const MARKER_B = "#00ff5a";
const MARKER_TILE = 24;

export default function LetterboxMaker() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const [items, setItems] = useState<ImageItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);

  const [toolMode, setToolMode] = useState<ToolMode>("add");
  const [bgMode, setBgMode] = useState<BgMode>("solid");
  const [trimMode, setTrimMode] = useState<TrimMode>("auto");

  const [bgColor, setBgColor] = useState("#f5f3ed");
  const [outputSize, setOutputSize] = useState(1080);
  const [format, setFormat] = useState<OutputFormat>("image/png");
  const [quality, setQuality] = useState(0.92);

  const [status, setStatus] = useState("이미지를 선택해주세요.");

  const currentItem = items[currentIndex] || null;

  useEffect(() => {
    drawPreview();
  }, [
    currentIndex,
    items,
    toolMode,
    bgMode,
    trimMode,
    bgColor,
    outputSize,
    format,
    quality,
  ]);

  function clamp(value: number, min: number, max: number) {
    return Math.min(Math.max(value, min), max);
  }

  function fileToImage(file: File) {
    return new Promise<HTMLImageElement>((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const image = new Image();

      image.onload = () => {
        URL.revokeObjectURL(url);
        resolve(image);
      };

      image.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error("이미지를 불러오지 못했습니다."));
      };

      image.src = url;
    });
  }

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;

    const loaded: ImageItem[] = [];

    for (const file of Array.from(files)) {
      if (!file.type.startsWith("image/")) continue;

      const image = await fileToImage(file);

      loaded.push({
        file,
        fileName: file.name,
        image,
      });
    }

    setItems(loaded);
    setCurrentIndex(0);

    if (loaded.length === 0) {
      setStatus("이미지 파일을 찾지 못했습니다.");
    } else {
      setStatus(`${loaded.length}개 이미지를 불러왔습니다.`);
    }
  }

  function containRect(sourceWidth: number, sourceHeight: number, target: number) {
    const sourceRatio = sourceWidth / sourceHeight;

    if (sourceRatio > 1) {
      const width = target;
      const height = target / sourceRatio;

      return {
        x: 0,
        y: (target - height) / 2,
        width,
        height,
        label: "위아래 여백",
      };
    }

    if (sourceRatio < 1) {
      const height = target;
      const width = target * sourceRatio;

      return {
        x: (target - width) / 2,
        y: 0,
        width,
        height,
        label: "좌우 여백",
      };
    }

    return {
      x: 0,
      y: 0,
      width: target,
      height: target,
      label: "여백 없음",
    };
  }

  function coverRect(sourceWidth: number, sourceHeight: number, target: number) {
    const scale = Math.max(target / sourceWidth, target / sourceHeight);
    const width = sourceWidth * scale;
    const height = sourceHeight * scale;

    return {
      x: (target - width) / 2,
      y: (target - height) / 2,
      width,
      height,
    };
  }

  function drawMarkerBackground(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number
  ) {
    for (let y = 0; y < height; y += MARKER_TILE) {
      for (let x = 0; x < width; x += MARKER_TILE) {
        const index =
          (Math.floor(x / MARKER_TILE) + Math.floor(y / MARKER_TILE)) % 2;

        ctx.fillStyle = index === 0 ? MARKER_A : MARKER_B;
        ctx.fillRect(x, y, MARKER_TILE, MARKER_TILE);
      }
    }
  }

  function drawAddMode(
    ctx: CanvasRenderingContext2D,
    canvas: HTMLCanvasElement,
    item: ImageItem,
    silent = false
  ) {
    const size = clamp(outputSize || 1080, 256, 4096);

    canvas.width = size;
    canvas.height = size;

    ctx.clearRect(0, 0, size, size);

    if (bgMode === "solid") {
      ctx.fillStyle = bgColor;
      ctx.fillRect(0, 0, size, size);
    }

    if (bgMode === "marker") {
      drawMarkerBackground(ctx, size, size);
    }

    if (bgMode === "blur") {
      const cover = coverRect(
        item.image.naturalWidth,
        item.image.naturalHeight,
        size
      );

      ctx.save();
      ctx.fillStyle = "#f5f3ed";
      ctx.fillRect(0, 0, size, size);
      ctx.filter = "blur(26px) saturate(1.08)";
      ctx.drawImage(item.image, cover.x, cover.y, cover.width, cover.height);
      ctx.restore();

      ctx.fillStyle = "rgba(255,255,255,0.12)";
      ctx.fillRect(0, 0, size, size);
    }

    if (bgMode === "transparent") {
      ctx.clearRect(0, 0, size, size);
    }

    const rect = containRect(
      item.image.naturalWidth,
      item.image.naturalHeight,
      size
    );

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";

    ctx.drawImage(
      item.image,
      Math.round(rect.x),
      Math.round(rect.y),
      Math.round(rect.width),
      Math.round(rect.height)
    );

    if (!silent) {
      setStatus(`${rect.label} 방식으로 1:1 레터박스를 적용했습니다.`);
    }
  }

  function makeImageData(image: HTMLImageElement) {
    const scanCanvas = document.createElement("canvas");
    scanCanvas.width = image.naturalWidth;
    scanCanvas.height = image.naturalHeight;

    const scanCtx = scanCanvas.getContext("2d", { willReadFrequently: true });

    if (!scanCtx) {
      throw new Error("이미지 분석용 캔버스를 만들 수 없습니다.");
    }

    scanCtx.drawImage(image, 0, 0);

    return {
      width: scanCanvas.width,
      height: scanCanvas.height,
      data: scanCtx.getImageData(0, 0, scanCanvas.width, scanCanvas.height)
        .data,
    };
  }

  function rgbDistance(
    r1: number,
    g1: number,
    b1: number,
    r2: number,
    g2: number,
    b2: number
  ) {
    return Math.abs(r1 - r2) + Math.abs(g1 - g2) + Math.abs(b1 - b2);
  }

  function isMarkerPixel(r: number, g: number, b: number, a: number) {
    if (a < 150) return false;

    const redDistance = rgbDistance(r, g, b, 255, 0, 72);
    const greenDistance = rgbDistance(r, g, b, 0, 255, 90);

    return redDistance < 240 || greenDistance < 240;
  }

  function findTrimRectByPredicate(
    width: number,
    height: number,
    data: Uint8ClampedArray,
    isBorder: (
      r: number,
      g: number,
      b: number,
      a: number,
      index: number
    ) => boolean,
    label: string
  ): Rect | null {
    let minX = width;
    let minY = height;
    let maxX = -1;
    let maxY = -1;

    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const index = (y * width + x) * 4;
        const r = data[index];
        const g = data[index + 1];
        const b = data[index + 2];
        const a = data[index + 3];

        if (!isBorder(r, g, b, a, index)) {
          minX = Math.min(minX, x);
          minY = Math.min(minY, y);
          maxX = Math.max(maxX, x);
          maxY = Math.max(maxY, y);
        }
      }
    }

    if (maxX < minX || maxY < minY) return null;

    const widthOut = maxX - minX + 1;
    const heightOut = maxY - minY + 1;

    if (widthOut < 8 || heightOut < 8) return null;

    return {
      x: minX,
      y: minY,
      width: widthOut,
      height: heightOut,
      label,
    };
  }

  function detectMarkerTrim(image: HTMLImageElement) {
    const { width, height, data } = makeImageData(image);

    return findTrimRectByPredicate(
      width,
      height,
      data,
      (r, g, b, a) => isMarkerPixel(r, g, b, a),
      "마커"
    );
  }

  function detectWhiteTrim(image: HTMLImageElement) {
    const { width, height, data } = makeImageData(image);

    return findTrimRectByPredicate(
      width,
      height,
      data,
      (r, g, b, a) => a < 10 || (r > 245 && g > 245 && b > 245),
      "흰색"
    );
  }

  function detectEdgeTrim(image: HTMLImageElement) {
    const { width, height, data } = makeImageData(image);

    const r0 = data[0];
    const g0 = data[1];
    const b0 = data[2];

    return findTrimRectByPredicate(
      width,
      height,
      data,
      (r, g, b, a) => a < 10 || rgbDistance(r, g, b, r0, g0, b0) < 45,
      "모서리색"
    );
  }

  function detectAutoTrim(image: HTMLImageElement) {
    return (
      detectMarkerTrim(image) || detectWhiteTrim(image) || detectEdgeTrim(image)
    );
  }

  function detectTrim(image: HTMLImageElement) {
    if (trimMode === "marker") return detectMarkerTrim(image);
    if (trimMode === "white") return detectWhiteTrim(image);
    if (trimMode === "edge") return detectEdgeTrim(image);
    return detectAutoTrim(image);
  }

  function drawRemoveMode(
    ctx: CanvasRenderingContext2D,
    canvas: HTMLCanvasElement,
    item: ImageItem,
    silent = false
  ) {
    const rect =
      detectTrim(item.image) || {
        x: 0,
        y: 0,
        width: item.image.naturalWidth,
        height: item.image.naturalHeight,
        label: "원본",
      };

    canvas.width = rect.width;
    canvas.height = rect.height;

    ctx.clearRect(0, 0, rect.width, rect.height);
    ctx.imageSmoothingEnabled = false;

    ctx.drawImage(
      item.image,
      rect.x,
      rect.y,
      rect.width,
      rect.height,
      0,
      0,
      rect.width,
      rect.height
    );

    if (!silent) {
      if (rect.label === "원본") {
        setStatus("제거할 여백을 감지하지 못해 원본을 표시했습니다.");
      } else {
        setStatus(`${rect.label} 기준으로 여백을 제거했습니다.`);
      }
    }
  }

  function drawPreview() {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return;

    if (!currentItem) {
      const size = clamp(outputSize || 1080, 256, 4096);
      canvas.width = size;
      canvas.height = size;

      ctx.fillStyle = "#f1eee7";
      ctx.fillRect(0, 0, size, size);

      return;
    }

    if (toolMode === "add") {
      drawAddMode(ctx, canvas, currentItem);
    } else {
      drawRemoveMode(ctx, canvas, currentItem);
    }
  }

  function getExtension() {
    if (format === "image/jpeg") return "jpg";
    if (format === "image/webp") return "webp";
    return "png";
  }

  function cleanFileName(name: string) {
    return name
      .replace(/\.[^/.]+$/, "")
      .replace(/[\\/:*?"<>|]/g, "")
      .replace(/\s+/g, "-");
  }

  function canvasToBlob(canvas: HTMLCanvasElement) {
    return new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error("이미지 저장에 실패했습니다."));
            return;
          }

          resolve(blob);
        },
        format,
        format === "image/png" ? undefined : quality
      );
    });
  }

  function downloadBlob(blob: Blob, fileName: string) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = fileName;

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    URL.revokeObjectURL(url);
  }

  async function renderItemToBlob(item: ImageItem) {
    const tempCanvas = document.createElement("canvas");
    const tempCtx = tempCanvas.getContext("2d", { willReadFrequently: true });

    if (!tempCtx) {
      throw new Error("이미지 처리용 캔버스를 만들 수 없습니다.");
    }

    if (toolMode === "add") {
      drawAddMode(tempCtx, tempCanvas, item, true);
    } else {
      drawRemoveMode(tempCtx, tempCanvas, item, true);
    }

    return await canvasToBlob(tempCanvas);
  }

  function numberToBytes(value: number, length: number) {
    const bytes = new Uint8Array(length);

    for (let i = 0; i < length; i += 1) {
      bytes[i] = (value >> (8 * i)) & 0xff;
    }

    return bytes;
  }

  function stringToBytes(value: string) {
    return new TextEncoder().encode(value);
  }

  const crcTable = (() => {
    const table = new Uint32Array(256);

    for (let i = 0; i < 256; i += 1) {
      let c = i;

      for (let k = 0; k < 8; k += 1) {
        c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      }

      table[i] = c >>> 0;
    }

    return table;
  })();

  function crc32(bytes: Uint8Array) {
    let c = 0xffffffff;

    for (let i = 0; i < bytes.length; i += 1) {
      c = crcTable[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
    }

    return (c ^ 0xffffffff) >>> 0;
  }

  async function blobToBytes(blob: Blob) {
    const buffer = await blob.arrayBuffer();
    return new Uint8Array(buffer);
  }

  function concatBytes(parts: Uint8Array[]) {
    const total = parts.reduce((sum, part) => sum + part.byteLength, 0);
    const output = new Uint8Array(total);

    let offset = 0;

    for (const part of parts) {
      output.set(part, offset);
      offset += part.byteLength;
    }

    return output;
  }

  function bytesToArrayBuffer(bytes: Uint8Array) {
    const buffer = new ArrayBuffer(bytes.byteLength);
    new Uint8Array(buffer).set(bytes);
    return buffer;
  }

  async function createZip(files: { name: string; blob: Blob }[]) {
    const localParts: Uint8Array[] = [];
    const centralParts: Uint8Array[] = [];

    let offset = 0;

    for (const file of files) {
      const data = await blobToBytes(file.blob);
      const nameBytes = stringToBytes(file.name);
      const crc = crc32(data);

      const localHeader = concatBytes([
        numberToBytes(0x04034b50, 4),
        numberToBytes(20, 2),
        numberToBytes(0, 2),
        numberToBytes(0, 2),
        numberToBytes(0, 2),
        numberToBytes(0, 2),
        numberToBytes(crc, 4),
        numberToBytes(data.byteLength, 4),
        numberToBytes(data.byteLength, 4),
        numberToBytes(nameBytes.byteLength, 2),
        numberToBytes(0, 2),
        nameBytes,
      ]);

      localParts.push(localHeader, data);

      const centralHeader = concatBytes([
        numberToBytes(0x02014b50, 4),
        numberToBytes(20, 2),
        numberToBytes(20, 2),
        numberToBytes(0, 2),
        numberToBytes(0, 2),
        numberToBytes(0, 2),
        numberToBytes(0, 2),
        numberToBytes(crc, 4),
        numberToBytes(data.byteLength, 4),
        numberToBytes(data.byteLength, 4),
        numberToBytes(nameBytes.byteLength, 2),
        numberToBytes(0, 2),
        numberToBytes(0, 2),
        numberToBytes(0, 2),
        numberToBytes(0, 2),
        numberToBytes(0, 4),
        numberToBytes(offset, 4),
        nameBytes,
      ]);

      centralParts.push(centralHeader);
      offset += localHeader.byteLength + data.byteLength;
    }

    const centralSize = centralParts.reduce(
      (sum, part) => sum + part.byteLength,
      0
    );
    const centralOffset = offset;

    const endHeader = concatBytes([
      numberToBytes(0x06054b50, 4),
      numberToBytes(0, 2),
      numberToBytes(0, 2),
      numberToBytes(files.length, 2),
      numberToBytes(files.length, 2),
      numberToBytes(centralSize, 4),
      numberToBytes(centralOffset, 4),
      numberToBytes(0, 2),
    ]);

    const finalBytes = concatBytes([...localParts, ...centralParts, endHeader]);
    const finalBuffer = bytesToArrayBuffer(finalBytes);

    return new Blob([finalBuffer], {
      type: "application/zip",
    });
  }

  async function downloadCurrent() {
    if (items.length === 0) {
      alert("저장할 이미지가 없습니다.");
      return;
    }

    try {
      if (items.length === 1 && currentItem) {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const blob = await canvasToBlob(canvas);
        downloadBlob(
          blob,
          `${cleanFileName(currentItem.fileName)}-letterbox.${getExtension()}`
        );

        return;
      }

      const outputs: { name: string; blob: Blob }[] = [];

      for (const item of items) {
        const blob = await renderItemToBlob(item);

        outputs.push({
          name: `${cleanFileName(item.fileName)}-letterbox.${getExtension()}`,
          blob,
        });
      }

      const zipBlob = await createZip(outputs);
      downloadBlob(zipBlob, `letterbox-results-${outputs.length}.zip`);
    } catch (error: any) {
      alert(error.message || "저장 중 오류가 발생했습니다.");
    }
  }

  function reset() {
    setItems([]);
    setCurrentIndex(0);
    setStatus("이미지를 선택해주세요.");
  }

  return (
    <section className="mt-10 rounded-[28px] bg-white p-6 shadow-sm md:p-8">
      <p className="mb-3 text-xs tracking-[0.3em] text-neutral-400">
        LETTERBOX TOOL
      </p>

      <h2 className="mb-3 text-3xl md:text-4xl">1:1 레터박스 메이커</h2>

      <p className="mb-6 text-lg leading-8 text-neutral-600">
        이미지를 정사각형 비율로 맞추거나, 기존 레터박스 여백을 제거하는
        편집 도구입니다. 여러 장을 선택하면 ZIP 파일로 한 번에 저장할 수
        있습니다.
      </p>

      <div className="grid gap-6 lg:grid-cols-[340px_1fr]">
        <aside className="rounded-[22px] border border-neutral-200 bg-[#f8f5ef] p-5">
          <label className="mb-5 flex min-h-[160px] cursor-pointer flex-col items-center justify-center rounded-[18px] border-2 border-dashed border-neutral-400 bg-white p-5 text-center transition hover:border-black">
            <input
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => handleFiles(e.target.files)}
            />

            <span className="mb-2 text-2xl font-semibold">이미지 선택</span>
            <span className="text-sm text-neutral-500">
              PNG, JPG, WebP · 여러 장 가능
            </span>
          </label>

          {items.length > 0 && (
            <div className="mb-5">
              <p className="mb-2 text-sm font-semibold text-neutral-600">
                선택 이미지
              </p>

              <select
                value={currentIndex}
                onChange={(e) => setCurrentIndex(Number(e.target.value))}
                className="w-full rounded-[12px] border border-neutral-300 bg-white px-4 py-3"
              >
                {items.map((item, index) => (
                  <option key={item.fileName + index} value={index}>
                    {index + 1}. {item.fileName}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="mb-5">
            <p className="mb-2 text-sm font-semibold text-neutral-600">작업</p>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setToolMode("add")}
                className={`rounded-[12px] border-2 px-4 py-3 font-semibold ${
                  toolMode === "add"
                    ? "border-black bg-black text-white"
                    : "border-black bg-white text-black"
                }`}
              >
                붙이기
              </button>

              <button
                type="button"
                onClick={() => setToolMode("remove")}
                className={`rounded-[12px] border-2 px-4 py-3 font-semibold ${
                  toolMode === "remove"
                    ? "border-black bg-black text-white"
                    : "border-black bg-white text-black"
                }`}
              >
                떼기
              </button>
            </div>
          </div>

          {toolMode === "add" && (
            <>
              <div className="mb-5">
                <p className="mb-2 text-sm font-semibold text-neutral-600">
                  여백 방식
                </p>

                <div className="grid grid-cols-2 gap-2">
                  {[
                    ["solid", "단색"],
                    ["blur", "블러"],
                    ["marker", "마커"],
                    ["transparent", "투명"],
                  ].map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setBgMode(value as BgMode)}
                      className={`rounded-[12px] border-2 px-4 py-3 font-semibold ${
                        bgMode === value
                          ? "border-black bg-black text-white"
                          : "border-black bg-white text-black"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {bgMode === "solid" && (
                <div className="mb-5">
                  <p className="mb-2 text-sm font-semibold text-neutral-600">
                    여백 색상
                  </p>

                  <div className="flex flex-wrap gap-2">
                    {["#f5f3ed", "#111318", "#dce8e1", "#e7d7cb"].map(
                      (color) => (
                        <button
                          key={color}
                          type="button"
                          onClick={() => setBgColor(color)}
                          className={`h-10 w-10 rounded-[10px] border-2 ${
                            bgColor === color
                              ? "border-black"
                              : "border-neutral-300"
                          }`}
                          style={{ backgroundColor: color }}
                          aria-label={color}
                        />
                      )
                    )}

                    <input
                      type="color"
                      value={bgColor}
                      onChange={(e) => setBgColor(e.target.value)}
                      className="h-10 w-12 cursor-pointer rounded-[10px]"
                    />
                  </div>
                </div>
              )}
            </>
          )}

          {toolMode === "remove" && (
            <div className="mb-5">
              <p className="mb-2 text-sm font-semibold text-neutral-600">
                떼기 기준
              </p>

              <div className="grid grid-cols-2 gap-2">
                {[
                  ["auto", "자동"],
                  ["marker", "마커"],
                  ["white", "흰색"],
                  ["edge", "모서리"],
                ].map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setTrimMode(value as TrimMode)}
                    className={`rounded-[12px] border-2 px-4 py-3 font-semibold ${
                      trimMode === value
                        ? "border-black bg-black text-white"
                        : "border-black bg-white text-black"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {toolMode === "add" && (
            <div className="mb-5">
              <p className="mb-2 text-sm font-semibold text-neutral-600">
                출력 크기
              </p>

              <input
                type="number"
                min={256}
                max={4096}
                value={outputSize}
                onChange={(e) => setOutputSize(Number(e.target.value))}
                className="w-full rounded-[12px] border border-neutral-300 bg-white px-4 py-3"
              />
            </div>
          )}

          <div className="mb-5">
            <p className="mb-2 text-sm font-semibold text-neutral-600">
              파일 형식
            </p>

            <select
              value={format}
              onChange={(e) => setFormat(e.target.value as OutputFormat)}
              className="w-full rounded-[12px] border border-neutral-300 bg-white px-4 py-3"
            >
              <option value="image/png">PNG</option>
              <option value="image/jpeg">JPG</option>
              <option value="image/webp">WebP</option>
            </select>
          </div>

          {format !== "image/png" && (
            <div className="mb-5">
              <p className="mb-2 text-sm font-semibold text-neutral-600">
                품질 {Math.round(quality * 100)}%
              </p>

              <input
                type="range"
                min={60}
                max={100}
                value={Math.round(quality * 100)}
                onChange={(e) => setQuality(Number(e.target.value) / 100)}
                className="w-full"
              />
            </div>
          )}

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={reset}
              disabled={items.length === 0}
              className="rounded-[14px] border-2 border-black bg-white px-4 py-3 font-semibold text-black disabled:opacity-40"
            >
              초기화
            </button>

            <button
              type="button"
              onClick={downloadCurrent}
              disabled={items.length === 0}
              className="rounded-[14px] bg-black px-4 py-3 font-semibold text-white disabled:opacity-40"
            >
              {items.length > 1 ? "ZIP 저장" : "저장"}
            </button>
          </div>

          <p className="mt-4 text-sm leading-6 text-neutral-500">{status}</p>
        </aside>

        <section className="rounded-[22px] border border-neutral-200 bg-[#111111] p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3 text-white">
            <div>
              <p className="text-sm text-white/50">PREVIEW</p>
              <p className="text-lg font-semibold">
                {currentItem ? currentItem.fileName : "이미지 없음"}
              </p>
            </div>

            <p className="text-sm text-white/50">
              {toolMode === "add"
                ? `${outputSize} x ${outputSize}`
                : "원본 여백 제거"}
            </p>
          </div>

          <div className="mx-auto max-w-[640px] overflow-hidden rounded-[18px] bg-neutral-200">
            <canvas
              ref={canvasRef}
              className="block aspect-square h-auto w-full"
            />
          </div>
        </section>
      </div>
    </section>
  );
}