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
      status: "변환 어려움",
      canGenerate: false,
      reason: "이미지 분석 결과를 구조화하지 못했습니다.",
      limitation:
        "현대화 변환에 필요한 인물, 공간, 상징, 감정, 배경 정보를 안정적으로 확인하지 못했습니다.",
      message: "이미지 변환이 불가능합니다.",
    };
  }
}

function normalizeSuitability(raw: any) {
  const statusText = String(raw?.status || "").replace(/\s/g, "");

  if (statusText.includes("어려움") && !statusText.includes("조금")) {
    return {
      ...raw,
      status: "변환 어려움",
      canGenerate: false,
      message: "이미지 변환이 불가능합니다.",
    };
  }

  if (statusText.includes("조금")) {
    return {
      ...raw,
      status: "변화 조금 어려움",
      canGenerate: true,
      message: "",
    };
  }

  if (statusText.includes("가능")) {
    return {
      ...raw,
      status: "변환 가능",
      canGenerate: true,
      message: "",
    };
  }

  return {
    ...raw,
    status: "변환 어려움",
    canGenerate: false,
    message: "이미지 변환이 불가능합니다.",
  };
}

export async function POST(req: Request) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return Response.json(
        { error: "OPENAI_API_KEY가 없습니다." },
        { status: 500 }
      );
    }

    const { image, direction, artworkTitle } = await req.json();

    if (!image) {
      return Response.json(
        { error: "분석할 이미지가 없습니다." },
        { status: 400 }
      );
    }

    const prompt = `
너는 고전 명화를 현대 사회의 문제의식으로 재해석하는 프로젝트의 사전 심사 큐레이터다.

작품명:
${artworkTitle || "알 수 없음"}

현대화 주제:
${direction}

반드시 아래 3개 중 하나로만 판정해라.

1. "변환 가능"
2. "변화 조금 어려움"
3. "변환 어려움"

엄격 기준:
- 흰 배경, 빈 이미지, 단색 이미지, 의미 없는 사진은 무조건 "변환 어려움"
- 명화나 예술 작품으로 보기 어려운 사진은 "변환 어려움"
- 현대화에 사용할 인물, 공간, 배경, 상징, 감정, 구도 중 최소 3개 이상이 없으면 "변환 어려움"
- 억지로 좋게 판단하지 마라.

주제별 기준:

[사회적 고립]
- 사람 또는 고립을 느낄 수 있는 인물/군중/생활 공간이 있어야 한다.
- 인물이 전혀 없고 단순 풍경만 있다면 원칙적으로 "변환 어려움"
- 단, 사람이 없더라도 실내 공간, 창문, 거리, 건축물, 폐허, 비어 있는 공공장소 등 고립을 상징할 강한 공간 구조가 있으면 "변화 조금 어려움"까지 가능하다.
- 자연 풍경만 있는 이미지는 "변환 어려움"
- 사회적 고립은 인간과 공간, 인간과 인간 사이의 단절이 핵심이다.

[환경 위기]
- 인물이 없어도 자연, 농경지, 바다, 하늘, 동물, 식물, 풍경, 계절, 생태계 요소가 뚜렷하면 가능하다.
- 자연환경 또는 생태적 요소가 없으면 "변환 어려움"
- 단순 인물 초상만 있고 환경 정보가 거의 없으면 "변화 조금 어려움" 또는 "변환 어려움"
- 환경 위기는 자연/생태/공간 요소가 핵심이다.

"변환 어려움"일 때는 반드시 canGenerate를 false로 하고,
message에는 반드시 "이미지 변환이 불가능합니다."라고 써라.

반드시 JSON으로만 답해라.

JSON 형식:
{
  "status": "변환 가능 / 변화 조금 어려움 / 변환 어려움 중 하나",
  "canGenerate": true 또는 false,
  "reason": "판정 이유",
  "limitation": "변환 한계",
  "message": "변환 어려움일 경우 이미지 변환이 불가능합니다."
}
`;

    const result = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: prompt },
            { type: "image_url", image_url: { url: image } },
          ],
        },
      ],
      response_format: { type: "json_object" },
    });

    const text = result.choices[0]?.message?.content || "{}";
    const parsed = safeParse(text);
    const suitability = normalizeSuitability(parsed);

    return Response.json({ suitability });
  } catch (error: any) {
    console.error("SUITABILITY_ERROR:", error);

    return Response.json(
      {
        error:
          error?.message ||
          error?.error?.message ||
          "적합도 분석 중 오류가 발생했습니다.",
      },
      { status: 500 }
    );
  }
}