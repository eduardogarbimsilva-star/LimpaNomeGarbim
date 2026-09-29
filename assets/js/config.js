/*
 * CONFIGURAÇÃO GERAL DO SITE
 *
 * Contatos, textos, fotos, serviços e dúvidas são editados pelo PAINEL (admin.html).
 * O que estiver aqui vale só enquanto o painel não tiver outro valor salvo.
 *
 * WhatsApp: formato internacional, só dígitos -> 55 (Brasil) + DDD + número. Ex.: "5516999999999"
 */
window.SITE_CONFIG = {
  empresa: "Milena Garbim",
  descricao: "Assessoria de crédito e recuperação do nome",
  proprietaria: "Milena Garbim",
  whatsapp: "5516988381117",
  telefone: "(16) 98838-1117",
  email: "millenagarbim@gmail.com",
  cnpj: "",
  endereco: "Atendimento online para todo o Brasil",
  horario: "Seg a Sex, 9h às 18h · Sáb, 9h às 12h",
  redes: { instagram: "", facebook: "", tiktok: "", youtube: "" },

  // Banco de dados e login com código por e-mail (Supabase). Enquanto estiver vazio, o site roda em
  // "modo demonstração": o código aparece na tela e tudo fica salvo só no navegador. Veja o README.
  supabase: {
    url: "",       // ex.: "https://SEU-PROJETO.supabase.co"
    anonKey: ""    // chave pública (anon / publishable). NUNCA coloque aqui a chave secreta (service_role).
  },
  // Quantos dígitos tem o código do e-mail (Supabase: Authentication → Email → "Email OTP Length").
  tamanhoCodigo: 8
};
