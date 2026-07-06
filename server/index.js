import dotenv from 'dotenv'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import bcrypt from 'bcryptjs'
import cors from 'cors'
import express from 'express'

import { authenticate, generateToken, requireRole } from './auth.js'
import { getPool, initializeDatabase } from './db.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

dotenv.config({ path: path.resolve(__dirname, '.env') })

const app = express()
const port = Number(process.env.API_PORT || 3001)

app.use(cors())
app.use(express.json({ limit: '10mb' }))

const getIpAddress = (req) => {
  const forwardedFor = req.headers['x-forwarded-for']
  if (typeof forwardedFor === 'string' && forwardedFor.length > 0) {
    return forwardedFor.split(',')[0].trim()
  }

  return req.ip || null
}

const logAuditEvent = async ({ req, action, entityType, entityId = null, details = null }) => {
  try {
    const pool = await getPool()
    await pool.query(
      `
        INSERT INTO AuditLogs (
          ActorUserId,
          ActorUsername,
          Action,
          EntityType,
          EntityId,
          Details,
          IpAddress,
          UserAgent
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        req.user?.id || null,
        req.user?.username || 'system',
        action,
        entityType,
        entityId === null ? null : String(entityId),
        details,
        getIpAddress(req),
        req.headers['user-agent'] || null,
      ],
    )
  } catch (error) {
    console.error('Failed to write audit log:', error)
  }
}

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' })
})

app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required.' })
  }

  const pool = await getPool()
  const [rows] = await pool.query(
    'SELECT Id, Username, PasswordHash, Role FROM Users WHERE Username = ?',
    [username],
  )

  const user = rows[0]
  if (!user) {
    return res.status(401).json({ error: 'Invalid credentials.' })
  }

  const validPassword = await bcrypt.compare(password, user.PasswordHash)
  if (!validPassword) {
    return res.status(401).json({ error: 'Invalid credentials.' })
  }

  const token = generateToken({
    id: user.Id,
    username: user.Username,
    role: user.Role,
  })

  return res.json({
    token,
    user: {
      id: user.Id,
      username: user.Username,
      role: user.Role,
    },
  })
})

app.get('/api/users', authenticate, requireRole(['admin', 'superadmin']), async (_req, res) => {
  const pool = await getPool()
  const [rows] = await pool.query(
    'SELECT Id AS id, Username AS username, Role AS role, CreatedAt AS createdAt FROM Users',
  )

  res.json(rows)
})

app.get('/api/ships', authenticate, requireRole(['admin', 'superadmin']), async (_req, res) => {
  const pool = await getPool()
  const [rows] = await pool.query(`
    SELECT
      Id AS id,
      ShipName AS shipName,
      ShipCode AS shipCode,
      ImoNumber AS imoNumber,
      MmsiNumber AS mmsiNumber,
      FlagState AS flagState,
      CallSign AS callSign,
      CargoType AS cargoType,
      GrossTonnage AS grossTonnage,
      DeadweightTonnage AS deadweightTonnage,
      YearBuilt AS yearBuilt,
      Status AS status,
      Notes AS notes,
      CreatedAt AS createdAt
    FROM Ships
    ORDER BY ShipName ASC
  `)

  return res.json(rows)
})

app.post('/api/ships', authenticate, requireRole(['admin', 'superadmin']), async (req, res) => {
  const {
    shipName,
    shipCode,
    imoNumber,
    mmsiNumber,
    flagState,
    callSign,
    cargoType,
    grossTonnage,
    deadweightTonnage,
    yearBuilt,
    status,
    notes,
  } = req.body

  if (!shipName || !shipCode || !imoNumber || !flagState || !cargoType) {
    return res.status(400).json({
      error: 'shipName, shipCode, imoNumber, flagState, and cargoType are required.',
    })
  }

  const pool = await getPool()
  const [existing] = await pool.query('SELECT Id FROM Ships WHERE ShipCode = ? OR ImoNumber = ?', [
    shipCode,
    imoNumber,
  ])

  if (existing.length > 0) {
    return res.status(409).json({ error: 'Ship code or IMO number already exists.' })
  }

  const [result] = await pool.query(
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
      shipName,
      shipCode,
      imoNumber,
      mmsiNumber || null,
      flagState,
      callSign || null,
      cargoType,
      grossTonnage || null,
      deadweightTonnage || null,
      yearBuilt || null,
      status || 'active',
      notes || null,
    ],
  )

  await logAuditEvent({
    req,
    action: 'create',
    entityType: 'ship',
    entityId: result.insertId,
    details: {
      shipName,
      shipCode,
      imoNumber,
      status: status || 'active',
    },
  })

  return res.status(201).json({ message: 'Ship registered successfully.' })
})

app.put('/api/ships/:id', authenticate, requireRole(['admin', 'superadmin']), async (req, res) => {
  const shipId = Number(req.params.id)
  const {
    shipName,
    shipCode,
    imoNumber,
    mmsiNumber,
    flagState,
    callSign,
    cargoType,
    grossTonnage,
    deadweightTonnage,
    yearBuilt,
    status,
    notes,
  } = req.body

  if (!Number.isInteger(shipId)) {
    return res.status(400).json({ error: 'Invalid ship ID.' })
  }

  if (!shipName || !shipCode || !imoNumber || !flagState || !cargoType) {
    return res.status(400).json({
      error: 'shipName, shipCode, imoNumber, flagState, and cargoType are required.',
    })
  }

  const pool = await getPool()
  const [existingShipRows] = await pool.query('SELECT Id FROM Ships WHERE Id = ?', [shipId])
  if (existingShipRows.length === 0) {
    return res.status(404).json({ error: 'Ship not found.' })
  }

  const [duplicates] = await pool.query(
    'SELECT Id FROM Ships WHERE (ShipCode = ? OR ImoNumber = ?) AND Id <> ?',
    [shipCode, imoNumber, shipId],
  )

  if (duplicates.length > 0) {
    return res.status(409).json({ error: 'Ship code or IMO number already exists.' })
  }

  const [result] = await pool.query(
    `
      UPDATE Ships
      SET
        ShipName = ?,
        ShipCode = ?,
        ImoNumber = ?,
        MmsiNumber = ?,
        FlagState = ?,
        CallSign = ?,
        CargoType = ?,
        GrossTonnage = ?,
        DeadweightTonnage = ?,
        YearBuilt = ?,
        Status = ?,
        Notes = ?
      WHERE Id = ?
    `,
    [
      shipName,
      shipCode,
      imoNumber,
      mmsiNumber || null,
      flagState,
      callSign || null,
      cargoType,
      grossTonnage || null,
      deadweightTonnage || null,
      yearBuilt || null,
      status || 'active',
      notes || null,
      shipId,
    ],
  )

  if (result.affectedRows === 0) {
    return res.status(404).json({ error: 'Ship not found.' })
  }

  await logAuditEvent({
    req,
    action: 'update',
    entityType: 'ship',
    entityId: shipId,
    details: {
      shipName,
      shipCode,
      imoNumber,
      status: status || 'active',
    },
  })

  return res.json({ message: 'Ship updated successfully.' })
})

app.post('/api/users', authenticate, requireRole(['admin', 'superadmin']), async (req, res) => {
  const { username, password, role } = req.body

  if (!username || !password || !role) {
    return res.status(400).json({ error: 'Username, password, and role are required.' })
  }

  if (!['superadmin', 'admin', 'user'].includes(role)) {
    return res.status(400).json({ error: 'Role must be superadmin, admin or user.' })
  }

  if (req.user.role !== 'superadmin' && role === 'superadmin') {
    return res.status(403).json({ error: 'Only superadmin can create superadmin users.' })
  }

  const pool = await getPool()
  const [existing] = await pool.query('SELECT Id FROM Users WHERE Username = ?', [username])

  if (existing.length > 0) {
    return res.status(409).json({ error: 'Username already exists.' })
  }

  const passwordHash = await bcrypt.hash(password, 10)
  const [result] = await pool.query('INSERT INTO Users (Username, PasswordHash, Role) VALUES (?, ?, ?)', [
    username,
    passwordHash,
    role,
  ])

  await logAuditEvent({
    req,
    action: 'create',
    entityType: 'user',
    entityId: result.insertId,
    details: {
      username,
      role,
    },
  })

  return res.status(201).json({ message: 'User created.' })
})

app.put('/api/users/:id/role', authenticate, requireRole(['admin', 'superadmin']), async (req, res) => {
  const userId = Number(req.params.id)
  const { role } = req.body

  if (!Number.isInteger(userId)) {
    return res.status(400).json({ error: 'Invalid user ID.' })
  }

  if (!['superadmin', 'admin', 'user'].includes(role)) {
    return res.status(400).json({ error: 'Role must be superadmin, admin or user.' })
  }

  if (req.user.role !== 'superadmin' && role === 'superadmin') {
    return res.status(403).json({ error: 'Only superadmin can assign superadmin role.' })
  }

  const pool = await getPool()

  const [targetUsers] = await pool.query('SELECT Id, Role FROM Users WHERE Id = ?', [userId])
  const targetUser = targetUsers[0]
  if (!targetUser) {
    return res.status(404).json({ error: 'User not found.' })
  }

  if (req.user.role !== 'superadmin' && targetUser.Role === 'superadmin') {
    return res.status(403).json({ error: 'Only superadmin can modify another superadmin.' })
  }

  const [result] = await pool.query('UPDATE Users SET Role = ? WHERE Id = ?', [role, userId])

  if (result.affectedRows === 0) {
    return res.status(404).json({ error: 'User not found.' })
  }

  await logAuditEvent({
    req,
    action: 'update-role',
    entityType: 'user',
    entityId: userId,
    details: {
      previousRole: targetUser.Role,
      newRole: role,
    },
  })

  return res.json({ message: 'Role updated.' })
})

app.post('/api/forms', authenticate, async (req, res) => {
  const { fullName, icPassportNumber, imageBase64 } = req.body

  if (!fullName || !icPassportNumber || !imageBase64) {
    return res.status(400).json({ error: 'fullName, icPassportNumber, and imageBase64 are required.' })
  }

  const pool = await getPool()
  const [result] = await pool.query(
    'INSERT INTO FormSubmissions (FullName, IcPassportNumber, ImageBase64, SubmittedByUserId) VALUES (?, ?, ?, ?)',
    [fullName, icPassportNumber, imageBase64, req.user.id],
  )

  await logAuditEvent({
    req,
    action: 'create',
    entityType: 'form-submission',
    entityId: result.insertId,
    details: {
      fullName,
      icPassportNumber,
    },
  })

  return res.status(201).json({ message: 'Form submitted.' })
})

app.get('/api/forms', authenticate, async (req, res) => {
  const pool = await getPool()
  let rows

  if (['admin', 'superadmin'].includes(req.user.role)) {
    ;[rows] = await pool.query(`
      SELECT
        fs.Id AS id,
        fs.FullName AS fullName,
        fs.IcPassportNumber AS icPassportNumber,
        fs.ImageBase64 AS imageBase64,
        u.Username AS submittedBy,
        fs.CreatedAt AS createdAt
      FROM FormSubmissions fs
      INNER JOIN Users u ON fs.SubmittedByUserId = u.Id
      ORDER BY fs.CreatedAt DESC
    `)
  } else {
    ;[rows] = await pool.query(
      `
        SELECT
          fs.Id AS id,
          fs.FullName AS fullName,
          fs.IcPassportNumber AS icPassportNumber,
          fs.ImageBase64 AS imageBase64,
          u.Username AS submittedBy,
          fs.CreatedAt AS createdAt
        FROM FormSubmissions fs
        INNER JOIN Users u ON fs.SubmittedByUserId = u.Id
        WHERE fs.SubmittedByUserId = ?
        ORDER BY fs.CreatedAt DESC
      `,
      [req.user.id],
    )
  }

  return res.json(rows)
})

app.get('/api/batch-candidates', authenticate, requireRole(['admin', 'superadmin']), async (_req, res) => {
  const pool = await getPool()
  const [rows] = await pool.query(`
    SELECT
      fs.Id AS id,
      fs.FullName AS fullName,
      fs.IcPassportNumber AS icPassportNumber,
      fs.ImageBase64 AS imageBase64,
      u.Username AS submittedBy,
      fs.CreatedAt AS createdAt
    FROM FormSubmissions fs
    INNER JOIN Users u ON u.Id = fs.SubmittedByUserId
    ORDER BY fs.CreatedAt DESC
  `)

  return res.json(rows)
})

app.post('/api/batches', authenticate, requireRole(['admin', 'superadmin']), async (req, res) => {
  const { batchName, shipId, expiryDate, submissionIds } = req.body

  if (!batchName || !shipId || !expiryDate || !Array.isArray(submissionIds) || submissionIds.length === 0) {
    return res.status(400).json({ error: 'batchName, shipId, expiryDate, and submissionIds are required.' })
  }

  const normalizedShipId = Number(shipId)
  if (!Number.isInteger(normalizedShipId)) {
    return res.status(400).json({ error: 'shipId must be a valid ship ID.' })
  }

  const normalizedSubmissionIds = [...new Set(submissionIds.map((value) => Number(value)).filter(Number.isInteger))]
  if (normalizedSubmissionIds.length === 0) {
    return res.status(400).json({ error: 'At least one valid submitted user must be selected.' })
  }

  const expiry = new Date(expiryDate)
  if (Number.isNaN(expiry.getTime())) {
    return res.status(400).json({ error: 'expiryDate must be a valid date.' })
  }

  const pool = await getPool()
  const connection = await pool.getConnection()

  try {
    await connection.beginTransaction()

    const placeholders = normalizedSubmissionIds.map(() => '?').join(', ')
    const [submissionsRows] = await connection.query(
      `SELECT Id FROM FormSubmissions WHERE Id IN (${placeholders})`,
      normalizedSubmissionIds,
    )

    if (submissionsRows.length !== normalizedSubmissionIds.length) {
      await connection.rollback()
      return res.status(400).json({ error: 'One or more selected submitted users were not found.' })
    }

    const [shipRows] = await connection.query('SELECT Id FROM Ships WHERE Id = ?', [normalizedShipId])
    if (shipRows.length === 0) {
      await connection.rollback()
      return res.status(400).json({ error: 'Selected ship was not found.' })
    }

    const [batchResult] = await connection.query(
      'INSERT INTO BatchGroups (BatchName, ShipId, ExpiryDate, CreatedByUserId) VALUES (?, ?, ?, ?)',
      [batchName, normalizedShipId, expiry, req.user.id],
    )

    const batchGroupId = batchResult.insertId

    for (const submissionId of normalizedSubmissionIds) {
      await connection.query(
        'INSERT INTO BatchGroupMembers (BatchGroupId, FormSubmissionId) VALUES (?, ?)',
        [batchGroupId, submissionId],
      )
    }

    await connection.commit()

    await logAuditEvent({
      req,
      action: 'create',
      entityType: 'batch-group',
      entityId: batchGroupId,
      details: {
        batchName,
        shipId: normalizedShipId,
        expiryDate,
        memberCount: normalizedSubmissionIds.length,
      },
    })

    return res.status(201).json({ message: 'Batch group created.', id: batchGroupId })
  } catch (error) {
    await connection.rollback()
    return res.status(500).json({ error: error.message || 'Failed to create batch group.' })
  } finally {
    connection.release()
  }
})

app.get('/api/batches', authenticate, requireRole(['admin', 'superadmin']), async (req, res) => {
  const status = String(req.query.status || 'active').toLowerCase()
  let statusFilter = ''

  if (status === 'expired' || status === 'historical') {
    statusFilter = 'WHERE bg.ExpiryDate < UTC_TIMESTAMP()'
  } else if (status === 'all') {
    statusFilter = ''
  } else {
    statusFilter = 'WHERE bg.ExpiryDate >= UTC_TIMESTAMP()'
  }

  const pool = await getPool()
  const [rows] = await pool.query(`
    SELECT
      bg.Id AS id,
      bg.BatchName AS batchName,
      bg.ShipId AS shipId,
      ship.ShipName AS shipName,
      ship.ShipCode AS shipCode,
      bg.ExpiryDate AS expiryDate,
      bg.CreatedAt AS createdAt,
      creator.Username AS createdBy,
      COUNT(bgm.FormSubmissionId) AS memberCount,
      GROUP_CONCAT(CONCAT(fs.FullName, ' (', fs.IcPassportNumber, ')') ORDER BY fs.FullName SEPARATOR ', ') AS memberNames
    FROM BatchGroups bg
    INNER JOIN Users creator ON creator.Id = bg.CreatedByUserId
    LEFT JOIN Ships ship ON ship.Id = bg.ShipId
    INNER JOIN BatchGroupMembers bgm ON bgm.BatchGroupId = bg.Id
    INNER JOIN FormSubmissions fs ON fs.Id = bgm.FormSubmissionId
    ${statusFilter}
    GROUP BY bg.Id, bg.BatchName, bg.ShipId, ship.ShipName, ship.ShipCode, bg.ExpiryDate, bg.CreatedAt, creator.Username
    ORDER BY
      CASE WHEN bg.ExpiryDate >= UTC_TIMESTAMP() THEN 0 ELSE 1 END,
      bg.ExpiryDate ASC,
      bg.CreatedAt DESC
  `)

  return res.json(
    rows.map((row) => ({
      ...row,
      isActive: new Date(row.expiryDate) >= new Date(),
    })),
  )
})

app.get('/api/batches/:id', authenticate, requireRole(['admin', 'superadmin']), async (req, res) => {
  const batchId = Number(req.params.id)
  if (!Number.isInteger(batchId)) {
    return res.status(400).json({ error: 'Invalid batch ID.' })
  }

  const pool = await getPool()
  const [batchRows] = await pool.query(
    `
      SELECT
        bg.Id AS id,
        bg.BatchName AS batchName,
        bg.ShipId AS shipId,
        ship.ShipName AS shipName,
        ship.ShipCode AS shipCode,
        bg.ExpiryDate AS expiryDate,
        bg.CreatedAt AS createdAt,
        creator.Username AS createdBy
      FROM BatchGroups bg
      INNER JOIN Users creator ON creator.Id = bg.CreatedByUserId
      LEFT JOIN Ships ship ON ship.Id = bg.ShipId
      WHERE bg.Id = ?
    `,
    [batchId],
  )

  const batch = batchRows[0]
  if (!batch) {
    return res.status(404).json({ error: 'Batch group not found.' })
  }

  const [members] = await pool.query(
    `
      SELECT
        fs.Id AS id,
        fs.FullName AS fullName,
        fs.IcPassportNumber AS icPassportNumber,
        fs.ImageBase64 AS imageBase64,
        fs.CreatedAt AS createdAt,
        u.Username AS submittedBy
      FROM BatchGroupMembers bgm
      INNER JOIN FormSubmissions fs ON fs.Id = bgm.FormSubmissionId
      INNER JOIN Users u ON u.Id = fs.SubmittedByUserId
      WHERE bgm.BatchGroupId = ?
      ORDER BY fs.FullName ASC
    `,
    [batchId],
  )

  return res.json({
    ...batch,
    isActive: new Date(batch.expiryDate) >= new Date(),
    members,
  })
})

app.put('/api/batches/:id', authenticate, requireRole(['admin', 'superadmin']), async (req, res) => {
  const batchId = Number(req.params.id)
  const { batchName, shipId, expiryDate, submissionIds } = req.body

  if (!Number.isInteger(batchId)) {
    return res.status(400).json({ error: 'Invalid batch ID.' })
  }

  if (!batchName || !shipId || !expiryDate || !Array.isArray(submissionIds) || submissionIds.length === 0) {
    return res.status(400).json({ error: 'batchName, shipId, expiryDate, and submissionIds are required.' })
  }

  const normalizedShipId = Number(shipId)
  if (!Number.isInteger(normalizedShipId)) {
    return res.status(400).json({ error: 'shipId must be a valid ship ID.' })
  }

  const normalizedSubmissionIds = [...new Set(submissionIds.map((value) => Number(value)).filter(Number.isInteger))]
  if (normalizedSubmissionIds.length === 0) {
    return res.status(400).json({ error: 'At least one valid submitted user must be selected.' })
  }

  const expiry = new Date(expiryDate)
  if (Number.isNaN(expiry.getTime())) {
    return res.status(400).json({ error: 'expiryDate must be a valid date.' })
  }

  const pool = await getPool()
  const connection = await pool.getConnection()

  try {
    await connection.beginTransaction()

    const [existingRows] = await connection.query('SELECT Id FROM BatchGroups WHERE Id = ?', [batchId])
    if (existingRows.length === 0) {
      await connection.rollback()
      return res.status(404).json({ error: 'Batch group not found.' })
    }

    const placeholders = normalizedSubmissionIds.map(() => '?').join(', ')
    const [submissionRows] = await connection.query(
      `SELECT Id FROM FormSubmissions WHERE Id IN (${placeholders})`,
      normalizedSubmissionIds,
    )

    if (submissionRows.length !== normalizedSubmissionIds.length) {
      await connection.rollback()
      return res.status(400).json({ error: 'One or more selected submitted users were not found.' })
    }

    const [shipRows] = await connection.query('SELECT Id FROM Ships WHERE Id = ?', [normalizedShipId])
    if (shipRows.length === 0) {
      await connection.rollback()
      return res.status(400).json({ error: 'Selected ship was not found.' })
    }

    await connection.query(
      'UPDATE BatchGroups SET BatchName = ?, ShipId = ?, ExpiryDate = ? WHERE Id = ?',
      [batchName, normalizedShipId, expiry, batchId],
    )

    await connection.query('DELETE FROM BatchGroupMembers WHERE BatchGroupId = ?', [batchId])

    for (const submissionId of normalizedSubmissionIds) {
      await connection.query(
        'INSERT INTO BatchGroupMembers (BatchGroupId, FormSubmissionId) VALUES (?, ?)',
        [batchId, submissionId],
      )
    }

    await connection.commit()

    await logAuditEvent({
      req,
      action: 'update',
      entityType: 'batch-group',
      entityId: batchId,
      details: {
        batchName,
        shipId: normalizedShipId,
        expiryDate,
        memberCount: normalizedSubmissionIds.length,
      },
    })

    return res.json({ message: 'Batch group updated.' })
  } catch (error) {
    await connection.rollback()
    return res.status(500).json({ error: error.message || 'Failed to update batch group.' })
  } finally {
    connection.release()
  }
})

app.delete('/api/batches/:id', authenticate, requireRole(['admin', 'superadmin']), async (req, res) => {
  const batchId = Number(req.params.id)
  if (!Number.isInteger(batchId)) {
    return res.status(400).json({ error: 'Invalid batch ID.' })
  }

  const pool = await getPool()
  const connection = await pool.getConnection()

  try {
    await connection.beginTransaction()

    const [existingRows] = await connection.query('SELECT Id FROM BatchGroups WHERE Id = ?', [batchId])
    if (existingRows.length === 0) {
      await connection.rollback()
      return res.status(404).json({ error: 'Batch group not found.' })
    }

    await connection.query('DELETE FROM BatchGroupMembers WHERE BatchGroupId = ?', [batchId])
    await connection.query('DELETE FROM BatchGroups WHERE Id = ?', [batchId])

    await connection.commit()

    await logAuditEvent({
      req,
      action: 'delete',
      entityType: 'batch-group',
      entityId: batchId,
    })

    return res.json({ message: 'Batch group removed.' })
  } catch (error) {
    await connection.rollback()
    return res.status(500).json({ error: error.message || 'Failed to remove batch group.' })
  } finally {
    connection.release()
  }
})

const start = async () => {
  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET is required in environment variables.')
  }

  await initializeDatabase()

  app.listen(port, () => {
    console.log(`API server running on port ${port}`)
  })
}

start().catch((error) => {
  console.error('Failed to start API:', error)
  process.exit(1)
})
