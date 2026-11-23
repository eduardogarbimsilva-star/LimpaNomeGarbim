// =========================================================
// Fornecedores de consulta (E06c)
// Cada fornecedor recebe o tipo de consulta e o documento do próprio cliente
// e devolve um resultado padronizado: resumo, pendências, fonte.
// Só dados que vieram do fornecedor: nada é inventado. Dados pessoais extras
// do retorno (telefones, endereços, renda...) NÃO são guardados (LGPD).
// =========================================================

export type Pendencia = { orgao: string; credor: string; valor: string; data: string };
export type Resultado = { resumo: string; pendencias: Pendencia[]; fonte: string };

const so = (v: unknown) => String(v ?? "").replace(/\D/g, "");
const txt = (v: unknown) => String(v ?? "").trim();
const lista = (v: unknown): any[] => (Array.isArray(v) ? v : []);

/** "1.234,56" | "1234.56" | 1234.56 -> 1234.56 */
export function numero(v: unknown): number {
  if (typeof v === "number") return v;
  let s = txt(v).replace(/[^\d,.-]/g, "");
  if (!s) return 0;
  if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}
export const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const valorTxt = (v: unknown) => (txt(v) === "" ? "" : brl(numero(v)));

// ---------------- Direct Data (https://apiv3.directd.com.br/api/<Api>?CPF=&CNPJ=&TOKEN=) ----------------
/** Quais APIs usar para cada tipo de consulta (pode ser trocado por produto em "código no fornecedor") */
export function apisDirectD(tipo: string, pj: boolean, codigo?: string | null): string[] {
  const c = txt(codigo);
  if (c) return c.split(",").map((x) => x.trim()).filter((x) => /^[A-Za-z0-9]+$/.test(x));
  const restricoes = pj ? "DossieCreditoCompleto" : "BoaVistaAcertaCompletoPositivoPF";
  switch (tipo) {
    case "restricoes": return [restricoes];
    case "protestos": return ["ProtestosCompleta"];
    case "score": return ["Score"];
    case "completa": return [restricoes, "ProtestosCompleta", "Score"];
    default: return [];
  }
}

export const NOMES_FONTE: Record<string, string> = {
  BoaVistaAcertaCompletoPositivoPF: "Boa Vista",
  DossieCreditoCompleto: "QUOD",
  ProtestosCompleta: "Protestos IEPTB (Cenprot)",
  ProtestosBasica: "Protestos IEPTB (Cenprot)",
  Score: "Score QUOD",
};

type Parcial = { pendencias: Pendencia[]; score?: string; observacoes: string[] };

/** Traduz o "retorno" de cada API para pendências padronizadas */
export function normalizarDirectD(api: string, retorno: any): Parcial {
  const r = retorno ?? {};
  const out: Parcial = { pendencias: [], observacoes: [] };
  if (api === "BoaVistaAcertaCompletoPositivoPF") {
    for (const o of lista(r?.pendenciasFinanceiras?.ocorrencias)) {
      out.pendencias.push({ orgao: "Boa Vista" + (txt(o.informante) ? ` · ${txt(o.informante)}` : ""), credor: txt(o.credor) || txt(o.informante), valor: valorTxt(o.valor), data: txt(o.dataInclusao) || txt(o.dataVencimento) });
    }
    for (const o of lista(r?.protestos?.ocorrencias)) {
      out.pendencias.push({ orgao: "Protesto" + (txt(o.cartorio) ? ` · ${txt(o.cartorio)}` : ""), credor: txt(o.credor), valor: valorTxt(o.valor), data: txt(o.data) });
    }
    const chq = numero(r?.chequeSemFundoVarejo?.quantidadeOcorrencia) + numero(r?.chequeSemFundoBacen?.quantidadeOcorrencia);
    if (chq > 0) out.observacoes.push(`${chq} registro(s) de cheque sem fundo.`);
    const sc = lista(r?.scores?.ocorrencias)[0];
    if (sc && txt(sc.score)) out.score = txt(sc.score) + (txt(sc.descricaoScore) ? ` (${txt(sc.descricaoScore)})` : "");
  } else if (api === "DossieCreditoCompleto") {
    const ent = r?.entidadeFisica ?? r?.entidadeJuridica ?? {};
    const pf = ent?.pendenciaFinanceira ?? {};
    for (const n of lista(pf.negativacoes)) {
      out.pendencias.push({ orgao: "Negativação" + (txt(n.motivo) ? ` · ${txt(n.motivo)}` : ""), credor: txt(n.nomeEmpresa), valor: valorTxt(n.valor), data: txt(n.dataInclusao) || txt(n.dataOcorrencia) });
    }
    for (const p of lista(pf.protestos)) {
      for (const c of lista(p.cartorios)) {
        out.pendencias.push({ orgao: "Protesto · " + [txt(c.nome), txt(c.cidade)].filter(Boolean).join(" · "), credor: "", valor: valorTxt(c.valorProtestado), data: "" });
      }
    }
    const chq = lista(pf.chequesSemFundo).reduce((t, c) => t + numero(c.quantidadeOcorrencia), 0);
    if (chq > 0) out.observacoes.push(`${chq} registro(s) de cheque sem fundo.`);
    const acoes = lista(pf.acoesJudiciais).length;
    if (acoes > 0) out.observacoes.push(`${acoes} ação(ões) judicial(is) encontrada(s).`);
    const s = ent?.scoreEntidade ?? ent?.scoreEntidades ?? {};
    const sv = s?.entidadeFisica?.score ?? s?.entidadeJuridica?.score;
    if (txt(sv)) out.score = txt(sv);
  } else if (api === "ProtestosCompleta") {
    for (const d of lista(r.documentos)) {
      for (const c of lista(d.cartorios)) {
        const onde = "Protesto · " + [txt(c.nomeCartorio), [txt(c.cidade), txt(c.estado)].filter(Boolean).join("/")].filter(Boolean).join(" · ");
        const titulos = lista(c.titulos);
        if (!titulos.length) out.pendencias.push({ orgao: onde, credor: "", valor: valorTxt(c.valorTotalProtestosCartorio), data: "" });
        for (const t of titulos) out.pendencias.push({ orgao: onde, credor: "", valor: valorTxt(t.valorProtestado), data: txt(t.dataProtesto) });
      }
    }
    if (!out.pendencias.length && r.constamProtestos === true) out.observacoes.push(`Constam ${txt(r.numeroTotalProtestos) || "alguns"} protesto(s), sem detalhes no retorno.`);
  } else if (api === "ProtestosBasica") {
    for (const t of lista(r.titulos)) out.pendencias.push({ orgao: "Protesto (IEPTB)", credor: "", valor: valorTxt(t.valorProtestado), data: "" });
  } else if (api === "Score") {
    const s = r?.pessoaFisica ?? r?.pessoaJuridica ?? {};
    if (txt(s.score)) out.score = txt(s.score) + (txt(s.faixaScore) ? ` (${txt(s.faixaScore)})` : "");
  }
  return out;
}

/** Junta os resultados parciais num resumo para o cliente */
export function montarResultado(apis: string[], parciais: Parcial[]): Resultado {
  const pendencias = parciais.flatMap((p) => p.pendencias).slice(0, 100);
  const total = pendencias.reduce((t, p) => t + numero(p.valor), 0);
  const score = parciais.map((p) => p.score).find(Boolean);
  const obs = parciais.flatMap((p) => p.observacoes);
  const partes: string[] = [];
  const temPendencia = apis.some((a) => a !== "Score");
  if (temPendencia) partes.push(pendencias.length ? `Encontramos ${pendencias.length} pendência(s)${total > 0 ? `, somando ${brl(total)}` : ""}.` : "Nenhuma pendência encontrada nas fontes consultadas.");
  if (score) partes.push(`Score: ${score}.`);
  else if (apis.includes("Score")) partes.push("Score não informado pela fonte.");
  partes.push(...obs);
  const fontes = [...new Set(apis.map((a) => NOMES_FONTE[a] ?? a))].join(", ");
  return { resumo: partes.join(" "), pendencias, fonte: `Direct Data — ${fontes}` };
}

export class ErroFornecedor extends Error {}

/** Chama a Direct Data para cada API e devolve o resultado padronizado */
export async function consultarDirectD(token: string, tipo: string, documento: string, pj: boolean, codigo?: string | null, buscar: typeof fetch = fetch): Promise<Resultado> {
  const apis = apisDirectD(tipo, pj, codigo);
  if (!apis.length) throw new ErroFornecedor("Este tipo de consulta não é feito pela Direct Data (fica manual).");
  const doc = so(documento);
  if (!(doc.length === 11 || doc.length === 14)) throw new ErroFornecedor("Documento do cliente inválido.");
  const parciais: Parcial[] = [];
  for (const api of apis) {
    const url = `https://apiv3.directd.com.br/api/${api}?${pj ? "CNPJ" : "CPF"}=${doc}&TOKEN=${encodeURIComponent(token)}`;
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 45000);
    let resp: Response;
    try { resp = await buscar(url, { signal: ctrl.signal, headers: { Accept: "application/json" } }); }
    catch (_) { throw new ErroFornecedor(`Sem resposta da Direct Data (${api}).`); }
    finally { clearTimeout(t); }
    const corpo = await resp.text();
    let json: any = null;
    try { json = JSON.parse(corpo); } catch (_) { /* não é JSON */ }
    if (!resp.ok || !json) throw new ErroFornecedor(`Direct Data ${api}: HTTP ${resp.status}${json?.metaDados?.mensagem ? " — " + json.metaDados.mensagem : ""}`);
    const meta = json.metaDados ?? {};
    const retorno = json.retorno;
    if (retorno == null) throw new ErroFornecedor(`Direct Data ${api}: ${txt(meta.mensagem) || "sem dados no retorno"}`);
    parciais.push(normalizarDirectD(api, retorno));
  }
  return montarResultado(apis, parciais);
}
