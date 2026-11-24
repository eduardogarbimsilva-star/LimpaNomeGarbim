// =========================================================
// Pagamentos (E08) — Asaas: cobrança PIX automática + confirmação por webhook
//  - "configurar" (admin com 2FA): valida a chave do Asaas e cria o webhook sozinho
//  - "cobrar" (cliente logado): cria a cobrança PIX da consulta e devolve o copia e cola
//  - webhook do Asaas (cabeçalho asaas-access-token): pagamento recebido -> consulta paga
// A chave do Asaas nunca sai do servidor.
// =========================================================
const SB_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SB_CHAVE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const SB_ANON = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const ORIGENS = ["https://milenagarbim.com.br", "https://www.milenagarbim.com.br", "http://localhost:8765"];

function cors(req: Request): Record<string, string> {
  const o = req.headers.get("origin") ?? "";
  return {
    "Access-Control-Allow-Origin": ORIGENS.includes(o) ? o : ORIGENS[0],
    "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}
const responder = (req: Request, corpo: unknown, status = 200) =>
  new Response(JSON.stringify(corpo), { status, headers: { "Content-Type": "application/json", ...cors(req) } });

class Erro extends Error { constructor(msg: string, public status = 400) { super(msg); } }

// ---------- Banco (service_role) ----------
async function db(caminho: string, init: RequestInit = {}): Promise<any> {
  const r = await fetch(`${SB_URL}/rest/v1/${caminho}`, {
    ...init,
    headers: { apikey: SB_CHAVE, Authorization: `Bearer ${SB_CHAVE}`, "Content-Type": "application/json", Prefer: "return=representation", ...(init.headers ?? {}) },
  });
  if (!r.ok) throw new Error(`db ${caminho}: ${r.status} ${await r.text()}`);
  const t = await r.text();
  return t ? JSON.parse(t) : null;
}
const rpc = (nome: string, args: unknown = {}) => db(`rpc/${nome}`, { method: "POST", body: JSON.stringify(args) });

// ---------- Quem está chamando (token do Supabase Auth) ----------
async function usuario(req: Request): Promise<{ id: string; email: string; jwt: string }> {
  const jwt = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!jwt) throw new Erro("Entre na sua conta para continuar.", 401);
  const r = await fetch(`${SB_URL}/auth/v1/user`, { headers: { apikey: SB_ANON, Authorization: `Bearer ${jwt}` } });
  if (!r.ok) throw new Erro("Sua sessão expirou. Entre de novo.", 401);
  const u = await r.json();
  return { id: u.id, email: u.email ?? "", jwt };
}
async function ehAdmin(jwt: string): Promise<boolean> {
  const r = await fetch(`${SB_URL}/rest/v1/rpc/eh_admin`, { method: "POST", headers: { apikey: SB_ANON, Authorization: `Bearer ${jwt}`, "Content-Type": "application/json" }, body: "{}" });
  return r.ok && (await r.json()) === true;
}

// ---------- Asaas ----------
const baseAsaas = (amb: string) => (amb === "producao" ? "https://api.asaas.com/v3" : "https://api-sandbox.asaas.com/v3");
async function asaas(amb: string, chave: string, caminho: string, init: RequestInit = {}): Promise<any> {
  let r: Response;
  try {
    r = await fetch(baseAsaas(amb) + caminho, {
      ...init,
      headers: { access_token: chave, "Content-Type": "application/json", "User-Agent": "MilenaGarbimSite/1.0", ...(init.headers ?? {}) },
      signal: AbortSignal.timeout(30000),
    });
  } catch (_) { throw new Erro("O Asaas não respondeu. Tente de novo em instantes.", 502); }
  const t = await r.text();
  let j: any = null;
  try { j = t ? JSON.parse(t) : null; } catch (_) { /* não é JSON */ }
  if (!r.ok) {
    const desc = j?.errors?.[0]?.description || j?.errors?.[0]?.code || `HTTP ${r.status}`;
    throw new Erro(`Asaas: ${desc}`, r.status === 401 ? 400 : 502);
  }
  return j;
}
const so = (v: unknown) => String(v ?? "").replace(/\D/g, "");
const amanha = () => { const d = new Date(Date.now() + 36 * 3600 * 1000); return d.toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" }); };
function tokenAleatorio(): string {
  const b = new Uint8Array(32); crypto.getRandomValues(b);
  return "mg" + Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
}
function iguais(a: string, b: string): boolean {
  if (!a || !b || a.length !== b.length) return false;
  let d = 0; for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

// ---------- Ações ----------
async function configurar(req: Request, corpo: any) {
  const u = await usuario(req);
  if (!(await ehAdmin(u.jwt))) throw new Erro("Só o administrador (com a dupla verificação) configura o pagamento.", 403);
  const amb = corpo.ambiente === "producao" ? "producao" : "sandbox";
  const cfg = (await rpc("config_gateway")) ?? {};
  const chave = String(corpo.chave ?? "").trim() || cfg.asaas_chave || "";
  if (!chave) throw new Erro("Cole a chave de API do Asaas.");
  if (amb === "producao" && chave.startsWith("$aact_hmlg_")) throw new Erro("Esta é uma chave de TESTE (sandbox). Escolha o ambiente de teste ou cole a chave de produção.");
  if (amb === "sandbox" && chave.startsWith("$aact_prod_")) throw new Erro("Esta é uma chave de PRODUÇÃO. Escolha o ambiente de produção ou cole a chave de teste.");
  await asaas(amb, chave, "/customers?limit=1");   // valida a chave
  const site = ((await db("configuracoes?id=eq.1&select=dados")) ?? [])[0]?.dados ?? {};
  const email = String(site?.contatos?.email || u.email || "").trim();
  const token = tokenAleatorio();
  await asaas(amb, chave, "/webhooks", { method: "POST", body: JSON.stringify({
    name: "Site Milena Garbim — consultas", url: `${SB_URL}/functions/v1/pagamentos`, email, enabled: true, interrupted: false,
    apiVersion: 3, sendType: "SEQUENTIALLY", authToken: token, events: ["PAYMENT_RECEIVED", "PAYMENT_CONFIRMED", "PAYMENT_REFUNDED"],
  }) });
  await rpc("salvar_gateway", { p_gateway: "asaas", p_ambiente: amb, p_chave: chave, p_token: token, p_quem: u.email });
  return { ok: true, ambiente: amb };
}

async function cobrar(req: Request, corpo: any) {
  const u = await usuario(req);
  const id = String(corpo.consulta_id ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw new Erro("Consulta inválida.");
  const cfg = (await rpc("config_gateway")) ?? {};
  if (cfg.gateway !== "asaas" || !cfg.asaas_chave) throw new Erro("Pagamento automático desligado.", 409);
  const amb = cfg.asaas_ambiente, chave = cfg.asaas_chave;
  const c = ((await db(`consultas?id=eq.${id}&cliente_id=eq.${u.id}&select=id,numero,valor,status,gateway_id,pix_copia,pix_expira`)) ?? [])[0];
  if (!c) throw new Erro("Consulta não encontrada.", 404);
  if (c.status !== "aguardando_pagamento") throw new Erro("Esta consulta não está aguardando pagamento.", 409);
  let pagamentoId = c.gateway_id;
  if (!pagamentoId) {
    const cli = ((await db(`clientes?id=eq.${u.id}&select=tipo,nome,razao_social,cpf,cnpj,telefone`)) ?? [])[0] ?? {};
    const doc = so(cli.tipo === "pj" ? cli.cnpj : cli.cpf);
    if (!doc) throw new Erro("Complete seu cadastro (CPF ou CNPJ) antes de pagar.");
    const achou = await asaas(amb, chave, `/customers?externalReference=${encodeURIComponent(u.id)}&limit=1`);
    let clienteAsaas = achou?.data?.[0]?.id;
    if (!clienteAsaas) {
      const novo = await asaas(amb, chave, "/customers", { method: "POST", body: JSON.stringify({
        name: (cli.tipo === "pj" ? cli.razao_social : cli.nome) || "Cliente", cpfCnpj: doc, email: u.email || undefined,
        mobilePhone: so(cli.telefone) || undefined, externalReference: u.id, notificationDisabled: true,
      }) });
      clienteAsaas = novo.id;
    }
    const pg = await asaas(amb, chave, "/payments", { method: "POST", body: JSON.stringify({
      customer: clienteAsaas, billingType: "PIX", value: Number(c.valor), dueDate: amanha(),
      description: `Consulta ${c.numero} — Milena Garbim · Limpa Nome`, externalReference: c.id,
    }) });
    pagamentoId = pg.id;
    await db(`consultas?id=eq.${c.id}&gateway_id=is.null`, { method: "PATCH", body: JSON.stringify({ gateway_id: pagamentoId, pagamento_ref: pagamentoId, pagamento_meio: "pix-asaas" }) });
  }
  const qr = await asaas(amb, chave, `/payments/${pagamentoId}/pixQrCode`);
  const expira = qr?.expirationDate ? new Date(String(qr.expirationDate).replace(" ", "T") + "-03:00").toISOString() : null;
  await db(`consultas?id=eq.${c.id}`, { method: "PATCH", body: JSON.stringify({ pix_copia: qr.payload, pix_expira: expira }) });
  return { payload: qr.payload, expira, valor: c.valor, numero: c.numero };
}

async function webhook(req: Request, tokenRecebido: string) {
  const cfg = (await rpc("config_gateway")) ?? {};
  if (!iguais(tokenRecebido, String(cfg.asaas_webhook_token ?? ""))) return new Response("não autorizado", { status: 401 });
  let ev: any = {};
  try { ev = await req.json(); } catch (_) { return new Response("ok"); }
  const p = ev?.payment ?? {};
  const consulta = String(p.externalReference ?? "");
  try {
    if ((ev.event === "PAYMENT_RECEIVED" || ev.event === "PAYMENT_CONFIRMED") && /^[0-9a-f-]{36}$/i.test(consulta)) {
      const r = await rpc("pagamento_gateway_confirmado", { p_id: consulta, p_gateway_id: String(p.id ?? ""), p_valor: Number(p.value) });
      console.log("asaas", ev.event, p.id, r);
    } else if (ev.event === "PAYMENT_REFUNDED" && p.id) {
      await rpc("pagamento_gateway_estornado", { p_gateway_id: String(p.id) });
    }
  } catch (e: any) {
    console.error("webhook asaas:", e?.message ?? e);
    return new Response("erro", { status: 500 });   // o Asaas tenta de novo
  }
  return new Response("ok");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(req) });
  if (req.method !== "POST") return new Response("método não permitido", { status: 405 });
  const tokenAsaas = req.headers.get("asaas-access-token");
  if (tokenAsaas !== null) return webhook(req, tokenAsaas);
  try {
    const corpo = await req.json().catch(() => ({}));
    if (corpo.acao === "configurar") return responder(req, await configurar(req, corpo));
    if (corpo.acao === "cobrar") return responder(req, await cobrar(req, corpo));
    return responder(req, { erro: "Ação inválida." }, 400);
  } catch (e: any) {
    if (e instanceof Erro) return responder(req, { erro: e.message }, e.status);
    console.error("pagamentos:", e?.message ?? e);
    return responder(req, { erro: "Erro inesperado. Tente de novo." }, 500);
  }
});
