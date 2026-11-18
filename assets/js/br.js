/* =========================================================
   Utilidades brasileiras: máscaras, validação de CPF/CNPJ,
   busca de endereço pelo CEP (ViaCEP) e de empresa pelo CNPJ (BrasilAPI)
   ========================================================= */
(function () {
  "use strict";
  const so = (v) => String(v || "").replace(/\D/g, "");

  const mascaras = {
    cpf: (v) => so(v).slice(0, 11).replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d{1,2})$/, "$1-$2"),
    cnpj: (v) => so(v).slice(0, 14).replace(/^(\d{2})(\d)/, "$1.$2").replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
      .replace(/\.(\d{3})(\d)/, ".$1/$2").replace(/(\d{4})(\d)/, "$1-$2"),
    cep: (v) => so(v).slice(0, 8).replace(/(\d{5})(\d)/, "$1-$2"),
    telefone: (v) => {
      const d = so(v).slice(0, 11);
      if (d.length <= 10) return d.replace(/(\d{2})(\d)/, "($1) $2").replace(/(\d{4})(\d)/, "$1-$2");
      return d.replace(/(\d{2})(\d)/, "($1) $2").replace(/(\d{5})(\d)/, "$1-$2");
    }
  };

  function cpfValido(v) {
    const c = so(v);
    if (c.length !== 11 || /^(\d)\1+$/.test(c)) return false;
    for (let t = 9; t < 11; t++) {
      let soma = 0;
      for (let i = 0; i < t; i++) soma += +c[i] * (t + 1 - i);
      if (((soma * 10) % 11) % 10 !== +c[t]) return false;
    }
    return true;
  }

  function cnpjValido(v) {
    const c = so(v);
    if (c.length !== 14 || /^(\d)\1+$/.test(c)) return false;
    const calc = (n) => {
      let soma = 0, peso = n - 7;
      for (let i = 0; i < n; i++) { soma += +c[i] * peso--; if (peso < 2) peso = 9; }
      const r = soma % 11;
      return r < 2 ? 0 : 11 - r;
    };
    return calc(12) === +c[12] && calc(13) === +c[13];
  }

  async function buscarCep(cep) {
    const c = so(cep);
    if (c.length !== 8) throw new Error("CEP deve ter 8 dígitos.");
    const r = await fetch("https://viacep.com.br/ws/" + c + "/json/");
    if (!r.ok) throw new Error("Não foi possível consultar o CEP agora.");
    const d = await r.json();
    if (d.erro) throw new Error("CEP não encontrado.");
    return { logradouro: d.logradouro, bairro: d.bairro, cidade: d.localidade, uf: d.uf, complemento: d.complemento };
  }

  async function buscarCnpj(cnpj) {
    const c = so(cnpj);
    if (!cnpjValido(c)) throw new Error("CNPJ inválido.");
    const r = await fetch("https://brasilapi.com.br/api/cnpj/v1/" + c);
    if (r.status === 404) throw new Error("CNPJ não encontrado na Receita.");
    if (!r.ok) throw new Error("Não foi possível consultar o CNPJ agora. Preencha manualmente.");
    const d = await r.json();
    return {
      razao_social: d.razao_social, nome_fantasia: d.nome_fantasia, cep: d.cep, logradouro: d.logradouro,
      numero: d.numero, complemento: d.complemento, bairro: d.bairro, cidade: d.municipio, uf: d.uf,
      telefone: d.ddd_telefone_1, situacao: d.descricao_situacao_cadastral
    };
  }

  /* ---------- Outras validações do cadastro ---------- */
  const DDDS = ("11 12 13 14 15 16 17 18 19 21 22 24 27 28 31 32 33 34 35 37 38 41 42 43 44 45 46 47 48 49 51 53 54 55 " +
    "61 62 63 64 65 66 67 68 69 71 73 74 75 77 79 81 82 83 84 85 86 87 88 89 91 92 93 94 95 96 97 98 99").split(" ");
  function telefoneValido(v) {
    const d = so(v);
    if (d.length !== 10 && d.length !== 11) return false;
    if (!DDDS.includes(d.slice(0, 2)) || /^(\d)\1+$/.test(d.slice(2))) return false;
    return d.length === 10 ? /^[2-5]/.test(d[2]) : d[2] === "9";   // fixo começa com 2 a 5; celular com 9
  }
  const cepValido = (v) => /^\d{8}$/.test(so(v)) && !/^(\d)\1+$/.test(so(v));
  /** Nome de pessoa: só letras, com nome e sobrenome */
  function nomeValido(v) {
    const t = limpar(v);
    if (t.length < 5 || t.length > 100 || !/^[A-Za-zÀ-ÖØ-öø-ÿ' .-]+$/.test(t)) return false;
    return t.split(" ").filter((p) => p.replace(/[^A-Za-zÀ-ÿ]/g, "").length >= 2).length >= 2;
  }
  /** Inscrição estadual: em branco, ISENTO ou só números (2 a 14) */
  const ieValida = (v) => { const t = limpar(v).toUpperCase(); return !t || t === "ISENTO" || /^\d{2,14}$/.test(so(t)) && !/[A-Z]/.test(t); };
  /** Tira espaços repetidos e caracteres invisíveis; corta no tamanho máximo */
  function limpar(v, max) {
    const t = String(v == null ? "" : v).replace(/[\u0000-\u001f\u007f\u200b-\u200f\ufeff]/g, "").replace(/\s+/g, " ").trim();
    return max ? t.slice(0, max) : t;
  }
  /** E-mails com domínio digitado errado (gmial.com, hotmail.con...) → sugestão correta */
  const DOMINIOS = { "gmail.com": ["gmial.com", "gmai.com", "gmal.com", "gamil.com", "gmail.co", "gmail.con", "gmail.cm", "gmail.om", "gmaill.com", "gnail.com", "gmail.com.br", "gmsil.com"],
    "hotmail.com": ["hotmial.com", "hotmai.com", "hotmal.com", "hotmail.con", "hotmail.co", "homail.com", "hotnail.com", "hotmaill.com"],
    "outlook.com": ["outlok.com", "outloo.com", "outlook.con", "outlook.co", "otlook.com"],
    "yahoo.com.br": ["yaho.com.br", "yahoo.com.b", "yahoo.combr"], "icloud.com": ["iclod.com", "icloud.con", "icoud.com"] };
  function sugerirEmail(email) {
    const [u, dom] = String(email || "").toLowerCase().split("@");
    if (!u || !dom) return null;
    for (const [certo, erros] of Object.entries(DOMINIOS)) if (erros.includes(dom)) return u + "@" + certo;
    return null;
  }

  window.BR = { so, mascaras, cpfValido, cnpjValido, telefoneValido, cepValido, nomeValido, ieValida, limpar, sugerirEmail, UFS: "AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO".split(" "), buscarCep, buscarCnpj };
})();
