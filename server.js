'use strict';
const express = require('express');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { Pool } = require('pg');
const path = require('path');

const app = express();
const PORT = Number(process.env.PORT || 3000);
const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('DATABASE_URL is missing. Add a Railway PostgreSQL service and attach its DATABASE_URL variable.');
  process.exit(1);
}
const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: /localhost|127\.0\.0\.1/.test(DATABASE_URL) ? false : { rejectUnauthorized: false },
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000
});

app.disable('x-powered-by');
app.set('trust proxy', 1); // Railway runs behind a proxy.
app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json({ limit: '32kb' }));
app.use('/api/', rateLimit({ windowMs: 15 * 60 * 1000, limit: 180, standardHeaders: 'draft-7', legacyHeaders: false }));
app.use(express.static(path.join(__dirname, 'public'), { dotfiles: 'ignore' }));

const seedPros = [
  {id:1,name:'Tobi Akin',role:'Cinematographer',category:'Camera',location:'Lagos',rate:180000,rating:4.9,credits:'8 years experience',desc:'Visual storytelling for commercials, music videos and branded films.',skills:['Commercials','Music videos','Lighting']},
  {id:2,name:'Mariam Okafor',role:'Film & Video Editor',category:'Editing',location:'Lagos',rate:120000,rating:4.8,credits:'6 years experience',desc:'Fast-paced edits, storytelling, social cuts and finishing.',skills:['Premiere Pro','DaVinci Resolve','Social cuts']},
  {id:3,name:'Chidi Nwosu',role:'Production Manager',category:'Production',location:'Lagos',rate:150000,rating:4.9,credits:'10 years experience',desc:'Budgets, schedules, crew coordination and on-set logistics.',skills:['Scheduling','Budgeting','Logistics']},
  {id:4,name:'Femi Balogun',role:'Gaffer / Lighting Technician',category:'Lighting',location:'Lagos',rate:95000,rating:4.8,credits:'7 years experience',desc:'Lighting plans, grip coordination and practical on-set execution.',skills:['LED lighting','Grip','Studio']},
  {id:5,name:'Adaeze Eze',role:'Production Sound Mixer',category:'Sound',location:'Abuja',rate:100000,rating:4.7,credits:'6 years experience',desc:'Location sound recording, dialogue and audio equipment management.',skills:['Boom op','Wireless','Location sound']},
  {id:6,name:'Zainab Yusuf',role:'Makeup & Creative Artist',category:'Creative',location:'Lagos',rate:70000,rating:4.9,credits:'4 years experience',desc:'Camera-ready makeup and creative looks for talent and campaigns.',skills:['Beauty','Editorial','Set-ready']}
];

async function initDb() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS professionals (
      id INTEGER PRIMARY KEY,
      name VARCHAR(120) NOT NULL,
      role VARCHAR(120) NOT NULL,
      category VARCHAR(80) NOT NULL,
      location VARCHAR(120) NOT NULL,
      daily_rate BIGINT NOT NULL CHECK (daily_rate >= 0),
      rating NUMERIC(2,1) NOT NULL DEFAULT 0,
      credits VARCHAR(160) NOT NULL DEFAULT '',
      description TEXT NOT NULL DEFAULT '',
      skills JSONB NOT NULL DEFAULT '[]'::jsonb,
      active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS bookings (
      id BIGSERIAL PRIMARY KEY,
      reference VARCHAR(40) UNIQUE NOT NULL,
      professional_id INTEGER NOT NULL REFERENCES professionals(id),
      client_name VARCHAR(120) NOT NULL,
      client_email VARCHAR(254) NOT NULL,
      project_type VARCHAR(80) NOT NULL,
      booking_unit VARCHAR(12) NOT NULL CHECK (booking_unit IN ('full','half')),
      start_date DATE NOT NULL,
      end_date DATE NOT NULL,
      project_location VARCHAR(180) NOT NULL,
      proposed_overtime_terms VARCHAR(1000) NOT NULL DEFAULT '',
      overtime_agreed BOOLEAN NOT NULL DEFAULT FALSE,
      project_brief TEXT NOT NULL,
      days NUMERIC(6,2) NOT NULL,
      base_amount BIGINT NOT NULL,
      client_fee BIGINT NOT NULL,
      crew_commission BIGINT NOT NULL,
      client_total BIGINT NOT NULL,
      crew_net BIGINT NOT NULL,
      agency_gross BIGINT NOT NULL,
      status VARCHAR(40) NOT NULL DEFAULT 'awaiting_review',
      payment_status VARCHAR(40) NOT NULL DEFAULT 'not_configured',
      payout_status VARCHAR(40) NOT NULL DEFAULT 'not_eligible',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS crew_applications (
      id BIGSERIAL PRIMARY KEY,
      full_name VARCHAR(120) NOT NULL,
      email VARCHAR(254) NOT NULL,
      role VARCHAR(100) NOT NULL,
      location VARCHAR(120) NOT NULL,
      portfolio_url TEXT NOT NULL DEFAULT '',
      bio TEXT NOT NULL,
      status VARCHAR(40) NOT NULL DEFAULT 'pending_review',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS bookings_created_at_idx ON bookings(created_at DESC);
    CREATE INDEX IF NOT EXISTS bookings_status_idx ON bookings(status);
    CREATE INDEX IF NOT EXISTS applications_created_at_idx ON crew_applications(created_at DESC);
  `);
  for (const p of seedPros) {
    await pool.query(`INSERT INTO professionals
      (id,name,role,category,location,daily_rate,rating,credits,description,skills)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb)
      ON CONFLICT (id) DO NOTHING`,
      [p.id,p.name,p.role,p.category,p.location,p.rate,p.rating,p.credits,p.desc,JSON.stringify(p.skills)]);
  }
}
function cleanString(value, max, field, {required=true}={}) {
  if (typeof value !== 'string') throw Object.assign(new Error(`${field} must be text.`), {status:400});
  const v = value.trim();
  if (required && !v) throw Object.assign(new Error(`${field} is required.`), {status:400});
  if (v.length > max) throw Object.assign(new Error(`${field} must be ${max} characters or fewer.`), {status:400});
  return v;
}
function validEmail(value) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value); }
function validDate(value) { return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value+'T00:00:00Z')) && new Date(value+'T00:00:00Z').toISOString().slice(0,10) === value; }
function dayCount(start, end) { return Math.floor((Date.parse(end+'T00:00:00Z') - Date.parse(start+'T00:00:00Z')) / 86400000) + 1; }
function nairaRound(n) { return Math.round(Number(n)); }
function adminOnly(req,res,next) {
  const expected = process.env.CMA_ADMIN_TOKEN;
  if (!expected) return res.status(503).json({error:'Admin API disabled: configure CMA_ADMIN_TOKEN in Railway Variables.'});
  const supplied = req.get('x-admin-token') || '';
  if (supplied.length !== expected.length || !require('crypto').timingSafeEqual(Buffer.from(supplied), Buffer.from(expected))) return res.status(401).json({error:'Unauthorized'});
  next();
}

app.get('/api/health', async (_req,res) => {
  try { await pool.query('SELECT 1'); res.json({ok:true, service:'crew-management-agency', database:'connected', paymentsEnabled: process.env.PAYMENTS_ENABLED === 'true'}); }
  catch (e) { res.status(503).json({ok:false,database:'unavailable'}); }
});
app.get('/api/config', (_req,res) => res.json({currency:'NGN',clientFeePercent:10,crewCommissionPercent:10,paymentsEnabled:process.env.PAYMENTS_ENABLED === 'true',paymentProvider:'Bachs.io (not connected)',payoutPolicy:'After project completion; subject to provider capability and dispute rules'}));
app.get('/api/professionals', async (req,res,next) => {
  try {
    const {category,location,q} = req.query;
    const result = await pool.query(`SELECT id,name,role,category,location,daily_rate AS rate,rating,credits,description AS "desc",skills
      FROM professionals WHERE active=TRUE AND ($1::text IS NULL OR category=$1) AND ($2::text IS NULL OR location=$2)
      AND ($3::text IS NULL OR (name || ' ' || role || ' ' || category || ' ' || description) ILIKE '%' || $3 || '%') ORDER BY id`,
      [category || null, location || null, q || null]);
    res.json({professionals:result.rows});
  } catch(e) { next(e); }
});
app.post('/api/bookings', async (req,res,next) => {
  try {
    const b = req.body || {};
    const professionalId = Number(b.professionalId);
    if (!Number.isSafeInteger(professionalId) || professionalId < 1) return res.status(400).json({error:'A valid professionalId is required.'});
    const clientName = cleanString(b.clientName,120,'Client name');
    const clientEmail = cleanString(b.clientEmail,254,'Client email');
    if (!validEmail(clientEmail)) return res.status(400).json({error:'Enter a valid email address.'});
    const projectType = cleanString(b.projectType,80,'Project type');
    const bookingUnit = b.bookingUnit;
    if (!['full','half'].includes(bookingUnit)) return res.status(400).json({error:'Booking type must be full or half.'});
    const startDate = b.startDate;
    const endDate = bookingUnit === 'half' ? startDate : b.endDate;
    if (!validDate(startDate) || !validDate(endDate) || endDate < startDate) return res.status(400).json({error:'Choose valid start and end dates; end date must not be before start date.'});
    const days = bookingUnit === 'half' ? 0.5 : dayCount(startDate,endDate);
    if (days > 60) return res.status(400).json({error:'A single booking cannot exceed 60 calendar days in this test version.'});
    const projectLocation = cleanString(b.projectLocation,180,'Production location');
    const overtimeTerms = cleanString(b.overtimeTerms || '',1000,'Overtime terms',{required:false});
    const brief = cleanString(b.brief,8000,'Project brief');
    const proResult = await pool.query('SELECT id,name,role,daily_rate FROM professionals WHERE id=$1 AND active=TRUE',[professionalId]);
    if (!proResult.rowCount) return res.status(404).json({error:'Professional not found or inactive.'});
    const p = proResult.rows[0];
    const base = nairaRound(Number(p.daily_rate) * days);
    const clientFee = nairaRound(base * 0.10);
    const crewCommission = nairaRound(base * 0.10);
    const clientTotal = base + clientFee;
    const crewNet = base - crewCommission;
    const agencyGross = clientFee + crewCommission;
    const reference = 'CMA-' + require('crypto').randomBytes(5).toString('hex').toUpperCase();
    const saved = await pool.query(`INSERT INTO bookings
      (reference,professional_id,client_name,client_email,project_type,booking_unit,start_date,end_date,project_location,proposed_overtime_terms,project_brief,days,base_amount,client_fee,crew_commission,client_total,crew_net,agency_gross)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
      RETURNING reference,status,payment_status,payout_status,days,base_amount,client_fee,crew_commission,client_total,crew_net,agency_gross,created_at`,
      [reference,professionalId,clientName,clientEmail,projectType,bookingUnit,startDate,endDate,projectLocation,overtimeTerms,brief,days,base,clientFee,crewCommission,clientTotal,crewNet,agencyGross]);
    res.status(201).json({message:'Booking request saved. This is not a confirmed booking and no payment has been taken.',booking:{...saved.rows[0],professionalName:p.name,professionalRole:p.role,bookingUnit,startDate,endDate,projectLocation,overtimeTerms},paymentsEnabled:process.env.PAYMENTS_ENABLED === 'true'});
  } catch(e) { next(e); }
});
app.post('/api/crew-applications', async (req,res,next) => {
  try {
    const b=req.body||{};
    const name=cleanString(b.name,120,'Full name');
    const email=cleanString(b.email,254,'Email');
    if(!validEmail(email)) return res.status(400).json({error:'Enter a valid email address.'});
    const role=cleanString(b.role,100,'Primary role');
    const location=cleanString(b.location,120,'Base location');
    const portfolio=cleanString(b.portfolio || '',1000,'Portfolio URL',{required:false});
    if(portfolio && !/^https:\/\//i.test(portfolio)) return res.status(400).json({error:'Portfolio link must start with https://'});
    const bio=cleanString(b.bio,5000,'Skills and experience');
    const saved=await pool.query(`INSERT INTO crew_applications(full_name,email,role,location,portfolio_url,bio) VALUES($1,$2,$3,$4,$5,$6) RETURNING id,status,created_at`,[name,email,role,location,portfolio,bio]);
    res.status(201).json({message:'Crew application received for review.',application:saved.rows[0]});
  } catch(e) { next(e); }
});
// Admin endpoints are intentionally protected by a secret header. Never expose the token in browser code.
app.get('/api/admin/bookings', adminOnly, async (req,res,next) => {
  try { const r=await pool.query(`SELECT b.reference,b.client_name,b.client_email,p.name AS professional_name,p.role,b.project_type,b.booking_unit,b.start_date,b.end_date,b.project_location,b.proposed_overtime_terms,b.overtime_agreed,b.days,b.base_amount,b.client_fee,b.crew_commission,b.client_total,b.crew_net,b.agency_gross,b.status,b.payment_status,b.payout_status,b.created_at FROM bookings b JOIN professionals p ON p.id=b.professional_id ORDER BY b.created_at DESC LIMIT 250`); res.json({bookings:r.rows}); }
  catch(e){next(e);}
});
app.get('/api/admin/applications', adminOnly, async (_req,res,next) => {
  try { const r=await pool.query('SELECT id,full_name,email,role,location,portfolio_url,bio,status,created_at FROM crew_applications ORDER BY created_at DESC LIMIT 250'); res.json({applications:r.rows}); }
  catch(e){next(e);}
});
app.patch('/api/admin/bookings/:reference/status', adminOnly, async (req,res,next) => {
  try {
    const allowed=['awaiting_review','awaiting_terms','confirmed','in_progress','completion_review','completed','disputed','cancelled','refunded'];
    const status=req.body && req.body.status;
    if(!allowed.includes(status)) return res.status(400).json({error:'Invalid status.'});
    const r=await pool.query('UPDATE bookings SET status=$1 WHERE reference=$2 RETURNING reference,status,payment_status,payout_status',[status,req.params.reference]);
    if(!r.rowCount) return res.status(404).json({error:'Booking not found.'});
    res.json({booking:r.rows[0]});
  }catch(e){next(e);}
});
app.use('/api', (_req,res)=>res.status(404).json({error:'API route not found.'}));
app.get('*', (req,res,next) => { if(req.path.startsWith('/api/')) return next(); res.sendFile(path.join(__dirname,'public','index.html')); });
app.use((err,_req,res,_next)=>{
  console.error(err && err.stack ? err.stack : err);
  const status=Number(err.status)||500;
  res.status(status).json({error:status===500?'Server error. Check Railway logs for details.':err.message});
});

initDb().then(()=>{
  app.listen(PORT,'0.0.0.0',()=>console.log(`Crew Management Agency listening on port ${PORT}`));
}).catch(err=>{console.error('Database initialization failed:',err);process.exit(1);});
process.on('SIGTERM',async()=>{await pool.end();process.exit(0);});
