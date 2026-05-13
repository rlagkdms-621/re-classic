import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

const supabaseUrl =
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

function getSupabase() {
  if (!supabaseUrl || !supabaseKey) {
    throw new Error("Supabase 환경변수가 없습니다.");
  }

  return createClient(supabaseUrl, supabaseKey);
}

function checkAdmin(req: Request) {
  const adminSecret = process.env.ADMIN_SECRET || "";
  const requestSecret = req.headers.get("x-admin-secret") || "";

  if (!adminSecret || requestSecret !== adminSecret) {
    throw new Error("관리자 권한이 없습니다.");
  }
}

export async function GET() {
  try {
    const supabase = getSupabase();

    const { data, error } = await supabase
      .from("generations")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw error;

    return Response.json({ generations: data || [] });
  } catch (error: any) {
    return Response.json(
      { error: error.message || "생성 결과 불러오기 실패" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const supabase = getSupabase();
    const body = await req.json();

    const { data, error } = await supabase
      .from("generations")
      .insert([
        {
          artwork_title: body.artworkTitle || "알 수 없음",
          artist: body.artist || "알 수 없음",
          direction: body.direction || "",
          original_image: body.originalImage || "",
          generated_image: body.generatedImage || "",
          suitability: body.suitability || {},
          curator_report: body.curatorReport || {},
          used_prompt: body.usedPrompt || "",
        },
      ])
      .select();

    if (error) throw error;

    return Response.json({ generation: data?.[0] });
  } catch (error: any) {
    return Response.json(
      { error: error.message || "생성 결과 저장 실패" },
      { status: 500 }
    );
  }
}

export async function DELETE(req: Request) {
  try {
    checkAdmin(req);

    const supabase = getSupabase();
    const { id } = await req.json();

    if (!id) {
      return Response.json({ error: "삭제할 작품 ID가 없습니다." }, { status: 400 });
    }

    const { error } = await supabase.from("generations").delete().eq("id", id);

    if (error) throw error;

    return Response.json({ success: true });
  } catch (error: any) {
    return Response.json(
      { error: error.message || "전시 작품 삭제 실패" },
      { status: 403 }
    );
  }
}