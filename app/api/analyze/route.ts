import OpenAI from "openai";

export const runtime = "nodejs";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

function safeParse(text: string) {
  try {
    return JSON.parse(text);
  } catch {
    return {
      originalAnalysis: "원작 분석을 구조화하지 못했습니다.",
      transformedAnalysis: "현대화 이미지 분석을 구조화하지 못했습니다.",
      transformationRationale: text,
      finalSummary: "최종 해석을 구조화하지 못했습니다.",
      comparisonTable: [],
    };
  }
}

export async function POST(req: Request) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return Response.json(
        { error: "OPENAI_API_KEY가 .env.local에 없습니다." },
        { status: 500 }
      );
    }

    const { originalImage, generatedImage, direction, artworkTitle } =
      await req.json();

    if (!originalImage || !generatedImage) {
      return Response.json(
        { error: "분석할 이미지가 없습니다." },
        { status: 400 }
      );
    }

    const prompt = `
너는 현대미술관의 디지털 큐레이터이자 미술 평론가다.

작품명:
${artworkTitle || "알 수 없음"}

현대화 방향:
${direction}

원작 이미지와 현대화된 이미지를 비교 분석해라.

중요:
- 내부 사고과정은 노출하지 마라.
- 사용자가 이해할 수 있는 큐레이터 해설로 작성해라.
- 차분하고 세련된 전시 해설 톤으로 작성해라.
- "AI가 판단했습니다" 같은 기계적 표현은 피하라.
- 단순 감상이 아니라 원작 요소와 변형 요소를 구조적으로 비교해라.
- 윤리적 쟁점도 간단히 포함해라.
- 원작 화풍 유지 여부와 현대적 변형의 의미를 분명히 설명해라.

반드시 JSON으로만 답해라.

{
  "originalAnalysis": "원작의 구도, 색감, 상징, 감정, 시대적 분위기 분석",
  "transformedAnalysis": "현대화 이미지의 변화 요소, 색감, 분위기, 현대 사회 감정 분석",
  "transformationRationale": "무엇을 유지했고 무엇을 왜 바꾸었는지 큐레이터 해설",
  "finalSummary": "원작과 현대화 작품의 감정 차이와 재해석 의미 요약",
  "comparisonTable": [
    {
      "originalElement": "원작에서 유지되거나 기준이 된 요소",
      "modernizedElement": "현대화 이미지에서 변형되거나 추가된 요소",
      "reason": "왜 이 요소를 바꾸었는지",
      "emotionalShift": "감정이 어떻게 변화했는지",
      "ethicalNote": "원작 훼손, 작가성, 화풍 차용과 관련한 윤리적 고려"
    },
    {
      "originalElement": "두 번째 원작 요소",
      "modernizedElement": "두 번째 현대화 요소",
      "reason": "두 번째 변환 이유",
      "emotionalShift": "두 번째 감정 변화",
      "ethicalNote": "두 번째 윤리적 고려"
    },
    {
      "originalElement": "세 번째 원작 요소",
      "modernizedElement": "세 번째 현대화 요소",
      "reason": "세 번째 변환 이유",
      "emotionalShift": "세 번째 감정 변화",
      "ethicalNote": "세 번째 윤리적 고려"
    }
  ]
}
`;

    const result = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: prompt },
            { type: "image_url", image_url: { url: originalImage } },
            { type: "image_url", image_url: { url: generatedImage } },
          ],
        },
      ],
      response_format: { type: "json_object" },
    });

    const text = result.choices[0]?.message?.content || "{}";

    return Response.json({
      report: safeParse(text),
    });
  } catch (error: any) {
    console.error("ANALYSIS_ERROR:", error);

    return Response.json(
      {
        error:
          error?.message ||
          error?.error?.message ||
          "큐레이터 분석 중 오류가 발생했습니다.",
      },
      { status: 500 }
    );
  }
}