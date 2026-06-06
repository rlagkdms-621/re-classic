import OpenAI from "openai";
import { readFile } from "fs/promises";
import path from "path";

export const runtime = "nodejs";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const prompts: Record<string, string> = {
  "사회적 고립": `
Transform the actual painting region into a reinterpretation of social isolation.

Use emotional distance, separated figures, silent crowds, cold public spaces, glass barriers, isolated rooms, distant windows, and subtle signs of disconnection.

The scene should feel socially disconnected, silent, cold, lonely, and psychologically isolated.
`,

  "환경 위기": `
Transform the actual painting region into a reinterpretation of environmental crisis.

Use polluted water, plastic waste, industrial smoke, dying plants, toxic sky, flooding, dry soil, climate collapse, and ecological decay.

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
    const artworkTitle = String(
      formData.get("artworkTitle") || "classic artwork"
    );
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
You are editing a classic painting that has been temporarily placed inside a square canvas with bright marker bars.

IMPORTANT INPUT STRUCTURE:
- The input image is a 1024x1024 square canvas.
- The actual artwork is inside the center region.
- The empty letterbox areas are filled with a bright red and green checkerboard marker.
- The checkerboard marker is NOT part of the painting.
- The marker exists only to show the AI which area must be ignored.

Artwork title:
"${artworkTitle}"

Modernization theme:
"${direction}"

Artwork region information:
${letterboxRect}

ABSOLUTE RULE ABOUT MARKERS:
Do NOT paint over the red and green checkerboard marker areas.
Do NOT use the marker pattern as part of the artwork.
Do NOT copy the marker pattern into the painting.
Do NOT expand the painting into the marker area.
Do NOT remove the marker area.
Do NOT redesign the whole square image.

ONLY transform the actual artwork region.
The artwork must stay inside the same rectangular region.
The original unusual aspect ratio must be respected.

If the original artwork is very wide, the transformed artwork must still be very wide.
If the original artwork is vertical, the transformed artwork must still be vertical.
Do not stretch, crop, zoom, or reframe the painting.

After generation, the marker areas will be removed by the program.
Therefore, the final useful image is only the artwork region.

STYLE RULES:
The transformation must preserve:
- original aspect ratio
- original framing
- original composition logic
- original brushwork rhythm
- original painterly texture
- original pigment feeling
- original color harmony
- original emotional atmosphere
- historical painting materiality

Do not create:
- photorealistic image
- CGI
- 3D render
- anime
- cartoon
- commercial poster
- digital collage
- clean digital illustration

Theme-specific instruction:
${prompts[direction] || prompts["사회적 고립"]}

Final goal:
Create a transformed version of the painting region only.
The red and green marker bars must remain visually separate and ignored.
The artwork must preserve its original proportion so that the program can remove the marker bars afterward and produce a correctly proportioned final image.
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