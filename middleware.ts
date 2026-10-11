import { NextRequest, NextResponse } from "next/server";
import { getIronSession } from "iron-session";
import { sessionOptions, SessionData } from "@/app/lib/session";

const OWNER_ONLY = [
  "/settings", "/users", "/audit-log",
  "/api/settings", "/api/users", "/api/backup", "/api/audit-logs",
];

const NOT_FOR_DATA_ENTRY = [
  "/payments", "/cash-book", "/bank-book", "/expenses", "/wheat-types",
  "/reports", "/labor", "/transport", "/bags",
  "/api/payments", "/api/cash-book", "/api/bank-book", "/api/expenses",
  "/api/expense-categories", "/api/labor", "/api/transport", "/api/bags",
  "/api/reports",
];

const matches = (path: string, list: string[]) =>
  list.some((p) => path === p || path.startsWith(p + "/"));

export async function middleware(request: NextRequest) {
  const response = NextResponse.next();
  const session = await getIronSession<SessionData>(request, response, sessionOptions);

  const path = request.nextUrl.pathname;
  const method = request.method;
  const isApi = path.startsWith("/api/");
  const isPublic = path === "/login" || path === "/api/auth/login";
  const loggedIn = !!session.userId;
  const role = session.roleName;

  if (!loggedIn) {
    if (isPublic) return response;
    if (isApi) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (path === "/login") {
    return NextResponse.redirect(new URL("/", request.url));
  }

  const forbidden =
    (matches(path, OWNER_ONLY) && role !== "owner") ||
    (role === "data_entry" &&
      (matches(path, NOT_FOR_DATA_ENTRY) ||
        (path.startsWith("/api/wheat-types") && method !== "GET")));

  if (forbidden) {
    if (isApi) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    return NextResponse.redirect(new URL("/", request.url));
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|icon-192|icon-512|sw.js).*)",
  ],
};