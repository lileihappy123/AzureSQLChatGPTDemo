import mysql, { RowDataPacket } from "mysql2/promise";
import { Connection } from "@/types";
import { Connector } from "..";
import fs from "fs";
import path from "path";

const systemDatabases = ["information_schema", "mysql", "performance_schema", "sys"];


const getMySQLConnection = async (connection: Connection): Promise<mysql.Connection> => {
  
  //const path = require('path');
  //const certFilePath = path.join(__dirname, 'DigiCertGlobalRootCA.crt.pem');
  //const certFilePath = path.join(__dirname, '..', '..', '..', '..', '..', 'cert','DigiCertGlobalRootCA.crt.pem');
  //const serverCa = [fs.readFileSync(certFilePath, "utf8")];
  //console.log(serverCa)

  //mysql connection
  const conn = await mysql.createConnection({
    host: connection.host,
    port: parseInt(connection.port),
    user: connection.username,
    password: connection.password,
    database: connection.database,
    debug:false,

  });

  return conn;
};

const testConnection = async (connection: Connection): Promise<boolean> => {
  const conn = await getMySQLConnection(connection);
  conn.destroy();
  return true;
};

const execute = async (connection: Connection, databaseName: string, statement: string): Promise<any> => {
  connection.database = databaseName;
  const conn = await getMySQLConnection(connection);
  const [rows] = await conn.query<RowDataPacket[]>(statement);
  conn.destroy();
  return rows;
};

const getDatabases = async (connection: Connection): Promise<string[]> => {
  const conn = await getMySQLConnection(connection);
  const [rows] = await conn.query<RowDataPacket[]>(
    `SELECT schema_name as db_name FROM information_schema.schemata WHERE schema_name NOT IN (?);`,
    [systemDatabases]
  );
  conn.destroy();
  const databaseList = [];
  for (const row of rows) {
    if (row["db_name"]) {
      databaseList.push(row["db_name"]);
    }
  }
  return databaseList;
};

const getTables = async (connection: Connection, databaseName: string): Promise<string[]> => {
  const conn = await getMySQLConnection(connection);
  const [rows] = await conn.query<RowDataPacket[]>(
    `SELECT TABLE_NAME as table_name FROM information_schema.tables WHERE TABLE_SCHEMA=? AND TABLE_TYPE='BASE TABLE';`,
    [databaseName]
  );
  conn.destroy();
  const tableList = [];
  for (const row of rows) {
    if (row["table_name"]) {
      tableList.push(row["table_name"]);
    }
  }
  return tableList;
};

const getTableStructure = async (connection: Connection, databaseName: string, tableName: string): Promise<string> => {
  const conn = await getMySQLConnection(connection);
  const [rows] = await conn.query<RowDataPacket[]>(`SHOW CREATE TABLE \`${databaseName}\`.\`${tableName}\`;`);
  conn.destroy();
  if (rows.length !== 1) {
    throw new Error("Unexpected number of rows.");
  }
  return rows[0]["Create Table"] || "";
};

const newConnector = (connection: Connection): Connector => {
  return {
    testConnection: () => testConnection(connection),
    execute: (databaseName: string, statement: string) => execute(connection, databaseName, statement),
    getDatabases: () => getDatabases(connection),
    getTables: (databaseName: string) => getTables(connection, databaseName),
    getTableStructure: (databaseName: string, tableName: string) => getTableStructure(connection, databaseName, tableName),
  };
};

export default newConnector;
