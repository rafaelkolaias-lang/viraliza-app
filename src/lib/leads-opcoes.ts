/** Nichos do garimpo, agrupados por setor (espelha o scraper MapsLeads). */
export const SETORES: { setor: string; nichos: string[] }[] = [
  {
    setor: "Hospitalidade e turismo",
    nichos: [
      "hotel", "pousada", "hostel", "motel", "resort", "hotel fazenda",
      "agência de viagens", "camping",
    ],
  },
  {
    setor: "Alimentação",
    nichos: [
      "restaurante", "lanchonete", "pizzaria", "hamburgueria", "padaria",
      "confeitaria", "cafeteria", "sorveteria", "açaí", "churrascaria",
      "marmitaria", "pastelaria", "doceria", "food truck", "self service",
    ],
  },
  {
    setor: "Bares e lazer",
    nichos: [
      "bar", "pub", "choperia", "boate", "casa de shows", "clube", "balada",
      "salão de festas", "buffet infantil", "cinema", "boliche", "karaokê",
    ],
  },
  {
    setor: "Beleza e estética",
    nichos: [
      "salão de beleza", "barbearia", "manicure", "clínica de estética",
      "spa", "depilação", "studio de sobrancelha", "estúdio de tatuagem",
    ],
  },
  {
    setor: "Saúde",
    nichos: [
      "clínica médica", "clínica odontológica", "consultório", "fisioterapia",
      "psicólogo", "nutricionista", "laboratório de análises", "farmácia",
      "ótica", "clínica veterinária",
    ],
  },
  {
    setor: "Esporte e fitness",
    nichos: [
      "academia", "crossfit", "estúdio de pilates", "escola de natação",
      "artes marciais", "quadra society", "loja de suplementos",
    ],
  },
  {
    setor: "Educação",
    nichos: [
      "escola", "creche", "curso de idiomas", "autoescola", "escola de música",
      "reforço escolar", "curso profissionalizante",
    ],
  },
  {
    setor: "Automotivo",
    nichos: [
      "oficina mecânica", "borracharia", "auto elétrica", "funilaria",
      "lava rápido", "concessionária", "loja de autopeças",
      "locadora de veículos", "moto peças",
    ],
  },
  {
    setor: "Pet",
    nichos: ["pet shop", "banho e tosa", "adestramento", "clínica veterinária"],
  },
  {
    setor: "Comércio e varejo",
    nichos: [
      "papelaria", "loja de roupas", "loja de calçados", "joalheria",
      "loja de presentes", "floricultura", "loja de móveis",
      "loja de eletrônicos", "loja de informática", "loja de celular",
      "loja de brinquedos", "perfumaria", "tabacaria", "loja de bebidas",
      "mercearia", "supermercado", "hortifruti", "açougue", "loja de cosméticos",
    ],
  },
  {
    setor: "Serviços",
    nichos: [
      "gráfica rápida", "lavanderia", "chaveiro",
      "assistência técnica de celular", "imobiliária",
      "escritório de contabilidade", "escritório de advocacia",
      "agência de marketing", "despachante", "costureira", "sapataria",
    ],
  },
  {
    setor: "Construção e casa",
    nichos: [
      "material de construção", "vidraçaria", "serralheria", "marmoraria",
      "marcenaria", "loja de tintas", "móveis planejados", "paisagismo",
    ],
  },
  {
    setor: "Atacado e indústria",
    nichos: ["distribuidora", "atacado", "transportadora"],
  },
];

export const ESTADOS: { uf: string; nome: string }[] = [
  { uf: "AC", nome: "Acre" },
  { uf: "AL", nome: "Alagoas" },
  { uf: "AP", nome: "Amapá" },
  { uf: "AM", nome: "Amazonas" },
  { uf: "BA", nome: "Bahia" },
  { uf: "CE", nome: "Ceará" },
  { uf: "DF", nome: "Distrito Federal" },
  { uf: "ES", nome: "Espírito Santo" },
  { uf: "GO", nome: "Goiás" },
  { uf: "MA", nome: "Maranhão" },
  { uf: "MT", nome: "Mato Grosso" },
  { uf: "MS", nome: "Mato Grosso do Sul" },
  { uf: "MG", nome: "Minas Gerais" },
  { uf: "PA", nome: "Pará" },
  { uf: "PB", nome: "Paraíba" },
  { uf: "PR", nome: "Paraná" },
  { uf: "PE", nome: "Pernambuco" },
  { uf: "PI", nome: "Piauí" },
  { uf: "RJ", nome: "Rio de Janeiro" },
  { uf: "RN", nome: "Rio Grande do Norte" },
  { uf: "RS", nome: "Rio Grande do Sul" },
  { uf: "RO", nome: "Rondônia" },
  { uf: "RR", nome: "Roraima" },
  { uf: "SC", nome: "Santa Catarina" },
  { uf: "SP", nome: "São Paulo" },
  { uf: "SE", nome: "Sergipe" },
  { uf: "TO", nome: "Tocantins" },
];
