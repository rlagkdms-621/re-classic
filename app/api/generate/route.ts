import OpenAI from "openai";
import { readFile } from "fs/promises";
import path from "path";

export const runtime = "nodejs";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const prompts: Record<string, string> = {
  "사회적 고립": `
Transform the classical painting into a haunting reinterpretation of social isolation.

Modern intervention:
Add emotional distance, lonely figures, separated groups, cold public spaces, silent crowds, glass barriers, isolated rooms, distant windows, and subtle signs of disconnection.

Emotional direction:
The image should feel socially disconnected, silent, cold, lonely, and psychologically isolated.

Style preservation:
Every added element must be physically painted in the original painter's exact style.
Figures, spaces, lights, and crowds must share the same brushstroke rhythm, paint texture, and pigment behavior as the original artwork.
`,

  "환경 위기": `
Transform the classical painting into a devastating reinterpretation of environmental crisis.

Modern intervention:
Add polluted water, plastic waste, industrial smoke, dying plants, toxic sky, flooding, dry soil, climate collapse, and ecological decay.

Emotional direction:
The original beauty should feel fragile, contaminated, tragic, and slowly collapsing.

Style preservation:
Every environmental crisis element must be physically painted in the original painter's exact style.
Pollution, smoke, water, plastic, and damaged nature must look like they belong inside the original painting, not like modern objects placed on top.
`,
};

async function localSampleToFile(sampleUrl: string) {
  const cleanPath = sampleUrl.replace(/^\/+/, "");
  const filePath = path.join(process.cwd(), "public", cleanPath);
  const buffer = await readFile(filePath);

  return new File([buffer], path.basename(filePath), {
    type: "image/jpeg",
  });
}

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
    const artworkTitle = String(
      formData.get("artworkTitle") || "classic artwork"
    );

    const preserveLetterbox =
      String(formData.get("preserveLetterbox") || "false") === "true";

    if (!image && sampleUrl) {
      if (sampleUrl.startsWith("/samples/")) {
        image = await localSampleToFile(sampleUrl);
      } else {
        const res = await fetch(sampleUrl);

        if (!res.ok) {
          return Response.json(
            { error: "샘플 이미지를 불러오지 못했습니다." },
            { status: 400 }
          );
        }

        const blob = await res.blob();

        image = new File([blob], "sample-artwork.jpg", {
          type: blob.type || "image/jpeg",
        });
      }
    }

    if (!image) {
      return Response.json({ error: "이미지가 없습니다." }, { status: 400 });
    }

    const letterboxRule = preserveLetterbox
      ? `
VERY IMPORTANT LETTERBOX RULE:
The input image is already placed inside a square canvas with black letterbox areas.

You must preserve the original aspect ratio.
Do NOT stretch, crop, zoom, or reframe the painting.
Do NOT expand the painting into the black letterbox area.
Do NOT paint new content over the black bars.
Do NOT remove the black letterbox bars.
The transformed artwork must remain inside the same original image area.
The black letterbox area must stay clean, flat, and unchanged.
Only transform the actual painting region, not the black border area.
`
      : "";

    const prompt = `
You are a contemporary art director, museum curator, and historical painting restoration specialist.

You are reinterpreting the classic artwork "${artworkTitle}" through the theme of "${direction}".

${letterboxRule}

ABSOLUTE CORE RULE:
The final image must look as if the ORIGINAL PAINTER personally witnessed modern society and painted this new version by hand.

Do not abandon the original painter's style.

The transformation must preserve:
- original composition
- original aspect ratio
- original framing
- original brushwork rhythm
- original painterly texture
- original pigment layering
- original canvas grain
- original lighting method
- original color harmony
- original emotional atmosphere
- original historical painting materiality
- original imperfect handmade surface

The result must NOT look:
- photorealistic
- CGI
- 3D rendered
- anime
- cartoon
- cyberpunk
- glossy
- commercial poster
- digital collage
- simple object overlay
- AI-smooth
- plastic
- modern graphic design

Modern objects must not look pasted on.
Every modern object must appear physically painted by the original artist using the same brush, paint, texture, and material limitations of the original artwork.

Theme-specific transformation:
${prompts[direction] || prompts["사회적 고립"]}

Painterly restoration pass:
After inserting the modern elements, restore the transformed painting region back into the original painterly surface.
Increase authentic brushstroke consistency.
Restore historical paint imperfections.
Restore canvas texture.
Restore traditional pigment layering.
Remove digital smoothness.
Remove modern sharpness.
Make the contemporary objects dissolve into the original painting's material world.

Final goal:
The image should feel like a disturbing parallel-world version of the original masterpiece.
It must be visually transformed, emotionally stronger, socially critical, museum-quality, and still unmistakably painterly.
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