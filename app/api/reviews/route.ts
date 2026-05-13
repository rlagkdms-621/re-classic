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
      .from("reviews")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw error;

    return Response.json({ reviews: data || [] });
  } catch (error: any) {
    return Response.json(
      { error: error.message || "후기 불러오기 실패" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const supabase = getSupabase();
    const { rating, name, comment } = await req.json();

    if (!rating || !comment) {
      return Response.json(
        { error: "별점과 후기를 입력해주세요." },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from("reviews")
      .insert([
        {
          rating,
          name: name || "익명",
          comment,
        },
      ])
      .select();

    if (error) throw error;

    return Response.json({ review: data?.[0] });
  } catch (error: any) {
    return Response.json(
      { error: error.message || "후기 저장 실패" },
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
      return Response.json({ error: "삭제할 후기 ID가 없습니다." }, { status: 400 });
    }

    const { error } = await supabase.from("reviews").delete().eq("id", id);

    if (error) throw error;

    return Response.json({ success: true });
  } catch (error: any) {
    return Response.json(
      { error: error.message || "후기 삭제 실패" },
      { status: 403 }
    );
  }
}