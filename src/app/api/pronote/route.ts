import {
  AccessDeniedError,
  AccountDisabledError,
  AuthenticateError,
  BadCredentialsError,
  BusyPageError,
  geolocation,
  instance,
  PageUnavailableError,
  RateLimitedError,
  SecurityError,
  ServerSideError,
  SessionExpiredError,
  SuspendedIPError,
  UnreachableError,
} from "@/lib/pronote/vendor/pawnote";
import { createDecipheriv, createHash } from "node:crypto";
import { type NextRequest, NextResponse } from "next/server";
import { DemoService } from "@/lib/pronote/demo";
import { pronoteFetcher } from "@/lib/pronote/fetcher";
import {
  loginWithCredentials,
  loginWithQrCode,
  type LoginOutcome,
  NotSupportedError,
  PronoteService,
  restorePronote,
  solveChallenge,
} from "@/lib/pronote/pronote";
import type { SchoolService } from "@/lib/pronote/service";
import {
  getService,
  newSessionId,
  openSession,
  removeService,
  saveChallenge,
  saveService,
  sealSession,
  sessionCookie,
  type SessionPayload,
  takeChallenge,
} from "@/lib/pronote/store";
import type { ApiError, ErrorCode } from "@/lib/pronote/types";

type Body = Record<string, unknown>;

class InputError extends Error {}

const text = (body: Body, key: string, max = 5000) => {
  const value = body[key];
  if (typeof value !== "string" || !value.trim() || value.length > max) throw new InputError(key);
  return value.trim();
};

const date = (body: Body, key: string) => {
  const value = new Date(text(body, key, 40));
  if (Number.isNaN(value.getTime())) throw new InputError(key);
  return value;
};

const textList = (body: Body, key: string) => {
  const value = body[key];
  if (!Array.isArray(value) || !value.length || value.some((item) => typeof item !== "string")) {
    throw new InputError(key);
  }
  return value as string[];
};

function failure(code: ErrorCode, status: number, error: string = code) {
  return NextResponse.json<ApiError>({ error, code }, { status });
}

function qrPinMatches(qr: { jeton: string; login: string }, pin: string) {
  const key = createHash("md5").update(pin, "utf8").digest();
  try {
    for (const value of [qr.jeton, qr.login]) {
      const decipher = createDecipheriv("aes-128-cbc", key, Buffer.alloc(16));
      Buffer.concat([decipher.update(Buffer.from(value, "hex")), decipher.final()]);
    }
    return true;
  } catch {
    return false;
  }
}

function classify(error: unknown) {
  if (error instanceof InputError) return failure("unknown", 400, `invalid ${error.message}`);
  if (error instanceof BadCredentialsError) return failure("bad_credentials", 401);
  if (error instanceof SessionExpiredError) return failure("session_expired", 401);
  if (error instanceof SuspendedIPError) return failure("suspended", 429);
  if (error instanceof RateLimitedError) return failure("rate_limited", 429);
  if (error instanceof SecurityError) return failure("security", 403);
  if (error instanceof ServerSideError) return failure("server", 502, error.message);
  if (error instanceof NotSupportedError) {
    return failure(error.message === "security" ? "security" : "unsupported", 422, error.message);
  }
  if (error instanceof AccessDeniedError || error instanceof AccountDisabledError) {
    return failure("bad_credentials", 403);
  }
  if (
    error instanceof UnreachableError ||
    error instanceof PageUnavailableError ||
    error instanceof BusyPageError ||
    error instanceof AuthenticateError
  ) {
    return failure("unreachable", 502, error.message);
  }
  if (error instanceof TypeError && /fetch failed|Invalid URL/i.test(error.message)) {
    return failure("unreachable", 502, error.message);
  }
  console.error("[papillon-web]", error);
  return failure("unknown", 500, error instanceof Error ? error.message : String(error));
}

function withCookie(response: NextResponse, payload: SessionPayload) {
  response.cookies.set(sessionCookie, sealSession(payload), {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
  return response;
}

function pronotePayload(id: string, service: PronoteService): SessionPayload {
  return { id, kind: "pronote", credentials: service.credentials() };
}

function settle(outcome: LoginOutcome, id: string) {
  if (outcome.status === "pin") {
    saveChallenge(id, outcome.challenge);
    return withCookie(NextResponse.json({ status: "pin" }), { id, kind: "challenge" });
  }
  saveService(id, outcome.service);
  return withCookie(NextResponse.json({ status: "ok" }), pronotePayload(id, outcome.service));
}

function restore(session: SessionPayload | undefined) {
  if (!session) return Promise.resolve(undefined);
  return getService(
    session.id,
    () => {
      if (session.kind === "demo") return Promise.resolve(new DemoService());
      if (session.kind === "pronote") return restorePronote(session.credentials);
      return undefined;
    },
    (service) =>
      session.kind !== "pronote" ||
      !(service instanceof PronoteService) ||
      service.credentials().refresh.token === session.credentials.refresh.token,
  );
}

async function runAction(service: SchoolService, action: string, body: Body): Promise<unknown> {
  switch (action) {
    case "profile":
      return service.profile();
    case "timetable":
      return service.timetable(date(body, "from"), date(body, "to"));
    case "courseResources":
      return service.courseResources(text(body, "resourceId"));
    case "homeworks":
      return service.homeworks(date(body, "from"), date(body, "to"));
    case "setHomeworkDone":
      await service.setHomeworkDone(text(body, "id"), body.done === true);
      return { ok: true };
    case "gradePeriods":
      return service.gradePeriods();
    case "grades":
      return service.grades(text(body, "periodId"));
    case "attendancePeriods":
      return service.attendancePeriods();
    case "attendance":
      return service.attendance(text(body, "periodId"));
    case "news":
      return service.news();
    case "newsDetail":
      if (!(service instanceof PronoteService)) return null;
      return service.newsDetail(text(body, "id"), typeof body.title === "string" ? body.title : "", typeof body.date === "string" ? body.date : "");
    case "newsDebug":
      if (!(service instanceof PronoteService)) return { patched: true, raw: null };
      return service.newsDebug(text(body, "id"));
    case "acknowledgeNews":
      await service.acknowledgeNews(text(body, "id"));
      return { ok: true };
    case "chats":
      return service.chats();
    case "chatMessages":
      return service.chatMessages(text(body, "id"));
    case "sendMessage":
      await service.sendMessage(text(body, "id"), text(body, "content"));
      return { ok: true };
    case "recipients":
      return service.recipients();
    case "createChat":
      await service.createChat(text(body, "subject", 200), text(body, "content"), textList(body, "recipientIds"));
      return { ok: true };
    case "canteen":
      return service.canteen(date(body, "from"));
    default:
      throw new InputError("action");
  }
}

export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (origin && new URL(origin).host !== request.headers.get("host")) {
    return failure("unknown", 403, "origin");
  }

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return failure("unknown", 400, "json");
  }

  const action = typeof body.action === "string" ? body.action : "";
  const session = openSession(request.cookies.get(sessionCookie)?.value);
  const currentId = session?.id;

  try {
    switch (action) {
      case "loginDemo": {
        const id = newSessionId();
        removeService(currentId);
        saveService(id, new DemoService());
        return withCookie(NextResponse.json({ status: "ok" }), { id, kind: "demo" });
      }
      case "loginCredentials": {
        const outcome = await loginWithCredentials({
          url: text(body, "url", 500),
          username: text(body, "username", 200),
          password: text(body, "password", 200),
          parent: body.parent === true,
        });
        removeService(currentId);
        return settle(outcome, newSessionId());
      }
      case "loginQr": {
        const qr = body.qr as Body | undefined;
        if (!qr || typeof qr !== "object") return failure("invalid_qr", 400);
        let parsed: { jeton: string; login: string; url: string };
        try {
          parsed = { jeton: text(qr, "jeton"), login: text(qr, "login"), url: text(qr, "url", 500) };
        } catch {
          return failure("invalid_qr", 400);
        }
        const pin = text(body, "pin", 10);
        if (!/^\d{4}$/.test(pin) || !qrPinMatches(parsed, pin)) return failure("invalid_pin", 400);
        let outcome: LoginOutcome;
        try {
          outcome = await loginWithQrCode({ qr: parsed, pin });
        } catch (error) {
          if (error instanceof BadCredentialsError) return failure("invalid_qr", 401);
          throw error;
        }
        removeService(currentId);
        return settle(outcome, newSessionId());
      }
      case "solveChallenge": {
        const challenge = takeChallenge(currentId);
        if (!challenge || !currentId) return failure("not_logged_in", 401);
        const service = await solveChallenge(challenge, text(body, "pin", 10));
        saveService(currentId, service);
        return withCookie(NextResponse.json({ status: "ok" }), pronotePayload(currentId, service));
      }
      case "logout": {
        removeService(currentId);
        const response = NextResponse.json({ ok: true });
        response.cookies.delete(sessionCookie);
        return response;
      }
      case "instance": {
        const info = await instance(text(body, "url", 500), pronoteFetcher);
        return NextResponse.json({ name: info.name, url: text(body, "url", 500), ent: Boolean(info.casURL) });
      }
      case "geolocate": {
        const latitude = Number(body.latitude);
        const longitude = Number(body.longitude);
        if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) throw new InputError("position");
        const schools = await geolocation({ latitude, longitude }, pronoteFetcher);
        return NextResponse.json(
          schools.slice(0, 20).map((school) => ({
            name: school.name,
            url: school.url,
            distance: school.distance,
            postalCode: school.postalCode,
          })),
        );
      }
    }

    let service: SchoolService | undefined;
    try {
      service = await restore(session);
    } catch (error) {
      console.error("[papillon-web] restore", error);
      removeService(currentId);
      const response = error instanceof BadCredentialsError ? failure("session_expired", 401) : classify(error);
      if (error instanceof BadCredentialsError) response.cookies.delete(sessionCookie);
      return response;
    }
    if (!service || !session) return failure("not_logged_in", 401);

    const response = NextResponse.json(await runAction(service, action, body));
    if (service instanceof PronoteService && session.kind === "pronote") {
      const latest = service.credentials();
      if (latest.refresh.token !== session.credentials.refresh.token) {
        withCookie(response, pronotePayload(session.id, service));
      }
    }
    return response;
  } catch (error) {
    return classify(error);
  }
}
