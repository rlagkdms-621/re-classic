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
      limitation: "현대화 변환에 필요한 인물, 공간, 상징, 회화적 맥락을 안정적으로 확인하지 못했습니다.",
      message: "이미지 생성이 불가능합니다.",
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

    const { image, direction, artworkTitle } = await req.json();

    if (!image) {
      return Response.json(
        { error: "분석할 이미지가 없습니다." },
        { status: 400 }
      );
    }

    const prompt = `
너는 고전 명화를 현대 사회의 문제의식으로 재해석하는 프로젝트의 사전 심사 큐레이터다.

목적:
이미지를 무조건 변환하지 않는다.
이 이미지를 "${direction}" 주제로 현대화해도 되는지 먼저 판정한다.

작품명:
${artworkTitle || "알 수 없음"}

판정은 반드시 아래 3개 중 하나만 사용한다.

1. "변환 가능"
- 고전 명화 또는 회화 작품으로 보임
- 인물, 공간, 배경, 상징, 감정, 구도 중 현대화에 사용할 요소가 충분함
- SNS 시대 / 도시적 고립 / 환경 위기 같은 현대 주제와 연결할 수 있음
- 이미지 생성 진행 가능

2. "변화 조금 어려움"
- 회화 작품이지만 변환 요소가 일부 부족함
- 배경이 단순하거나 인물이 적거나 상징성이 약함
- 그래도 제한적으로 현대화 가능
- 이미지 생성 진행 가능

3. "변환 어려움"
- 흰 배경, 단색 이미지, 빈 이미지, 의미 없는 사진, 명화와 무관한 사진, 회화성이 약한 이미지, 변환 요소가 거의 없는 이미지
- 인물/공간/상징/감정/배경이 부족해서 현대화 주제와 연결하기 어려움
- 이미지 생성 진행 불가
- 반드시 "이미지 생성이 불가능합니다."라는 문구를 포함

중요:
- 하얀 배경, 빈 이미지, 단순 물체 사진, 의미 없는 사진은 반드시 "변환 어려움"으로 판단해라.
- 억지로 좋게 평가하지 마라.
- 변환 가능 여부를 엄격하게 판단해라.
- 내부 사고과정은 노출하지 마라.
- 반드시 JSON으로만 답해라.

JSON 형식:
{
  "status": "변환 가능 / 변화 조금 어려움 / 변환 어려움 중 하나",
  "canGenerate": true 또는 false,
  "reason": "왜 이렇게 판정했는지 설명",
  "limitation": "변환의 한계 또는 주의점 설명",
  "message": "변환 어려움일 경우 '이미지 생성이 불가능합니다.' 포함, 아니면 빈 문자열"
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
    const suitability = safeParse(text);

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