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

너의 임무:
이미지를 무조건 변환 가능하다고 판단하지 않는다.
이미지가 "${direction}" 주제로 현대화하기 적합한지 엄격하게 판정한다.

작품명:
${artworkTitle || "알 수 없음"}

판정은 반드시 아래 3개 중 하나만 사용한다.

1. "변환 가능"
2. "변화 조금 어려움"
3. "변환 어려움"

공통 엄격 기준:
- 빈 이미지, 흰 배경, 단색 이미지, 단순 패턴, 의미 없는 사진은 무조건 "변환 어려움"
- 회화 작품이 아니거나 명작/예술작품으로 보기 어려운 일상 사진은 원칙적으로 "변환 어려움"
- 현대화에 사용할 시각 요소가 부족하면 "변환 어려움"
- 인물, 공간, 배경, 상징, 감정, 구도 중 최소 3개 이상이 확인되어야 "변화 조금 어려움" 이상 가능
- 단순 풍경만 있고 사회적 해석 요소가 약하면 대부분 "변환 어려움"
- 억지로 좋게 평가하지 말 것

주제별 엄격 기준:

[SNS 시대]
- 사람 또는 사람의 행위가 명확히 보여야 한다.
- 인물이 없으면 원칙적으로 "변환 어려움"
- 인물이 있더라도 표정, 시선, 군중, 관계, 소통, 고립, 관찰 구조 중 하나 이상이 있어야 한다.
- 단순 자연 풍경, 정물, 추상 이미지, 건축물만 있는 이미지는 "변환 어려움"
- SNS 시대는 인간의 시선, 인정 욕구, 자기표현, 비교, 연결/단절을 다루므로 인물성이 핵심이다.

[도시적 고립]
- 사람 또는 고립을 느낄 수 있는 인물/군중/생활 공간이 있어야 한다.
- 인물이 전혀 없고 단순 풍경만 있다면 원칙적으로 "변환 어려움"
- 단, 사람이 없더라도 도시 공간, 실내 공간, 창문, 거리, 건축물, 폐허 등 고립을 상징할 강한 공간 구조가 있으면 "변화 조금 어려움"까지 가능하다.
- 자연 풍경만 있는 이미지는 "변환 어려움"
- 도시적 고립은 인간과 공간의 관계가 핵심이다.

[환경 위기]
- 인물이 없어도 자연, 농경지, 바다, 하늘, 동물, 식물, 풍경, 계절, 생태계 요소가 뚜렷하면 가능하다.
- 자연환경 또는 생태적 요소가 없으면 "변환 어려움"
- 단순 인물 초상만 있고 환경 정보가 거의 없으면 "변화 조금 어려움" 또는 "변환 어려움"
- 환경 위기는 자연/생태/공간 요소가 핵심이다.

판정 기준 상세:

"변환 가능"
- 주제와 직접 연결되는 핵심 요소가 충분하다.
- 원작의 구도, 인물, 배경, 상징을 현대적으로 재해석할 수 있다.
- 생성 결과가 단순 장식이 아니라 사회적 메시지를 가질 가능성이 높다.

"변화 조금 어려움"
- 일부 요소는 있으나 부족하다.
- 변환은 가능하지만 결과가 단순하거나 설득력이 약할 수 있다.
- 주제 연결이 부분적으로만 가능하다.

"변환 어려움"
- 주제와 연결할 핵심 요소가 부족하다.
- 인물/공간/상징/환경 중 필요한 요소가 거의 없다.
- 명작이 아니거나 현대화할 맥락이 약하다.
- 이 경우 반드시 message에 "이미지 생성이 불가능합니다."를 넣어라.

중요:
- 특히 SNS 시대와 도시적 고립은 인물 여부를 매우 중요하게 판단해라.
- 환경 위기는 인물이 없어도 자연/생태 요소가 충분하면 가능하다.
- 판정은 엄격하게 한다.
- 내부 사고과정은 노출하지 않는다.
- 반드시 JSON으로만 답한다.

JSON 형식:
{
  "status": "변환 가능 / 변화 조금 어려움 / 변환 어려움 중 하나",
  "canGenerate": true 또는 false,
  "reason": "왜 이렇게 판정했는지 구체적으로 설명",
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

    if (suitability.status === "변환 어려움") {
      suitability.canGenerate = false;
      suitability.message = "이미지 생성이 불가능합니다.";
    }

    if (
      suitability.status === "변환 가능" ||
      suitability.status === "변화 조금 어려움"
    ) {
      suitability.canGenerate = true;
      suitability.message = "";
    }

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