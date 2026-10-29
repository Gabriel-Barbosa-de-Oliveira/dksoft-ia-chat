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

// Gerado por map-api.mjs em 2026-10-29T20:08:34.062Z

export interface AlunosResponse {
  status: string;
  total_registros: number;
  limite: number;
  offset: number;
  tem_mais: boolean;
  alunos: AlunosResponseAlunos[];
}

export interface AlunosResponseAlunos {
  id_aluno: number;
  matricula: string;
  nome: string;
  nome_social: string;
  cpf: string;
  data_nascimento: string;
  sexo: string;
  data_cadastro: string;
  situacao: string;
  email: string;
  telefone?: null | null;
  celular: string;
  telefone_contato?: null | null;
  endereco: AlunosResponseAlunosEndereco;
  responsavel: AlunosResponseAlunosResponsavel;
  pai: AlunosResponseAlunosPai;
  mae: AlunosResponseAlunosMae;
}

export interface AlunosResponseAlunosEndereco {
  tipo_logradouro?: null | null;
  logradouro?: null | null;
  numero?: null | null;
  complemento?: null | null;
  bairro?: null | null;
  cep?: null | null;
  cidade?: null | null;
  estado?: null | null;
}

export interface AlunosResponseAlunosResponsavel {
  nome: string;
  tipo: string;
  parentesco?: null | null;
  telefone?: null | null;
  celular: string;
  zap: string;
  email: string;
  sexo: string;
  cidade?: null | null;
  estado?: null | null;
}

export interface AlunosResponseAlunosPai {
  nome?: null | null;
  telefone?: null | null;
  email?: null | null;
}

export interface AlunosResponseAlunosMae {
  nome?: null | null;
  telefone?: null | null;
  email?: null | null;
}

export interface AlunoPorIdResponse {
  status: string;
  id_aluno: number;
  matricula: string;
  nome: string;
  nome_social: string;
  cpf: string;
  data_nascimento: string;
  sexo: string;
  data_cadastro: string;
  situacao: string;
  email: string;
  telefone: null;
  celular: string;
  telefone_contato: null;
  endereco: AlunoPorIdResponseEndereco;
  responsavel: AlunoPorIdResponseResponsavel;
  pai: AlunoPorIdResponsePai;
  mae: AlunoPorIdResponseMae;
}

export interface AlunoPorIdResponseEndereco {
  tipo_logradouro: null;
  logradouro: null;
  numero: null;
  complemento: null;
  bairro: null;
  cep: null;
  cidade: null;
  estado: null;
}

export interface AlunoPorIdResponseResponsavel {
  nome: string;
  tipo: string;
  parentesco: null;
  telefone: null;
  celular: string;
  zap: string;
  email: string;
  sexo: string;
  cidade: null;
  estado: null;
}

export interface AlunoPorIdResponsePai {
  nome: null;
  telefone: null;
  email: null;
}

export interface AlunoPorIdResponseMae {
  nome: null;
  telefone: null;
  email: null;
}

export interface AlunoCursosResponse {
  id_aluno: number;
  cursos: AlunoCursosResponseCursos[];
}

export interface AlunoCursosResponseCursos {
  id_aluno_curso: number;
  id_pacote: number;
  contrato: string;
  pacote: string;
  data_matricula: string;
  situacao: string;
}

export interface AlunoParcelasAbertasResponse {
  id_aluno: number;
  parcelas: AlunoParcelasAbertasResponseParcelas[];
}

export interface AlunoParcelasAbertasResponseParcelas {
  numero_lancamento: number;
  id_aluno_curso: number;
  contrato: string;
  id_pacote: number;
  pacote: string;
  situacao_curso: string;
  vencimento: string;
  historico: string;
  valor: number;
  pj_link?: null | null;
}

export interface AlunoPresencasResponse {
  status: string;
  id_aluno: number;
  total_registros: number;
  total_presenca: number;
  total_falta: number;
  presencas: unknown[];
}

export interface AlunoProvasResponse {
  status: string;
  id_aluno: number;
  total_provas: number;
  provas: unknown[];
}

export interface AlunoPorMatriculaResponse {
  status: string;
  id_aluno: number;
  matricula: string;
  nome: string;
  nome_social: string;
  cpf: string;
  data_nascimento: string;
  sexo: string;
  data_cadastro: string;
  situacao: string;
  email: string;
  telefone: null;
  celular: string;
  telefone_contato: null;
  endereco: AlunoPorMatriculaResponseEndereco;
  responsavel: AlunoPorMatriculaResponseResponsavel;
  pai: AlunoPorMatriculaResponsePai;
  mae: AlunoPorMatriculaResponseMae;
}

export interface AlunoPorMatriculaResponseEndereco {
  tipo_logradouro: null;
  logradouro: null;
  numero: null;
  complemento: null;
  bairro: null;
  cep: null;
  cidade: null;
  estado: null;
}

export interface AlunoPorMatriculaResponseResponsavel {
  nome: string;
  tipo: string;
  parentesco: null;
  telefone: null;
  celular: string;
  zap: string;
  email: string;
  sexo: string;
  cidade: null;
  estado: null;
}

export interface AlunoPorMatriculaResponsePai {
  nome: null;
  telefone: null;
  email: null;
}

export interface AlunoPorMatriculaResponseMae {
  nome: null;
  telefone: null;
  email: null;
}

export interface AlunoPorCpfResponse {
  status: string;
  id_aluno: number;
  matricula: string;
  nome: string;
  nome_social: string;
  cpf: string;
  data_nascimento: string;
  sexo: string;
  data_cadastro: string;
  situacao: string;
  email: string;
  telefone: null;
  celular: string;
  telefone_contato: null;
  endereco: AlunoPorCpfResponseEndereco;
  responsavel: AlunoPorCpfResponseResponsavel;
  pai: AlunoPorCpfResponsePai;
  mae: AlunoPorCpfResponseMae;
}

export interface AlunoPorCpfResponseEndereco {
  tipo_logradouro: null;
  logradouro: string;
  numero: string;
  complemento: string;
  bairro: string;
  cep: string;
  cidade: string;
  estado: string;
}

export interface AlunoPorCpfResponseResponsavel {
  nome: string;
  tipo: string;
  parentesco: null;
  telefone: null;
  celular: string;
  zap: string;
  email: string;
  sexo: string;
  cidade: string;
  estado: string;
}

export interface AlunoPorCpfResponsePai {
  nome: null;
  telefone: null;
  email: null;
}

export interface AlunoPorCpfResponseMae {
  nome: null;
  telefone: null;
  email: null;
}

export interface AlunoPorEmailResponse {
  status: string;
  id_aluno: number;
  matricula: string;
  nome: string;
  nome_social: string;
  cpf: string;
  data_nascimento: string;
  sexo: string;
  data_cadastro: string;
  situacao: string;
  email: string;
  telefone: null;
  celular: string;
  telefone_contato: null;
  endereco: AlunoPorEmailResponseEndereco;
  responsavel: AlunoPorEmailResponseResponsavel;
  pai: AlunoPorEmailResponsePai;
  mae: AlunoPorEmailResponseMae;
}

export interface AlunoPorEmailResponseEndereco {
  tipo_logradouro: null;
  logradouro: null;
  numero: null;
  complemento: null;
  bairro: null;
  cep: null;
  cidade: null;
  estado: null;
}

export interface AlunoPorEmailResponseResponsavel {
  nome: string;
  tipo: string;
  parentesco: null;
  telefone: null;
  celular: string;
  zap: string;
  email: string;
  sexo: string;
  cidade: null;
  estado: null;
}

export interface AlunoPorEmailResponsePai {
  nome: null;
  telefone: null;
  email: null;
}

export interface AlunoPorEmailResponseMae {
  nome: null;
  telefone: null;
  email: null;
}

export interface AlunoPorTelefoneResponse {
  status: string;
  telefone_consultado: string;
  total: number;
  resultados: AlunoPorTelefoneResponseResultados[];
}

export interface AlunoPorTelefoneResponseResultados {
  id_aluno: number;
  matricula: string;
  nome_aluno: string;
  tipo_contato: string;
  nome_contato?: string | null;
  campo_encontrado: string;
  telefone_encontrado: string;
  aluno: AlunoPorTelefoneResponseResultadosAluno;
}

export interface AlunoPorTelefoneResponseResultadosAluno {
  id_aluno: number;
  nome_social?: string | null;
  cpf: string;
  data_nascimento?: string | null;
  sexo: string;
  email?: string | null;
  situacao: string;
  data_cadastro: string;
  endereco: AlunoPorTelefoneResponseResultadosAlunoEndereco;
  responsavel: AlunoPorTelefoneResponseResultadosAlunoResponsavel;
  pai: AlunoPorTelefoneResponseResultadosAlunoPai;
  mae: AlunoPorTelefoneResponseResultadosAlunoMae;
}

export interface AlunoPorTelefoneResponseResultadosAlunoEndereco {
  tipo_logradouro?: null | null;
  logradouro?: string | null;
  numero?: string | null;
  complemento?: string | null;
  bairro?: string | null;
  cep?: string | null;
  cidade?: string | null;
  estado?: string | null;
}

export interface AlunoPorTelefoneResponseResultadosAlunoResponsavel {
  nome?: string | null;
  tipo?: string | null;
  parentesco?: string | null;
  telefone?: string | null;
  celular: string;
  zap: string;
  email?: string | null;
  sexo?: string | null;
  cidade?: string | null;
  estado?: string | null;
}

export interface AlunoPorTelefoneResponseResultadosAlunoPai {
  nome?: null | null;
  telefone?: null | null;
  email?: null | null;
}

export interface AlunoPorTelefoneResponseResultadosAlunoMae {
  nome?: null | null;
  telefone?: null | null;
  email?: null | null;
}

export interface Erro401 {
  status: string;
  mensagem: string;
}
