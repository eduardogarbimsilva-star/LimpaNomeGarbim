#!/usr/bin/env node
/*
 * Pré-renderização para o Google (E02)
 * ------------------------------------
 * O catálogo de serviços vem do banco e é desenhado por JavaScript. Para o Google
 * (e para quem abre a página com internet lenta) ler os serviços já no HTML inicial,
 * este script abre o site num navegador, copia o catálogo desenhado e grava dentro
 * dos marcadores <!-- pre-render:NOME --> ... <!-- /pre-render:NOME --> dos arquivos.
 * Quando a página carrega, o JavaScript redesenha por cima com os dados atuais,
 * então nada muda para o visitante.
 *
 * Quando rodar: depois de mudar serviços/categorias no painel (o site continua certo
 * mesmo sem rodar; só o HTML inicial lido pelo Google fica desatualizado).
 *
 * Uso:  servidor local com URLs limpas na porta 8765, depois
 *       node ferramentas/pre-renderizar.js [http://localhost:8765/]
 * Requer: playwright (npm i -D playwright, ou o que já existir na máquina).
 */
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");

const BASE = process.argv[2] || "http://localhost:8765/";
const SITE = "https://milenagarbim.com.br";
const RAIZ = path.resolve(__dirname, "..");

function trocar(html, nome, conteudo) {
  const re = new RegExp(`(<!-- pre-render:${nome} -->)[\\s\\S]*?(<!-- /pre-render:${nome} -->)`);
  if (!re.test(html)) throw new Error("marcador pre-render:" + nome + " não encontrado");
  return html.replace(re, `$1${conteudo}$2`);
}

(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } });
  const p = await ctx.newPage();
  // visitante novo: sem abertura animada, sem triagem, sem filtros guardados
  await p.addInitScript(() => { try { sessionStorage.setItem("mg_abertura", "1"); localStorage.setItem("mg_triagem", '{"visto":true}'); } catch (e) { /* ok */ } });

  // ---------- Serviços ----------
  await p.goto(BASE + "servicos");
  await p.waitForFunction(() => document.querySelectorAll("[data-catalogo] .servico-card").length > 0, null, { timeout: 20000 });
  if (!(await p.evaluate(() => window.Dados && window.Dados.online))) throw new Error("o site não está lendo o banco real (modo demonstração)");
  const cat = await p.evaluate(() => {
    const limpar = (el) => { const c = el.cloneNode(true); c.querySelectorAll(".revelar").forEach((x) => x.classList.remove("revelar", "visivel")); return c.innerHTML.replace(/\s+\n/g, "\n").trim(); };
    const servicos = [...document.querySelectorAll("[data-catalogo] .catalogo-cat")].flatMap((sec) => {
      const categoria = sec.querySelector("h2")?.textContent.trim() || "";
      return [...sec.querySelectorAll(".servico-card")].map((card) => ({
        id: card.dataset.servico, categoria,
        nome: card.querySelector("h3")?.textContent.trim() || "",
        resumo: card.querySelector(".servico-corpo > p")?.textContent.trim() || ""
      }));
    });
    return { catalogo: limpar(document.querySelector("[data-catalogo]")), filtro: limpar(document.querySelector("[data-filtro]")), servicos };
  });
  const ld = {
    "@context": "https://schema.org", "@type": "ItemList", name: "Serviços — Milena Garbim · Limpa Nome",
    itemListElement: cat.servicos.map((s, i) => ({
      "@type": "ListItem", position: i + 1,
      item: { "@type": "Service", name: s.nome, description: s.resumo || undefined, category: s.categoria || undefined, url: `${SITE}/servicos#cat-${s.id}`, areaServed: "BR",
        provider: { "@type": "ProfessionalService", name: "Milena Garbim · Limpa Nome", url: SITE + "/" } }
    }))
  };
  let html = fs.readFileSync(path.join(RAIZ, "servicos.html"), "utf8");
  html = trocar(html, "catalogo", "\n" + cat.catalogo + "\n");
  html = trocar(html, "filtro", cat.filtro);
  html = trocar(html, "servicos-ld", `\n  <script type="application/ld+json">\n  ${JSON.stringify(ld)}\n  </script>\n  `);
  fs.writeFileSync(path.join(RAIZ, "servicos.html"), html);
  console.log("servicos.html:", cat.servicos.length, "serviços pré-renderizados");

  // ---------- Página inicial: frentes de atuação ----------
  await p.goto(BASE);
  await p.waitForFunction(() => document.querySelectorAll("[data-frentes] .frente").length > 0, null, { timeout: 20000 });
  const frentes = await p.evaluate(() => {
    const c = document.querySelector("[data-frentes]").cloneNode(true);
    c.querySelectorAll(".revelar").forEach((x) => x.classList.remove("revelar", "visivel"));
    return { html: c.innerHTML.trim(), n: c.querySelectorAll(".frente").length };
  });
  let ini = fs.readFileSync(path.join(RAIZ, "index.html"), "utf8");
  ini = trocar(ini, "frentes", "\n" + frentes.html + "\n");
  fs.writeFileSync(path.join(RAIZ, "index.html"), ini);
  console.log("index.html:", frentes.n, "frentes pré-renderizadas");
  await b.close();
})().catch((e) => { console.error("ERRO:", e.message); process.exit(1); });
