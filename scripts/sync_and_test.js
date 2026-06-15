require('dotenv').config();
const Database = require('../src/database/connection');
const UserService = require('../src/services/UserService');
const AgendamentoService = require('../src/services/AgendamentoService');
const Tratamento = require('../src/models/Tratamento');
const NotificationService = require('../src/services/NotificationService');

async function main() {
  try {
    console.log('Conectando ao DB...');
    const sequelize = Database.getInstance();
    await sequelize.authenticate();
    console.log('Conectado.');

    console.log('Sincronizando modelos...');
    // sincroniza modelos usados
    const Usuario = require('../src/models/Usuario');
    const Agendamento = require('../src/models/Agendamento');
    const Pagamento = require('../src/models/Pagamento');
    const Imagem = require('../src/models/ImagemClinica');
    const Historico = require('../src/models/HistoricoAtendimento');

    await Usuario.sync();
    await Agendamento.sync();
    await Tratamento.sync();
    await Pagamento.sync();
    await Imagem.sync();
    await Historico.sync();

    console.log('Modelos sincronizados.');

    console.log('Criando paciente de teste...');
    const { user, created } = await UserService.createPatient({
      nome: 'Teste Paciente',
      dataNascimento: '01/01/1990',
      cpf: '12345678901',
      telefone: '5511999999999',
      email: 'teste@example.com',
    });
    console.log(`Paciente id=${user.id} (created=${created})`);

    console.log('Criando consulta de teste para amanhã...');
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(10,0,0,0);

    const consulta = await AgendamentoService.createAppointment({
      idUsuario: user.id,
      telefone: user.telefone,
      dataHorario: tomorrow,
      tipoProcedimento: 'Consulta / Avaliação',
      anamnese: JSON.stringify({ motivo: 'Teste automatizado' }),
    });
    console.log('Consulta criada id=', consulta.id);

    console.log('Criando tratamento concluido há >6 meses para testar convocação...');
    const seisMesesAtras = new Date();
    seisMesesAtras.setMonth(seisMesesAtras.getMonth() - 7);
    const tratamento = await Tratamento.create({
      paciente_id: user.id,
      descricao: 'Tratamento de teste concluido',
      status: 'concluido',
      realizado_em: seisMesesAtras,
    });
    console.log('Tratamento criado id=', tratamento.id);

    console.log('Executando envio manual de lembretes D-1 (simulado)...');
    await NotificationService.sendNextDayReminders(async (to, message) => {
      console.log('Simulated sendNextDayReminders -> to:', to, 'message:', message);
    });

    console.log('Executando envio manual de convocacoes semestrais (simulado)...');
    await NotificationService.sendSixMonthConvocations(async (to, message) => {
      console.log('Simulated sendSixMonthConvocations -> to:', to, 'message:', message);
    });

    console.log('Testes concluídos com sucesso.');
    process.exit(0);
  } catch (err) {
    console.error('Erro durante sincronizacao/testes:', err && err.stack ? err.stack : err);
    process.exit(2);
  }
}

main();
