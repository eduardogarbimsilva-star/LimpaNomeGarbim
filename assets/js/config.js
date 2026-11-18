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
    url: "https://bdsqusebturohiwiaczg.supabase.co",
    // chave pública (anon): pode ficar no site. NUNCA coloque aqui a chave secreta (service_role).
    anonKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJkc3F1c2VidHVyb2hpd2lhY3pnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTQ1MDkwOTMsImV4cCI6MjExMDA4NTA5M30.tyPQ_aB9rAoAMn5AiUA7XiIabNNyHM2U1FCPWS7o4x4"
  },
  // Assistente virtual com IA. Vazio = usa a função "assistente" do próprio Supabase (supabase/functions/assistente).
  // Sem Supabase, a assistente funciona em "modo básico" (responde com as dúvidas e serviços do site).
  // usarIA: false = assistente própria (sem custo). Para usar IA paga no futuro: true + ANTHROPIC_API_KEY no Supabase.
  assistente: { endpoint: "", usarIA: false },
  // Notificações no celular/computador da equipe (Web Push). Chave PÚBLICA — a privada fica só no Supabase.
  pushChavePublica: "BME82ZVrhyiLT3_MaCwmXiVjRDg1Ua4Ze6a7bLu3wSB-rIDI9wgaYfOqjWxvtslYCnQzI6zOPIQY5AZxP9SAx2I",
  // Quantos dígitos tem o código do e-mail (Supabase: Authentication → Email → "Email OTP Length").
  tamanhoCodigo: 8
};
