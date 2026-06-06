import OpenAI from "openai";
import { readFile } from "fs/promises";
import path from "path";

export const runtime = "nodejs";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const prompts: Record<string, string> = {
  "사회적 고립": `
Transform only the actual painting area into a reinterpretation of social isolation.

Use emotional distance, separated figures, silent crowds, cold public spaces, glass barriers, isolated rooms, distant windows, and subtle signs of disconnection.

Do not change the aspect ratio or framing logic.
The scene should feel socially disconnected, silent, cold, lonely, and psychologically isolated.
`,

  "환경 위기": `
Transform only the actual painting area into a reinterpretation of environmental crisis.

Use polluted water, plastic waste, industrial smoke, dying plants, toxic sky, flooding, dry soil, climate collapse, and ecological decay.

Do not change the aspect ratio or framing logic.
The original beauty should feel fragile, contaminated, tragic, and slowly collapsing.
`,
};

export async function POST(req: Request) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return Response.json(
        { error: "OPENAI_API_KEY가 .env.local에 없습니다." },
        { status: 500 }
      );
    }

    const formData = await req.formData();

    let image = formData.get("image") as File | null;
    const sampleUrl = String(formData.get("sampleUrl") || "");
    const direction = String(formData.get("direction") || "사회적 고립");
    const artworkTitle = String(formData.get("artworkTitle") || "classic artwork");
    const letterboxRect = String(formData.get("letterboxRect") || "");

    if (!image && sampleUrl) {
      if (sampleUrl.startsWith("/samples/")) {
        const cleanPath = sampleUrl.replace(/^\/+/, "");
        const filePath = path.join(process.cwd(), "public", cleanPath);
        const buffer = await readFile(filePath);

        image = new File([buffer], path.basename(filePath), {
          type: "image/jpeg",
        });
      }
    }

    if (!image) {
      return Response.json({ error: "이미지가 없습니다." }, { status: 400 });
    }

    const prompt = `
You are editing a letterboxed classic painting.

The input is a 1024x1024 square canvas.
Inside that square canvas, the original artwork occupies only its original aspect-ratio region.
The remaining areas are black letterbox bars.

Original artwork:
"${artworkTitle}"

Modernization theme:
"${direction}"

Letterbox region data:
${letterboxRect}

CRITICAL RULE:
Do not treat the whole 1024x1024 canvas as the artwork.
Only the non-black artwork region is the actual painting.
The black bars are not part of the painting.

You must keep the original painting's aspect ratio.
You must not stretch the painting.
You must not crop the painting.
You must not reframe the painting.
You must not expand the painting into the black bars.

If the original artwork is panoramic, the result must still feel panoramic.
If the original artwork is vertical, the result must still feel vertical.
If the original artwork is extremely wide, the result must remain extremely wide.

Transform only the painting region conceptually.
The final result may still be returned as a square image, but the composition must be designed for the same original aspect-ratio region.

Style preservation:
- preserve original composition
- preserve original aspect ratio
- preserve original framing
- preserve original brushwork rhythm
- preserve original painterly texture
- preserve original color harmony
- preserve original emotional atmosphere
- preserve original historical painting materiality

Do not create:
- photorealistic image
- CGI
- 3D render
- anime
- cartoon
- commercial poster
- digital collage
- simple object overlay
- AI-smooth modern illustration

Theme-specific instruction:
${prompts[direction] || prompts["사회적 고립"]}

Final goal:
Create a modern reinterpretation that still visually respects the original artwork's unusual proportions.
`;

    const result = await openai.images.edit({
      model: "gpt-image-1",
      image,
      prompt,
      size: "1024x1024",
    });

    const base64 = result.data?.[0]?.b64_json;

    if (!base64) {
      return Response.json(
        { error: "이미지 생성 결과가 없습니다." },
        { status: 500 }
      );
    }

    return Response.json({
      image: `data:image/png;base64,${base64}`,
      usedPrompt: prompt,
    });
  } catch (error: any) {
    console.error("IMAGE_GENERATION_ERROR:", error);

    return Response.json(
      {
        error:
          error?.message ||
          error?.error?.message ||
          "이미지 생성 중 오류가 발생했습니다.",
      },
      { status: 500 }
    );
  }
}