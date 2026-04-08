const { Op } = require('sequelize');
const Usuario = require('../models/Usuario');

class UserService {
	static normalizePhone(remoteJid) {
		const value = String(remoteJid || '');
		return value
			.replace('@s.whatsapp.net', '')
			.replace('@c.us', '')
			.replace(/\D/g, '');
	}

	static getPhoneCandidates(phoneOrJid) {
		const cleaned = UserService.normalizePhone(phoneOrJid);
		if (!cleaned) return [];

		const candidates = new Set([cleaned]);

		if (cleaned.startsWith('55') && cleaned.length > 11) {
			candidates.add(cleaned.slice(2));
		}

		if (!cleaned.startsWith('55') && cleaned.length >= 10) {
			candidates.add(`55${cleaned}`);
		}

		return Array.from(candidates);
	}

	static normalizeCpf(cpf) {
		return (cpf || '').replace(/\D/g, '');
	}

	static normalizeDate(input) {
		const value = (input || '').trim();

		if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
			return value;
		}

		if (/^\d{2}\/\d{2}\/\d{4}$/.test(value)) {
			const [dia, mes, ano] = value.split('/');
			return `${ano}-${mes}-${dia}`;
		}

		return null;
	}

	static isValidEmail(email) {
		return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
	}

	static isValidCpf(cpf) {
		const cleanedCpf = UserService.normalizeCpf(cpf);
		return cleanedCpf.length === 11;
	}

	static isValidBirthDate(input) {
		const normalized = UserService.normalizeDate(input);
		if (!normalized) return false;

		const date = new Date(`${normalized}T00:00:00`);
		return !Number.isNaN(date.getTime()) && date <= new Date();
	}

	static isValidPhone(phone) {
		const cleanedPhone = UserService.normalizePhone(phone);
		return cleanedPhone.length >= 10 && cleanedPhone.length <= 13;
	}

	static async syncModel() {
		await Usuario.sync();

		const sequelize = Usuario.sequelize;
		const [dataNascimentoColumn] = await sequelize.query("SHOW COLUMNS FROM usuarios LIKE 'data_nascimento'");
		if (!dataNascimentoColumn.length) {
			await sequelize.query('ALTER TABLE usuarios ADD COLUMN data_nascimento DATE NULL');
		}

		const [cpfColumn] = await sequelize.query("SHOW COLUMNS FROM usuarios LIKE 'cpf'");
		if (!cpfColumn.length) {
			await sequelize.query('ALTER TABLE usuarios ADD COLUMN cpf VARCHAR(14) NULL');
		}
	}

	static async findByPhone(phoneOrJid) {
		const candidates = UserService.getPhoneCandidates(phoneOrJid);
		if (!candidates.length) return null;

		let user = await Usuario.findOne({
			where: {
				telefone: { [Op.in]: candidates },
			},
		});

		if (user) return user;

		const suffix = candidates[0].length >= 8 ? candidates[0].slice(-8) : candidates[0];
		user = await Usuario.findOne({
			where: {
				telefone: { [Op.like]: `%${suffix}` },
			},
		});

		return user;
	}

	static async findByCpf(cpf) {
		const cleanedCpf = UserService.normalizeCpf(cpf);
		if (!cleanedCpf) return null;

		return Usuario.findOne({ where: { cpf: cleanedCpf } });
	}

	static async createPatient({ nome, dataNascimento, cpf, telefone, email }) {
		const normalizedDate = UserService.normalizeDate(dataNascimento);
		const cleanedCpf = UserService.normalizeCpf(cpf);
		const cleanedPhone = UserService.normalizePhone(telefone);

		if (!cleanedPhone) {
			throw new Error('Telefone invalido para cadastro.');
		}

		if (!normalizedDate) {
			throw new Error('Data de nascimento invalida.');
		}

		if (!cleanedCpf || cleanedCpf.length !== 11) {
			throw new Error('CPF invalido.');
		}

		const byPhone = await Usuario.findOne({ where: { telefone: cleanedPhone } });
		if (byPhone) return { user: byPhone, created: false };

		const byCpf = await Usuario.findOne({ where: { cpf: cleanedCpf } });
		if (byCpf) {
			await byCpf.update({
				nome,
				data_nascimento: normalizedDate,
				telefone: cleanedPhone,
				email: email || byCpf.email,
				status: 'ativo',
			});

			return { user: byCpf, created: false };
		}

		const user = await Usuario.create({
			nome,
			data_nascimento: normalizedDate,
			cpf: cleanedCpf,
			telefone: cleanedPhone,
			email,
			status: 'ativo',
		});

		return { user, created: true };
	}
}

module.exports = UserService;
