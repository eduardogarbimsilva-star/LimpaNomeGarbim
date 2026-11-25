/* SPRUCE UP Digital Engineering — liga a assinatura e o selo de equipe técnica ao site da SPRUCE UP.
   Quando o site da SPRUCE UP estiver no ar, coloque o endereço abaixo (ex.: "https://spruceup.com.br").
   Vazio: a assinatura aparece, mas sem link, e o botão "Conheça a SPRUCE UP" fica escondido. */
(function () {
  var SPRUCE_URL = "https://spruce-up-gamma.vercel.app/";
  if (!SPRUCE_URL) return;
  document.querySelectorAll("[data-spruce-link]").forEach(function (a) {
    a.href = SPRUCE_URL;
    a.target = "_blank";
    a.rel = "noopener";
    a.hidden = false;
  });
})();
