import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { Presentation, PresentationFile } from '@oai/artifact-tool';

const root = 'C:/Users/joaob/projeto_tcc/chat_bot_whatsapp';
const build = path.join(root, '.presentation-build/sprint2');
const out = path.join(root, 'outputs/sprint2');
const skill = 'C:/Users/joaob/.codex/plugins/cache/openai-primary-runtime/presentations/26.1013.11914/skills/presentations';
const python = 'C:/Users/joaob/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe';
process.env.RUNTIME_NODE_MODULES = 'C:/Users/joaob/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules';
const p = Presentation.create({ slideSize: { width: 1280, height: 720 } });
const C = { bg:'#F6F5F0', ink:'#173A3A', green:'#15776C', muted:'#536767', light:'#D9E9E4', white:'#FFFFFF' };
const sources = 'Fontes do projeto: docs/sprint2-entrega.md; docs/logs-validacao-sprints.md; logs/validation/2026-10-16.jsonl (ultima execucao: 78 testes aprovados); docs/evidence/sprint2-benchmark.json. Evidencias em 16/10/2026.';
function text(s, value, x,y,w,h,size=28,color=C.ink,bold=false){
  const box=s.shapes.add({geometry:'textbox',position:{left:x,top:y,width:w,height:h},fill:'none',line:{fill:'none',width:0}});
  box.text=value; box.text.style={typeface:'Arial',fontSize:size,color,bold}; return box;
}
function slide(title, notes, dark=false){
  const s=p.slides.add(); s.background.fill=dark?C.ink:C.bg;
  if(title) text(s,title,70,56,1140,110,48,dark?C.white:C.ink,true);
  text(s,String(p.slides.items.length).padStart(2,'0'),1160,662,60,30,16,dark?C.light:C.muted);
  s.speakerNotes.text=notes+'\n\n'+sources;
  return s;
}
function block(s,title,body,x,y,w=515){text(s,title,x,y,w,48,30,C.green,true);text(s,body,x,y+56,w,150,27);}
function table(s,values,y=195,widths=[355,785],height=390){
  const tb=s.tables.add({rows:values.length,columns:values[0].length,left:70,top:y,width:1140,height,columnWidths:widths,values});
  tb.borders.assign({fill:C.bg,width:2,style:'solid'});
  for(let r=0;r<values.length;r++) for(let c=0;c<values[0].length;c++){
    const cell=tb.getCell(r,c); cell.fill=r===0?C.ink:r%2?C.white:C.light;
    cell.text.style={typeface:'Arial',fontSize:r===0?25:24,color:r===0?C.white:C.ink,bold:r===0};
  }
}

let s=slide('', 'A Sprint 2 concentrou o trabalho na integracao dos fluxos e na verificacao do atendimento. Apresente a proposta como apoio administrativo e coleta inicial de informacoes para o dentista. Duracao sugerida da apresentacao: 8 a 10 minutos.',true);
text(s,'TCC EM ENGENHARIA DE SOFTWARE',74,86,1080,45,23,C.light,true);
text(s,'Sprint 2',70,210,1100,100,82,C.white,true);
text(s,'Chatbot odontológico\ncom atendimento pelo WhatsApp',74,340,1060,150,46,C.white);
text(s,'Entregas e validação técnica\n16 de outubro de 2026',76,571,1030,65,24,C.light);

s=slide('Objetivo da Sprint 2','Explique que a integracao com a IA ja vinha da sprint anterior. Nesta sprint, o foco foi completar os fluxos e produzir evidencias. A validacao tecnica nao substitui a avaliacao da equipe odontologica.');
text(s,'Consolidar o atendimento e tornar seus resultados verificáveis.',70,175,1120,90,34);
block(s,'Atendimento','Triagem, anamnese e agendamento\ncom continuidade da conversa.',70,305);
block(s,'Integrações','MySQL, relatório para o dentista\ne publicação no Google Calendar.',670,305);
block(s,'Segurança','Regras para a IA e respostas locais\nquando houver falha ou rejeição.',70,505);
block(s,'Evidências','Testes, consumo de tokens\ne logs de cada etapa.',670,505);

s=slide('Arquitetura do atendimento','O fluxo controla as decisoes. A OpenAI reformula textos previamente aprovados quando a politica permite. No modo smart, etapas operacionais de agendamento e triagem usam respostas locais. A integracao com WhatsApp utiliza Baileys. Fonte adicional: src/handlers/MessageHandler.js e src/services/ResponseHumanizerService.js.');
table(s,[['Componente','Responsabilidade'],['WhatsApp e buffer','Receber e agrupar mensagens fragmentadas'],['FlowRouter e Flows','Identificar a intenção e controlar as etapas'],['Serviços e MySQL','Consultar disponibilidade e registrar os dados'],['OpenAI e guardrails','Reformular textos e validar a resposta'],['Relatório e Calendar','Encaminhar informações para a equipe']],185,[355,785],400);
text(s,'As regras de negócio permanecem nos fluxos e serviços.',70,611,1120,42,27,C.green,true);

s=slide('Jornada do paciente','Descreva o caminho geral em ordem. O bot consulta cadastro, identifica a necessidade, coleta informacoes, recebe preferencia de data e horario quando aplicavel e registra a solicitacao. O dentista avalia o caso. Uma saudacao simples nao deve disparar relatorio.');
const steps=[['01','Mensagem e cadastro','Reconhecimento do paciente e da necessidade.'],['02','Fluxo adequado','Agendamento conhecido ou coleta de sintomas.'],['03','Informações necessárias','Anamnese conforme regra do fluxo e foto opcional.'],['04','Data, horário e confirmação','Disponibilidade consultada no banco de dados.'],['05','Registro e encaminhamento','Relatório para a equipe e evento quando há agendamento.']];
steps.forEach(([n,t,b],i)=>{const y=185+i*88;text(s,n,70,y,70,55,35,C.green,true);text(s,t,170,y,1000,39,29,C.ink,true);text(s,b,170,y+40,1000,36,24,C.muted);});

s=slide('Triagem e anamnese','A triagem coleta o relato sem diagnosticar. Complexidade representa uma regra preliminar de encaminhamento, nao uma classificacao clinica validada. Para os procedimentos de alta complexidade previstos no agendamento, a anamnese coleta condicoes de saude e persiste os dados na tabela correspondente. Os testes cobrem um fluxo de anamnese com 13 mensagens.');
block(s,'Triagem','Queixa principal e tempo do sintoma\nLocalização e características\nFoto opcional, com recusa em linguagem natural',70,190);
block(s,'Anamnese odontológica','Condições de saúde e alergias\nHistórico de transfusão e transplante\nReações à anestesia e outras condições',670,190);
text(s,'Relatório preliminar para o dentista',70,457,1120,55,34,C.green,true);
text(s,'Necessidade, complexidade e informações coletadas.\nData e hora do agendamento, ou indicação de pendência.\nA equipe realiza a avaliação clínica.',70,523,1120,110,28);

s=slide('Agendamento e persistência','Explique a sequencia de consulta de disponibilidade, escolha, confirmacao e persistencia. A transacao no InnoDB liga a verificacao e a insercao. Em conflito ou erro o fluxo permanece aberto. A integracao Calendar esta implementada e possui testes simulados, mas o convite real ainda precisa de homologacao final nesta entrega.');
block(s,'Agenda no MySQL','Oferta de horários disponíveis\nDuração consistente com a consulta\nVerificação e gravação em transação',70,195);
block(s,'Google Calendar','Evento com resumo do atendimento\nPaciente convidado quando há e-mail válido\nResultado da publicação registrado nos logs',670,195);
text(s,'Validação real do banco',70,464,1120,55,34,C.green,true);
text(s,'Consulta e anamnese gravadas e conferidas.\nConflito de horário rejeitado.\nDados sintéticos revertidos ao final do teste.',70,530,1120,110,28);

s=slide('Proteções da IA','Detalhe as camadas: prompt, minimizacao, validacao e fallback. O prompt nao e a unica defesa. O sistema verifica alteracoes de procedimento, datas, numeros, perguntas e tom. Os testes usam candidatos adversariais e falhas simuladas. Essas regras reduzem risco, mas nao garantem protecao contra toda resposta possivel.');
table(s,[['Camada','Comportamento implementado'],['Instruções','Reformular somente o texto aprovado pelo fluxo'],['Minimização','Filtrar identificadores e limitar o contexto enviado'],['Validação da resposta','Rejeitar afirmações clínicas, deboche e alterações do fluxo'],['Fallback local','Manter o atendimento em erro, timeout ou resposta inválida']],195,[300,840],350);
text(s,'Guardrails reduzem riscos. A avaliação clínica continua com o dentista.',70,587,1140,70,28,C.green,true);

s=slide('Correções na conversa','Use estes exemplos para demonstrar as correcoes verificadas. Nao esta certo deixa de confirmar. Foto antecipada fica armazenada sem preencher perguntas com vazio. Na anamnese, uma resposta contendo a palavra dor nao muda automaticamente para triagem. Esses casos estao em Sprint2Scenarios.test.js.');
table(s,[['Situação','Resultado esperado'],['“Não está certo”','Solicitar outra data, sem confirmar o agendamento'],['“Não consigo tirar foto”','Continuar a coleta sem exigir um comando fixo'],['Foto enviada antecipadamente','Guardar a imagem e manter a pergunta obrigatória'],['Sintoma durante a anamnese','Preservar as respostas e a etapa do atendimento']],195,[450,690],390);

s=slide('Controle de contexto e tokens','O modo smart evita chamadas em respostas operacionais. A mensagem atual tem limite de 500 caracteres. O historico tem limite de quatro itens de 300 caracteres quando habilitado e o padrao e nao envia-lo. O sistema registra usage real retornado pela API. Nao apresentar economia percentual nem comparar com o modelo anterior.');
text(s,'500',70,198,480,115,88,C.green,true);
text(s,'caracteres na mensagem atual',75,325,510,60,28);
text(s,'4 × 300',670,198,510,115,88,C.green,true);
text(s,'limite do histórico, quando habilitado',675,325,510,76,28);
text(s,'Modo smart',70,462,1120,50,35,C.ink,true);
text(s,'Etapas operacionais usam respostas locais.\nTokens de entrada, saída e cache vêm da API.\nConsumo ausente permanece desconhecido.',70,527,1120,110,28);

s=slide('Resultados da validação','A suite mais recente tem 78 testes aprovados, incluindo os testes de telemetria adicionados apos a entrega inicial de 75. A chamada real sintetica consumiu 201 tokens de entrada e 9 de saida, total 210, com latencia 3187 ms. E uma unica chamada, nao media ou p95 da API. Os quatro replays simulados cobrem limpeza, triagem, implante com anamnese e atendimento sem agendamento. O teste MySQL real utiliza rollback.');
text(s,'78',70,177,300,125,100,C.green,true);
text(s,'testes aprovados\n0 falhas na última execução',75,315,410,95,29);
text(s,'Verificações realizadas',565,192,620,50,32,C.ink,true);
text(s,'4 cenários completos simulados\n\nMySQL real com reversão dos dados\n\nOpenAI real com mensagem sintética',565,266,620,230,28);
text(s,'210 tokens e 3,187 s em uma chamada real à OpenAI.',70,559,1120,50,29,C.green,true);
text(s,'Resultados pontuais não representam desempenho médio em produção.',70,617,1120,40,23,C.muted);

s=slide('Logs para validar cada etapa','Explique o uso de traceId para acompanhar uma mensagem e de identificadores pseudonimos para continuidade. Os eventos incluem IA, fluxo, banco, WhatsApp e Calendar. O resumo apresenta contagens, motivos, percentis e taxa de fallback. Ele nao mede satisfacao ou qualidade clinica. Os arquivos de validacao excluem mensagens, fotos e identificadores diretos. Debug antigo e independente e deve ficar desligado no uso real.');
block(s,'Comunicação com a IA','Tokens, latência e status HTTP\nTimeout, cooldown e chamadas evitadas\nAceitação, rejeição e motivo do fallback',70,195);
block(s,'Execução do atendimento','Etapas, cancelamento e agrupamento\nPersistência no banco e envio de relatórios\nPublicação no Calendar e falhas de integração',670,195);
text(s,'npm run metrics:validation',70,470,1140,54,34,C.green,true);
text(s,'Resumo com contagens, média e percentis de tempo.\nRegistros sem textos clínicos ou identificadores diretos.',70,540,1120,95,28);

s=slide('Entrega técnica e homologação','Conclua dizendo que o projeto possui fluxos integrados e evidencias reproduziveis. Ainda e preciso avaliar naturalidade com usuarios, revisar relatorios com equipe odontologica e validar o canal completo WhatsApp e Calendar. As sessoes ficam em memoria e nao ha fila duravel de reenvio externo. A implementacao de filtros nao comprova conformidade LGPD integral. Nao afirmar que o sistema esta homologado clinicamente.',true);
text(s,'Entregue',72,195,520,60,37,C.light,true);
text(s,'Fluxos integrados\nPersistência verificada no MySQL\nGuardrails e respostas locais\nMétricas e testes reproduzíveis',72,275,530,220,30,C.white);
text(s,'Em validação',685,195,520,60,37,C.light,true);
text(s,'Naturalidade com usuários\nRevisão clínica dos relatórios\nTeste final no WhatsApp e Calendar\nAcesso e retenção de dados',685,275,520,220,30,C.white);
text(s,'A Sprint 2 entrega uma base técnica para a homologação do atendimento.',72,578,1130,65,30,C.white);

await fs.mkdir(out,{recursive:true});
for (const [i,s] of p.slides.items.entries()) {
  const png=await p.export({slide:s,format:'png',scale:1});
  await fs.writeFile(path.join(build,`slide-${String(i+1).padStart(2,'0')}.png`),new Uint8Array(await png.arrayBuffer()));
}
const candidate=path.join(build,'candidate.pptx');
await (await PresentationFile.exportPptx(p)).save(candidate);
const {finalizePresentation}=await import(pathToFileURL(path.join(skill,'container_tools/artifact_tool_utils.mjs')).href);
const result=await finalizePresentation({workspaceDir:root,candidatePath:candidate,finalPath:path.join(out,'Sprint_2_Chatbot_Odontologico.pptx'),pythonExecutable:python,
integrityValidatorPath:path.join(skill,'container_tools/inspect_presentation_package_integrity.py'),layoutValidatorPath:path.join(skill,'container_tools/inspect_presentation_layout_geometry.py'),
layoutArgs:['--expected-slide-size-emu','12192000,6858000','--validate-heading-fit'],fontPolicy:{basis:'design',families:['Arial']},verifyArtifactToolImport:true,
receiptPath:path.join(build,'validation.json')});
console.log(JSON.stringify(result));
