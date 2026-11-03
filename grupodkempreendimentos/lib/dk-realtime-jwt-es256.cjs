/**
 * Emissor/verificador JWT ES256 para Realtime (preparação).
 * Chave privada só no servidor. Sem HMAC improvisado. Sem service_role.
 *
 * Ativação em produção exige (todos):
 * - DK_REALTIME_SINAL=1
 * - DK_REALTIME_ES256_TRUSTED=1  (humano confirmou import + rotação para Current no Supabase)
 * - DK_REALTIME_ES256_JWK       (JWK privado EC P-256)
 * - DK_REALTIME_ES256_KID       (mesmo kid importado no Dashboard)
 *
 * Standby no Supabase NÃO autentica JWTs mintados por nós até a chave ser Current/trusted.
 */
const crypto = require("crypto");

const DEFAULT_TTL_SEC = 120;
const PROJECT_REF = "ppxtwqvzgujllfzarpuz";
const DEFAULT_ISS = `https://${PROJECT_REF}.supabase.co/auth/v1`;

function b64urlJson(obj) {
  return Buffer.from(JSON.stringify(obj), "utf8").toString("base64url");
}

function parseJwk(raw) {
  if (raw && typeof raw === "object") return raw;
  const s = String(raw || "").trim();
  if (!s) return null;
  try {
    const j = JSON.parse(s);
    return j && typeof j === "object" ? j : null;
  } catch {
    return null;
  }
}

function lerConfig(env) {
  const e = env || process.env;
  const jwk = parseJwk(e.DK_REALTIME_ES256_JWK);
  const kid = String(e.DK_REALTIME_ES256_KID || (jwk && jwk.kid) || "").trim();
  const ttl = Math.min(300, Math.max(30, Number(e.DK_REALTIME_JWT_TTL_SEC) || DEFAULT_TTL_SEC));
  const sinal = String(e.DK_REALTIME_SINAL || "0").trim() === "1";
  const trusted = String(e.DK_REALTIME_ES256_TRUSTED || "0").trim() === "1";
  const { isolamentoPronto } = require("./dk-realtime-scope.cjs");
  const scopeOk = isolamentoPronto(e).ok;
  const iss = String(e.DK_REALTIME_JWT_ISS || e.SUPABASE_URL || DEFAULT_ISS)
    .trim()
    .replace(/\/$/, "");
  const issuer = /\/auth\/v1$/i.test(iss) ? iss : `${iss}/auth/v1`;
  return { jwk, kid, ttl, sinal, trusted, scopeOk, issuer };
}

function requisitosAusentes(cfg) {
  const falta = [];
  if (!cfg.sinal) falta.push("DK_REALTIME_SINAL");
  if (!cfg.trusted) falta.push("DK_REALTIME_ES256_TRUSTED");
  if (!cfg.scopeOk) falta.push("DK_REALTIME_SCOPE_ISOLATION");
  if (!cfg.jwk || cfg.jwk.kty !== "EC" || cfg.jwk.crv !== "P-256" || !cfg.jwk.d) {
    falta.push("DK_REALTIME_ES256_JWK");
  }
  if (!cfg.kid) falta.push("DK_REALTIME_ES256_KID");
  return falta;
}

function emissorPronto(env) {
  const cfg = lerConfig(env);
  const falta = requisitosAusentes(cfg);
  return {
    ok: falta.length === 0,
    falta,
    alg: "ES256",
    ttl_sec: cfg.ttl,
    kid: cfg.kid || null,
    trusted: cfg.trusted,
    sinal: cfg.sinal,
    motivo: falta.length
      ? "REALTIME_AUTH_BLOCKED"
      : "pronto_para_emissao_local_apos_gates",
  };
}

/** UUID estável a partir de CPF+sid (não cria auth.users). */
function subjectDeterministico(cpf, sid) {
  const h = crypto.createHash("sha256").update(`dk-rt:${cpf}:${sid}`, "utf8").digest();
  const b = Buffer.from(h.subarray(0, 16));
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const hex = b.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function montarClaims(gate, opts) {
  const now = Math.floor(Date.now() / 1000);
  const ttl = Number(opts && opts.ttl) || DEFAULT_TTL_SEC;
  const cpf = String((gate && gate.cpf) || "").replace(/\D/g, "").slice(0, 11);
  const sid = String((gate && gate.sid) || "").trim();
  const { normalizarEmpresa, normalizarFilial } = require("./dk-realtime-scope.cjs");
  const empresa =
    normalizarEmpresa((opts && opts.empresa) || (gate && gate.empresa) || "locadora") || "locadora";
  const filial = normalizarFilial((opts && opts.filial) || (gate && gate.filial) || "default");
  const roleDk = String((gate && gate.role) || "").trim() || "equipa";
  if (String(roleDk).toLowerCase() === "service_role") {
    throw new Error("service_role_proibido");
  }
  return {
    iss: opts.issuer,
    aud: "authenticated",
    sub: subjectDeterministico(cpf || "0", sid || "nosid"),
    role: "authenticated",
    iat: now,
    nbf: now,
    exp: now + ttl,
    dk_portal: true,
    dk_sid: sid,
    dk_role: roleDk,
    dk_empresa: empresa,
    dk_filial: filial,
    dk_typ: String((gate && gate.typ) || "equipa"),
  };
}

function assinarEs256(privateJwk, kid, claims) {
  if (!privateJwk || privateJwk.kty !== "EC" || !privateJwk.d) {
    throw new Error("jwk_privada_invalida");
  }
  if (!kid) throw new Error("kid_obrigatorio");
  const header = { alg: "ES256", typ: "JWT", kid: String(kid) };
  const data = `${b64urlJson(header)}.${b64urlJson(claims)}`;
  const keyObject = crypto.createPrivateKey({ key: privateJwk, format: "jwk" });
  const sig = crypto.sign("SHA256", Buffer.from(data, "utf8"), {
    key: keyObject,
    dsaEncoding: "ieee-p1363",
  });
  return `${data}.${Buffer.from(sig).toString("base64url")}`;
}

function verificarEs256(token, publicJwk, opts) {
  const parts = String(token || "").split(".");
  if (parts.length !== 3) return { ok: false, reason: "jwt_formato" };
  let header;
  let payload;
  try {
    header = JSON.parse(Buffer.from(parts[0], "base64url").toString("utf8"));
    payload = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
  } catch {
    return { ok: false, reason: "jwt_json" };
  }
  if (header.alg !== "ES256") return { ok: false, reason: "alg" };
  if (opts && opts.kid && header.kid !== opts.kid) return { ok: false, reason: "kid" };
  const data = `${parts[0]}.${parts[1]}`;
  const sig = Buffer.from(parts[2], "base64url");
  const pub = { ...publicJwk };
  delete pub.d;
  let keyObject;
  try {
    keyObject = crypto.createPublicKey({ key: pub, format: "jwk" });
  } catch {
    return { ok: false, reason: "jwk_publica" };
  }
  const good = crypto.verify("SHA256", Buffer.from(data, "utf8"), { key: keyObject, dsaEncoding: "ieee-p1363" }, sig);
  if (!good) return { ok: false, reason: "assinatura" };
  const now = Math.floor(Date.now() / 1000);
  if (!Number.isFinite(payload.exp) || payload.exp < now) return { ok: false, reason: "expirado", payload };
  if (Number.isFinite(payload.nbf) && payload.nbf > now + 5) return { ok: false, reason: "nbf", payload };
  if (opts && opts.issuer && payload.iss !== opts.issuer) return { ok: false, reason: "issuer", payload };
  if (opts && opts.aud && payload.aud !== opts.aud) return { ok: false, reason: "audience", payload };
  if (payload.role !== "authenticated") return { ok: false, reason: "role", payload };
  if (String(payload.role || "").toLowerCase() === "service_role") {
    return { ok: false, reason: "service_role_proibido", payload };
  }
  if (payload.dk_portal !== true) return { ok: false, reason: "dk_portal", payload };
  return { ok: true, header, payload };
}

/**
 * Emite JWT só se gates de env estiverem OK (ou override de teste).
 * @param {{ gate: object, empresa?: string, filial?: string, env?: object, forcarTeste?: boolean, jwk?: object, kid?: string, ttl?: number }} opts
 */
function emitirCredencialRealtime(opts) {
  const env = (opts && opts.env) || process.env;
  const cfg = lerConfig(env);
  const forcar = Boolean(opts && opts.forcarTeste);
  const jwk = (opts && opts.jwk) || cfg.jwk;
  const kid = String((opts && opts.kid) || cfg.kid || "").trim();
  const ttl = Number((opts && opts.ttl) || cfg.ttl) || DEFAULT_TTL_SEC;

  if (!forcar) {
    const falta = requisitosAusentes({ ...cfg, jwk, kid });
    if (falta.length) {
      return {
        ok: false,
        status: 503,
        body: {
          ok: false,
          reason: "REALTIME_AUTH_BLOCKED",
          realtime: false,
          requisito_ausente: falta.join(","),
          falta,
          detalhe:
            "ES256 preparado no código, mas gates de produção não estão completos. " +
            "Standby no Supabase não basta: a chave precisa estar confiável (Current) e a feature ligada.",
          catch_up: "/api/dk-sync",
          polling_temporario: true,
          alg: "ES256",
        },
      };
    }
  }

  const gate = opts && opts.gate;
  if (!gate || !gate.ok) {
    return { ok: false, status: 401, body: { ok: false, reason: "REALTIME_AUTH_BLOCKED", hint: "unauthorized" } };
  }
  if (String(gate.typ || "") === "cliente") {
    return {
      ok: false,
      status: 403,
      body: { ok: false, reason: "REALTIME_AUTH_BLOCKED", hint: "somente_equipa" },
    };
  }
  if (!gate.sid) {
    return {
      ok: false,
      status: 401,
      body: { ok: false, reason: "REALTIME_AUTH_BLOCKED", hint: "sid_obrigatorio" },
    };
  }

  const { topicoRealtime, normalizarEmpresa, isolamentoPronto, TOPICO_GLOBAL } = require("./dk-realtime-scope.cjs");
  const empresa = normalizarEmpresa(opts.empresa || (gate && gate.empresa) || "locadora") || "locadora";
  if (!forcar) {
    const iso = isolamentoPronto(env);
    if (!iso.ok) {
      return {
        ok: false,
        status: 503,
        body: {
          ok: false,
          reason: "SCOPE_ISOLATION_BLOCKED",
          realtime: false,
          detalhe: iso.detalhe,
          catch_up: "/api/dk-sync",
        },
      };
    }
  }
  const canal = topicoRealtime(empresa, env) || TOPICO_GLOBAL;
  if (!canal) {
    return {
      ok: false,
      status: 503,
      body: { ok: false, reason: "SCOPE_ISOLATION_BLOCKED", hint: "topico_ausente" },
    };
  }

  let claims;
  try {
    claims = montarClaims(gate, {
      issuer: cfg.issuer,
      ttl,
      empresa,
      filial: opts.filial,
    });
  } catch (errClaims) {
    return {
      ok: false,
      status: 500,
      body: {
        ok: false,
        reason: "REALTIME_AUTH_BLOCKED",
        hint: String(errClaims && errClaims.message ? errClaims.message : "claims"),
      },
    };
  }
  if (String(claims.role).toLowerCase() === "service_role") {
    return {
      ok: false,
      status: 500,
      body: { ok: false, reason: "REALTIME_AUTH_BLOCKED", hint: "service_role_proibido" },
    };
  }

  let token;
  try {
    token = assinarEs256(jwk, kid, claims);
  } catch (err) {
    return {
      ok: false,
      status: 503,
      body: {
        ok: false,
        reason: "REALTIME_AUTH_BLOCKED",
        hint: "assinatura_falhou",
        detalhe: String(err && err.message ? err.message : err),
      },
    };
  }

  return {
    ok: true,
    status: 200,
    body: {
      ok: true,
      realtime: true,
      alg: "ES256",
      kid,
      expires_in: ttl,
      exp: claims.exp,
      canal,
      private: true,
      token,
      /** Revogação: Realtime só reavalia RLS no join ou no access_token; residual até exp. */
      revogacao: {
        instantanea: false,
        residual_max_sec: ttl,
        nota:
          "Logout/revogação no Portal não corta o WebSocket instantaneamente. " +
          "O cliente deve encerrar o canal e o token deixa de renovar; o servidor fecha na expiração.",
      },
    },
  };
}

/** Gera par EC P-256 fictício (só testes). */
function gerarParFicticio() {
  const { privateKey, publicKey } = crypto.generateKeyPairSync("ec", { namedCurve: "P-256" });
  const priv = privateKey.export({ format: "jwk" });
  const pub = publicKey.export({ format: "jwk" });
  const kid = crypto.randomUUID();
  priv.kid = kid;
  pub.kid = kid;
  pub.alg = "ES256";
  priv.alg = "ES256";
  return { kid, privateJwk: priv, publicJwk: pub };
}

module.exports = {
  DEFAULT_TTL_SEC,
  DEFAULT_ISS,
  lerConfig,
  emissorPronto,
  requisitosAusentes,
  subjectDeterministico,
  montarClaims,
  assinarEs256,
  verificarEs256,
  emitirCredencialRealtime,
  gerarParFicticio,
};
