import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

const supabaseUrl =
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "";

const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

function getSupabase() {
  if (!supabaseUrl || !supabaseKey) {
    throw new Error(
      "Supabase 환경변수가 없습니다. NEXT_PUBLIC_SUPABASE_URL과 SUPABASE_SERVICE_ROLE_KEY를 확인해주세요."
    );
  }

  return createClient(supabaseUrl, supabaseKey);
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
    console.error("REVIEWS_GET_ERROR:", error);

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
    console.error("REVIEWS_POST_ERROR:", error);

    return Response.json(
      { error: error.message || "후기 저장 실패" },
      { status: 500 }
    );
  }
}