import OpenAI from "openai";
import { readFile } from "fs/promises";
import path from "path";

export const runtime = "nodejs";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const themePrompts: Record<string, string> = {
  "SNS 시대": `
Theme: SNS era.

Add only minimal modern symbolic elements:
- one or two smartphones
- subtle screen glow
- small painted notification symbols
- a feeling of being watched or recorded
- social comparison, anxiety, and performance pressure

Do not fill the entire painting with digital UI.
Do not turn the image into a modern poster.
The SNS elements must be small, symbolic, and painted into the original world.
`,

  "도시적 고립": `
Theme: urban isolation.

Add only minimal modern symbolic elements:
- distant apartment windows
- cold city light
- subtle glass reflections
- isolated figures or anonymous urban atmosphere
- emotional distance between people and space

Do not replace the whole background with a modern city.
Do not over-modernize the scene.
The urban elements must quietly invade the original painting while preserving the original atmosphere.
`,

  "환경 위기": `
Theme: environmental crisis.

Add only minimal modern symbolic elements:
- polluted air or water
- small traces of plastic waste
- dying plants
- toxic sky tone
- subtle signs of climate damage

Do not turn the painting into a disaster movie.
Do not destroy the whole original composition.
The environmental crisis must feel like it is slowly contaminating the original painting.
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
    const direction = String(formData.get("direction") || "SNS 시대");
    const artworkTitle = String(
      formData.get("artworkTitle") || "classic artwork"
    );

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

    const themePrompt =
      themePrompts[direction] ||
      "Add minimal modern symbolic elements while preserving the original painting.";

    const prompt = `
You are NOT creating a new digital artwork.

You are carefully preserving and minimally editing an existing historical painting.

Artwork title:
"${artworkTitle}"

Modernization theme:
"${direction}"

The MOST IMPORTANT goal is preserving the original artist’s brushwork, paint texture, and physical painting material.

The artwork must still look like the original hand-painted masterpiece.

Preserve at all costs:
- original brushstroke direction
- visible paint texture
- rough canvas grain
- layered oil paint feeling
- imperfect hand-painted details
- historical pigment texture
- uneven paint density
- cracks, noise, and painterly imperfections
- original lighting and atmosphere
- original color temperature
- original composition and framing

The final image must look physically painted by the original artist,
NOT digitally generated.

Modern elements must appear as if they were painted by the original artist using the same brush technique and materials.

Only add minimal modern symbolic elements related to the theme.

${themePrompt}

DO NOT:
- redraw the entire artwork
- smooth out brushstrokes
- create clean digital illustration
- create photorealism
- use 3D rendering
- use anime style
- use cinematic CGI lighting
- sharpen details artificially
- replace the painting texture
- remove canvas imperfections
- modernize the whole composition
- create a glossy surface
- create a poster-like image
- create a collage or overlay effect

The original painting should remain immediately recognizable at first glance.

Preserve at least 80% of the original artwork visually.

The image must look scanned from a physical painting, not rendered by AI.

Preserve physical oil paint materiality.

Do not smooth out the original brush texture.

Do not make the modern objects look pasted on.
They must be absorbed into the original brushwork and pigment surface.
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