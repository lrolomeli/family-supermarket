require("dotenv").config();

const express = require("express");
const cors = require("cors");
const admin = require("firebase-admin");
const { Pool } = require("pg");
const multer = require("multer");
const { parse } = require("csv-parse/sync");
const sharp = require("sharp");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const runSetup = require("./db/setup");
const nodemailer = require("nodemailer");

const upload = multer({ storage: multer.memoryStorage() });

// Firebase Admin (solo para verificar tokens de Google)
admin.initializeApp({
  credential: admin.credential.cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
  }),
});

// PostgreSQL
const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

const server = express();
server.use(cors());
server.use(express.json());

// Serve static files - use ASSETS_DIR env var for Docker, fallback for local dev
const ASSETS_DIR = process.env.ASSETS_DIR || path.join(__dirname, '../lomeli-super/public');
server.use(express.static(ASSETS_DIR));

// Email notifications
const emailTransporter = process.env.SMTP_USER ? nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
}) : null;

const sendAdminEmail = async (subject, text) => {
  if (!emailTransporter) return;
  const adminEmail = process.env.ADMIN_EMAIL || process.env.VITE_ADMIN_EMAIL;
  if (!adminEmail) return;
  try {
    await emailTransporter.sendMail({
      from: `"Lomeli Super" <${process.env.SMTP_USER}>`,
      to: adminEmail,
      subject,
      text,
    });
  } catch (err) {
    console.error("Error sending email:", err.message);
  }
};

// Image processing helper
const processImage = async (file, filename) => {
  try {
    // Create a unique filename
    const name = path.parse(filename).name;
    const webpFilename = `${name}.webp`;
    const outputPath = path.join(ASSETS_DIR, 'assets', webpFilename);
    
    // Process image: resize to max 800x800, convert to WebP, quality 80%
    await sharp(file.buffer)
      .resize(800, 800, { 
        fit: 'inside',
        withoutEnlargement: true 
      })
      .webp({ quality: 80 })
      .toFile(outputPath);
    
    return `/assets/${webpFilename}`;
  } catch (error) {
    console.error('Error processing image:', error);
    throw error;
  }
};

const JWT_SECRET = process.env.JWT_SECRET || "lomeli-super-secret-key-change-in-production";

// Middleware: verifica el token (Firebase o JWT local)
const authenticate = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).send("Unauthorized: No token provided");
  }
  try {
    const token = authHeader.split("Bearer ")[1];
    
    // Try Firebase token first
    try {
      const decoded = await admin.auth().verifyIdToken(token);
      req.user = decoded; // { uid, email, ... }
      return next();
    } catch (firebaseErr) {
      // Not a Firebase token, try local JWT
    }
    
    // Try local JWT
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = { uid: decoded.uid, email: decoded.email };
    next();
  } catch (error) {
    return res.status(401).send("Unauthorized: Invalid token");
  }
};

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || process.env.VITE_ADMIN_EMAIL || "";

// Registra al usuario en postgres si es la primera vez que hace login
const syncUser = async (uid, email) => {
  const isAdmin = !!(email && ADMIN_EMAIL && email.toLowerCase() === ADMIN_EMAIL.toLowerCase());
  
  // Check if a user with this email already exists (e.g. local user logging in via Google)
  const { rows: existing } = await pool.query("SELECT uid, is_admin, is_approved FROM users WHERE email = $1", [email]);
  
  if (existing.length && existing[0].uid !== uid) {
    // Same email, different uid — update the existing row to use the new uid
    const newAdmin = existing[0].is_admin || isAdmin;
    const newApproved = existing[0].is_approved || isAdmin;
    await pool.query(
      "UPDATE users SET uid = $1, is_admin = $2, is_approved = $3 WHERE email = $4",
      [uid, newAdmin, newApproved, email]
    );
  } else if (existing.length) {
    // Same uid — just ensure admin/approved flags
    if (isAdmin) {
      await pool.query(
        "UPDATE users SET is_admin = true, is_approved = true WHERE uid = $1",
        [uid]
      );
    }
  } else {
    // New user
    await pool.query(
      "INSERT INTO users (uid, email, is_admin, is_approved) VALUES ($1, $2, $3, $3)",
      [uid, email, isAdmin]
    );
  }
};

// Verifica si el usuario está aprobado
const isApproved = async (uid) => {
  const { rows } = await pool.query("SELECT is_approved, is_admin FROM users WHERE uid = $1", [uid]);
  if (!rows.length) return false;
  return rows[0].is_approved || rows[0].is_admin;
};

// === INVITATION & LOCAL AUTH ===

// POST /admin/invitations - create invitation link (admin only)
server.post("/admin/invitations", authenticate, async (req, res) => {
  try {
    const { rows: user } = await pool.query("SELECT is_admin FROM users WHERE uid = $1", [req.user.uid]);
    if (!user.length || !user[0].is_admin) return res.status(403).send("Unauthorized");

    const code = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    const { rows } = await pool.query(
      "INSERT INTO invitations (code, created_by, expires_at) VALUES ($1, $2, $3) RETURNING *",
      [code, req.user.uid, expiresAt]
    );

    res.status(201).json(rows[0]);
  } catch (error) {
    console.error("Error creating invitation:", error);
    res.status(500).send(error.message);
  }
});

// GET /admin/invitations - list all invitations (admin only)
server.get("/admin/invitations", authenticate, async (req, res) => {
  try {
    const { rows: user } = await pool.query("SELECT is_admin FROM users WHERE uid = $1", [req.user.uid]);
    if (!user.length || !user[0].is_admin) return res.status(403).send("Unauthorized");

    const { rows } = await pool.query(
      "SELECT i.*, u.email as used_by_email FROM invitations i LEFT JOIN users u ON i.used_by = u.uid ORDER BY i.created_at DESC"
    );
    res.status(200).json(rows);
  } catch (error) {
    console.error("Error fetching invitations:", error);
    res.status(500).send(error.message);
  }
});

// GET /invitations/:code/validate - check if invitation is valid (public)
server.get("/invitations/:code/validate", async (req, res) => {
  try {
    const { rows } = await pool.query(
      "SELECT id, code, expires_at, used_by FROM invitations WHERE code = $1",
      [req.params.code]
    );
    if (!rows.length) return res.status(404).json({ valid: false, reason: "not_found" });
    if (rows[0].used_by) return res.status(400).json({ valid: false, reason: "already_used" });
    if (new Date(rows[0].expires_at) < new Date()) return res.status(400).json({ valid: false, reason: "expired" });

    res.status(200).json({ valid: true });
  } catch (error) {
    res.status(500).send(error.message);
  }
});

// POST /auth/register - register with invitation code (public)
server.post("/auth/register", async (req, res) => {
  try {
    const { code, email, password, display_name } = req.body;

    if (!code || !email || !password) {
      return res.status(400).send("Código, email y contraseña son requeridos");
    }

    // Validate invitation
    const { rows: inv } = await pool.query(
      "SELECT * FROM invitations WHERE code = $1",
      [code]
    );
    if (!inv.length) return res.status(404).send("Invitación no encontrada");
    if (inv[0].used_by) return res.status(400).send("Esta invitación ya fue utilizada");
    if (new Date(inv[0].expires_at) < new Date()) return res.status(400).send("Esta invitación ha expirado");

    // Check if email already exists
    const { rows: existing } = await pool.query("SELECT id FROM users WHERE email = $1", [email]);
    if (existing.length) return res.status(400).send("Este email ya está registrado");

    // Create user
    const uid = `local_${crypto.randomBytes(16).toString("hex")}`;
    const passwordHash = await bcrypt.hash(password, 10);

    await pool.query(
      "INSERT INTO users (uid, email, password_hash, display_name, auth_type, is_approved) VALUES ($1, $2, $3, $4, 'local', true)",
      [uid, email, passwordHash, display_name || email.split("@")[0]]
    );

    // Mark invitation as used
    await pool.query(
      "UPDATE invitations SET used_by = $1, used_at = CURRENT_TIMESTAMP WHERE id = $2",
      [uid, inv[0].id]
    );

    // Generate JWT
    const token = jwt.sign({ uid, email }, JWT_SECRET, { expiresIn: "7d" });

    res.status(201).json({ token, uid, email, display_name: display_name || email.split("@")[0] });
  } catch (error) {
    console.error("Error registering user:", error);
    res.status(500).send(error.message);
  }
});

// POST /auth/login - login with email/password (public)
server.post("/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).send("Email y contraseña son requeridos");

    const { rows } = await pool.query(
      "SELECT uid, email, password_hash, display_name, is_approved, is_admin FROM users WHERE email = $1 AND auth_type = 'local'",
      [email]
    );
    if (!rows.length) return res.status(401).send("Credenciales incorrectas");

    const user = rows[0];
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(401).send("Credenciales incorrectas");

    const token = jwt.sign({ uid: user.uid, email: user.email }, JWT_SECRET, { expiresIn: "7d" });

    res.status(200).json({
      token,
      uid: user.uid,
      email: user.email,
      display_name: user.display_name,
      is_approved: user.is_approved,
      is_admin: user.is_admin,
    });
  } catch (error) {
    console.error("Error logging in:", error);
    res.status(500).send(error.message);
  }
});

// GET /me - verifica si el usuario autenticado está aprobado
server.get("/me", authenticate, async (req, res) => {
  try {
    await syncUser(req.user.uid, req.user.email);
    
    // Ensure admin email is always approved and admin
    if (ADMIN_EMAIL && req.user.email && req.user.email.toLowerCase() === ADMIN_EMAIL.toLowerCase()) {
      await pool.query(
        "UPDATE users SET is_admin = true, is_approved = true WHERE uid = $1",
        [req.user.uid]
      );
    }
    
    const { rows } = await pool.query(
      "SELECT is_approved, is_admin FROM users WHERE uid = $1",
      [req.user.uid]
    );
    if (!rows.length) return res.status(200).json({ approved: false });
    res.status(200).json({ approved: rows[0].is_approved || rows[0].is_admin });
  } catch (error) {
    res.status(500).send(error.message);
  }
});

// GET /admin/users - listar todos los usuarios (solo admin)
server.get("/admin/users", authenticate, async (req, res) => {
  try {
    const { rows: admin } = await pool.query("SELECT is_admin FROM users WHERE uid = $1", [req.user.uid]);
    if (!admin.length || !admin[0].is_admin) return res.status(403).send("Unauthorized");
    const { rows } = await pool.query("SELECT id, uid, email, is_admin, is_approved FROM users ORDER BY id DESC");
    res.status(200).json(rows);
  } catch (error) {
    res.status(500).send(error.message);
  }
});

// PATCH /admin/users/:uid/approve - aprobar o rechazar usuario
server.patch("/admin/users/:uid/approve", authenticate, async (req, res) => {
  try {
    const { rows: admin } = await pool.query("SELECT is_admin FROM users WHERE uid = $1", [req.user.uid]);
    if (!admin.length || !admin[0].is_admin) return res.status(403).send("Unauthorized");
    const { approved } = req.body;
    await pool.query("UPDATE users SET is_approved = $1 WHERE uid = $2", [approved, req.params.uid]);
    res.status(200).send("User updated");
  } catch (error) {
    res.status(500).send(error.message);
  }
});


server.get("/products", async (req, res) => {
  try {
    const { rows } = await pool.query("SELECT * FROM products ORDER BY id");
    res.status(200).json(rows);
  } catch (error) {
    res.status(500).send(error.message);
  }
});

// PUT /admin/products/:id - actualizar precio (solo admin)
server.put("/admin/products/:id", authenticate, async (req, res) => {
  try {
    const { rows: user } = await pool.query("SELECT is_admin FROM users WHERE uid = $1", [req.user.uid]);
    if (!user.length || !user[0].is_admin) return res.status(403).send("Unauthorized");

    const { price_piece, price_kg } = req.body;
    await pool.query(
      "UPDATE products SET price_piece = $1, price_kg = $2 WHERE id = $3",
      [price_piece, price_kg, req.params.id]
    );
    res.status(200).send("Price updated");
  } catch (error) {
    res.status(500).send(error.message);
  }
});

// POST /admin/products/bulk - actualizar todos los precios de un golpe
server.post("/admin/products/bulk", authenticate, async (req, res) => {
  try {
    const { rows: user } = await pool.query("SELECT is_admin FROM users WHERE uid = $1", [req.user.uid]);
    if (!user.length || !user[0].is_admin) return res.status(403).send("Unauthorized");

    const { products } = req.body; // [{ id, price_piece, price_kg }]
    for (const p of products) {
      await pool.query(
        "UPDATE products SET price_piece = $1, price_kg = $2 WHERE id = $3",
        [p.price_piece, p.price_kg, p.id]
      );
    }
    res.status(200).json({ updated: products.length });
  } catch (error) {
    res.status(500).send(error.message);
  }
});

// POST /admin/products/csv - subir CSV con precios
server.post("/admin/products/csv", authenticate, upload.single("file"), async (req, res) => {
  try {
    const { rows: user } = await pool.query("SELECT is_admin FROM users WHERE uid = $1", [req.user.uid]);
    if (!user.length || !user[0].is_admin) return res.status(403).send("Unauthorized");

    const records = parse(req.file.buffer.toString(), {
      columns: true, skip_empty_lines: true, trim: true,
    });

    // Espera columnas: id, price_piece, price_kg
    let updated = 0;
    for (const row of records) {
      if (!row.id) continue;
      await pool.query(
        "UPDATE products SET price_piece = $1, price_kg = $2 WHERE id = $3",
        [parseFloat(row.price_piece) || 0, parseFloat(row.price_kg) || 0, parseInt(row.id)]
      );
      updated++;
    }
    res.status(200).json({ updated });
  } catch (error) {
    res.status(500).send(error.message);
  }
});

// POST /admin/products - create new product
server.post("/admin/products", authenticate, upload.single("image"), async (req, res) => {
  try {
    const { rows: user } = await pool.query("SELECT is_admin FROM users WHERE uid = $1", [req.user.uid]);
    if (!user.length || !user[0].is_admin) return res.status(403).send("Unauthorized");

    const { name, price_piece, price_kg, category, sell_by } = req.body;
    let imagePath = null;
    
    // Process image if uploaded
    if (req.file) {
      imagePath = await processImage(req.file, req.file.originalname);
    }
    
    const { rows } = await pool.query(
      "INSERT INTO products (name, price_piece, price_kg, image, category, sell_by) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *",
      [name, parseFloat(price_piece) || 0, parseFloat(price_kg) || 0, imagePath, category || 'general', sell_by || 'both']
    );
    
    res.status(201).json(rows[0]);
  } catch (error) {
    console.error('Error creating product:', error);
    res.status(500).send(error.message);
  }
});

// DELETE /admin/products/:id - delete product
server.delete("/admin/products/:id", authenticate, async (req, res) => {
  try {
    const { rows: user } = await pool.query("SELECT is_admin FROM users WHERE uid = $1", [req.user.uid]);
    if (!user.length || !user[0].is_admin) return res.status(403).send("Unauthorized");

    const { rows } = await pool.query("DELETE FROM products WHERE id = $1 RETURNING *", [req.params.id]);
    
    if (!rows.length) return res.status(404).send("Product not found");
    
    res.status(200).json({ message: "Product deleted successfully", product: rows[0] });
  } catch (error) {
    res.status(500).send(error.message);
  }
});

// PUT /admin/products/:id/details - update product details (name, image, category)
server.put("/admin/products/:id/details", authenticate, upload.single("image"), async (req, res) => {
  try {
    const { rows: user } = await pool.query("SELECT is_admin FROM users WHERE uid = $1", [req.user.uid]);
    if (!user.length || !user[0].is_admin) return res.status(403).send("Unauthorized");

    const { name, category } = req.body;
    let imagePath = null;
    
    // Process image if uploaded
    if (req.file) {
      imagePath = await processImage(req.file, req.file.originalname);
    }
    
    // Build dynamic update query
    let updateFields = [];
    let updateValues = [];
    let paramIndex = 1;

    if (name !== undefined) {
      updateFields.push(`name = $${paramIndex++}`);
      updateValues.push(name);
    }
    if (category !== undefined) {
      updateFields.push(`category = $${paramIndex++}`);
      updateValues.push(category);
    }
    if (imagePath !== null) {
      updateFields.push(`image = $${paramIndex++}`);
      updateValues.push(imagePath);
    }

    if (updateFields.length === 0) {
      return res.status(400).send("No fields to update");
    }

    updateValues.push(req.params.id);
    
    const { rows } = await pool.query(
      `UPDATE products SET ${updateFields.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      updateValues
    );
    
    if (!rows.length) return res.status(404).send("Product not found");
    
    res.status(200).json(rows[0]);
  } catch (error) {
    console.error('Error updating product:', error);
    res.status(500).send(error.message);
  }
});

// GET /categories - fetch all categories
server.get("/categories", async (req, res) => {
  try {
    const { rows } = await pool.query("SELECT * FROM categories ORDER BY name");
    res.status(200).json(rows);
  } catch (error) {
    res.status(500).send(error.message);
  }
});

// POST /admin/categories - create new category
server.post("/admin/categories", authenticate, async (req, res) => {
  try {
    const { rows: user } = await pool.query("SELECT is_admin FROM users WHERE uid = $1", [req.user.uid]);
    if (!user.length || !user[0].is_admin) return res.status(403).send("Unauthorized");

    const { name } = req.body;
    const { rows } = await pool.query("INSERT INTO categories (name) VALUES ($1) RETURNING *", [name]);
    
    res.status(201).json(rows[0]);
  } catch (error) {
    res.status(500).send(error.message);
  }
});


server.get("/admin/orders", authenticate, async (req, res) => {
  try {
    const { rows: user } = await pool.query(
      "SELECT is_admin FROM users WHERE uid = $1",
      [req.user.uid]
    );
    if (!user.length || !user[0].is_admin) {
      return res.status(403).send("Unauthorized: Only admins can access this endpoint");
    }
    const { rows } = await pool.query("SELECT o.*, u.email as user_email FROM orders o JOIN users u ON o.uid = u.uid");
    res.status(200).json(rows);
  } catch (error) {
    console.error("Error fetching all orders:", error);
    res.status(500).send(error.message);
  }
});

// PATCH /admin/orders/:id/status - actualizar status de una orden
server.patch("/admin/orders/:id/status", authenticate, async (req, res) => {
  try {
    const { rows: user } = await pool.query(
      "SELECT is_admin FROM users WHERE uid = $1",
      [req.user.uid]
    );
    if (!user.length || !user[0].is_admin) {
      return res.status(403).send("Unauthorized");
    }
    const { status } = req.body;
    const validStatuses = ["pending", "completed", "cancelled"];
    if (!validStatuses.includes(status)) {
      return res.status(400).send("Invalid status");
    }
    await pool.query("UPDATE orders SET status = $1 WHERE id = $2", [status, req.params.id]);
    res.status(200).send("Status updated");
  } catch (error) {
    console.error("Error updating status:", error);
    res.status(500).send(error.message);
  }
});


server.get("/orders", authenticate, async (req, res) => {
  try {
    await syncUser(req.user.uid, req.user.email);
    if (!await isApproved(req.user.uid)) return res.status(403).json({ reason: "not_approved" });
    const { rows } = await pool.query(
      "SELECT * FROM orders WHERE uid = $1 AND is_delivered = false ORDER BY created_at DESC",
      [req.user.uid]
    );
    res.status(200).json(rows);
  } catch (error) {
    console.error("Error fetching orders:", error);
    res.status(500).send(error.message);
  }
});

// POST /orders - crear orden
server.post("/orders", authenticate, async (req, res) => {
  try {
    await syncUser(req.user.uid, req.user.email);
    if (!await isApproved(req.user.uid)) return res.status(403).json({ reason: "not_approved" });
    const { products } = req.body;
    
    const productsJson = typeof products === 'string' ? products : JSON.stringify(products);
    
    if (!productsJson || productsJson.trim() === '') {
      throw new Error('Products data is empty');
    }
    // Validate JSON
    JSON.parse(productsJson);
    
    const { rows } = await pool.query(
      "INSERT INTO orders (uid, products, status) VALUES ($1, $2, 'pending') RETURNING id",
      [req.user.uid, productsJson]
    );

    // Notify admin via email
    const items = JSON.parse(productsJson);
    const itemList = items.map(i => `  - ${i.name}: ${i.quantity} ${i.unit === "kg" ? "kg" : "pzs"}`).join("\n");
    sendAdminEmail(
      `Nueva orden #${rows[0].id}`,
      `${req.user.email} ha creado una nueva orden:\n\n${itemList}\n\nRevisa el panel de administración.`
    );

    res.status(201).json({ id: rows[0].id });
  } catch (error) {
    console.error("Error creating order:", error);
    res.status(500).send(error.message);
  }
});

// PUT /orders/:id - actualizar orden completa
server.put("/orders/:id", authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const { products } = req.body;
    const { rows } = await pool.query(
      "SELECT uid, status FROM orders WHERE id = $1",
      [id]
    );
    if (!rows.length) return res.status(404).send("Order not found");
    if (rows[0].uid !== req.user.uid) return res.status(403).send("Unauthorized");
    
    // Prevent modification of delivered orders
    if (rows[0].status === 'delivered') {
      return res.status(403).send("Cannot modify delivered orders");
    }
    
    // Check if order can be modified (only pending orders can be edited)
    if (rows[0].status !== 'pending') {
      return res.status(403).send("Order cannot be modified - it's already in progress or delivered");
    }

    await pool.query("UPDATE orders SET products = $1 WHERE id = $2", [
      JSON.stringify(products),
      id,
    ]);
    res.status(200).send("Order updated successfully");
  } catch (error) {
    console.error("Error updating order:", error);
    res.status(500).send(error.message);
  }
});

// DELETE /orders/:id - eliminar orden
server.delete("/orders/:id", authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const { rows } = await pool.query(
      "SELECT uid, status FROM orders WHERE id = $1",
      [id]
    );
    if (!rows.length) return res.status(404).send("Order not found");
    if (rows[0].uid !== req.user.uid) return res.status(403).send("Unauthorized");
    
    // Prevent deletion of delivered orders
    if (rows[0].status === 'delivered') {
      return res.status(403).send("Cannot delete delivered orders");
    }
    
    // Check if order can be deleted (only pending orders can be deleted)
    if (rows[0].status !== 'pending') {
      return res.status(403).send("Order cannot be deleted - it's already in progress or delivered");
    }

    await pool.query("DELETE FROM orders WHERE id = $1", [id]);
    res.status(200).send("Order deleted successfully");
  } catch (error) {
    console.error("Error deleting order:", error);
    res.status(500).send(error.message);
  }
});

// DELETE /orders/:orderId/products/:productIndex - eliminar un producto de una orden
server.delete("/orders/:orderId/products/:productIndex", authenticate, async (req, res) => {
  try {
    const { orderId, productIndex } = req.params;
    const { rows } = await pool.query(
      "SELECT uid, status, products FROM orders WHERE id = $1",
      [orderId]
    );
    if (!rows.length) return res.status(404).send("Order not found");
    if (rows[0].uid !== req.user.uid) return res.status(403).send("Unauthorized");

    // Check if order can be modified (only pending orders can be edited)
    if (rows[0].status !== 'pending') {
      return res.status(403).send("Order cannot be modified - it's already in progress");
    }

    const products = rows[0].products;
    products.splice(Number(productIndex), 1);

    await pool.query("UPDATE orders SET products = $1 WHERE id = $2", [
      JSON.stringify(products),
      orderId,
    ]);
    res.status(200).send("Item deleted successfully");
  } catch (error) {
    console.error("Error deleting item:", error);
    res.status(500).send(error.message);
  }
});

// PUT /admin/orders/:id/status - update order status (admin only)
server.put("/admin/orders/:id/status", authenticate, async (req, res) => {
  try {
    const { rows: user } = await pool.query("SELECT is_admin FROM users WHERE uid = $1", [req.user.uid]);
    if (!user.length || !user[0].is_admin) return res.status(403).send("Unauthorized");

    const { status } = req.body;
    const validStatuses = ['pending', 'in_progress', 'delivered'];
    if (!validStatuses.includes(status)) {
      return res.status(400).send("Invalid status");
    }

    const { rows } = await pool.query(
      "UPDATE orders SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *",
      [status, req.params.id]
    );
    
    if (!rows.length) return res.status(404).send("Order not found");
    
    const updatedOrder = rows[0];
    
    // If order is marked as delivered, move it to history by updating the is_delivered flag
    if (status === 'delivered') {
      await pool.query(
        "UPDATE orders SET is_delivered = true, delivered_at = CURRENT_TIMESTAMP WHERE id = $1",
        [req.params.id]
      );
    }
    
    res.status(200).json(updatedOrder);
  } catch (error) {
    console.error("Error updating order status:", error);
    res.status(500).send(error.message);
  }
});

// GET /orders/history - get user's order history (all orders)
server.get("/orders/history", authenticate, async (req, res) => {
  try {
    const { rows } = await pool.query(
      "SELECT * FROM orders WHERE uid = $1 ORDER BY created_at DESC",
      [req.user.uid]
    );
    res.status(200).json(rows);
  } catch (error) {
    console.error("Error fetching order history:", error);
    res.status(500).send(error.message);
  }
});

// GET /orders/:id - get specific order with status check
server.get("/orders/:id", authenticate, async (req, res) => {
  try {
    const { rows } = await pool.query(
      "SELECT * FROM orders WHERE id = $1 AND uid = $2",
      [req.params.id, req.user.uid]
    );
    
    if (!rows.length) return res.status(404).send("Order not found");
    
    res.status(200).json(rows[0]);
  } catch (error) {
    console.error("Error fetching order:", error);
    res.status(500).send(error.message);
  }
});

// GET /favorites - get user's favorite orders
server.get("/favorites", authenticate, async (req, res) => {
  try {
    const { rows } = await pool.query(
      "SELECT * FROM order_favorites WHERE uid = $1 ORDER BY created_at DESC",
      [req.user.uid]
    );
    res.status(200).json(rows);
  } catch (error) {
    console.error("Error fetching favorites:", error);
    res.status(500).send(error.message);
  }
});

// ORDER REQUESTS API - User-Admin Communication

// POST /orders/:id/requests - create order request (user only)
server.post("/orders/:id/requests", authenticate, async (req, res) => {
  try {
    const { request_type, message, proposed_changes } = req.body;
    const orderId = req.params.id;
    
    // Verify order belongs to user
    const { rows: order } = await pool.query(
      "SELECT uid, status FROM orders WHERE id = $1",
      [orderId]
    );
    if (!order.length) return res.status(404).send("Order not found");
    if (order[0].uid !== req.user.uid) return res.status(403).send("Unauthorized");
    
    // Prevent requests on delivered orders
    if (order[0].status === 'delivered') {
      return res.status(400).send("Cannot modify delivered orders");
    }
    
    // Only allow requests for in_progress orders (pending orders can be edited directly)
    if (order[0].status !== 'in_progress') {
      return res.status(400).send("Requests only allowed for orders in progress");
    }
    
    // Check if there's already a pending request for this order and replace it
    const { rows: existingRequest } = await pool.query(
      "SELECT id FROM order_requests WHERE order_id = $1 AND status = 'pending'",
      [orderId]
    );
    
    let result;
    const proposedChangesJson = proposed_changes ? JSON.stringify(proposed_changes) : null;
    
    if (existingRequest.length > 0) {
      // Replace existing pending request
      result = await pool.query(
        "UPDATE order_requests SET request_type = $1, message = $2, proposed_changes = $3, updated_at = CURRENT_TIMESTAMP WHERE id = $4 RETURNING *",
        [request_type, message, proposedChangesJson, existingRequest[0].id]
      );
    } else {
      // Create new request
      result = await pool.query(
        "INSERT INTO order_requests (order_id, uid, request_type, message, proposed_changes) VALUES ($1, $2, $3, $4, $5) RETURNING *",
        [orderId, req.user.uid, request_type, message, proposedChangesJson]
      );
    }
    
    res.status(201).json(result.rows[0]);

    // Notify admin via email about the change request
    sendAdminEmail(
      `Solicitud de cambio - Orden #${orderId}`,
      `${req.user.email} solicita un cambio en la orden #${orderId}:\n\nTipo: ${request_type}\nMensaje: ${message || "(sin mensaje)"}\n\nRevisa el panel de administración.`
    );
  } catch (error) {
    console.error("Error creating order request:", error);
    res.status(500).send(error.message);
  }
});

// GET /admin/requests - get all pending requests (admin only)
server.get("/admin/requests", authenticate, async (req, res) => {
  try {
    const { rows: user } = await pool.query("SELECT is_admin FROM users WHERE uid = $1", [req.user.uid]);
    if (!user.length || !user[0].is_admin) return res.status(403).send("Unauthorized");

    const { rows } = await pool.query(`
      SELECT r.*, o.id as order_id, u.email as user_email, o.products
      FROM order_requests r
      JOIN orders o ON r.order_id = o.id
      JOIN users u ON r.uid = u.uid
      WHERE r.status = 'pending'
      ORDER BY r.created_at ASC
    `);
    
    res.status(200).json(rows);
  } catch (error) {
    console.error("Error fetching requests:", error);
    res.status(500).send(error.message);
  }
});

// PUT /admin/requests/:id/respond - respond to order request (admin only)
server.put("/admin/requests/:id/respond", authenticate, async (req, res) => {
  try {
    const { rows: user } = await pool.query("SELECT is_admin FROM users WHERE uid = $1", [req.user.uid]);
    if (!user.length || !user[0].is_admin) return res.status(403).send("Unauthorized");

    const { status, admin_response } = req.body;
    const validStatuses = ['approved', 'rejected', 'completed'];
    if (!validStatuses.includes(status)) return res.status(400).send("Invalid status");

    const { rows: request } = await pool.query(
      "SELECT * FROM order_requests WHERE id = $1",
      [req.params.id]
    );
    if (!request.length) return res.status(404).send("Request not found");
    
    const { rows } = await pool.query(
      "UPDATE order_requests SET status = $1, admin_response = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3 RETURNING *",
      [status, admin_response, req.params.id]
    );
    
    // If approved, apply the proposed changes
    if (status === 'approved' && request[0].proposed_changes) {
      try {
        const proposedChanges = typeof request[0].proposed_changes === 'string'
          ? JSON.parse(request[0].proposed_changes)
          : request[0].proposed_changes;
        
        await pool.query(
          "UPDATE orders SET products = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2",
          [JSON.stringify(proposedChanges), request[0].order_id]
        );
      } catch (parseError) {
        console.error("Error parsing proposed changes:", parseError);
      }
    }
    
    res.status(200).json(rows[0]);
  } catch (error) {
    console.error("Error responding to request:", error);
    res.status(500).send(error.message);
  }
});

// GET /orders/:id/requests - get user's requests for specific order
server.get("/orders/:id/requests", authenticate, async (req, res) => {
  try {
    const { rows: order } = await pool.query(
      "SELECT uid FROM orders WHERE id = $1",
      [req.params.id]
    );
    if (!order.length) return res.status(404).send("Order not found");
    if (order[0].uid !== req.user.uid) return res.status(403).send("Unauthorized");

    const { rows } = await pool.query(
      "SELECT * FROM order_requests WHERE order_id = $1 AND uid = $2 ORDER BY created_at DESC",
      [req.params.id, req.user.uid]
    );
    
    res.status(200).json(rows);
  } catch (error) {
    console.error("Error fetching order requests:", error);
    res.status(500).send(error.message);
  }
});

// DELETE /admin/requests/cleanup - clear all pending requests (admin only)
server.delete("/admin/requests/cleanup", authenticate, async (req, res) => {
  try {
    const { rows: user } = await pool.query("SELECT is_admin FROM users WHERE uid = $1", [req.user.uid]);
    if (!user.length || !user[0].is_admin) return res.status(403).send("Unauthorized");

    const { rows: deleted } = await pool.query(
      "DELETE FROM order_requests WHERE status = 'pending' RETURNING id, order_id"
    );
    
    res.status(200).json({ 
      message: `Deleted ${deleted.length} pending requests`,
      deleted: deleted 
    });
  } catch (error) {
    console.error("Error cleaning up requests:", error);
    res.status(500).send(error.message);
  }
});

// ORDER FAVORITES API

// POST /favorites - create new favorite order
server.post("/favorites", authenticate, async (req, res) => {
  try {
    const { name, products } = req.body;
    
    if (!name || !products) {
      return res.status(400).send("Name and products are required");
    }
    
    const { rows } = await pool.query(
      "INSERT INTO order_favorites (uid, name, products) VALUES ($1, $2, $3) RETURNING *",
      [req.user.uid, name, JSON.stringify(products)]
    );
    
    res.status(201).json(rows[0]);
  } catch (error) {
    console.error("Error creating favorite:", error);
    res.status(500).send(error.message);
  }
});

// DELETE /favorites/:id - delete favorite order
server.delete("/favorites/:id", authenticate, async (req, res) => {
  try {
    const { rows } = await pool.query(
      "DELETE FROM order_favorites WHERE id = $1 AND uid = $2 RETURNING *",
      [req.params.id, req.user.uid]
    );
    
    if (!rows.length) return res.status(404).send("Favorite not found");
    
    res.status(200).json(rows[0]);
  } catch (error) {
    console.error("Error deleting favorite:", error);
    res.status(500).send(error.message);
  }
});

// POST /favorites/:id/reorder - create new order from favorite
server.post("/favorites/:id/reorder", authenticate, async (req, res) => {
  try {
    const { rows: favorite } = await pool.query(
      "SELECT * FROM order_favorites WHERE id = $1 AND uid = $2",
      [req.params.id, req.user.uid]
    );
    
    if (!favorite.length) return res.status(404).send("Favorite not found");
    
    const productsJson = typeof favorite[0].products === 'string'
      ? favorite[0].products
      : JSON.stringify(favorite[0].products);
    
    if (!productsJson || productsJson.trim() === '') {
      throw new Error('Products data is empty');
    }
    JSON.parse(productsJson); // validate
    
    const { rows } = await pool.query(
      "INSERT INTO orders (uid, products, status, created_at) VALUES ($1, $2, 'pending', CURRENT_TIMESTAMP) RETURNING *",
      [req.user.uid, productsJson]
    );
    
    res.status(201).json(rows[0]);
  } catch (error) {
    console.error("Error creating order from favorite:", error);
    res.status(500).send(error.message);
  }
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, async () => {
  await runSetup(pool);
  console.log(`Server running on port ${PORT}`);
});
