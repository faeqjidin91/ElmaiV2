import mysql from 'mysql2/promise'
import bcrypt from 'bcryptjs'

const getDatabaseName = () => process.env.DB_NAME || 'rbac_demo'

const getConnectionConfig = (withDatabase = true) => {
  const host = process.env.DB_HOST || '127.0.0.1'
  const port = Number(process.env.DB_PORT || 3306)

  return {
    host,
    port,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    ...(withDatabase ? { database: getDatabaseName() } : {}),
    waitForConnections: true,
    connectionLimit: Number(process.env.DB_CONNECTION_LIMIT || 10),
    queueLimit: 0,
  }
}

let pool

const ensureDatabaseExists = async () => {
  const dbName = getDatabaseName()
  const connection = await mysql.createConnection(getConnectionConfig(false))
  await connection.query(
    `CREATE DATABASE IF NOT EXISTS \`${dbName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
  )
  await connection.end()
}

export const getPool = async () => {
  if (!pool) {
    await ensureDatabaseExists()
    pool = mysql.createPool(getConnectionConfig())
  }
  return pool
}

export const initializeDatabase = async () => {
  const db = await getPool()

  await db.query(`
    CREATE TABLE IF NOT EXISTS Users (
      Id INT AUTO_INCREMENT PRIMARY KEY,
      Username VARCHAR(100) NOT NULL UNIQUE,
      PasswordHash VARCHAR(255) NOT NULL,
      Role VARCHAR(20) NOT NULL,
      CreatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB
  `)

  await db.query(`
    CREATE TABLE IF NOT EXISTS FormSubmissions (
      Id INT AUTO_INCREMENT PRIMARY KEY,
      FullName VARCHAR(200) NOT NULL,
      IcPassportNumber VARCHAR(100) NOT NULL,
      ImageBase64 LONGTEXT NOT NULL,
      SubmittedByUserId INT NOT NULL,
      CreatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT FK_FormSubmissions_Users FOREIGN KEY (SubmittedByUserId) REFERENCES Users(Id)
    ) ENGINE=InnoDB
  `)

  await db.query(`
    CREATE TABLE IF NOT EXISTS Ships (
      Id INT AUTO_INCREMENT PRIMARY KEY,
      ShipName VARCHAR(200) NOT NULL,
      ShipCode VARCHAR(50) NOT NULL UNIQUE,
      ImoNumber VARCHAR(50) NOT NULL UNIQUE,
      MmsiNumber VARCHAR(50) NULL,
      FlagState VARCHAR(100) NOT NULL,
      CallSign VARCHAR(50) NULL,
      CargoType VARCHAR(100) NOT NULL,
      GrossTonnage DECIMAL(18,2) NULL,
      DeadweightTonnage DECIMAL(18,2) NULL,
      YearBuilt INT NULL,
      Status VARCHAR(50) NOT NULL DEFAULT 'active',
      Notes VARCHAR(500) NULL,
      CreatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB
  `)

  await db.query(`
    CREATE TABLE IF NOT EXISTS BatchGroups (
      Id INT AUTO_INCREMENT PRIMARY KEY,
      BatchName VARCHAR(200) NOT NULL,
      ShipId INT NULL,
      ExpiryDate DATETIME NOT NULL,
      CreatedByUserId INT NOT NULL,
      CreatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT FK_BatchGroups_Ships FOREIGN KEY (ShipId) REFERENCES Ships(Id),
      CONSTRAINT FK_BatchGroups_Users FOREIGN KEY (CreatedByUserId) REFERENCES Users(Id)
    ) ENGINE=InnoDB
  `)

  await db.query(`
    CREATE TABLE IF NOT EXISTS BatchGroupMembers (
      Id INT AUTO_INCREMENT PRIMARY KEY,
      BatchGroupId INT NOT NULL,
      FormSubmissionId INT NOT NULL,
      CreatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT FK_BatchGroupMembers_BatchGroups FOREIGN KEY (BatchGroupId) REFERENCES BatchGroups(Id),
      CONSTRAINT FK_BatchGroupMembers_FormSubmissions FOREIGN KEY (FormSubmissionId) REFERENCES FormSubmissions(Id),
      UNIQUE KEY UQ_BatchGroupMembers (BatchGroupId, FormSubmissionId)
    ) ENGINE=InnoDB
  `)

  const superadminUsername = process.env.SUPERADMIN_USERNAME || 'superadmin'
  const superadminPassword = process.env.SUPERADMIN_PASSWORD || 'SuperAdmin123!'

  const [existingSuperadmin] = await db.query('SELECT Id FROM Users WHERE Username = ?', [superadminUsername])

  if (existingSuperadmin.length === 0) {
    const passwordHash = await bcrypt.hash(superadminPassword, 10)

    await db.query('INSERT INTO Users (Username, PasswordHash, Role) VALUES (?, ?, ?)', [
      superadminUsername,
      passwordHash,
      'superadmin',
    ])
  }

  const adminUsername = process.env.ADMIN_USERNAME || 'admin'
  const adminPassword = process.env.ADMIN_PASSWORD || 'Admin123!'

  const [existingAdmin] = await db.query('SELECT Id FROM Users WHERE Username = ?', [adminUsername])

  if (existingAdmin.length === 0) {
    const passwordHash = await bcrypt.hash(adminPassword, 10)

    await db.query('INSERT INTO Users (Username, PasswordHash, Role) VALUES (?, ?, ?)', [
      adminUsername,
      passwordHash,
      'admin',
    ])
  }

  const [seedUserRows] = await db.query(
    `
      SELECT Id
      FROM Users
      WHERE Username IN (?, ?)
      ORDER BY CASE WHEN Username = ? THEN 0 ELSE 1 END
      LIMIT 1
    `,
    [adminUsername, superadminUsername, adminUsername],
  )

  const seedUserId = seedUserRows[0]?.Id

  if (seedUserId) {
    for (let index = 1; index <= 50; index += 1) {
      const fullName = `Dummy Candidate ${String(index).padStart(2, '0')}`
      const icPassportNumber = `DUMMY-${String(index).padStart(4, '0')}`

      const [existingDummy] = await db.query('SELECT Id FROM FormSubmissions WHERE IcPassportNumber = ?', [
        icPassportNumber,
      ])

      if (existingDummy.length === 0) {
        await db.query(
          'INSERT INTO FormSubmissions (FullName, IcPassportNumber, ImageBase64, SubmittedByUserId) VALUES (?, ?, ?, ?)',
          [fullName, icPassportNumber, '', seedUserId],
        )
      }
    }
  }

  const dummyShips = [
    {
      shipName: 'MV Atlas Horizon',
      shipCode: 'SHIP-001',
      imoNumber: '9301001',
      mmsiNumber: '533100001',
      flagState: 'Malaysia',
      callSign: '9MAH1',
      cargoType: 'General Cargo',
      grossTonnage: 24500,
      deadweightTonnage: 38200,
      yearBuilt: 2013,
      status: 'active',
      notes: 'Seeded demo cargo ship.',
    },
    {
      shipName: 'MV Pacific Meridian',
      shipCode: 'SHIP-002',
      imoNumber: '9301002',
      mmsiNumber: '533100002',
      flagState: 'Singapore',
      callSign: '9VPM2',
      cargoType: 'Container Ship',
      grossTonnage: 31800,
      deadweightTonnage: 44150,
      yearBuilt: 2016,
      status: 'active',
      notes: 'Seeded demo cargo ship.',
    },
    {
      shipName: 'MV Iron Crest',
      shipCode: 'SHIP-003',
      imoNumber: '9301003',
      mmsiNumber: '533100003',
      flagState: 'Panama',
      callSign: 'HPIC3',
      cargoType: 'Bulk Carrier',
      grossTonnage: 40120,
      deadweightTonnage: 62200,
      yearBuilt: 2011,
      status: 'maintenance',
      notes: 'Seeded demo cargo ship.',
    },
    {
      shipName: 'MV Northern Trade',
      shipCode: 'SHIP-004',
      imoNumber: '9301004',
      mmsiNumber: '533100004',
      flagState: 'Liberia',
      callSign: 'D5NT4',
      cargoType: 'Ro-Ro Cargo',
      grossTonnage: 28750,
      deadweightTonnage: 36500,
      yearBuilt: 2018,
      status: 'active',
      notes: 'Seeded demo cargo ship.',
    },
    {
      shipName: 'MV Eastern Freighter',
      shipCode: 'SHIP-005',
      imoNumber: '9301005',
      mmsiNumber: '533100005',
      flagState: 'Hong Kong',
      callSign: 'VRQF5',
      cargoType: 'Heavy Lift Cargo',
      grossTonnage: 35640,
      deadweightTonnage: 48900,
      yearBuilt: 2015,
      status: 'inactive',
      notes: 'Seeded demo cargo ship.',
    },
  ]

  for (const ship of dummyShips) {
    const [existingShip] = await db.query('SELECT Id FROM Ships WHERE ShipCode = ? OR ImoNumber = ?', [
      ship.shipCode,
      ship.imoNumber,
    ])

    if (existingShip.length === 0) {
      await db.query(
        `
          INSERT INTO Ships (
            ShipName,
            ShipCode,
            ImoNumber,
            MmsiNumber,
            FlagState,
            CallSign,
            CargoType,
            GrossTonnage,
            DeadweightTonnage,
            YearBuilt,
            Status,
            Notes
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [
          ship.shipName,
          ship.shipCode,
          ship.imoNumber,
          ship.mmsiNumber,
          ship.flagState,
          ship.callSign,
          ship.cargoType,
          ship.grossTonnage,
          ship.deadweightTonnage,
          ship.yearBuilt,
          ship.status,
          ship.notes,
        ],
      )
    }
  }
}
