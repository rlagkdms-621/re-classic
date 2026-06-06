"use client";

import { useEffect, useRef, useState } from "react";

type ToolMode = "add" | "remove";
type BgMode = "solid" | "blur" | "marker" | "transparent";
type TrimMode = "auto" | "marker" | "white" | "edge";
type OutputFormat = "image/png" | "image/jpeg" | "image/webp";

type TrimRect = {
  x: number;
  y: number;
  width: number;
  height: number;
  label: string;
  removed?: {
    top: number;
    bottom: number;
    left: number;
    right: number;
  };
};

type ImageItem = {
  image: HTMLImageElement;
  originalName: string;
  fileName: string;
  trimRect: TrimRect | null;
};

const MARKER_COLORS = {
  a: "#ff0048",
  b: "#00ff5a",
};

const MARKER_TILE_SIZE = 24;
const MARKER_TRIM_THRESHOLD = 0.5;
const MARKER_EDGE_CLEANUP = 4;
const MARKER_GAP_TOLERANCE = 56;
const MARKER_MIN_TOTAL_TRIM = 24;
const MARKER_MIN_ONE_SIDED_TRIM = 80;
const MARKER_SCAN_WINDOW = 8;
const SOLID_GAP_TOLERANCE = 2;

export default function LetterboxMaker() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const [items, setItems] = useState<ImageItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);

  const [toolMode, setToolModeState] = useState<ToolMode>("add");
  const [bgMode, setBgModeState] = useState<BgMode>("solid");
  const [trimMode, setTrimModeState] = useState<TrimMode>("auto");

  const [bgColor, setBgColor] = useState("#f5f3ed");
  const [outputSize, setOutputSize] = useState(1080);
  const [format, setFormatState] = useState<OutputFormat>("image/png");
  const [quality, setQuality] = useState(0.92);

  const [status, setStatus] = useState(
    "자동은 마커를 먼저 찾고, 없으면 흰색이나 모서리색 여백을 봅니다."
  );
  const [previewInfo, setPreviewInfo] = useState("1080 x 1080");
  const [fitMode, setFitMode] = useState("대기");
  const [isProcessing, setIsProcessing] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const currentItem = items[currentIndex] || null;

  useEffect(() => {
    draw();
  }, [
    items,
    currentIndex,
    toolMode,
    bgMode,
    trimMode,
    bgColor,
    outputSize,
    format,
    quality,
  ]);

  function defaultTrimStatus() {
    return "자동은 마커를 먼저 찾고, 없으면 흰색이나 모서리색 여백을 봅니다.";
  }

  function clamp(value: number, min: number, max: number) {
    return Math.min(Math.max(value, min), max);
  }

  function selectedCount() {
    return items.length;
  }

  function getCanvasContext() {
    const canvas = canvasRef.current;
    if (!canvas) return null;

    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return null;

    return { canvas, ctx };
  }

  function setCanvasSize(canvas: HTMLCanvasElement, width: number, height: number) {
    const safeWidth = Math.max(1, Math.round(width));
    const safeHeight = Math.max(1, Math.round(height));

    canvas.width = safeWidth;
    canvas.height = safeHeight;
    setPreviewInfo(`${safeWidth} x ${safeHeight}`);
  }

  function containRect(sourceWidth: number, sourceHeight: number, targetSize: number) {
    const sourceRatio = sourceWidth / sourceHeight;

    if (sourceRatio > 1) {
      const width = targetSize;
      const height = targetSize / sourceRatio;

      return {
        x: 0,
        y: (targetSize - height) / 2,
        width,
        height,
        fit: "위아래 여백",
      };
    }

    if (sourceRatio < 1) {
      const height = targetSize;
      const width = targetSize * sourceRatio;

      return {
        x: (targetSize - width) / 2,
        y: 0,
        width,
        height,
        fit: "좌우 여백",
      };
    }

    return {
      x: 0,
      y: 0,
      width: targetSize,
      height: targetSize,
      fit: "여백 없음",
    };
  }

  function pixelAlignedRect(
    rect: { x: number; y: number; width: number; height: number; fit: string },
    targetSize: number
  ) {
    const x = Math.round(rect.x);
    const y = Math.round(rect.y);
    const width = Math.min(targetSize - x, Math.round(rect.width));
    const height = Math.min(targetSize - y, Math.round(rect.height));

    return { ...rect, x, y, width, height };
  }

  function coverRect(sourceWidth: number, sourceHeight: number, targetSize: number) {
    const scale = Math.max(targetSize / sourceWidth, targetSize / sourceHeight);
    const width = sourceWidth * scale;
    const height = sourceHeight * scale;

    return {
      x: (targetSize - width) / 2,
      y: (targetSize - height) / 2,
      width,
      height,
    };
  }

  function drawMarkerBackground(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number
  ) {
    for (let y = 0; y < height; y += MARKER_TILE_SIZE) {
      for (let x = 0; x < width; x += MARKER_TILE_SIZE) {
        const markerIndex =
          (Math.floor(x / MARKER_TILE_SIZE) + Math.floor(y / MARKER_TILE_SIZE)) %
          2;
        ctx.fillStyle = markerIndex === 0 ? MARKER_COLORS.a : MARKER_COLORS.b;
        ctx.fillRect(x, y, MARKER_TILE_SIZE, MARKER_TILE_SIZE);
      }
    }
  }

  function drawBlurBackground(
    ctx: CanvasRenderingContext2D,
    image: HTMLImageElement,
    size: number
  ) {
    const rect = coverRect(image.naturalWidth, image.naturalHeight, size);

    ctx.save();
    ctx.fillStyle = "#f5f3ed";
    ctx.fillRect(0, 0, size, size);
    ctx.filter = "blur(26px) saturate(1.08)";
    ctx.drawImage(image, rect.x, rect.y, rect.width, rect.height);
    ctx.restore();

    ctx.fillStyle = "rgba(255,255,255,0.12)";
    ctx.fillRect(0, 0, size, size);
  }

  function drawAddMode(
    ctx: CanvasRenderingContext2D,
    canvas: HTMLCanvasElement,
    item: ImageItem | null
  ) {
    const size = clamp(Number(outputSize) || 1080, 256, 4096);
    setCanvasSize(canvas, size, size);

    ctx.clearRect(0, 0, size, size);

    if (!item) {
      ctx.fillStyle = "#f1eee7";
      ctx.fillRect(0, 0, size, size);
      setFitMode("대기");
      return;
    }

    if (bgMode === "blur") {
      drawBlurBackground(ctx, item.image, size);
    } else if (bgMode === "marker") {
      drawMarkerBackground(ctx, size, size);
    } else if (bgMode === "solid") {
      ctx.fillStyle = bgColor;
      ctx.fillRect(0, 0, size, size);
    } else if (bgMode === "transparent") {
      ctx.clearRect(0, 0, size, size);
    }

    const rect = pixelAlignedRect(
      containRect(item.image.naturalWidth, item.image.naturalHeight, size),
      size
    );

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";

    ctx.drawImage(item.image, rect.x, rect.y, rect.width, rect.height);
    setFitMode(rect.fit);
  }

  function drawRemoveMode(
    ctx: CanvasRenderingContext2D,
    canvas: HTMLCanvasElement,
    item: ImageItem | null
  ) {
    if (!item) {
      const size = clamp(Number(outputSize) || 1080, 256, 4096);
      setCanvasSize(canvas, size, size);
      ctx.clearRect(0, 0, size, size);
      ctx.fillStyle = "#f1eee7";
      ctx.fillRect(0, 0, size, size);
      setFitMode("대기");
      return;
    }

    const rect =
      item.trimRect || {
        x: 0,
        y: 0,
        width: item.image.naturalWidth,
        height: item.image.naturalHeight,
        label: "원본",
      };

    setCanvasSize(canvas, rect.width, rect.height);
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

    setFitMode(item.trimRect ? `${item.trimRect.label} 여백 제거됨` : "원본 미리보기");
  }

  function draw() {
    const context = getCanvasContext();
    if (!context) return;

    if (toolMode === "remove") {
      drawRemoveMode(context.ctx, context.canvas, currentItem);
      return;
    }

    drawAddMode(context.ctx, context.canvas, currentItem);
  }

  function channelDistance(
    r: number,
    g: number,
    b: number,
    color: { r: number; g: number; b: number }
  ) {
    return Math.abs(r - color.r) + Math.abs(g - color.g) + Math.abs(b - color.b);
  }

  function markerClassAt(data: Uint8ClampedArray, index: number) {
    const r = data[index];
    const g = data[index + 1];
    const b = data[index + 2];
    const a = data[index + 3];

    const red = { r: 255, g: 0, b: 72 };
    const green = { r: 0, g: 255, b: 90 };

    if (a < 150) return 0;

    const redDistance = channelDistance(r, g, b, red);
    const greenDistance = channelDistance(r, g, b, green);

    const redLike =
      redDistance < 240 ||
      (r > 70 && r >= g + 10 && r >= b + 6 && r - Math.min(g, b) > 18);

    const greenLike =
      greenDistance < 240 ||
      (g > 70 && g >= r + 10 && g >= b + 4 && g - Math.min(r, b) > 18);

    if (redLike && greenLike) return redDistance <= greenDistance ? 1 : 2;
    if (redLike) return 1;
    if (greenLike) return 2;

    return 0;
  }

  function markerScore(
    redMatches: number,
    greenMatches: number,
    samples: number,
    transitions: number,
    transitionSlots: number
  ) {
    if (samples === 0 || redMatches === 0 || greenMatches === 0) return 0;

    const markerRatio = (redMatches + greenMatches) / samples;
    const balance = Math.min(redMatches, greenMatches) / Math.max(redMatches, greenMatches);
    const transitionDensity = transitions / Math.max(1, transitionSlots);

    if (transitionDensity < 0.16) return 0;

    return markerRatio * (0.35 + balance * 0.65);
  }

  function markerRatioForRow(
    data: Uint8ClampedArray,
    width: number,
    y: number,
    sampleStep: number
  ) {
    let redMatches = 0;
    let greenMatches = 0;
    let samples = 0;
    let transitions = 0;
    let scanLines = 0;

    const height = data.length / 4 / width;
    const startY = Math.max(0, y - MARKER_SCAN_WINDOW);
    const endY = Math.min(height - 1, y + MARKER_SCAN_WINDOW);

    for (let sampleY = startY; sampleY <= endY; sampleY += sampleStep) {
      let lastMarkerClass = 0;
      scanLines += 1;

      for (let x = 0; x < width; x += sampleStep) {
        const index = (sampleY * width + x) * 4;
        const markerClass = markerClassAt(data, index);

        if (markerClass === 1) redMatches += 1;
        if (markerClass === 2) greenMatches += 1;

        if (markerClass > 0 && lastMarkerClass > 0 && markerClass !== lastMarkerClass) {
          transitions += 1;
        }

        if (markerClass > 0) lastMarkerClass = markerClass;
        samples += 1;
      }
    }

    return markerScore(
      redMatches,
      greenMatches,
      samples,
      transitions,
      scanLines * (width / 12)
    );
  }

  function markerRatioForColumn(
    data: Uint8ClampedArray,
    width: number,
    height: number,
    x: number,
    sampleStep: number,
    startY = 0,
    endY = height - 1
  ) {
    let redMatches = 0;
    let greenMatches = 0;
    let samples = 0;
    let transitions = 0;
    let scanLines = 0;

    const startX = Math.max(0, x - MARKER_SCAN_WINDOW);
    const endX = Math.min(width - 1, x + MARKER_SCAN_WINDOW);

    for (let sampleX = startX; sampleX <= endX; sampleX += sampleStep) {
      let lastMarkerClass = 0;
      scanLines += 1;

      for (let y = startY; y <= endY; y += sampleStep) {
        const index = (y * width + sampleX) * 4;
        const markerClass = markerClassAt(data, index);

        if (markerClass === 1) redMatches += 1;
        if (markerClass === 2) greenMatches += 1;

        if (markerClass > 0 && lastMarkerClass > 0 && markerClass !== lastMarkerClass) {
          transitions += 1;
        }

        if (markerClass > 0) lastMarkerClass = markerClass;
        samples += 1;
      }
    }

    return markerScore(
      redMatches,
      greenMatches,
      samples,
      transitions,
      scanLines * ((endY - startY + 1) / 12)
    );
  }

  function findContentStart(
    length: number,
    ratioAt: (position: number) => number,
    threshold: number,
    gapTolerance: number
  ) {
    let lastTrimPixel = -1;
    let gap = 0;
    let sawTrimPixel = false;

    for (let position = 0; position < length; position += 1) {
      if (ratioAt(position) >= threshold) {
        lastTrimPixel = position;
        gap = 0;
        sawTrimPixel = true;
        continue;
      }

      gap += 1;

      if (!sawTrimPixel) {
        if (gap > gapTolerance) return 0;
        continue;
      }

      if (gap > gapTolerance) {
        return lastTrimPixel + 1;
      }
    }

    return sawTrimPixel ? Math.min(length - 1, lastTrimPixel + 1) : 0;
  }

  function findContentEnd(
    length: number,
    ratioAt: (position: number) => number,
    threshold: number,
    gapTolerance: number
  ) {
    let lastTrimPixel = length;
    let gap = 0;
    let sawTrimPixel = false;

    for (let position = length - 1; position >= 0; position -= 1) {
      if (ratioAt(position) >= threshold) {
        lastTrimPixel = position;
        gap = 0;
        sawTrimPixel = true;
        continue;
      }

      gap += 1;

      if (!sawTrimPixel) {
        if (gap > gapTolerance) return length - 1;
        continue;
      }

      if (gap > gapTolerance) {
        return lastTrimPixel - 1;
      }
    }

    return sawTrimPixel ? Math.max(0, lastTrimPixel - 1) : length - 1;
  }

  function imageDataFor(image: HTMLImageElement) {
    const width = image.naturalWidth;
    const height = image.naturalHeight;
    const scanCanvas = document.createElement("canvas");
    const scanCtx = scanCanvas.getContext("2d", { willReadFrequently: true });

    if (!scanCtx) throw new Error("이미지 분석용 캔버스를 만들 수 없습니다.");

    scanCanvas.width = width;
    scanCanvas.height = height;
    scanCtx.drawImage(image, 0, 0);

    return {
      width,
      height,
      data: scanCtx.getImageData(0, 0, width, height).data,
    };
  }

  function detectMarkerTrimRect(image: HTMLImageElement): TrimRect | null {
    const { width, height, data } = imageDataFor(image);
    const sampleStep = Math.max(1, Math.floor(Math.max(width, height) / 1800));

    let top = findContentStart(
      height,
      (y) => markerRatioForRow(data, width, y, sampleStep),
      MARKER_TRIM_THRESHOLD,
      MARKER_GAP_TOLERANCE
    );

    let bottom = findContentEnd(
      height,
      (y) => markerRatioForRow(data, width, y, sampleStep),
      MARKER_TRIM_THRESHOLD,
      MARKER_GAP_TOLERANCE
    );

    let left = findContentStart(
      width,
      (x) => markerRatioForColumn(data, width, height, x, sampleStep, top, bottom),
      MARKER_TRIM_THRESHOLD,
      MARKER_GAP_TOLERANCE
    );

    let right = findContentEnd(
      width,
      (x) => markerRatioForColumn(data, width, height, x, sampleStep, top, bottom),
      MARKER_TRIM_THRESHOLD,
      MARKER_GAP_TOLERANCE
    );

    if (top + (height - bottom - 1) < MARKER_MIN_TOTAL_TRIM) {
      top = 0;
      bottom = height - 1;
    }

    if (left + (width - right - 1) < MARKER_MIN_TOTAL_TRIM) {
      left = 0;
      right = width - 1;
    }

    const trimTop = top;
    const trimBottom = height - bottom - 1;
    const trimLeft = left;
    const trimRight = width - right - 1;

    if ((trimTop === 0 || trimBottom === 0) && trimTop + trimBottom < MARKER_MIN_ONE_SIDED_TRIM) {
      top = 0;
      bottom = height - 1;
    }

    if ((trimLeft === 0 || trimRight === 0) && trimLeft + trimRight < MARKER_MIN_ONE_SIDED_TRIM) {
      left = 0;
      right = width - 1;
    }

    const cropWidth = right - left + 1;
    const cropHeight = bottom - top + 1;
    const removedPixels = width * height - cropWidth * cropHeight;

    if (removedPixels <= 0 || cropWidth < 8 || cropHeight < 8) {
      return null;
    }

    const cleanup = Math.min(MARKER_EDGE_CLEANUP, Math.floor(Math.min(cropWidth, cropHeight) / 8));
    const cleanLeft = left > 0 ? Math.min(right, left + cleanup) : left;
    const cleanTop = top > 0 ? Math.min(bottom, top + cleanup) : top;
    const cleanRight = right < width - 1 ? Math.max(cleanLeft, right - cleanup) : right;
    const cleanBottom = bottom < height - 1 ? Math.max(cleanTop, bottom - cleanup) : bottom;

    return {
      x: cleanLeft,
      y: cleanTop,
      width: cleanRight - cleanLeft + 1,
      height: cleanBottom - cleanTop + 1,
      label: "마커",
      removed: {
        top: cleanTop,
        bottom: height - cleanBottom - 1,
        left: cleanLeft,
        right: width - cleanRight - 1,
      },
    };
  }

  function colorDistanceAt(
    data: Uint8ClampedArray,
    index: number,
    color: { r: number; g: number; b: number }
  ) {
    const r = data[index];
    const g = data[index + 1];
    const b = data[index + 2];
    const a = data[index + 3];

    if (a < 245) return 1000;
    return channelDistance(r, g, b, color);
  }

  function isSolidColorPixel(
    data: Uint8ClampedArray,
    index: number,
    color: { r: number; g: number; b: number },
    tolerance: number
  ) {
    return colorDistanceAt(data, index, color) <= tolerance;
  }

  function colorRatioForRow(
    data: Uint8ClampedArray,
    width: number,
    y: number,
    color: { r: number; g: number; b: number },
    tolerance: number,
    sampleStep: number
  ) {
    let matches = 0;
    let samples = 0;

    for (let x = 0; x < width; x += sampleStep) {
      const index = (y * width + x) * 4;
      if (isSolidColorPixel(data, index, color, tolerance)) matches += 1;
      samples += 1;
    }

    return matches / samples;
  }

  function colorRatioForColumn(
    data: Uint8ClampedArray,
    width: number,
    height: number,
    x: number,
    color: { r: number; g: number; b: number },
    tolerance: number,
    sampleStep: number,
    startY = 0,
    endY = height - 1
  ) {
    let matches = 0;
    let samples = 0;

    for (let y = startY; y <= endY; y += sampleStep) {
      const index = (y * width + x) * 4;
      if (isSolidColorPixel(data, index, color, tolerance)) matches += 1;
      samples += 1;
    }

    return matches / samples;
  }

  function averageCornerColor(data: Uint8ClampedArray, width: number, height: number) {
    const maxCornerSize = Math.max(1, Math.min(width, height));
    const cornerSize = Math.min(
      maxCornerSize,
      clamp(Math.round(Math.min(width, height) * 0.025), 3, 28)
    );

    const corners = [
      { x: 0, y: 0 },
      { x: width - cornerSize, y: 0 },
      { x: 0, y: height - cornerSize },
      { x: width - cornerSize, y: height - cornerSize },
    ];

    let red = 0;
    let green = 0;
    let blue = 0;
    let samples = 0;

    corners.forEach((corner) => {
      for (let y = corner.y; y < corner.y + cornerSize; y += 1) {
        for (let x = corner.x; x < corner.x + cornerSize; x += 1) {
          const index = (y * width + x) * 4;
          if (data[index + 3] < 245) continue;

          red += data[index];
          green += data[index + 1];
          blue += data[index + 2];
          samples += 1;
        }
      }
    });

    if (samples === 0) return { r: 255, g: 255, b: 255 };

    return {
      r: Math.round(red / samples),
      g: Math.round(green / samples),
      b: Math.round(blue / samples),
    };
  }

  function isNearWhite(color: { r: number; g: number; b: number }) {
    return color.r >= 228 && color.g >= 228 && color.b >= 228;
  }

  function detectSolidTrimRect(
    image: HTMLImageElement,
    options: {
      target?: { r: number; g: number; b: number };
      tolerance: number;
      threshold: number;
      label: string;
      requiresWhite?: boolean;
    }
  ): TrimRect | null {
    const { width, height, data } = imageDataFor(image);
    const sampleStep = Math.max(1, Math.floor(Math.max(width, height) / 1800));
    const target = options.target || averageCornerColor(data, width, height);

    if (options.requiresWhite && !isNearWhite(target)) {
      return null;
    }

    const top = findContentStart(
      height,
      (y) => colorRatioForRow(data, width, y, target, options.tolerance, sampleStep),
      options.threshold,
      SOLID_GAP_TOLERANCE
    );

    const bottom = findContentEnd(
      height,
      (y) => colorRatioForRow(data, width, y, target, options.tolerance, sampleStep),
      options.threshold,
      SOLID_GAP_TOLERANCE
    );

    const left = findContentStart(
      width,
      (x) =>
        colorRatioForColumn(
          data,
          width,
          height,
          x,
          target,
          options.tolerance,
          sampleStep,
          top,
          bottom
        ),
      options.threshold,
      SOLID_GAP_TOLERANCE
    );

    const right = findContentEnd(
      width,
      (x) =>
        colorRatioForColumn(
          data,
          width,
          height,
          x,
          target,
          options.tolerance,
          sampleStep,
          top,
          bottom
        ),
      options.threshold,
      SOLID_GAP_TOLERANCE
    );

    const cropWidth = right - left + 1;
    const cropHeight = bottom - top + 1;
    const removedPixels = width * height - cropWidth * cropHeight;

    if (removedPixels <= 0 || cropWidth < 8 || cropHeight < 8) {
      return null;
    }

    return {
      x: left,
      y: top,
      width: cropWidth,
      height: cropHeight,
      label: options.label,
      removed: {
        top,
        bottom: height - bottom - 1,
        left,
        right: width - right - 1,
      },
    };
  }

  function detectWhiteTrimRect(image: HTMLImageElement) {
    return detectSolidTrimRect(image, {
      target: { r: 255, g: 255, b: 255 },
      tolerance: 82,
      threshold: 0.955,
      label: "흰색",
    });
  }

  function detectEdgeColorTrimRect(image: HTMLImageElement) {
    return detectSolidTrimRect(image, {
      tolerance: 62,
      threshold: 0.965,
      label: "모서리색",
    });
  }

  function detectAutoTrimRect(image: HTMLImageElement) {
    return detectMarkerTrimRect(image) || detectWhiteTrimRect(image) || detectEdgeColorTrimRect(image);
  }

  function detectTrimRectForImage(image: HTMLImageElement) {
    if (trimMode === "marker") return detectMarkerTrimRect(image);
    if (trimMode === "white") return detectWhiteTrimRect(image);
    if (trimMode === "edge") return detectEdgeColorTrimRect(image);

    return detectAutoTrimRect(image);
  }

  function safeDetectTrimRectForImage(image: HTMLImageElement) {
    try {
      return detectTrimRectForImage(image);
    } catch (error: any) {
      return {
        error: error?.message || "이미지 분석 실패",
      };
    }
  }

  function trimLetterbox() {
    if (items.length === 0) return;

    let trimmedCount = 0;
    let errorMessage = "";

    const nextItems = items.map((item) => {
      const result = safeDetectTrimRectForImage(item.image);

      if (result && "error" in result) {
        errorMessage = result.error;
        return { ...item, trimRect: null };
      }

      if (result) trimmedCount += 1;
      return { ...item, trimRect: result || null };
    });

    setItems(nextItems);

    const firstRect = nextItems[0]?.trimRect || null;

    if (!firstRect) {
      setStatus(
        errorMessage
          ? `이 브라우저가 이미지 픽셀을 읽지 못했어요: ${errorMessage}`
          : items.length > 1
          ? `${trimmedCount}/${items.length}장 잘랐어요. 못 찾은 이미지는 원본 크기로 저장됩니다.`
          : "여백을 찾지 못했어요. 원본에도 흰 영역이 많으면 마커 여백으로 만든 PNG가 가장 정확합니다."
      );
      return;
    }

    setStatus(
      items.length > 1
        ? `${trimmedCount}/${items.length}장 잘랐어요. 첫 번째: 위 ${firstRect.removed?.top || 0}px, 아래 ${firstRect.removed?.bottom || 0}px, 왼쪽 ${firstRect.removed?.left || 0}px, 오른쪽 ${firstRect.removed?.right || 0}px`
        : `${firstRect.label} 기준으로 잘랐어요: 위 ${firstRect.removed?.top || 0}px, 아래 ${firstRect.removed?.bottom || 0}px, 왼쪽 ${firstRect.removed?.left || 0}px, 오른쪽 ${firstRect.removed?.right || 0}px`
    );
  }

  function clearItemTrims() {
    setItems((prev) => prev.map((item) => ({ ...item, trimRect: null })));
  }

  function handleToolMode(mode: ToolMode) {
    setToolModeState(mode);
    clearItemTrims();
    setStatus(defaultTrimStatus());

    if (mode === "remove" && items.length > 0) {
      setTimeout(trimLetterbox, 0);
    }
  }

  function handleTrimMode(mode: TrimMode) {
    setTrimModeState(mode);
    setStatus(defaultTrimStatus());
    clearItemTrims();

    if (toolMode === "remove" && items.length > 0) {
      setTimeout(trimLetterbox, 0);
    }
  }

  function handleBgMode(mode: BgMode) {
    setBgModeState(mode);

    if (mode === "marker") {
      setFormatState("image/png");
    }

    if (mode === "transparent" && format === "image/jpeg") {
      setFormatState("image/png");
    }
  }

  function handleFormat(nextFormat: OutputFormat) {
    if (toolMode === "add" && bgMode === "marker") {
      setFormatState("image/png");
      return;
    }

    if (nextFormat === "image/jpeg" && bgMode === "transparent") {
      setBgModeState("solid");
    }

    setFormatState(nextFormat);
  }

  function loadImageFile(file: File) {
    return new Promise<ImageItem>((resolve, reject) => {
      if (!file || !file.type.startsWith("image/")) {
        reject(new Error("이미지 파일이 아닙니다."));
        return;
      }

      const url = URL.createObjectURL(file);
      const image = new Image();

      image.onload = () => {
        URL.revokeObjectURL(url);
        resolve({
          image,
          originalName: file.name,
          fileName: file.name.replace(/\.[^.]+$/, "") || "letterbox",
          trimRect: null,
        });
      };

      image.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error("이미지를 열 수 없습니다."));
      };

      image.src = url;
    });
  }

  async function loadFiles(fileList: FileList | null) {
    const files = Array.from(fileList || []).filter((file) =>
      file.type.startsWith("image/")
    );

    if (files.length === 0) return;

    setIsProcessing(true);
    setStatus(`${files.length}장 읽는 중`);

    try {
      const loadedItems = await Promise.all(files.map(loadImageFile));

      setItems(loadedItems);
      setCurrentIndex(0);
      setStatus(
        loadedItems.length === 1
          ? `${loadedItems[0].originalName} · ${loadedItems[0].image.naturalWidth} x ${loadedItems[0].image.naturalHeight}`
          : `${loadedItems.length}장 선택됨 · 첫 번째 ${loadedItems[0].image.naturalWidth} x ${loadedItems[0].image.naturalHeight}`
      );

      if (toolMode === "remove") {
        setTimeout(trimLetterbox, 0);
      }
    } catch (error: any) {
      setItems([]);
      setCurrentIndex(0);
      setStatus(error?.message || "이미지를 불러오지 못했습니다.");
    } finally {
      setIsProcessing(false);
    }
  }

  function reset() {
    setItems([]);
    setCurrentIndex(0);
    setStatus("이미지를 선택해주세요.");
    setFitMode("대기");
    setPreviewInfo(`${outputSize} x ${outputSize}`);
  }

  function extensionForFormat(value: OutputFormat) {
    if (value === "image/jpeg") return "jpg";
    if (value === "image/webp") return "webp";
    return "png";
  }

  function downloadSuffixForItem(item: ImageItem) {
    if (toolMode === "remove") return item.trimRect ? "trimmed" : "original";
    return "1x1";
  }

  function cleanFileName(name: string) {
    return (
      (name || "letterbox")
        .replace(/[\\/:*?"<>|]+/g, "-")
        .replace(/\s+/g, " ")
        .trim() || "letterbox"
    );
  }

  function outputNameForItem(item: ImageItem) {
    return `${cleanFileName(item.fileName)}-${downloadSuffixForItem(item)}.${extensionForFormat(format)}`;
  }

  function canvasToBlob(canvas: HTMLCanvasElement, outputFormat: OutputFormat, outputQuality?: number) {
    return new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error("이미지 저장에 실패했습니다."));
            return;
          }

          resolve(blob);
        },
        outputFormat,
        outputQuality
      );
    });
  }

  function downloadBlob(blob: Blob, fileName: string) {
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);

    link.href = url;
    link.download = fileName;

    document.body.append(link);
    link.click();
    link.remove();

    URL.revokeObjectURL(url);
  }

  function crc32(bytes: Uint8Array) {
    let crc = 0xffffffff;

    for (let i = 0; i < bytes.length; i += 1) {
      crc ^= bytes[i];

      for (let bit = 0; bit < 8; bit += 1) {
        crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
      }
    }

    return (crc ^ 0xffffffff) >>> 0;
  }

  function dosDateTime(dateValue = new Date()) {
    const time =
      (dateValue.getHours() << 11) |
      (dateValue.getMinutes() << 5) |
      Math.floor(dateValue.getSeconds() / 2);

    const date =
      ((dateValue.getFullYear() - 1980) << 9) |
      ((dateValue.getMonth() + 1) << 5) |
      dateValue.getDate();

    return { time, date };
  }

  function makeZipName(name: string, usedNames: Set<string>) {
    const cleaned = cleanFileName(name);

    if (!usedNames.has(cleaned)) {
      usedNames.add(cleaned);
      return cleaned;
    }

    const dotIndex = cleaned.lastIndexOf(".");
    const base = dotIndex >= 0 ? cleaned.slice(0, dotIndex) : cleaned;
    const extension = dotIndex >= 0 ? cleaned.slice(dotIndex) : "";

    let index = 2;
    let candidate = `${base}-${index}${extension}`;

    while (usedNames.has(candidate)) {
      index += 1;
      candidate = `${base}-${index}${extension}`;
    }

    usedNames.add(candidate);
    return candidate;
  }

  function writeBytes(target: Uint8Array, offset: number, bytes: Uint8Array) {
    target.set(bytes, offset);
    return offset + bytes.length;
  }

  function makeHeader(size: number, writer: (view: DataView) => void) {
    const bytes = new Uint8Array(size);
    const view = new DataView(bytes.buffer);
    writer(view);
    return bytes;
  }

  async function createZip(files: { name: string; blob: Blob }[]) {
    const encoder = new TextEncoder();
    const usedNames = new Set<string>();
    const localParts: Uint8Array[] = [];
    const centralParts: Uint8Array[] = [];
    const { time, date } = dosDateTime();
    let offset = 0;

    for (const file of files) {
      const nameBytes = encoder.encode(makeZipName(file.name, usedNames));
      const data = new Uint8Array(await file.blob.arrayBuffer());
      const crc = crc32(data);

      const localHeader = makeHeader(30 + nameBytes.length, (view) => {
        view.setUint32(0, 0x04034b50, true);
        view.setUint16(4, 20, true);
        view.setUint16(6, 0, true);
        view.setUint16(8, 0, true);
        view.setUint16(10, time, true);
        view.setUint16(12, date, true);
        view.setUint32(14, crc, true);
        view.setUint32(18, data.length, true);
        view.setUint32(22, data.length, true);
        view.setUint16(26, nameBytes.length, true);
        view.setUint16(28, 0, true);
      });

      writeBytes(localHeader, 30, nameBytes);

      const centralHeader = makeHeader(46 + nameBytes.length, (view) => {
        view.setUint32(0, 0x02014b50, true);
        view.setUint16(4, 20, true);
        view.setUint16(6, 20, true);
        view.setUint16(8, 0, true);
        view.setUint16(10, 0, true);
        view.setUint16(12, time, true);
        view.setUint16(14, date, true);
        view.setUint32(16, crc, true);
        view.setUint32(20, data.length, true);
        view.setUint32(24, data.length, true);
        view.setUint16(28, nameBytes.length, true);
        view.setUint16(30, 0, true);
        view.setUint16(32, 0, true);
        view.setUint16(34, 0, true);
        view.setUint16(36, 0, true);
        view.setUint32(38, 0, true);
        view.setUint32(42, offset, true);
      });

      writeBytes(centralHeader, 46, nameBytes);

      localParts.push(localHeader, data);
      centralParts.push(centralHeader);
      offset += localHeader.length + data.length;
    }

    const centralSize = centralParts.reduce((sum, part) => sum + part.length, 0);

    const endHeader = makeHeader(22, (view) => {
      view.setUint32(0, 0x06054b50, true);
      view.setUint16(4, 0, true);
      view.setUint16(6, 0, true);
      view.setUint16(8, files.length, true);
      view.setUint16(10, files.length, true);
      view.setUint32(12, centralSize, true);
      view.setUint32(16, offset, true);
      view.setUint16(20, 0, true);
    });

    return new Blob([...localParts, ...centralParts, endHeader], {
      type: "application/zip",
    });
  }

  async function renderOutputForItem(item: ImageItem) {
    const tempCanvas = document.createElement("canvas");
    const tempCtx = tempCanvas.getContext("2d", { willReadFrequently: true });

    if (!tempCtx) throw new Error("저장용 캔버스를 만들 수 없습니다.");

    let outputItem = item;

    if (toolMode === "remove") {
      const result = safeDetectTrimRectForImage(item.image);

      outputItem = {
        ...item,
        trimRect: result && !("error" in result) ? result : null,
      };
    }

    if (toolMode === "remove") {
      drawRemoveMode(tempCtx, tempCanvas, outputItem);
    } else {
      drawAddMode(tempCtx, tempCanvas, outputItem);
    }

    const blob = await canvasToBlob(
      tempCanvas,
      format,
      format === "image/png" ? undefined : quality
    );

    return {
      blob,
      name: outputNameForItem(outputItem),
    };
  }

  async function download() {
    if (selectedCount() === 0) return;

    setIsProcessing(true);

    try {
      const outputs = [];

      for (const item of items) {
        const output = await renderOutputForItem(item);
        if (output.blob) outputs.push(output);
      }

      if (outputs.length === 1) {
        downloadBlob(outputs[0].blob, outputs[0].name);
      } else if (outputs.length > 1) {
        const zipBlob = await createZip(outputs);
        downloadBlob(zipBlob, `letterbox-results-${outputs.length}.zip`);
      }
    } catch (error: any) {
      alert(error?.message || "저장 중 오류가 발생했습니다.");
    } finally {
      setIsProcessing(false);
      draw();
    }
  }

  const canvasAspect =
    canvasRef.current && canvasRef.current.width > 0 && canvasRef.current.height > 0
      ? `${canvasRef.current.width} / ${canvasRef.current.height}`
      : "1 / 1";

  return (
    <section className="mt-10 rounded-[28px] bg-white p-6 shadow-sm md:p-8">
      <p className="mb-3 text-xs tracking-[0.3em] text-neutral-400">
        LETTERBOX TOOL
      </p>

      <h2 className="mb-3 text-3xl md:text-4xl">1:1 레터박스 메이커</h2>

      <p className="mb-6 text-lg leading-8 text-neutral-600">
        ZIP에 포함된 레터박스 도구의 핵심 기능을 현재 프로젝트에 맞게
        통합한 편집 도구입니다. 이미지를 정사각형 비율로 맞추거나 기존
        레터박스 여백을 자동으로 제거할 수 있고, 여러 장을 선택하면 ZIP으로
        한 번에 저장할 수 있습니다.
      </p>

      <div className="grid gap-6 lg:grid-cols-[340px_1fr]">
        <aside className="rounded-[22px] border border-neutral-200 bg-[#f8f5ef] p-5">
          <label
            className={`mb-5 flex min-h-[160px] cursor-pointer flex-col items-center justify-center rounded-[18px] border-2 border-dashed bg-white p-5 text-center transition ${
              isDragging ? "border-black" : "border-neutral-400 hover:border-black"
            }`}
            onDragOver={(event) => {
              event.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={(event) => {
              event.preventDefault();
              setIsDragging(false);
              loadFiles(event.dataTransfer.files);
            }}
          >
            <input
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(event) => loadFiles(event.target.files)}
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
                onChange={(event) => setCurrentIndex(Number(event.target.value))}
                className="w-full rounded-[12px] border border-neutral-300 bg-white px-4 py-3"
              >
                {items.map((item, index) => (
                  <option key={`${item.originalName}-${index}`} value={index}>
                    {index + 1}. {item.originalName}
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
                onClick={() => handleToolMode("add")}
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
                onClick={() => handleToolMode("remove")}
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
                      onClick={() => handleBgMode(value as BgMode)}
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
                            bgColor.toLowerCase() === color.toLowerCase()
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
                      onChange={(event) => setBgColor(event.target.value)}
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
                    onClick={() => handleTrimMode(value as TrimMode)}
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

              <button
                type="button"
                onClick={trimLetterbox}
                disabled={items.length === 0}
                className="mt-3 w-full rounded-[14px] border-2 border-black bg-white px-4 py-3 font-semibold text-black disabled:opacity-40"
              >
                여백 떼기
              </button>
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
                step={1}
                value={outputSize}
                onChange={(event) => setOutputSize(Number(event.target.value))}
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
              onChange={(event) => handleFormat(event.target.value as OutputFormat)}
              className="w-full rounded-[12px] border border-neutral-300 bg-white px-4 py-3"
            >
              <option value="image/png">PNG</option>
              <option value="image/jpeg">JPG</option>
              <option value="image/webp">WebP</option>
            </select>
          </div>

          {(format === "image/jpeg" || format === "image/webp") && (
            <div className="mb-5">
              <p className="mb-2 flex justify-between text-sm font-semibold text-neutral-600">
                <span>품질</span>
                <span>{Math.round(quality * 100)}%</span>
              </p>

              <input
                type="range"
                min={60}
                max={100}
                value={Math.round(quality * 100)}
                onChange={(event) => setQuality(Number(event.target.value) / 100)}
                className="w-full"
              />
            </div>
          )}

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={reset}
              disabled={items.length === 0 || isProcessing}
              className="rounded-[14px] border-2 border-black bg-white px-4 py-3 font-semibold text-black disabled:opacity-40"
            >
              초기화
            </button>

            <button
              type="button"
              onClick={download}
              disabled={items.length === 0 || isProcessing}
              className="rounded-[14px] bg-black px-4 py-3 font-semibold text-white disabled:opacity-40"
            >
              {isProcessing ? "처리 중" : items.length > 1 ? "ZIP 저장" : "저장"}
            </button>
          </div>

          <p className="mt-4 text-sm leading-6 text-neutral-500">{status}</p>
        </aside>

        <section className="rounded-[22px] border border-neutral-200 bg-[#111111] p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3 text-white">
            <div>
              <p className="text-sm text-white/50">PREVIEW</p>
              <p className="text-lg font-semibold">
                {currentItem ? currentItem.originalName : "이미지 없음"}
              </p>
            </div>

            <div className="text-right text-sm text-white/50">
              <p>{fitMode}</p>
              <p>{previewInfo}</p>
            </div>
          </div>

          <div
            className={`mx-auto max-w-[640px] overflow-hidden rounded-[18px] ${
              bgMode === "transparent" && toolMode === "add"
                ? "bg-[linear-gradient(45deg,#d8d8d8_25%,transparent_25%),linear-gradient(-45deg,#d8d8d8_25%,transparent_25%),linear-gradient(45deg,transparent_75%,#d8d8d8_75%),linear-gradient(-45deg,transparent_75%,#d8d8d8_75%)] bg-[length:20px_20px] bg-[position:0_0,0_10px,10px_-10px,-10px_0]"
                : "bg-neutral-200"
            }`}
          >
            <canvas
              ref={canvasRef}
              className="block h-auto w-full"
              style={{ aspectRatio: canvasAspect }}
            />
          </div>
        </section>
      </div>
    </section>
  );
}
