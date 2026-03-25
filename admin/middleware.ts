import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    console.error(
      "[middleware] Faltan NEXT_PUBLIC_SUPABASE_URL o NEXT_PUBLIC_SUPABASE_ANON_KEY en Vercel → Settings → Environment Variables"
    );
    if (request.nextUrl.pathname.startsWith("/dashboard")) {
      return NextResponse.json(
        {
          error:
            "Configuración incompleta: añade NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_ANON_KEY en Vercel.",
        },
        { status: 503 }
      );
    }
    return NextResponse.next({ request });
  }

  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  try {
    const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    });

    const {
      data: { user },
    } = await supabase.auth.getUser();

    const { pathname } = request.nextUrl;

    if (pathname.startsWith("/dashboard")) {
      if (!user) {
        const url = request.nextUrl.clone();
        url.pathname = "/login";
        url.searchParams.set("next", pathname);
        return NextResponse.redirect(url);
      }

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();

      if (profileError) {
        console.error("[middleware] profiles:", profileError.message);
        const url = request.nextUrl.clone();
        url.pathname = "/login";
        url.searchParams.set("error", "profile");
        return NextResponse.redirect(url);
      }

      if (profile?.role !== "admin") {
        const url = request.nextUrl.clone();
        url.pathname = "/login";
        url.searchParams.set("error", "forbidden");
        return NextResponse.redirect(url);
      }
    }

    return response;
  } catch (e) {
    console.error("[middleware]", e);
    return NextResponse.json(
      { error: "Error en middleware. Revisa logs en Vercel." },
      { status: 500 }
    );
  }
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
