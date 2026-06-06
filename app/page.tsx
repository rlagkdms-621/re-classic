"use client";

import { useEffect, useState } from "react";
import LetterboxMaker from "./components/LetterboxMaker";

const sampleArtworks = [
  { title: "절규", artist: "Edvard Munch", url: "/samples/1.jpg" },
  {
    title: "그랑드 자트 섬의 일요일 오후",
    artist: "Georges Seurat",
    url: "/samples/2.jpg",
  },
  {
    title: "이삭 줍는 사람들",
    artist: "Jean-François Millet",
    url: "/samples/3.jpg",
  },
  { title: "별이 빛나는 밤", artist: "Vincent van Gogh", url: "/samples/4.jpg" },
  { title: "아메리칸 고딕", artist: "Grant Wood", url: "/samples/5.jpg" },
  { title: "아테네 학당", artist: "Raphael", url: "/samples/6.jpg" },
];

const keywords = ["사회적 고립", "환경 위기"];

type Artwork = { title: string; artist: string; url: string };

type LetterboxRect = {
  x: number;
  y: number;
  width: number;
  height: number;
  canvasSize: number;
};

type SuitabilityResult = {
  status?: "변환 가능" | "변화 조금 어려움" | "변환 어려움";
  canGenerate?: boolean;
  reason?: string;
  limitation?: string;
  message?: string;
};

type ComparisonRow = {
  originalElement?: string;
  modernizedElement?: string;
  reason?: string;
  emotionalShift?: string;
  ethicalNote?: string;
};

type CuratorReport = {
  originalAnalysis?: string;
  transformedAnalysis?: string;
  transformationRationale?: string;
  finalSummary?: string;
  comparisonTable?: ComparisonRow[];
};

type Review = {
  id: string;
  rating: number;
  name: string;
  comment: string;
  created_at: string;
};

type Generation = {
  id: string;
  artwork_title: string;
  artist: string;
  direction: string;
  original_image: string;
  generated_image: string;
  suitability: SuitabilityResult;
  curator_report: CuratorReport;
  used_prompt: string;
  created_at: string;
};

export default function Home() {
  const [selectedArtwork, setSelectedArtwork] = useState<Artwork | null>(null);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [selectedKeyword, setSelectedKeyword] = useState("사회적 고립");

  const [resultImage, setResultImage] = useState("");
  const [usedPrompt, setUsedPrompt] = useState("");
  const [suitabilityResult, setSuitabilityResult] =
    useState<SuitabilityResult | null>(null);
  const [curatorReport, setCuratorReport] = useState<CuratorReport | null>(null);

  const [loadingGenerate, setLoadingGenerate] = useState(false);

  const [modalImage, setModalImage] = useState<string | null>(null);
  const [modalTitle, setModalTitle] = useState("");

  const [reviews, setReviews] = useState<Review[]>([]);
  const [reviewName, setReviewName] = useState("");
  const [reviewComment, setReviewComment] = useState("");
  const [reviewRating, setReviewRating] = useState(5);
  const [loadingReview, setLoadingReview] = useState(false);

  const [generations, setGenerations] = useState<Generation[]>([]);
  const [showArchive, setShowArchive] = useState(false);
  const [loadingArchive, setLoadingArchive] = useState(false);

  const [adminSecret, setAdminSecret] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const savedAdmin = localStorage.getItem("reclassic_admin_secret");
    if (savedAdmin) {
      setAdminSecret(savedAdmin);
      setIsAdmin(true);
    }

    loadReviews();
    loadGenerations();
  }, []);

  async function safeJson(response: Response) {
    const text = await response.text();

    try {
      return JSON.parse(text);
    } catch {
      throw new Error(text || "서버 응답 오류");
    }
  }

  function loginAdmin() {
    if (!adminSecret.trim()) {
      alert("관리자 비밀번호를 입력해주세요.");
      return;
    }

    localStorage.setItem("reclassic_admin_secret", adminSecret);
    setIsAdmin(true);
    alert("관리자 모드가 켜졌습니다.");
  }

  function logoutAdmin() {
    localStorage.removeItem("reclassic_admin_secret");
    setAdminSecret("");
    setIsAdmin(false);
    alert("관리자 모드가 꺼졌습니다.");
  }

  async function deleteReview(id: string) {
    if (!confirm("이 후기를 삭제할까요?")) return;

    try {
      const response = await fetch("/api/reviews", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          "x-admin-secret": adminSecret,
        },
        body: JSON.stringify({ id }),
      });

      const data = await safeJson(response);

      if (!response.ok) throw new Error(data.error || "후기 삭제 실패");

      await loadReviews();
    } catch (error: any) {
      alert(error.message || "후기 삭제 중 오류가 발생했습니다.");
    }
  }

  async function deleteGeneration(id: string) {
    if (!confirm("이 전시 작품을 삭제할까요?")) return;

    try {
      const response = await fetch("/api/generations", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          "x-admin-secret": adminSecret,
        },
        body: JSON.stringify({ id }),
      });

      const data = await safeJson(response);

      if (!response.ok) throw new Error(data.error || "전시 작품 삭제 실패");

      await loadGenerations();
    } catch (error: any) {
      alert(error.message || "전시 작품 삭제 중 오류가 발생했습니다.");
    }
  }

  async function loadReviews() {
    try {
      const response = await fetch("/api/reviews");
      const data = await safeJson(response);

      if (response.ok) setReviews(data.reviews || []);
    } catch (error) {
      console.error("REVIEWS_LOAD_ERROR:", error);
    }
  }

  async function loadGenerations() {
    setLoadingArchive(true);

    try {
      const response = await fetch("/api/generations");
      const data = await safeJson(response);

      if (response.ok) setGenerations(data.generations || []);
    } catch (error) {
      console.error("GENERATIONS_LOAD_ERROR:", error);
    } finally {
      setLoadingArchive(false);
    }
  }

  async function submitReview() {
    if (!reviewComment.trim()) {
      alert("후기를 입력해주세요.");
      return;
    }

    setLoadingReview(true);

    try {
      const response = await fetch("/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rating: reviewRating,
          name: reviewName,
          comment: reviewComment,
        }),
      });

      const data = await safeJson(response);

      if (!response.ok) throw new Error(data.error || "후기 저장 실패");

      setReviewName("");
      setReviewComment("");
      setReviewRating(5);
      await loadReviews();
    } catch (error: any) {
      alert(error.message || "후기 저장 중 오류가 발생했습니다.");
    } finally {
      setLoadingReview(false);
    }
  }

  async function saveGenerationArchive(params: {
    originalImage: string;
    generatedImage: string;
    suitability: SuitabilityResult;
    report: CuratorReport;
    prompt: string;
  }) {
    try {
      const response = await fetch("/api/generations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          artworkTitle: selectedArtwork?.title,
          artist: selectedArtwork?.artist,
          direction: selectedKeyword,
          originalImage: params.originalImage,
          generatedImage: params.generatedImage,
          suitability: params.suitability,
          curatorReport: params.report,
          usedPrompt: params.prompt,
        }),
      });

      const data = await safeJson(response);

      if (!response.ok) {
        console.error("ARCHIVE_SAVE_ERROR:", data);
        return;
      }

      await loadGenerations();
    } catch (error) {
      console.error("ARCHIVE_SAVE_ERROR:", error);
    }
  }

  async function imageUrlToDataUrl(url: string) {
    const response = await fetch(url);
    const blob = await response.blob();

    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  async function fileToDataUrl(file: File) {
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  async function compressDataUrl(dataUrl: string, maxSize = 520, quality = 0.65) {
    return await new Promise<string>((resolve, reject) => {
      const img = new Image();

      img.onload = () => {
        const canvas = document.createElement("canvas");
        const scale = Math.min(1, maxSize / Math.max(img.width, img.height));

        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);

        const ctx = canvas.getContext("2d");

        if (!ctx) {
          reject(new Error("이미지 압축 실패"));
          return;
        }

        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };

      img.onerror = () => reject(new Error("이미지를 압축할 수 없습니다."));
      img.src = dataUrl;
    });
  }

  async function createLetterboxedInput(
    dataUrl: string,
    fileName = "letterboxed-input.png",
    size = 1024
  ) {
    return await new Promise<{
      file: File;
      dataUrl: string;
      rect: LetterboxRect;
    }>((resolve, reject) => {
      const img = new Image();

      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = size;
        canvas.height = size;

        const ctx = canvas.getContext("2d");

        if (!ctx) {
          reject(new Error("레터박스 캔버스를 만들 수 없습니다."));
          return;
        }

        ctx.fillStyle = "#111318";
        ctx.fillRect(0, 0, size, size);

        const scale = Math.min(size / img.width, size / img.height);
        const width = img.width * scale;
        const height = img.height * scale;
        const x = (size - width) / 2;
        const y = (size - height) / 2;

        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = "high";
        ctx.drawImage(img, x, y, width, height);

        const outputDataUrl = canvas.toDataURL("image/png");

        canvas.toBlob((blob) => {
          if (!blob) {
            reject(new Error("레터박스 이미지 생성 실패"));
            return;
          }

          resolve({
            file: new File([blob], fileName, { type: "image/png" }),
            dataUrl: outputDataUrl,
            rect: {
              x,
              y,
              width,
              height,
              canvasSize: size,
            },
          });
        }, "image/png");
      };

      img.onerror = () => reject(new Error("이미지를 불러오지 못했습니다."));
      img.src = dataUrl;
    });
  }

  async function forceGeneratedImageToOriginalRatio(
    generatedDataUrl: string,
    rect: LetterboxRect
  ) {
    return await new Promise<string>((resolve, reject) => {
      const img = new Image();

      img.onload = () => {
        const size = rect.canvasSize;
        const canvas = document.createElement("canvas");
        canvas.width = size;
        canvas.height = size;

        const ctx = canvas.getContext("2d");

        if (!ctx) {
          reject(new Error("결과 레터박스 캔버스를 만들 수 없습니다."));
          return;
        }

        ctx.fillStyle = "#111318";
        ctx.fillRect(0, 0, size, size);

        const sourceScaleX = img.width / size;
        const sourceScaleY = img.height / size;

        const sx = rect.x * sourceScaleX;
        const sy = rect.y * sourceScaleY;
        const sw = rect.width * sourceScaleX;
        const sh = rect.height * sourceScaleY;

        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = "high";

        ctx.drawImage(
          img,
          sx,
          sy,
          sw,
          sh,
          rect.x,
          rect.y,
          rect.width,
          rect.height
        );

        resolve(canvas.toDataURL("image/png"));
      };

      img.onerror = () => reject(new Error("생성 이미지를 후처리할 수 없습니다."));
      img.src = generatedDataUrl;
    });
  }

  async function getAnalyzableImage() {
    if (uploadedFile) return await fileToDataUrl(uploadedFile);
    if (selectedArtwork?.url) return await imageUrlToDataUrl(selectedArtwork.url);
    return "";
  }

  function handleSampleClick(artwork: Artwork) {
    setSelectedArtwork(artwork);
    setUploadedFile(null);
    setResultImage("");
    setUsedPrompt("");
    setSuitabilityResult(null);
    setCuratorReport(null);
  }

  function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const imageUrl = URL.createObjectURL(file);

    setUploadedFile(file);
    setSelectedArtwork({
      title: file.name,
      artist: "사용자 업로드",
      url: imageUrl,
    });

    setResultImage("");
    setUsedPrompt("");
    setSuitabilityResult(null);
    setCuratorReport(null);
  }

  function openImageModal(image: string, title: string) {
    setModalImage(image);
    setModalTitle(title);
  }

  function closeImageModal() {
    setModalImage(null);
    setModalTitle("");
  }

  async function downloadResultImage() {
    if (!resultImage) {
      alert("저장할 현대화 이미지가 없습니다.");
      return;
    }

    try {
      const response = await fetch(resultImage);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);

      const safeTitle =
        selectedArtwork?.title
          ?.replace(/[\\/:*?"<>|]/g, "")
          .replace(/\s+/g, "-") || "artwork";

      const safeKeyword = selectedKeyword.replace(/\s+/g, "-");

      const link = document.createElement("a");
      link.href = url;
      link.download = `re-classic-${safeTitle}-${safeKeyword}.png`;

      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      URL.revokeObjectURL(url);
    } catch (error) {
      console.error(error);
      alert("이미지 저장이 어려운 브라우저입니다. 이미지를 크게 연 뒤 길게 눌러 저장해주세요.");
    }
  }

  async function runSuitabilityCheck(image: string) {
    const response = await fetch("/api/suitability", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        image,
        direction: selectedKeyword,
        artworkTitle: selectedArtwork?.title,
      }),
    });

    const data = await safeJson(response);

    if (!response.ok) throw new Error(data.error || "적합도 분석 실패");

    const suitability = data.suitability as SuitabilityResult;
    const status = String(suitability.status || "").replace(/\s/g, "");

    const blocked =
      suitability.canGenerate === false ||
      (status.includes("어려움") && !status.includes("조금"));

    if (blocked) {
      const blockedResult: SuitabilityResult = {
        ...suitability,
        status: "변환 어려움",
        canGenerate: false,
        message: "이미지 변환이 불가능합니다.",
      };

      setSuitabilityResult(blockedResult);
      return blockedResult;
    }

    setSuitabilityResult(suitability);
    return suitability;
  }

  async function handleGenerate() {
    if (!selectedArtwork) {
      alert("작품을 먼저 선택해주세요.");
      return;
    }

    setLoadingGenerate(true);
    setResultImage("");
    setUsedPrompt("");
    setSuitabilityResult(null);
    setCuratorReport(null);

    try {
      const originalImage = await getAnalyzableImage();

      const letterboxedInput = await createLetterboxedInput(
        originalImage,
        `${selectedArtwork.title}-letterboxed.png`,
        1024
      );

      const compressedOriginalImage = await compressDataUrl(letterboxedInput.dataUrl);

      const suitability = await runSuitabilityCheck(compressedOriginalImage);
      const normalizedStatus = String(suitability.status || "").replace(/\s/g, "");

      const isBlocked =
        suitability.canGenerate === false ||
        (normalizedStatus.includes("어려움") && !normalizedStatus.includes("조금"));

      if (isBlocked) {
        setSuitabilityResult({
          ...suitability,
          status: "변환 어려움",
          canGenerate: false,
          message: "이미지 변환이 불가능합니다.",
        });

        setResultImage("");
        setUsedPrompt("");
        setCuratorReport(null);
        alert("이미지 변환이 불가능합니다.");
        return;
      }

      const formData = new FormData();

      formData.append("image", letterboxedInput.file);
      formData.append("direction", selectedKeyword);
      formData.append("artworkTitle", selectedArtwork.title);
      formData.append("preserveLetterbox", "true");
      formData.append("letterboxRect", JSON.stringify(letterboxedInput.rect));

      const response = await fetch("/api/generate", {
        method: "POST",
        body: formData,
      });

      const data = await safeJson(response);

      if (!response.ok) throw new Error(data.error || "이미지 생성 실패");

      const ratioFixedImage = await forceGeneratedImageToOriginalRatio(
        data.image,
        letterboxedInput.rect
      );

      setResultImage(ratioFixedImage);
      setUsedPrompt(data.usedPrompt || "");

      const compressedGeneratedImage = await compressDataUrl(ratioFixedImage);

      try {
        const analyzeResponse = await fetch("/api/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            originalImage: compressedOriginalImage,
            generatedImage: compressedGeneratedImage,
            direction: selectedKeyword,
            artworkTitle: selectedArtwork.title,
          }),
        });

        const analyzeData = await safeJson(analyzeResponse);

        if (analyzeResponse.ok) {
          setCuratorReport(analyzeData.report);

          await saveGenerationArchive({
            originalImage: compressedOriginalImage,
            generatedImage: compressedGeneratedImage,
            suitability,
            report: analyzeData.report,
            prompt: data.usedPrompt || "",
          });
        }
      } catch (analysisError) {
        console.error("분석/아카이브 저장 실패:", analysisError);
      }
    } catch (error: any) {
      alert(error.message || "생성 중 오류가 발생했습니다.");
    } finally {
      setLoadingGenerate(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#e7e2d8] px-4 py-6 text-[#1a1a1a] md:px-8 md:py-8">
      <div className="mx-auto max-w-6xl">
        <p className="mb-2 text-xs tracking-[0.35em] text-neutral-500">RE-CLASSIC</p>

        <h1 className="mb-3 text-4xl leading-tight md:text-6xl">
          현대를 입은 명작
        </h1>

        <p className="text-base text-neutral-700 md:text-lg">명화는 변하지 않았다.</p>
        <p className="mb-10 text-base text-neutral-700 md:text-lg">
          변한 것은 우리가 살아가는 시대였다.
        </p>

        <AdminPanel
          isAdmin={isAdmin}
          adminSecret={adminSecret}
          setAdminSecret={setAdminSecret}
          loginAdmin={loginAdmin}
          logoutAdmin={logoutAdmin}
        />

        <section className="mb-10">
          <button
            onClick={() => {
              setShowArchive(!showArchive);
              loadGenerations();
            }}
            className="w-full rounded-[20px] border-2 border-black bg-black px-6 py-5 text-xl font-semibold text-white transition hover:scale-[1.01] md:text-2xl"
          >
            {showArchive ? "전시 아카이브 닫기" : "다른 사용자의 변환 이미지 구경하기"}
          </button>
        </section>

        {showArchive && (
          <ArchiveSection
            generations={generations}
            loading={loadingArchive}
            isAdmin={isAdmin}
            deleteGeneration={deleteGeneration}
            openImageModal={openImageModal}
          />
        )}

        <section className="mb-12">
          <h2 className="mb-6 text-3xl md:text-4xl">샘플 명작 선택</h2>

          <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
            {sampleArtworks.map((artwork) => (
              <button
                key={artwork.title}
                onClick={() => handleSampleClick(artwork)}
                className={`overflow-hidden rounded-[22px] border bg-white text-left transition-all duration-300 ${
                  selectedArtwork?.title === artwork.title
                    ? "scale-[1.02] border-black shadow-xl"
                    : "border-neutral-300 hover:scale-[1.01]"
                }`}
              >
                <div className="aspect-[4/3] overflow-hidden bg-neutral-200">
                  <img
                    src={artwork.url}
                    alt={artwork.title}
                    className="h-full w-full object-cover transition duration-500 hover:scale-105"
                  />
                </div>

                <div className="p-4">
                  <h3 className="mb-1 text-xl leading-snug">{artwork.title}</h3>
                  <p className="text-sm text-neutral-500">{artwork.artist}</p>
                </div>
              </button>
            ))}
          </div>
        </section>

        <section className="mb-12">
          <h2 className="mb-5 text-3xl md:text-4xl">직접 업로드</h2>

          <label className="block cursor-pointer rounded-[22px] border-2 border-dashed border-neutral-500 bg-white/60 p-7 text-center transition hover:border-black hover:bg-white">
            <input type="file" accept="image/*" onChange={handleUpload} className="hidden" />

            <p className="mb-2 text-2xl font-semibold">이미지를 업로드해주세요</p>

            <p className="text-base text-neutral-500">
              직접 선택한 이미지를 현대화 적합도 분석 후 변환합니다.
            </p>

            {uploadedFile && (
              <p className="mt-4 text-lg font-semibold text-black">
                선택된 파일: {uploadedFile.name}
              </p>
            )}
          </label>
        </section>

        <section className="mb-12">
          <h2 className="mb-5 text-3xl md:text-4xl">현대화 방향</h2>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {keywords.map((keyword) => (
              <button
                key={keyword}
                onClick={() => {
                  setSelectedKeyword(keyword);
                  setResultImage("");
                  setUsedPrompt("");
                  setSuitabilityResult(null);
                  setCuratorReport(null);
                }}
                className={`rounded-[22px] border-2 px-8 py-6 text-2xl font-semibold transition-all duration-300 hover:scale-[1.02] ${
                  selectedKeyword === keyword
                    ? "border-black bg-black text-white shadow-lg"
                    : "border-black bg-white text-black hover:bg-neutral-100"
                }`}
              >
                {keyword}
              </button>
            ))}
          </div>
        </section>

        <section className="mb-12 flex flex-wrap gap-4">
          <button
            onClick={handleGenerate}
            disabled={loadingGenerate}
            className="rounded-[22px] bg-black px-9 py-5 text-xl font-semibold text-white transition hover:scale-105 disabled:opacity-40"
          >
            {loadingGenerate ? "적합도 분석 및 생성 중..." : "현대화 생성"}
          </button>

          {resultImage && (
            <button
              onClick={downloadResultImage}
              className="rounded-[22px] border-2 border-black bg-white px-9 py-5 text-xl font-semibold text-black transition hover:scale-105 hover:bg-black hover:text-white"
            >
              결과 이미지 저장
            </button>
          )}
        </section>

        <section className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <ArtworkPanel
            title="원작"
            image={selectedArtwork?.url || null}
            onImageClick={() =>
              selectedArtwork?.url && openImageModal(selectedArtwork.url, "원작")
            }
          />

          <ArtworkPanel
            title="현대화 결과"
            image={resultImage || null}
            isGenerating={loadingGenerate}
            onImageClick={() =>
              resultImage && openImageModal(resultImage, "현대화 결과")
            }
          />
        </section>

        {suitabilityResult && (
          <section className="mt-10 rounded-[28px] bg-white p-6 shadow-sm md:p-8">
            <p className="mb-3 text-xs tracking-[0.3em] text-neutral-400">
              PRE-CHECK REPORT
            </p>

            <h2 className="mb-6 text-3xl md:text-4xl">
              현대화 사전 적합도 분석
            </h2>

            <div
              className={`mb-6 rounded-[20px] border-2 p-5 ${
                suitabilityResult.status === "변환 가능"
                  ? "border-green-700 bg-green-50"
                  : suitabilityResult.status === "변화 조금 어려움"
                  ? "border-yellow-700 bg-yellow-50"
                  : "border-red-700 bg-red-50"
              }`}
            >
              <p className="mb-2 text-3xl font-bold">
                {suitabilityResult.status}
              </p>

              {suitabilityResult.status === "변환 어려움" && (
                <p className="text-2xl font-semibold text-red-700">
                  이미지 변환이 불가능합니다.
                </p>
              )}
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              <ReportBlock title="판정 이유" content={suitabilityResult.reason || ""} />
              <ReportBlock title="변환 한계" content={suitabilityResult.limitation || ""} />
            </div>
          </section>
        )}

        {curatorReport && (
          <section className="mt-10 rounded-[28px] bg-white p-6 shadow-sm md:p-8">
            <p className="mb-3 text-xs tracking-[0.3em] text-neutral-400">
              AI CURATOR REPORT
            </p>

            <h2 className="mb-6 text-3xl md:text-4xl">작품 분석</h2>

            <div className="grid gap-6 md:grid-cols-2">
              <ReportBlock title="원작 이미지 분석" content={curatorReport.originalAnalysis || ""} />
              <ReportBlock title="현대화 이미지 분석" content={curatorReport.transformedAnalysis || ""} />
            </div>

            <div className="mt-6 grid gap-6 md:grid-cols-2">
              <ReportBlock title="변화 과정 설명" content={curatorReport.transformationRationale || ""} />
              <ReportBlock title="최종 해석 요약" content={curatorReport.finalSummary || ""} />
            </div>

            <ComparisonTable rows={curatorReport.comparisonTable} />
          </section>
        )}

        {usedPrompt && <PromptPanel prompt={usedPrompt} />}

        <LetterboxMaker />

        <ReviewSection
          reviews={reviews}
          reviewName={reviewName}
          reviewComment={reviewComment}
          reviewRating={reviewRating}
          loadingReview={loadingReview}
          isAdmin={isAdmin}
          deleteReview={deleteReview}
          setReviewName={setReviewName}
          setReviewComment={setReviewComment}
          setReviewRating={setReviewRating}
          submitReview={submitReview}
        />
      </div>

      {modalImage && (
        <ImageModal image={modalImage} title={modalTitle} onClose={closeImageModal} />
      )}
    </main>
  );
}

function AdminPanel({
  isAdmin,
  adminSecret,
  setAdminSecret,
  loginAdmin,
  logoutAdmin,
}: {
  isAdmin: boolean;
  adminSecret: string;
  setAdminSecret: (value: string) => void;
  loginAdmin: () => void;
  logoutAdmin: () => void;
}) {
  return (
    <section className="mb-8 rounded-[20px] bg-white/60 p-4">
      <p className="mb-3 text-xs tracking-[0.3em] text-neutral-500">ADMIN</p>

      {isAdmin ? (
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-lg font-semibold">관리자 모드 ON</p>
          <button
            onClick={logoutAdmin}
            className="rounded-[14px] border-2 border-black bg-white px-5 py-3 text-base font-semibold"
          >
            관리자 모드 끄기
          </button>
        </div>
      ) : (
        <div className="flex flex-wrap gap-3">
          <input
            type="password"
            value={adminSecret}
            onChange={(e) => setAdminSecret(e.target.value)}
            placeholder="관리자 비밀번호"
            className="min-w-[240px] rounded-[14px] border-2 border-black px-5 py-3 text-base"
          />

          <button
            onClick={loginAdmin}
            className="rounded-[14px] bg-black px-5 py-3 text-base font-semibold text-white"
          >
            관리자 로그인
          </button>
        </div>
      )}
    </section>
  );
}

function ArchiveSection({
  generations,
  loading,
  isAdmin,
  deleteGeneration,
  openImageModal,
}: {
  generations: Generation[];
  loading: boolean;
  isAdmin: boolean;
  deleteGeneration: (id: string) => void;
  openImageModal: (image: string, title: string) => void;
}) {
  return (
    <section className="mb-12 rounded-[28px] bg-[#111111] p-6 text-white shadow-sm md:p-8">
      <p className="mb-3 text-xs tracking-[0.3em] text-white/40">
        PUBLIC EXHIBITION ARCHIVE
      </p>

      <h2 className="mb-4 text-3xl md:text-5xl">다른 사용자의 변환 전시</h2>

      {loading && <p className="text-xl text-white/60">아카이브를 불러오는 중...</p>}

      {!loading && generations.length === 0 && (
        <p className="text-xl text-white/60">아직 저장된 전시 결과가 없습니다.</p>
      )}

      <div className="grid gap-5 md:grid-cols-2">
        {generations.map((item) => (
          <div key={item.id} className="bg-white p-4 text-black">
            <h3 className="mt-1 text-2xl">{item.artwork_title}</h3>
            <p className="text-sm text-neutral-500">{item.artist}</p>

            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <button
                onClick={() => openImageModal(item.original_image, "아카이브 원작")}
                className="aspect-square overflow-hidden bg-[#111318]"
              >
                <img
                  src={item.original_image}
                  alt="archive original"
                  className="h-full w-full object-contain"
                />
              </button>

              <button
                onClick={() => openImageModal(item.generated_image, "아카이브 현대화 결과")}
                className="aspect-square overflow-hidden bg-[#111318]"
              >
                <img
                  src={item.generated_image}
                  alt="archive generated"
                  className="h-full w-full object-contain"
                />
              </button>
            </div>

            {isAdmin && (
              <button
                onClick={() => deleteGeneration(item.id)}
                className="mt-5 w-full rounded-[16px] bg-red-600 px-5 py-3 text-lg font-semibold text-white"
              >
                이 전시 작품 삭제
              </button>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

function ArtworkPanel({
  title,
  image,
  isGenerating = false,
  onImageClick,
}: {
  title: string;
  image?: string | null;
  isGenerating?: boolean;
  onImageClick?: () => void;
}) {
  return (
    <div className="rounded-[28px] bg-white p-5 shadow-sm md:p-6">
      <h2 className="mb-5 text-3xl md:text-4xl">{title}</h2>

      <div className="aspect-square overflow-hidden rounded-[20px] bg-[#111318]">
        {image ? (
          <button
            onClick={onImageClick}
            className="h-full w-full cursor-zoom-in overflow-hidden"
            type="button"
          >
            <img
              src={image}
              alt={title}
              className="h-full w-full object-contain transition duration-500 hover:scale-105"
            />
          </button>
        ) : isGenerating ? (
          <div className="flex h-full w-full flex-col items-center justify-center text-xl text-neutral-400">
            <div className="mb-4 h-8 w-8 animate-spin rounded-full border-2 border-neutral-500 border-t-white" />
            적합도 분석 후 생성 중...
          </div>
        ) : (
          <div className="flex h-full w-full items-center justify-center text-center text-xl text-neutral-400">
            아직 작품이 생성되지 않았습니다.
          </div>
        )}
      </div>
    </div>
  );
}

function ImageModal({
  image,
  title,
  onClose,
}: {
  image: string;
  title: string;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-6"
      onClick={onClose}
    >
      <div className="relative max-h-full max-w-5xl" onClick={(e) => e.stopPropagation()}>
        <button
          onClick={onClose}
          className="absolute right-0 top-[-54px] rounded-full border border-white/30 px-5 py-2 text-lg text-white transition hover:bg-white hover:text-black"
        >
          닫기
        </button>

        <p className="mb-3 text-xl text-white">{title}</p>

        <img
          src={image}
          alt={title}
          className="max-h-[80vh] max-w-full rounded-[20px] object-contain shadow-2xl"
        />
      </div>
    </div>
  );
}

function ReportBlock({ title, content }: { title: string; content: string }) {
  return (
    <div className="border-t border-neutral-300 pt-4">
      <h3 className="mb-3 text-2xl">{title}</h3>
      <p className="whitespace-pre-wrap text-lg leading-[1.75] text-neutral-700 md:text-xl">
        {content}
      </p>
    </div>
  );
}

function ComparisonTable({ rows }: { rows?: ComparisonRow[] }) {
  if (!rows || rows.length === 0) return null;

  return (
    <div className="mt-10 overflow-hidden rounded-[20px] border border-neutral-200">
      <div className="bg-black px-6 py-5 text-white">
        <p className="text-xs tracking-[0.3em] text-white/50">
          STRUCTURAL COMPARISON
        </p>
        <h3 className="mt-2 text-3xl">변환 근거 비교표</h3>
      </div>

      <div className="divide-y divide-neutral-200 bg-[#f8f5ef]">
        {rows.map((row, index) => (
          <div key={index} className="grid gap-0 md:grid-cols-5">
            <TableCell label="원작 요소" content={row.originalElement || ""} />
            <TableCell label="현대화 요소" content={row.modernizedElement || ""} />
            <TableCell label="변환 이유" content={row.reason || ""} />
            <TableCell label="감정 변화" content={row.emotionalShift || ""} />
            <TableCell label="윤리적 고려" content={row.ethicalNote || ""} />
          </div>
        ))}
      </div>
    </div>
  );
}

function TableCell({ label, content }: { label: string; content: string }) {
  return (
    <div className="border-b border-r border-neutral-200 p-4 md:border-b-0">
      <p className="mb-3 text-xs tracking-[0.2em] text-neutral-400">{label}</p>
      <p className="text-base leading-7 text-neutral-700">{content}</p>
    </div>
  );
}

function PromptPanel({ prompt }: { prompt: string }) {
  return (
    <section className="mt-10 rounded-[28px] bg-[#111111] p-6 text-white shadow-sm md:p-8">
      <p className="mb-3 text-xs tracking-[0.3em] text-white/40">
        PROMPT DESIGN DOCUMENTATION
      </p>

      <h2 className="mb-5 text-3xl md:text-4xl">AI에게 전달된 창작 지시문</h2>

      <pre className="max-h-[420px] overflow-auto whitespace-pre-wrap rounded-[20px] bg-white/10 p-5 text-base leading-7 text-white/80">
        {prompt}
      </pre>
    </section>
  );
}

function ReviewSection({
  reviews,
  reviewName,
  reviewComment,
  reviewRating,
  loadingReview,
  isAdmin,
  deleteReview,
  setReviewName,
  setReviewComment,
  setReviewRating,
  submitReview,
}: {
  reviews: Review[];
  reviewName: string;
  reviewComment: string;
  reviewRating: number;
  loadingReview: boolean;
  isAdmin: boolean;
  deleteReview: (id: string) => void;
  setReviewName: (value: string) => void;
  setReviewComment: (value: string) => void;
  setReviewRating: (value: number) => void;
  submitReview: () => void;
}) {
  const average =
    reviews.length > 0
      ? (
          reviews.reduce((sum, review) => sum + review.rating, 0) /
          reviews.length
        ).toFixed(1)
      : "0.0";

  return (
    <section className="mt-10 rounded-[28px] bg-white p-6 shadow-sm md:p-8">
      <p className="mb-3 text-xs tracking-[0.3em] text-neutral-400">
        USER EXPERIENCE REVIEW
      </p>

      <h2 className="mb-3 text-3xl md:text-4xl">사용자 후기</h2>

      <p className="mb-6 text-xl text-neutral-600">
        평균 별점 {average} / 5.0 · 총 {reviews.length}개 후기
      </p>

      <div className="mb-8 grid gap-4">
        <input
          value={reviewName}
          onChange={(e) => setReviewName(e.target.value)}
          placeholder="이름 또는 닉네임"
          className="rounded-[16px] border-2 border-black bg-white px-5 py-4 text-lg"
        />

        <div className="flex flex-wrap gap-2">
          {[1, 2, 3, 4, 5].map((별) => (
            <button
              key={star}
              type="button"
              onClick={() => setReviewRating(별)}
              className={`rounded-[14px] border-2 border-black px-5 py-3 text-xl ${
                reviewRating >= star ? "bg-black text-white" : "bg-white text-black"
              }`}
            >
              ★
            </button>
          ))}
        </div>

        <textarea
          value={reviewComment}
          onChange={(e) => setReviewComment(e.target.value)}
          placeholder="이 사이트를 사용해본 후기를 남겨주세요."
          className="min-h-[120px] rounded-[16px] border-2 border-black bg-white px-5 py-4 text-lg leading-7"
        />

        <button
          onClick={submitReview}
          disabled={loadingReview}
          className="rounded-[18px] border-2 border-black bg-black px-8 py-5 text-xl font-semibold text-white transition hover:-translate-y-1 disabled:opacity-40"
        >
          {loadingReview ? "저장 중..." : "후기 남기기"}
        </button>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {reviews.map((review) => (
          <div key={review.id} className="rounded-[20px] border-2 border-neutral-200 p-5">
            <div className="mb-3 flex items-center justify-between gap-3">
              <p className="text-xl font-semibold">{review.name || "익명"}</p>
              <p className="text-xl">{"★".repeat(review.rating)}</p>
            </div>

            <p className="whitespace-pre-wrap text-lg leading-7 text-neutral-700">
              {review.comment}
            </p>

            <p className="mt-4 text-xs text-neutral-400">
              {new Date(review.created_at).toLocaleString("ko-KR")}
            </p>

            {isAdmin && (
              <button
                onClick={() => deleteReview(review.id)}
                className="mt-4 w-full rounded-[14px] bg-red-600 px-5 py-3 text-base font-semibold text-white"
              >
                이 후기 삭제
              </button>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}