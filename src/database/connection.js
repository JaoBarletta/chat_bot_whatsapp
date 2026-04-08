require('dotenv').config();

const { Sequelize } = require('sequelize');

class Database {
  static sequelize = null;

  static getInstance() {
    if (!Database.sequelize) {
      const {
        DB_HOST,
        DB_PORT = '3306',
        DB_NAME,
        DB_USER,
        DB_PASSWORD,
      } = process.env;

      if (!DB_HOST || !DB_NAME || !DB_USER) {
        throw new Error(
          'Variaveis de ambiente ausentes. Defina DB_HOST, DB_PORT, DB_NAME, DB_USER e DB_PASSWORD no arquivo .env.'
        );
      }

      Database.sequelize = new Sequelize(DB_NAME, DB_USER, DB_PASSWORD || '', {
        host: DB_HOST,
        port: Number(DB_PORT),
        dialect: 'mysql',
        logging: false,
      });
    }

    return Database.sequelize;
  }

  static async testConnection() {
    const sequelize = Database.getInstance();
    await sequelize.authenticate();
    return sequelize;
  }
}

module.exports = Database;
