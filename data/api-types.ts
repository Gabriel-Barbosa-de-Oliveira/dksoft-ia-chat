// Gerado por map-api.mjs em 2026-10-29T01:48:46.435Z

export interface HealthResponse {
  status: string;
  servico: string;
  versao: string;
}

export interface PacotesResponse {
  status: string;
  total: number;
  pacotes: PacotesResponsePacotes[];
}

export interface PacotesResponsePacotes {
  id_pacote: number;
  nome: string;
  carga_horaria?: number | null;
  modulos: PacotesResponsePacotesModulos[];
}

export interface PacotesResponsePacotesModulos {
  id_modulo: number;
  nome: string;
  sequencia: number;
  carga_horaria?: number | null;
}

export interface ContasRecebidasResponse {
  tipo: string;
  data_inicial: string;
  data_final: string;
  total_registros: number;
  registros: ContasRecebidasResponseRegistros[];
}

export interface ContasRecebidasResponseRegistros {
  id_aluno: number;
  id_aluno_curso?: number | null;
  numero_lancamento: number;
  vencimento: string;
  data_pagamento: string;
  valor_pago: number;
  historico: string;
  aluno: string;
  responsavel: string;
  banco: string;
  subconta: string;
  conta: string;
  pacote?: string | null;
  pag_nome: string;
  centro_custo?: null | null;
  banco_caixa: string;
  hora: string;
  aluno_situacao: string;
  situacao_personalizada?: string | null;
  situacao_curso?: string | null;
}

export interface ContasPagasResponse {
  tipo: string;
  data_inicial: string;
  data_final: string;
  total_registros: number;
  registros: ContasPagasResponseRegistros[];
}

export interface ContasPagasResponseRegistros {
  id_aluno: number;
  id_aluno_curso?: null | null;
  numero_lancamento: number;
  vencimento: string;
  data_pagamento: string;
  valor_pago: number;
  historico: string;
  aluno: string;
  responsavel: string;
  banco: string;
  subconta: string;
  conta: string;
  pacote?: null | null;
  pag_nome: string;
  centro_custo: string;
  banco_caixa: string;
  hora: string;
  aluno_situacao: string;
  situacao_personalizada?: null | null;
  situacao_curso?: null | null;
}

export interface Erro401 {
  status: string;
  mensagem: string;
}

export interface Erro400 {
  status: string;
  codigo: string;
  mensagem: string;
}
