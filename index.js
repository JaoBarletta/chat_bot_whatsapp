require('dotenv').config();

const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  Browsers
} = require("@whiskeysockets/baileys")

const qrcode = require("qrcode-terminal")
const Database = require('./src/database/connection')
const UserService = require('./src/services/UserService')
const AtendimentoService = require('./src/services/AtendimentoService')

const registrationState = new Map()

function getPhoneFromMessage(msg) {
  const participant = msg.key?.participant
  const remoteJid = msg.key?.remoteJid

  if (participant) {
    return UserService.normalizePhone(participant)
  }

  return UserService.normalizePhone(remoteJid)
}

async function startSock() {
  try {
    await Database.testConnection()
    await UserService.syncModel()
    await AtendimentoService.syncModel()
    console.log('Banco MySQL conectado com sucesso')
  } catch (error) {
    console.error('Erro ao conectar no banco:', error.message)
    process.exit(1)
  }

  const { state, saveCreds } = await useMultiFileAuthState("auth")

  const sock = makeWASocket({
    auth: state,
    browser: Browsers.ubuntu("Chrome"),
    version: [2, 3000, 1034074495]
  })

  sock.ev.on("connection.update", async (update) => {
    const { connection, qr, lastDisconnect } = update

    if (qr) {
      qrcode.generate(qr, { small: true })
    }

    if (connection === "open") {
      console.log("✅ WhatsApp conectado")
    }

    if (connection === "close") {
      const statusCode = lastDisconnect?.error?.output?.statusCode
      console.log("Conexão fechada. Status:", statusCode)

      if (statusCode !== DisconnectReason.loggedOut) {
        setTimeout(() => startSock(), 3000)
      } else {
        console.log("Sessão encerrada. Apague a pasta auth e conecte novamente.")
      }
    }
  })

  sock.ev.on("creds.update", saveCreds)

  sock.ev.on("messages.upsert", async ({ messages }) => {
    const msg = messages[0]
    if (!msg.message) return
    if (msg.key.fromMe) return

    const text =
      msg.message.conversation ||
      msg.message.extendedTextMessage?.text

    if (!text) return

    const from = msg.key.remoteJid
    const telefoneOrigem = getPhoneFromMessage(msg)

    if (!telefoneOrigem) {
      await sock.sendMessage(from, {
        text: 'Nao consegui identificar seu numero. Envie novamente sua mensagem.'
      })
      return
    }
    const normalizedText = text.trim()
    const textLower = normalizedText.toLowerCase()
    const eventoInicio = new Date()

    const flow = registrationState.get(from)

    if (textLower === 'cancelar') {
      registrationState.delete(from)
      await sock.sendMessage(from, { text: 'Fluxo cancelado. Envie qualquer mensagem para recomecar.' })
      return
    }

    if (flow?.step === 'waiting_name') {
      registrationState.set(from, {
        step: 'waiting_birth_date',
        nome: normalizedText,
      })

      await sock.sendMessage(from, {
        text: 'Informe sua *data de nascimento* (dd/mm/aaaa).'
      })
      return
    }

    if (flow?.step === 'waiting_birth_date') {
      if (!UserService.isValidBirthDate(normalizedText)) {
        await sock.sendMessage(from, {
          text: 'Data invalida. Envie no formato *dd/mm/aaaa*.'
        })
        return
      }

      registrationState.set(from, {
        ...flow,
        step: 'waiting_cpf',
        dataNascimento: normalizedText,
      })

      await sock.sendMessage(from, { text: 'Agora informe o *CPF* (somente numeros ou formatado).' })
      return
    }

    if (flow?.step === 'waiting_cpf') {
      if (!UserService.isValidCpf(normalizedText)) {
        await sock.sendMessage(from, {
          text: 'CPF invalido. Envie um CPF com 11 digitos.'
        })
        return
      }

      registrationState.set(from, {
        ...flow,
        step: 'waiting_email',
        cpf: normalizedText,
      })

      await sock.sendMessage(from, {
        text: 'Telefone identificado automaticamente pelo WhatsApp. Agora informe seu *e-mail* ou digite *pular*.'
      })
      return
    }

    if (flow?.step === 'waiting_email') {
      const skipEmail = textLower === 'pular'
      const email = skipEmail ? null : normalizedText

      if (!skipEmail && !UserService.isValidEmail(email)) {
        await sock.sendMessage(from, {
          text: 'E-mail invalido. Digite um e-mail valido ou *pular*.'
        })
        return
      }

      try {
        const { user, created } = await UserService.createPatient({
          nome: flow.nome,
          dataNascimento: flow.dataNascimento,
          cpf: flow.cpf,
          telefone: telefoneOrigem,
          email,
        })

        registrationState.delete(from)

        await sock.sendMessage(from, {
          text: created
            ? `Cadastro concluido com sucesso! ID do paciente: ${user.id_usuario}`
            : `Paciente atualizado com sucesso! ID: ${user.id_usuario}`
        })

        await sock.sendMessage(from, {
          text: 'Agora me diga sua solicitacao para iniciar o atendimento.'
        })
      } catch (error) {
        registrationState.delete(from)
        await sock.sendMessage(from, {
          text: 'Nao foi possivel concluir o cadastro agora. Tente novamente.'
        })
      }

      return
    }

    const paciente = await UserService.findByPhone(telefoneOrigem)

    if (!paciente) {
      registrationState.set(from, { step: 'waiting_name' })
      await sock.sendMessage(from, {
        text: 'Ola! Nao encontrei seu cadastro. Vamos comecar. Qual o seu *nome completo*?'
      })
      return
    }

    if (textLower === "oi") {
      await sock.sendMessage(from, {
        text: `Ola, ${paciente.nome}! Como posso ajudar hoje?`
      })
      return
    }

    const tipoSolicitacao = AtendimentoService.classifyRequest(normalizedText)
    const resposta = AtendimentoService.buildReply({
      tipoSolicitacao,
      pacienteNome: paciente.nome,
    })

    await sock.sendMessage(from, { text: resposta })

    const eventoFim = new Date()

    await AtendimentoService.saveHistory({
      idUsuario: paciente.id_usuario,
      telefone: paciente.telefone,
      mensagemRecebida: normalizedText,
      tipoSolicitacao,
      respostaEnviada: resposta,
      eventoInicio,
      eventoFim,
    })
  })
}

startSock()