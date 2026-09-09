require("dotenv").config();
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const express = require("express");
const nodemailer = require("nodemailer");
const multer = require("multer");
const { query, init, hasDb } = require("./db");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: "12mb" }));
app.use(express.urlencoded({ extended: false, limit: "12mb" }));
app.use(express.static(__dirname));

const UPLOAD_DIR = path.join("/tmp", "jt-uploads");
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const SECRET = process.env.SECRET || crypto.randomBytes(32).toString("hex");
const ADMIN_USER = process.env.ADMIN_USER || "admin";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "jtcovers2026";
const TOKEN_TTL = 7 * 24 * 3600 * 1000;
const COOKIE = "jt_admin";

const sign = (v) => crypto.createHmac("sha256", SECRET).update(v).digest("hex");
function makeToken() {
  const payload = Buffer.from(JSON.stringify({ u: ADMIN_USER, exp: Date.now() + TOKEN_TTL })).toString("base64");
  return payload + "." + sign(payload);
}
function verifyToken(token) {
  if (!token) return false;
  const [payload, sig] = token.split(".");
  if (!payload || !sig || sign(payload) !== sig) return false;
  try {
    const d = JSON.parse(Buffer.from(payload, "base64").toString());
    return d.u === ADMIN_USER && d.exp > Date.now();
  } catch { return false; }
}
function checkPassword(pw) {
  const a = Buffer.from(String(pw || "").trim());
  const b = Buffer.from(String(ADMIN_PASSWORD || "").trim());
  if (!a.length || a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}
function getCookie(req, name) {
  const c = req.headers.cookie || "";
  const m = c.match(new RegExp("(?:^|;\\s*)" + name + "=([^;]+)"));
  return m ? m[1] : null;
}
function requireAdmin(req, res, next) {
  if (verifyToken(getCookie(req, COOKIE))) return next();
  res.status(401).json({ success: false, error: "Not authenticated" });
}

const ALLOWED = /\.(jpg|jpeg|png|gif|webp)$/i;
const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _f, cb) => cb(null, UPLOAD_DIR),
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase() || ".jpg";
      cb(null, Date.now() + "-" + Math.round(Math.random() * 1e9) + ext);
    },
  }),
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ok = /^image\//.test(file.mimetype) || ALLOWED.test(file.originalname);
    cb(null, ok);
  },
});

const RATE_WINDOW_MS = 15 * 60 * 1000;
const RATE_MAX = 5;
const hits = new Map();
function isRateLimited(ip) {
  const now = Date.now();
  const list = (hits.get(ip) || []).filter((t) => now - t < RATE_WINDOW_MS);
  if (list.length >= RATE_MAX) { hits.set(ip, list); return true; }
  list.push(now);
  hits.set(ip, list);
  return false;
}

function getTransporter() {
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (!user || !pass) return null;
  const host = process.env.SMTP_HOST || "smtp.gmail.com";
  const port = Number(process.env.SMTP_PORT || 465);
  const secure = process.env.SMTP_SECURE ? process.env.SMTP_SECURE === "true" : port === 465;
  return nodemailer.createTransport({
    host, port, secure, auth: { user, pass },
    connectionTimeout: 10000, greetingTimeout: 10000, socketTimeout: 20000,
  });
}

const VALID_SERVICES = new Set(["Custom Cover", "Premade Cover", "Series Branding", "Audiobook & Promo", "Other"]);
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const isValidEmail = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e);

app.get("/api/health", async (_req, res) => {
  if (!hasDb()) return res.json({ ok: true, db: false });
  try {
    await query("SELECT 1 AS ok");
    res.json({ ok: true, db: true });
  } catch (err) {
    console.error("[health]", err.message);
    res.json({ ok: true, db: false, error: err.message });
  }
});

app.get("/media/:id", async (req, res) => {
  try {
    const rows = await query("SELECT mime_type, data FROM media_files WHERE id = $1", [req.params.id]);
    if (!rows.length) return res.status(404).send("Not found");
    const file = rows[0];
    res.setHeader("Content-Type", file.mime_type || "image/jpeg");
    res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
    return res.end(file.data);
  } catch (err) {
    console.error("[media]", err.message);
    return res.status(500).send("Could not load media");
  }
});

app.get("/api/content", async (_req, res) => {
  if (!hasDb()) return res.json({ covers: [], testimonials: [] });
  try {
    const [covers, testimonials] = await Promise.all([
      query("SELECT id, title, author, genre, image FROM covers ORDER BY id DESC"),
      query("SELECT id, image, quote, name, role FROM testimonials ORDER BY id DESC"),
    ]);
    res.json({ covers, testimonials });
  } catch (err) {
    console.error("[content]", err.message);
    res.json({ covers: [], testimonials: [] });
  }
});

app.post("/api/contact", async (req, res) => {
  const ip = (req.headers["x-forwarded-for"] || req.socket.remoteAddress || "unknown").toString().split(",")[0].trim();
  if (isRateLimited(ip)) return res.status(429).json({ success: false, error: "Too many requests. Please try again later." });
  if (req.body && req.body.website && String(req.body.website).length > 0) return res.json({ success: true });

  const name = typeof req.body.name === "string" ? req.body.name.trim() : "";
  const email = typeof req.body.email === "string" ? req.body.email.trim() : "";
  const service = typeof req.body.service === "string" ? req.body.service.trim() : "";
  const subject = typeof req.body.subject === "string" ? req.body.subject.trim() : "";
  const message = typeof req.body.message === "string" ? req.body.message.trim() : "";

  if (name.length < 2) return res.status(400).json({ success: false, error: "Please enter your name." });
  if (!isValidEmail(email)) return res.status(400).json({ success: false, error: "Please enter a valid email." });
  if (!VALID_SERVICES.has(service)) return res.status(400).json({ success: false, error: "Please choose a service." });
  if (subject.length < 2) return res.status(400).json({ success: false, error: "Please enter a book title / subject." });
  if (message.length < 10) return res.status(400).json({ success: false, error: "Please write a longer message." });

  if (hasDb()) {
    try {
      await query(
        "INSERT INTO enquiries (name, email, service, subject, message) VALUES ($1,$2,$3,$4,$5)",
        [name, email, service, subject, message]
      );
    } catch (err) {
      console.error("[contact] save failed:", err.message);
      return res.status(500).json({ success: false, error: "Could not save your enquiry. Please try again." });
    }
  }

  const transporter = getTransporter();
  const toAddress = process.env.MAIL_TO || "joannathompson616@gmail.com";
  const fromAddress = process.env.MAIL_FROM || process.env.SMTP_USER || toAddress;

  if (transporter) {
    const html = `
      <div style="font-family:Arial,sans-serif;max-width:560px;margin:auto">
        <h2>New cover enquiry</h2>
        <p><b>Name:</b> ${esc(name)}<br>
        <b>Email:</b> <a href="mailto:${esc(email)}">${esc(email)}</a><br>
        <b>Service:</b> ${esc(service)}<br>
        <b>Subject:</b> ${esc(subject)}</p>
        <p style="white-space:pre-wrap">${esc(message)}</p>
      </div>`;
    transporter.sendMail({
      from: `"JT Cover Studio" <${fromAddress}>`,
      to: toAddress,
      replyTo: email,
      subject: `Cover enquiry: ${subject}`,
      text: `Name: ${name}\nEmail: ${email}\nService: ${service}\nSubject: ${subject}\n\n${message}`,
      html,
    }).catch((err) => console.error("[contact] email failed:", err.message));
  }

  return res.json({ success: true });
});

app.post("/api/admin/login", (req, res) => {
  const { user, password } = req.body || {};
  if (user === ADMIN_USER && checkPassword(password)) {
    res.setHeader("Set-Cookie", `${COOKIE}=${makeToken()}; HttpOnly; Path=/; SameSite=Lax; Secure; Max-Age=${TOKEN_TTL / 1000}`);
    return res.json({ success: true });
  }
  res.status(401).json({ success: false, error: "Invalid username or password." });
});

app.post("/api/admin/logout", (_req, res) => {
  res.setHeader("Set-Cookie", `${COOKIE}=; HttpOnly; Path=/; Max-Age=0`);
  res.json({ success: true });
});

app.get("/api/admin/check", (req, res) => {
  res.json({ authenticated: verifyToken(getCookie(req, COOKIE)) });
});

app.get("/api/admin/enquiries", requireAdmin, wrap(async (_req, res) => {
  res.json(await query("SELECT * FROM enquiries ORDER BY id DESC"));
}));
app.patch("/api/admin/enquiries/:id", requireAdmin, wrap(async (req, res) => {
  const { status } = req.body || {};
  if (!["new", "read"].includes(status)) return res.status(400).json({ success: false, error: "Invalid status" });
  await query("UPDATE enquiries SET status = $1 WHERE id = $2", [status, req.params.id]);
  res.json({ success: true });
}));
app.delete("/api/admin/enquiries/:id", requireAdmin, wrap(async (req, res) => {
  await query("DELETE FROM enquiries WHERE id = $1", [req.params.id]);
  res.json({ success: true });
}));

function wrap(fn) {
  return async (req, res) => {
    try {
      await fn(req, res);
    } catch (err) {
      console.error("[admin]", err.message);
      if (!res.headersSent) {
        res.status(500).json({ success: false, error: "Database error. Check DATABASE_URL on Render." });
      }
    }
  };
}

function crud(base, table, fields, required) {
  app.get(`/api/admin/${base}`, requireAdmin, wrap(async (_req, res) => {
    res.json(await query(`SELECT * FROM ${table} ORDER BY id DESC`));
  }));
  app.delete(`/api/admin/${base}/:id`, requireAdmin, wrap(async (req, res) => {
    await query(`DELETE FROM ${table} WHERE id = $1`, [req.params.id]);
    res.json({ success: true });
  }));
  app.post(`/api/admin/${base}`, requireAdmin, wrap(async (req, res) => {
    const r = {};
    for (const f of fields) r[f] = req.body[f] !== undefined ? String(req.body[f] ?? "").trim() : "";
    if (!r[required]) return res.status(400).json({ success: false, error: "Please fill the required fields." });
    const ph = fields.map((_, i) => `$${i + 1}`).join(",");
    const rows = await query(`INSERT INTO ${table} (${fields.join(",")}) VALUES (${ph}) RETURNING id`, fields.map((f) => r[f]));
    res.json({ success: true, id: rows[0].id });
  }));
  app.put(`/api/admin/${base}/:id`, requireAdmin, wrap(async (req, res) => {
    const r = {};
    for (const f of fields) r[f] = req.body[f] !== undefined ? String(req.body[f] ?? "").trim() : "";
    if (!r[required]) return res.status(400).json({ success: false, error: "Please fill the required fields." });
    const set = fields.map((f, i) => `${f}=$${i + 1}`).join(",");
    await query(`UPDATE ${table} SET ${set} WHERE id=$${fields.length + 1}`, [...fields.map((f) => r[f]), req.params.id]);
    res.json({ success: true });
  }));
}

crud("covers", "covers", ["title", "author", "genre", "image"], "image");
crud("testimonials", "testimonials", ["image", "quote", "name", "role"], "image");

app.post("/api/admin/upload", requireAdmin, upload.single("file"), async (req, res) => {
  if (!req.file) return res.status(400).json({ success: false, error: "No file uploaded." });
  if (req.file.size > 8 * 1024 * 1024) {
    fs.unlink(req.file.path, () => {});
    return res.status(400).json({ success: false, error: "Images must be smaller than 8 MB." });
  }
  try {
    const data = fs.readFileSync(req.file.path);
    fs.unlinkSync(req.file.path);
    const ext = path.extname(req.file.originalname).toLowerCase();
    const fallback = { ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".gif": "image/gif", ".webp": "image/webp" };
    const mimeType = req.file.mimetype === "application/octet-stream" ? (fallback[ext] || "image/jpeg") : req.file.mimetype;
    const rows = await query(
      "INSERT INTO media_files (mime_type, original_name, data) VALUES ($1,$2,$3) RETURNING id",
      [mimeType, req.file.originalname, data]
    );
    return res.json({ success: true, url: `/media/${rows[0].id}` });
  } catch (err) {
    fs.unlink(req.file.path, () => {});
    console.error("[upload]", err.message);
    return res.status(500).json({ success: false, error: "Could not save the file." });
  }
});

app.get("/admin", (_req, res) => res.sendFile(path.join(__dirname, "admin.html")));

init()
  .catch((err) => console.error("[db] init failed:", err.message))
  .finally(() => {
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`JT Cover Studio running on ${PORT}`);
    });
  });
