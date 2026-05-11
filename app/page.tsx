"use client";

import { useEffect, useState } from "react";

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

const keywords = ["SNS 시대", "도시적 고립", "환경 위기"];

type Artwork = {
  title: string;
  artist: string;
  url: string;
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
  const [selectedKeyword, setSelectedKeyword] = useState("SNS 시대");

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

  useEffect(() => {
    loadReviews();
    loadGenerations();
  }, []);

  async function loadReviews() {
    try {
      const response = await fetch("/api/reviews");
      const data = await response.json();
      if (response.ok) setReviews(data.reviews || []);
    } catch (error) {
      console.error(error);
    }
  }

  async function loadGenerations() {
    setLoadingArchive(true);
    try {
      const response = await fetch("/api/generations");
      const data = await response.json();
      if (response.ok) setGenerations(data.generations || []);
    } catch (error) {
      console.error(error);
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
        body: JSON.stringify({ rating: reviewRating, name: reviewName, comment: reviewComment }),
      });

      const data = await response.json();
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

      const data = await response.json();

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

    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "적합도 분석 실패");

    setSuitabilityResult(data.suitability);
    return data.suitability as SuitabilityResult;
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
      const suitability = await runSuitabilityCheck(originalImage);

      if (suitability.status === "변환 어려움" || suitability.canGenerate === false) {
        return;
      }

      const formData = new FormData();

      if (uploadedFile) formData.append("image", uploadedFile);
      else formData.append("sampleUrl", selectedArtwork.url);

      formData.append("direction", selectedKeyword);
      formData.append("artworkTitle", selectedArtwork.title);

      const response = await fetch("/api/generate", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "이미지 생성 실패");

      setResultImage(data.image);
      setUsedPrompt(data.usedPrompt || "");

      const analyzeResponse = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          originalImage,
          generatedImage: data.image,
          direction: selectedKeyword,
          artworkTitle: selectedArtwork.title,
        }),
      });

      const analyzeData = await analyzeResponse.json();
      if (!analyzeResponse.ok) throw new Error(analyzeData.error || "큐레이터 분석 실패");

      setCuratorReport(analyzeData.report);

      await saveGenerationArchive({
        originalImage,
        generatedImage: data.image,
        suitability,
        report: analyzeData.report,
        prompt: data.usedPrompt || "",
      });
    } catch (error: any) {
      alert(error.message || "생성 중 오류가 발생했습니다.");
    } finally {
      setLoadingGenerate(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#e7e2d8] px-4 py-6 text-[#1a1a1a] md:px-8 md:py-8">
      <div className="mx-auto max-w-6xl">
        <p className="mb-2 text-xs tracking-[0.35em] text-neutral-500">
          RE-CLASSIC
        </p>

        <h1 className="mb-3 text-4xl leading-tight md:text-6xl">
          현대를 입은 명작
        </h1>

        <p className="text-base text-neutral-700 md:text-lg">
          명화는 변하지 않았다.
        </p>
        <p className="mb-10 text-base text-neutral-700 md:text-lg">
          변한 것은 우리가 살아가는 시대였다.
        </p>

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
                  <h3 className="mb-1 text-xl leading-snug">
                    {artwork.title}
                  </h3>
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

            <p className="mb-2 text-2xl font-semibold">
              이미지를 업로드해주세요
            </p>

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

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
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

            <h2 className="mb-6 text-3xl md:text-4xl">현대화 사전 적합도 분석</h2>

            <div
              className={`mb-6 rounded-[20px] border-2 p-5 ${
                suitabilityResult.status === "변환 가능"
                  ? "border-green-700 bg-green-50"
                  : suitabilityResult.status === "변화 조금 어려움"
                  ? "border-yellow-700 bg-yellow-50"
                  : "border-red-700 bg-red-50"
              }`}
            >
              <p className="mb-2 text-3xl font-bold">{suitabilityResult.status}</p>

              {suitabilityResult.status === "변환 어려움" && (
                <p className="text-2xl font-semibold text-red-700">
                  이미지 생성이 불가능합니다.
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

        <ReviewSection
          reviews={reviews}
          reviewName={reviewName}
          reviewComment={reviewComment}
          reviewRating={reviewRating}
          loadingReview={loadingReview}
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

function ArchiveSection({
  generations,
  loading,
  openImageModal,
}: {
  generations: Generation[];
  loading: boolean;
  openImageModal: (image: string, title: string) => void;
}) {
  return (
    <section className="mb-12 rounded-[28px] bg-[#111111] p-6 text-white shadow-sm md:p-8">
      <p className="mb-3 text-xs tracking-[0.3em] text-white/40">
        PUBLIC EXHIBITION ARCHIVE
      </p>

      <h2 className="mb-4 text-3xl md:text-5xl">다른 사용자의 변환 전시</h2>

      <p className="mb-8 max-w-4xl text-base leading-7 text-white/60 md:text-lg">
        사용자들이 생성한 현대화 명작 결과가 자동으로 저장되는 전시 아카이브입니다.
      </p>

      {loading && <p className="text-xl text-white/60">아카이브를 불러오는 중...</p>}

      {!loading && generations.length === 0 && (
        <p className="text-xl text-white/60">아직 저장된 전시 결과가 없습니다.</p>
      )}

      <div className="grid gap-5 md:grid-cols-2">
        {generations.map((item) => (
          <div key={item.id} className="bg-white p-4 text-black">
            <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="text-xs tracking-[0.2em] text-neutral-400">
                  {item.direction}
                </p>
                <h3 className="mt-1 text-2xl">{item.artwork_title}</h3>
                <p className="text-sm text-neutral-500">{item.artist}</p>
              </div>

              <p className="text-xs text-neutral-400">
                {new Date(item.created_at).toLocaleString("ko-KR")}
              </p>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <button
                onClick={() => openImageModal(item.original_image, "아카이브 원작")}
                className="aspect-square overflow-hidden bg-neutral-100"
              >
                <img src={item.original_image} alt="archive original" className="h-full w-full object-cover transition hover:scale-105" />
              </button>

              <button
                onClick={() => openImageModal(item.generated_image, "아카이브 현대화 결과")}
                className="aspect-square overflow-hidden bg-neutral-100"
              >
                <img src={item.generated_image} alt="archive generated" className="h-full w-full object-cover transition hover:scale-105" />
              </button>
            </div>

            <div className="mt-4 border-t border-neutral-200 pt-4">
              <p className="mb-1 text-lg font-semibold">
                적합도: {item.suitability?.status || "기록 없음"}
              </p>
              <p className="line-clamp-4 text-base leading-7 text-neutral-700">
                {item.curator_report?.finalSummary ||
                  item.curator_report?.transformationRationale ||
                  "분석 내용이 없습니다."}
              </p>
            </div>
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

      <div className="aspect-square overflow-hidden rounded-[20px] bg-neutral-100">
        {image ? (
          <button onClick={onImageClick} className="h-full w-full cursor-zoom-in overflow-hidden" type="button">
            <img src={image} alt={title} className="h-full w-full object-cover transition duration-500 hover:scale-105" />
          </button>
        ) : isGenerating ? (
          <div className="flex h-full w-full flex-col items-center justify-center text-xl text-neutral-500">
            <div className="mb-4 h-8 w-8 animate-spin rounded-full border-2 border-neutral-300 border-t-black" />
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

function ImageModal({ image, title, onClose }: { image: string; title: string; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-6" onClick={onClose}>
      <div className="relative max-h-full max-w-5xl" onClick={(e) => e.stopPropagation()}>
        <button
          onClick={onClose}
          className="absolute right-0 top-[-54px] rounded-full border border-white/30 px-5 py-2 text-lg text-white transition hover:bg-white hover:text-black"
        >
          닫기
        </button>

        <p className="mb-3 text-xl text-white">{title}</p>

        <img src={image} alt={title} className="max-h-[80vh] max-w-full rounded-[20px] object-contain shadow-2xl" />
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

      <p className="mb-5 max-w-4xl text-base leading-7 text-white/60 md:text-lg">
        이미지가 어떤 프롬프트 설계를 통해 생성되었는지 보여줍니다.
      </p>

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
  setReviewName: (value: string) => void;
  setReviewComment: (value: string) => void;
  setReviewRating: (value: number) => void;
  submitReview: () => void;
}) {
  const average =
    reviews.length > 0
      ? (reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length).toFixed(1)
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
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              onClick={() => setReviewRating(star)}
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
          </div>
        ))}
      </div>
    </section>
  );
}