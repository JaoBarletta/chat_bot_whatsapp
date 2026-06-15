// Script de verificação: define variáveis de ambiente mínimas e carrega modelos
process.env.DB_HOST = process.env.DB_HOST || '127.0.0.1';
process.env.DB_PORT = process.env.DB_PORT || '3306';
process.env.DB_NAME = process.env.DB_NAME || 'testdb';
process.env.DB_USER = process.env.DB_USER || 'root';
process.env.DB_PASSWORD = process.env.DB_PASSWORD || '';

try {
  require('../src/models/Usuario');
  require('../src/models/Agendamento');
  require('../src/models/Tratamento');
  require('../src/models/Pagamento');
  require('../src/models/ImagemClinica');
  require('../src/models/HistoricoAtendimento');
  require('../src/services/AgendamentoService');
  require('../src/services/TriagemService');
  require('../src/services/AtendimentoService');
  console.log('OK: modelos e serviços carregados com sucesso (sem conectar ao DB)');
  process.exit(0);
} catch (err) {
  console.error('ERRO ao carregar modelos/serviços:', err && err.stack ? err.stack : err);
  process.exit(2);
}
