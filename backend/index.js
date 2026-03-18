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
const runSetup = require("./db/setup");

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

// Serve static files from frontend public folder
server.use(express.static('../lomeli-super/public'));

// Image processing helper
const processImage = async (file, filename) => {
  try {
    // Create a unique filename
    const name = path.parse(filename).name;
    const webpFilename = `${name}.webp`;
    const outputPath = path.join(__dirname, '../lomeli-super/public/assets', webpFilename);
    
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

// Middleware: verifica el token de Firebase y adjunta el usuario
const authenticate = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).send("Unauthorized: No token provided");
  }
  try {
    const token = authHeader.split("Bearer ")[1];
    const decoded = await admin.auth().verifyIdToken(token);
    req.user = decoded; // { uid, email, ... }
    next();
  } catch (error) {
    return res.status(401).send("Unauthorized: Invalid token");
  }
};

// Registra al usuario en postgres si es la primera vez que hace login
const syncUser = async (uid, email) => {
  await pool.query(
    `INSERT INTO users (uid, email) VALUES ($1, $2) ON CONFLICT (uid) DO NOTHING`,
    [uid, email]
  );
};

// Verifica si el usuario está aprobado
const isApproved = async (uid) => {
  const { rows } = await pool.query("SELECT is_approved, is_admin FROM users WHERE uid = $1", [uid]);
  if (!rows.length) return false;
  return rows[0].is_approved || rows[0].is_admin;
};

// GET /me - verifica si el usuario autenticado está aprobado
server.get("/me", authenticate, async (req, res) => {
  try {
    await syncUser(req.user.uid, req.user.email);
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

    const { name, price_piece, price_kg, category } = req.body;
    let imagePath = null;
    
    // Process image if uploaded
    if (req.file) {
      imagePath = await processImage(req.file, req.file.originalname);
    }
    
    const { rows } = await pool.query(
      "INSERT INTO products (name, price_piece, price_kg, image, category) VALUES ($1, $2, $3, $4, $5) RETURNING *",
      [name, parseFloat(price_piece) || 0, parseFloat(price_kg) || 0, imagePath, category || 'general']
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
      "SELECT * FROM orders WHERE uid = $1",
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
    const { rows } = await pool.query(
      "INSERT INTO orders (uid, products, status) VALUES ($1, $2, 'pending') RETURNING id",
      [req.user.uid, JSON.stringify(products)]
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
    
    // Check if order can be modified (only pending orders can be edited)
    if (rows[0].status !== 'pending') {
      return res.status(403).send("Order cannot be modified - it's already in progress");
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
    
    // Check if order can be deleted (only pending orders can be deleted)
    if (rows[0].status !== 'pending') {
      return res.status(403).send("Order cannot be deleted - it's already in progress");
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
    
    res.status(200).json(rows[0]);
  } catch (error) {
    console.error("Error updating order status:", error);
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

// POST /favorites - create favorite order
server.post("/favorites", authenticate, async (req, res) => {
  try {
    const { name, products } = req.body;
    
    const { rows } = await pool.query(
      "INSERT INTO favorites (uid, name, products) VALUES ($1, $2, $3) RETURNING *",
      [req.user.uid, name, JSON.stringify(products)]
    );
    
    res.status(201).json(rows[0]);
  } catch (error) {
    console.error("Error creating favorite:", error);
    res.status(500).send(error.message);
  }
});

// GET /favorites - get user's favorite orders
server.get("/favorites", authenticate, async (req, res) => {
  try {
    const { rows } = await pool.query(
      "SELECT * FROM favorites WHERE uid = $1 ORDER BY created_at DESC",
      [req.user.uid]
    );
    
    res.status(200).json(rows);
  } catch (error) {
    console.error("Error fetching favorites:", error);
    res.status(500).send(error.message);
  }
});

// POST /favorites/:id/reorder - create order from favorite
server.post("/favorites/:id/reorder", authenticate, async (req, res) => {
  try {
    const { rows: favorite } = await pool.query(
      "SELECT * FROM favorites WHERE id = $1 AND uid = $2",
      [req.params.id, req.user.uid]
    );
    
    if (!favorite.length) return res.status(404).send("Favorite not found");
    
    const { rows } = await pool.query(
      "INSERT INTO orders (uid, products, status) VALUES ($1, $2, 'pending') RETURNING *",
      [req.user.uid, favorite[0].products]
    );
    
    res.status(201).json(rows[0]);
  } catch (error) {
    console.error("Error reordering from favorite:", error);
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
    
    // Only allow requests for in_progress orders (pending orders can be edited directly)
    if (order[0].status !== 'in_progress') {
      return res.status(400).send("Requests only allowed for orders in progress");
    }
    
    const { rows } = await pool.query(
      "INSERT INTO order_requests (order_id, uid, request_type, message, proposed_changes) VALUES ($1, $2, $3, $4, $5) RETURNING *",
      [orderId, req.user.uid, request_type, message, JSON.stringify(proposed_changes)]
    );
    
    res.status(201).json(rows[0]);
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
    if (!validStatuses.includes(status)) {
      return res.status(400).send("Invalid status");
    }

    // Get the request details to check for proposed changes
    const { rows: request } = await pool.query(
      "SELECT * FROM order_requests WHERE id = $1",
      [req.params.id]
    );
    
    if (!request.length) return res.status(404).send("Request not found");
    
    const { rows } = await pool.query(
      "UPDATE order_requests SET status = $1, admin_response = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3 RETURNING *",
      [status, admin_response, req.params.id]
    );
    
    // If approved, apply the proposed changes and allow user to modify
    if (status === 'approved') {
      const requestData = request[0];
      
      // If there are proposed changes, apply them to the order
      if (requestData.proposed_changes) {
        try {
          const proposedChanges = JSON.parse(requestData.proposed_changes);
          await pool.query(
            "UPDATE orders SET products = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2",
            [JSON.stringify(proposedChanges), requestData.order_id]
          );
        } catch (parseError) {
          console.error("Error parsing proposed changes:", parseError);
        }
      }
      
      // Set order back to pending so user can edit if needed
      await pool.query(
        "UPDATE orders SET status = 'pending' WHERE id = $1",
        [requestData.order_id]
      );
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

const PORT = process.env.PORT || 5000;
server.listen(PORT, async () => {
  await runSetup(pool);
  console.log(`Server running on port ${PORT}`);
});
