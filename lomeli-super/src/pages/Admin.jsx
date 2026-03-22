import { useEffect, useState, useMemo } from "react";
import { auth } from "../firebase";
import API_BASE_URL from "../config";
import apiFetch from "../api";
import { calcOrderTotal, formatMXN } from "../utils/pricing";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell
} from "recharts";

const STATUS_COLORS = {
  pending:     { bg: "#fffbeb", color: "#d97706", label: "Pendiente", icon: "🕐" },
  in_progress: { bg: "#eff6ff", color: "#2563eb", label: "En Progreso", icon: "📦" },
  delivered:   { bg: "#f0fdf4", color: "#16a34a", label: "Entregado", icon: "✅" },
  completed:   { bg: "#f0fdf4", color: "#16a34a", label: "Completado", icon: "✅" },
  cancelled:   { bg: "#fef2f2", color: "#dc2626", label: "Cancelado", icon: "❌" },
};

const Badge = ({ status = "pending" }) => {
  const s = STATUS_COLORS[status] || STATUS_COLORS.pending;
  return (
    <span style={{
      background: s.bg, color: s.color, padding: "4px 10px",
      borderRadius: "999px", fontSize: "11px", fontWeight: 700,
      display: "inline-flex", alignItems: "center", gap: "3px",
    }}>{s.icon} {s.label}</span>
  );
};

const StatCard = ({ label, value, color = "#3b82f6", icon }) => (
  <div style={{
    background: "#fff", border: "1px solid #e5e7eb", borderRadius: "14px",
    padding: "14px 16px", flex: "1 1 calc(50% - 6px)", minWidth: "0",
    boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
  }}>
    <div style={{ fontSize: "12px", color: "#9ca3af", marginBottom: "4px" }}>{icon} {label}</div>
    <div style={{ fontSize: "22px", fontWeight: 700, color }}>{value}</div>
  </div>
);

const ActionBtn = ({ onClick, bg, color, children, disabled, style: extraStyle }) => (
  <button onClick={onClick} disabled={disabled} style={{
    padding: "10px 0", background: bg, color,
    border: "none", borderRadius: "10px", cursor: disabled ? "default" : "pointer",
    fontSize: "13px", fontWeight: 600, flex: 1,
    WebkitTapHighlightColor: "transparent",
    display: "flex", alignItems: "center", justifyContent: "center", gap: "4px",
    opacity: disabled ? 0.5 : 1,
    ...extraStyle,
  }}>
    {children}
  </button>
);

const TAB_ITEMS = [
  { key: "Dashboard", label: "Panel", icon: "📊" },
  { key: "Orders", label: "Órdenes", icon: "📋" },
  { key: "ShoppingList", label: "Compras", icon: "🛒" },
  { key: "Users", label: "Usuarios", icon: "👥" },
  { key: "Prices", label: "Productos", icon: "🏷️" },
  { key: "Categories", label: "Categorías", icon: "📁" },
];

// ─── PricesTab ───
const PricesTab = ({ catalog, editingPrices, onPriceChange, onSaveOne, onSaveAll, onCsvUpload, onAddProduct, onDeleteProduct, categories, onUpdateProduct, onToggleAvailable }) => {
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);
  const [csvStatus, setCsvStatus] = useState(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [newProduct, setNewProduct] = useState({
    name: "", price_piece: "", price_kg: "",
    category: categories[0]?.name || "general", sell_by: "both"
  });
  const [imageFile, setImageFile] = useState(null);
  const [editImageFile, setEditImageFile] = useState(null);
  const [expandedId, setExpandedId] = useState(null);

  const filtered = catalog.filter(p => p.name.toLowerCase().includes(search.toLowerCase()));

  const handleSaveAll = async () => { setSaving(true); await onSaveAll(); setSaving(false); };

  const handleFile = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setCsvStatus("uploading");
    try { await onCsvUpload(file); setCsvStatus("ok"); } catch { setCsvStatus("error"); }
    e.target.value = "";
  };

  const handleAddProduct = async () => {
    if (!newProduct.name.trim()) return;
    try {
      await onAddProduct(newProduct, imageFile);
      setNewProduct({ name: "", price_piece: "", price_kg: "", category: categories[0]?.name || "general", sell_by: "both" });
      setImageFile(null); setShowAddForm(false);
    } catch (error) { console.error("Error adding product:", error); }
  };

  const handleEditProduct = (product) => {
    setEditingProduct({ ...product, price_piece: product.price_piece.toString(), price_kg: product.price_kg.toString() });
    setEditImageFile(null);
  };

  const handleUpdateProduct = async () => {
    if (!editingProduct.name.trim()) return;
    try {
      await onUpdateProduct(editingProduct.id, { name: editingProduct.name, category: editingProduct.category }, editImageFile);
      setEditingProduct(null); setEditImageFile(null);
    } catch (error) { console.error("Error updating product:", error); }
  };

  return (
    <div>
      {/* Search + actions */}
      <div style={{ display: "flex", gap: "8px", marginBottom: "12px", flexWrap: "wrap" }}>
        <input placeholder="🔍 Buscar producto..." value={search} onChange={e => setSearch(e.target.value)}
          style={{ flex: 1, minWidth: "140px", padding: "10px 14px", borderRadius: "10px", border: "1.5px solid #e5e7eb", fontSize: "14px", background: "#f9fafb" }} />
        <button onClick={() => setShowAddForm(!showAddForm)} style={{
          padding: "10px 14px", background: "#8b5cf6", color: "#fff",
          border: "none", borderRadius: "10px", cursor: "pointer", fontWeight: 600, fontSize: "13px",
        }}>
          {showAddForm ? "✕" : "+ Producto"}
        </button>
      </div>

      <div style={{ display: "flex", gap: "6px", marginBottom: "12px", flexWrap: "wrap" }}>
        <ActionBtn onClick={handleSaveAll} bg="#15803d" color="#fff" disabled={saving} style={{ flex: "0 1 auto", padding: "8px 14px" }}>
          {saving ? "Guardando..." : "💾 Guardar Todo"}
        </ActionBtn>
        <label style={{
          padding: "8px 14px", background: "#eff6ff", color: "#2563eb",
          borderRadius: "10px", cursor: "pointer", fontWeight: 600, fontSize: "13px",
          display: "flex", alignItems: "center", gap: "4px",
        }}>
          {csvStatus === "uploading" ? "Subiendo..." : "📤 CSV"}
          <input type="file" accept=".csv" onChange={handleFile} style={{ display: "none" }} />
        </label>
        <a href={`data:text/csv;charset=utf-8,id,name,price_piece,price_kg\n${catalog.map(p => `${p.id},${p.name},${p.price_piece},${p.price_kg}`).join("\n")}`}
          download="precios.csv" style={{
            padding: "8px 14px", background: "#f3f4f6", color: "#374151",
            borderRadius: "10px", textDecoration: "none", fontWeight: 600, fontSize: "13px",
            display: "flex", alignItems: "center", gap: "4px",
          }}>📥 Exportar</a>
      </div>

      {csvStatus === "ok" && <p style={{ color: "#16a34a", fontSize: "12px", marginBottom: "8px" }}>✅ CSV importado</p>}
      {csvStatus === "error" && <p style={{ color: "#dc2626", fontSize: "12px", marginBottom: "8px" }}>❌ Error al importar</p>}

      {/* Add Product Form */}
      {showAddForm && (
        <div style={{ background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: "14px", padding: "16px", marginBottom: "12px" }}>
          <h4 style={{ margin: "0 0 12px", fontSize: "15px", fontWeight: 700, color: "#111827" }}>Agregar Producto</h4>
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            <input placeholder="Nombre" value={newProduct.name} onChange={e => setNewProduct({...newProduct, name: e.target.value})}
              style={{ padding: "10px 12px", borderRadius: "10px", border: "1.5px solid #e5e7eb", fontSize: "14px" }} />
            <div style={{ display: "flex", gap: "8px" }}>
              <input type="number" placeholder="$/pieza" value={newProduct.price_piece} onChange={e => setNewProduct({...newProduct, price_piece: e.target.value})}
                style={{ flex: 1, padding: "10px 12px", borderRadius: "10px", border: "1.5px solid #e5e7eb", fontSize: "14px" }} />
              <input type="number" placeholder="$/kg" value={newProduct.price_kg} onChange={e => setNewProduct({...newProduct, price_kg: e.target.value})}
                style={{ flex: 1, padding: "10px 12px", borderRadius: "10px", border: "1.5px solid #e5e7eb", fontSize: "14px" }} />
            </div>
            <div style={{ display: "flex", gap: "8px" }}>
              <select value={newProduct.category} onChange={e => setNewProduct({...newProduct, category: e.target.value})}
                style={{ flex: 1, padding: "10px 12px", borderRadius: "10px", border: "1.5px solid #e5e7eb", fontSize: "14px" }}>
                {categories.map(cat => <option key={cat.id} value={cat.name}>{cat.name}</option>)}
              </select>
              <select value={newProduct.sell_by} onChange={e => setNewProduct({...newProduct, sell_by: e.target.value})}
                style={{ flex: 1, padding: "10px 12px", borderRadius: "10px", border: "1.5px solid #e5e7eb", fontSize: "14px" }}>
                <option value="both">Pieza y Kilo</option>
                <option value="pieces">Solo Pieza</option>
                <option value="kg">Solo Kilo</option>
              </select>
            </div>
            <input type="file" accept="image/*" onChange={e => setImageFile(e.target.files[0])}
              style={{ padding: "8px", borderRadius: "10px", border: "1.5px solid #e5e7eb", fontSize: "13px" }} />
            <div style={{ display: "flex", gap: "8px" }}>
              <ActionBtn onClick={handleAddProduct} bg="#8b5cf6" color="#fff">Agregar</ActionBtn>
              <ActionBtn onClick={() => { setShowAddForm(false); setImageFile(null); }} bg="#f3f4f6" color="#374151">Cancelar</ActionBtn>
            </div>
          </div>
        </div>
      )}

      {/* Product cards (accordion) */}
      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        {filtered.map(product => {
          const isOpen = expandedId === product.id;
          return (
            <div key={product.id} style={{
              background: "#fff", border: "1px solid #e5e7eb", borderRadius: "14px",
              boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
              opacity: product.available !== false ? 1 : 0.5,
              overflow: "hidden",
            }}>
              {/* Row 1: name + badges (always visible, tappable) */}
              <div onClick={() => setExpandedId(isOpen ? null : product.id)} style={{
                display: "flex", alignItems: "center", gap: "8px",
                padding: "12px 14px", cursor: "pointer",
                WebkitTapHighlightColor: "transparent",
              }}>
                <span style={{ flex: 1, fontSize: "14px", fontWeight: 600, color: "#111827", minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {product.name}
                </span>
                <span style={{ fontSize: "11px", color: "#9ca3af", background: "#f3f4f6", padding: "2px 8px", borderRadius: "6px", flexShrink: 0 }}>
                  {product.category || "general"}
                </span>
                <button onClick={e => { e.stopPropagation(); onToggleAvailable(product.id, !product.available); }} style={{
                  padding: "2px 10px", border: "none", borderRadius: "6px", cursor: "pointer", fontSize: "11px", fontWeight: 600, flexShrink: 0,
                  background: product.available !== false ? "#dcfce7" : "#fee2e2",
                  color: product.available !== false ? "#15803d" : "#ef4444",
                }}>
                  {product.available !== false ? "✓" : "✕"}
                </button>
                <span style={{ fontSize: "14px", color: "#9ca3af", transform: isOpen ? "rotate(180deg)" : "none", transition: "transform .2s", flexShrink: 0 }}>▼</span>
              </div>

              {/* Expanded content */}
              {isOpen && (
                <div style={{ padding: "0 14px 14px", borderTop: "1px solid #f3f4f6" }}>
                  {/* Row 2: price inputs side by side */}
                  <div style={{ display: "flex", gap: "8px", marginTop: "10px", marginBottom: "10px" }}>
                    <div style={{ flex: 1 }}>
                      <label style={{ fontSize: "11px", color: "#9ca3af", display: "block", marginBottom: "4px" }}>$/pieza</label>
                      <input type="number" min="0" step="0.5"
                        value={editingPrices[product.id]?.price_piece ?? product.price_piece}
                        onChange={e => onPriceChange(product.id, "price_piece", e.target.value)}
                        style={{ width: "100%", padding: "8px 10px", borderRadius: "8px", border: "1.5px solid #e5e7eb", fontSize: "14px", textAlign: "right", boxSizing: "border-box" }} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <label style={{ fontSize: "11px", color: "#9ca3af", display: "block", marginBottom: "4px" }}>$/kilo</label>
                      <input type="number" min="0" step="0.5"
                        value={editingPrices[product.id]?.price_kg ?? product.price_kg}
                        onChange={e => onPriceChange(product.id, "price_kg", e.target.value)}
                        style={{ width: "100%", padding: "8px 10px", borderRadius: "8px", border: "1.5px solid #e5e7eb", fontSize: "14px", textAlign: "right", boxSizing: "border-box" }} />
                    </div>
                  </div>
                  {/* Row 3: action buttons */}
                  <div style={{ display: "flex", gap: "6px" }}>
                    <ActionBtn onClick={() => onSaveOne(product.id)} bg="#f0fdf4" color="#15803d">💾 Guardar</ActionBtn>
                    <ActionBtn onClick={() => handleEditProduct(product)} bg="#eff6ff" color="#2563eb">✏️ Editar</ActionBtn>
                    <ActionBtn onClick={() => { if (confirm("¿Eliminar este producto?")) onDeleteProduct(product.id); }} bg="#fef2f2" color="#dc2626">🗑️</ActionBtn>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Edit Product Modal */}
      {editingProduct && (
        <>
          <div onClick={() => { setEditingProduct(null); setEditImageFile(null); }} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 300 }} />
          <div style={{
            position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 301,
            background: "#fff", borderRadius: "20px 20px 0 0",
            padding: "20px 20px calc(24px + env(safe-area-inset-bottom, 0px))",
            boxShadow: "0 -8px 30px rgba(0,0,0,0.15)",
          }}>
            <div style={{ width: "36px", height: "4px", background: "#e5e7eb", borderRadius: "2px", margin: "0 auto 16px" }} />
            <h4 style={{ margin: "0 0 14px", fontSize: "16px", fontWeight: 700, color: "#111827" }}>Editar: {editingProduct.name}</h4>
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              <input value={editingProduct.name} onChange={e => setEditingProduct({...editingProduct, name: e.target.value})}
                style={{ padding: "10px 12px", borderRadius: "10px", border: "1.5px solid #e5e7eb", fontSize: "14px" }} />
              <select value={editingProduct.category || categories[0]?.name || 'general'}
                onChange={e => setEditingProduct({...editingProduct, category: e.target.value})}
                style={{ padding: "10px 12px", borderRadius: "10px", border: "1.5px solid #e5e7eb", fontSize: "14px" }}>
                {categories.map(cat => <option key={cat.id} value={cat.name}>{cat.name}</option>)}
              </select>
              <input type="file" accept="image/*" onChange={e => setEditImageFile(e.target.files[0])}
                style={{ padding: "8px", borderRadius: "10px", border: "1.5px solid #e5e7eb", fontSize: "13px" }} />
              {editingProduct.image && <p style={{ margin: 0, fontSize: "11px", color: "#9ca3af" }}>Actual: {editingProduct.image}</p>}
              <div style={{ display: "flex", gap: "8px" }}>
                <ActionBtn onClick={handleUpdateProduct} bg="#2563eb" color="#fff">Actualizar</ActionBtn>
                <ActionBtn onClick={() => { setEditingProduct(null); setEditImageFile(null); }} bg="#f3f4f6" color="#374151">Cancelar</ActionBtn>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

// ─── CategoriesTab ───
const CategoriesTab = ({ categories, onAddCategory }) => {
  const [newCategory, setNewCategory] = useState("");
  const [showAdd, setShowAdd] = useState(false);

  const handleAdd = async () => {
    if (!newCategory.trim()) return;
    try { await onAddCategory(newCategory); setNewCategory(""); setShowAdd(false); }
    catch (e) { console.error("Error adding category:", e); }
  };

  return (
    <div>
      <button onClick={() => setShowAdd(!showAdd)} style={{
        padding: "10px 16px", background: "#8b5cf6", color: "#fff",
        border: "none", borderRadius: "10px", cursor: "pointer", fontWeight: 600, fontSize: "13px", marginBottom: "12px",
      }}>
        {showAdd ? "✕ Cancelar" : "+ Categoría"}
      </button>

      {showAdd && (
        <div style={{ display: "flex", gap: "8px", marginBottom: "12px" }}>
          <input placeholder="Nombre de categoría" value={newCategory} onChange={e => setNewCategory(e.target.value)}
            style={{ flex: 1, padding: "10px 12px", borderRadius: "10px", border: "1.5px solid #e5e7eb", fontSize: "14px" }} />
          <ActionBtn onClick={handleAdd} bg="#8b5cf6" color="#fff" style={{ flex: "0 1 auto", padding: "10px 16px" }}>Agregar</ActionBtn>
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        {categories.map(cat => (
          <div key={cat.id} style={{
            background: "#fff", border: "1px solid #e5e7eb", borderRadius: "12px",
            padding: "12px 14px", display: "flex", alignItems: "center", justifyContent: "space-between",
          }}>
            <span style={{ fontSize: "14px", fontWeight: 600, color: "#374151" }}>📁 {cat.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

// ─── ShoppingListTab ───
const ShoppingListTab = ({ orders, catalog }) => {
  const activeOrders = orders.filter(o => o.status === "pending" || o.status === "in_progress");

  const consolidated = useMemo(() => {
    const map = {};
    activeOrders.forEach(order => {
      const products = typeof order.products === "string" ? JSON.parse(order.products) : order.products;
      products.forEach(item => {
        const key = `${item.name}-${item.unit}`;
        if (!map[key]) map[key] = { name: item.name, unit: item.unit, quantity: 0, id: item.id };
        map[key].quantity += item.quantity;
      });
    });
    return Object.values(map).sort((a, b) => a.name.localeCompare(b.name));
  }, [activeOrders]);

  const [checked, setChecked] = useState({});
  const toggleCheck = (key) => setChecked(prev => ({ ...prev, [key]: !prev[key] }));

  const getProductImage = (item) => {
    const found = catalog.find(p => p.id === item.id || p.name === item.name);
    const img = found?.image;
    return img ? `${API_BASE_URL}${img}` : "/assets/default-product.svg";
  };

  if (activeOrders.length === 0) {
    return (
      <div style={{ textAlign: "center", padding: "48px 20px", color: "#d1d5db" }}>
        <div style={{ fontSize: "48px", marginBottom: "8px" }}>🛒</div>
        <p style={{ margin: 0, fontSize: "14px", color: "#9ca3af" }}>No hay órdenes activas</p>
      </div>
    );
  }

  return (
    <div>
      <p style={{ color: "#9ca3af", fontSize: "12px", marginBottom: "12px" }}>
        {activeOrders.length} {activeOrders.length === 1 ? "orden activa" : "órdenes activas"} · {consolidated.length} productos
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
        {consolidated.map(item => {
          const key = `${item.name}-${item.unit}`;
          const isDone = checked[key];
          return (
            <div key={key} onClick={() => toggleCheck(key)} style={{
              display: "flex", alignItems: "center", gap: "10px",
              padding: "10px 14px", background: "#fff", borderRadius: "12px",
              border: "1px solid #e5e7eb", cursor: "pointer",
              opacity: isDone ? 0.4 : 1, transition: "opacity 0.2s",
              WebkitTapHighlightColor: "transparent",
            }}>
              <div style={{
                width: "22px", height: "22px", borderRadius: "6px", flexShrink: 0,
                border: isDone ? "none" : "2px solid #d1d5db",
                background: isDone ? "#15803d" : "#fff",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                {isDone && <span style={{ color: "#fff", fontSize: "13px" }}>✓</span>}
              </div>
              <img src={getProductImage(item)} alt={item.name}
                style={{ width: "36px", height: "36px", borderRadius: "8px", objectFit: "cover", flexShrink: 0 }} />
              <span style={{
                flex: 1, fontSize: "14px", fontWeight: 600, color: "#374151",
                textDecoration: isDone ? "line-through" : "none",
              }}>
                {item.name}
              </span>
              <span style={{
                fontSize: "14px", fontWeight: 700, color: "#15803d",
                background: "#f0fdf4", padding: "4px 10px", borderRadius: "8px",
              }}>
                {item.quantity} {item.unit === "kg" ? "kg" : "pz"}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ─── Main Admin Component ───
const Admin = () => {
  const [orders, setOrders] = useState([]);
  const [users, setUsers] = useState([]);
  const [catalog, setCatalog] = useState([]);
  const [categories, setCategories] = useState([]);
  const [editingPrices, setEditingPrices] = useState({});
  const [invitations, setInvitations] = useState([]);
  const [tab, setTab] = useState("Dashboard");
  const [filterStatus, setFilterStatus] = useState("not_delivered");
  const [filterUser, setFilterUser] = useState("all");

  const fetchOrders = async () => { try { const r = await apiFetch(`${API_BASE_URL}/admin/orders`); setOrders(await r.json()); } catch (e) { console.error("Error:", e); } };
  const fetchUsers = async () => { try { const r = await apiFetch(`${API_BASE_URL}/admin/users`); setUsers(await r.json()); } catch (e) { console.error("Error:", e); } };
  const fetchCategories = async () => { try { const r = await apiFetch(`${API_BASE_URL}/categories`); setCategories(await r.json()); } catch (e) { console.error("Error:", e); } };
  const fetchInvitations = async () => { try { const r = await apiFetch(`${API_BASE_URL}/admin/invitations`); setInvitations(await r.json()); } catch (e) { console.error("Error:", e); } };

  const refreshCatalog = async () => {
    try {
      const r = await apiFetch(`${API_BASE_URL}/products?all=true`);
      const data = await r.json();
      setCatalog(data);
      const initial = {};
      data.forEach(p => { initial[p.id] = { price_piece: p.price_piece, price_kg: p.price_kg }; });
      setEditingPrices(initial);
    } catch (e) { console.error("Error:", e); }
  };

  const handleCreateInvitation = async (multiUse = false) => {
    try { await apiFetch(`${API_BASE_URL}/admin/invitations`, { method: "POST", body: JSON.stringify({ multi_use: multiUse }) }); await fetchInvitations(); }
    catch (e) { console.error("Error:", e); }
  };

  const handleDeactivateInvitation = async (id) => {
    try { await apiFetch(`${API_BASE_URL}/admin/invitations/${id}/deactivate`, { method: "PUT" }); await fetchInvitations(); }
    catch (e) { console.error("Error:", e); }
  };

  useEffect(() => {
    fetchOrders(); fetchUsers(); fetchCategories(); fetchInvitations(); refreshCatalog();
    const interval = setInterval(() => { fetchOrders(); }, 3 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const handleApprove = async (uid, approved) => {
    await apiFetch(`${API_BASE_URL}/admin/users/${uid}/approve`, { method: "PATCH", body: JSON.stringify({ approved }) });
    await fetchUsers();
  };

  const handleDeliverOrder = async (orderId) => {
    if (confirm("¿Marcar como entregado?")) {
      try { await apiFetch(`${API_BASE_URL}/admin/orders/${orderId}/status`, { method: "PUT", body: JSON.stringify({ status: 'delivered' }) }); await fetchOrders(); }
      catch (e) { console.error("Error:", e); }
    }
  };

  const handleStatusChange = async (orderId, status) => {
    try { await apiFetch(`${API_BASE_URL}/admin/orders/${orderId}/status`, { method: "PUT", body: JSON.stringify({ status }) }); await fetchOrders(); }
    catch (e) { console.error("Error:", e); }
  };

  const handlePriceChange = (id, field, value) => { setEditingPrices(prev => ({ ...prev, [id]: { ...prev[id], [field]: value } })); };

  const handleSavePrice = async (id) => { await apiFetch(`${API_BASE_URL}/admin/products/${id}`, { method: "PUT", body: JSON.stringify(editingPrices[id]) }); await refreshCatalog(); };

  const handleSaveAll = async () => {
    const products = Object.entries(editingPrices).map(([id, prices]) => ({ id: Number(id), ...prices }));
    await apiFetch(`${API_BASE_URL}/admin/products/bulk`, { method: "POST", body: JSON.stringify({ products }) });
    await refreshCatalog();
  };

  const handleCsvUpload = async (file) => {
    const formData = new FormData(); formData.append("file", file);
    const token = localStorage.getItem("local_token") || (auth.currentUser && await auth.currentUser.getIdToken());
    if (!token) throw new Error("Not authenticated");
    const res = await fetch(`${API_BASE_URL}/admin/products/csv`, { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: formData });
    const result = await res.json(); await refreshCatalog(); alert(`✅ ${result.updated} productos actualizados`);
  };

  const handleAddProduct = async (productData, imageFile) => {
    const formData = new FormData();
    formData.append("name", productData.name); formData.append("price_piece", productData.price_piece);
    formData.append("price_kg", productData.price_kg); formData.append("category", productData.category);
    formData.append("sell_by", productData.sell_by || "both");
    if (imageFile) formData.append("image", imageFile);
    const token = localStorage.getItem("local_token") || (auth.currentUser && await auth.currentUser.getIdToken());
    if (!token) throw new Error("Not authenticated");
    const res = await fetch(`${API_BASE_URL}/admin/products`, { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: formData });
    if (res.ok) await refreshCatalog(); else throw new Error("Failed to add product");
  };

  const handleDeleteProduct = async (productId) => { await apiFetch(`${API_BASE_URL}/admin/products/${productId}`, { method: "DELETE" }); await refreshCatalog(); };

  const handleToggleAvailable = async (productId, available) => {
    await apiFetch(`${API_BASE_URL}/admin/products/${productId}/available`, { method: "PUT", body: JSON.stringify({ available }) });
    setCatalog(prev => prev.map(p => p.id === productId ? { ...p, available } : p));
  };

  const handleUpdateProduct = async (productId, productData, imageFile) => {
    const formData = new FormData(); formData.append("name", productData.name); formData.append("category", productData.category);
    if (imageFile) formData.append("image", imageFile);
    const token = localStorage.getItem("local_token") || (auth.currentUser && await auth.currentUser.getIdToken());
    if (!token) throw new Error("Not authenticated");
    const res = await fetch(`${API_BASE_URL}/admin/products/${productId}/details`, { method: "PUT", headers: { Authorization: `Bearer ${token}` }, body: formData });
    if (res.ok) await refreshCatalog(); else throw new Error("Failed to update product");
  };

  const handleAddCategory = async (categoryName) => {
    await apiFetch(`${API_BASE_URL}/admin/categories`, { method: "POST", body: JSON.stringify({ name: categoryName }) });
    await fetchCategories();
  };

  // --- Stats ---
  const stats = useMemo(() => {
    const total = orders.length;
    const pending = orders.filter(o => o.status === "pending" || !o.status).length;
    const inProgress = orders.filter(o => o.status === "in_progress").length;
    const delivered = orders.filter(o => o.status === "delivered").length;
    const uniqueUsers = new Set(orders.map(o => o.user_email)).size;
    const totalItems = orders.reduce((acc, o) => acc + (o.products?.length || 0), 0);
    const revenue = catalog.length
      ? orders.filter(o => o.status !== "cancelled").reduce((acc, o) => acc + calcOrderTotal(o.products, catalog), 0)
      : null;
    return { total, pending, inProgress, delivered, uniqueUsers, totalItems, revenue };
  }, [orders, catalog]);

  const topProducts = useMemo(() => {
    const counts = {};
    orders.forEach(o => { o.products?.forEach(p => { counts[p.name] = (counts[p.name] || 0) + 1; }); });
    return Object.entries(counts).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count).slice(0, 8);
  }, [orders]);

  const ordersPerUser = useMemo(() => {
    const counts = {};
    orders.forEach(o => { const email = o.user_email?.split("@")[0] || o.uid; counts[email] = (counts[email] || 0) + 1; });
    return Object.entries(counts).map(([name, count]) => ({ name, count }));
  }, [orders]);

  const uniqueUsers = useMemo(() => [...new Set(orders.map(o => o.user_email))], [orders]);
  const filteredOrders = useMemo(() => orders.filter(o => {
    const status = o.status || "pending";
    let statusMatch;
    if (filterStatus === "all") statusMatch = true;
    else if (filterStatus === "not_delivered") statusMatch = status !== "delivered";
    else statusMatch = status === filterStatus;
    const userMatch = filterUser === "all" || o.user_email === filterUser;
    return statusMatch && userMatch;
  }), [orders, filterStatus, filterUser]);

  const ordersByUser = useMemo(() => {
    const groups = {};
    filteredOrders.forEach(o => { const key = o.user_email || o.uid; if (!groups[key]) groups[key] = []; groups[key].push(o); });
    return groups;
  }, [filteredOrders]);

  const CHART_COLORS = ["#3b82f6","#22c55e","#f59e0b","#ef4444","#8b5cf6","#06b6d4","#f97316","#ec4899"];

  return (
    <div style={{ padding: "16px 16px 120px", maxWidth: "600px", margin: "0 auto" }}>
      {/* Header */}
      <div style={{ marginBottom: "12px" }}>
        <h2 style={{ margin: "0 0 4px", color: "#111827", fontSize: "22px", fontWeight: 700 }}>
          Panel Admin
        </h2>
        <p style={{ margin: 0, fontSize: "13px", color: "#9ca3af" }}>
          Gestiona tu tienda
        </p>
      </div>

      {/* Grid 3x2 tabs */}
      <div style={{
        display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "6px",
        marginBottom: "16px",
      }}>
        {TAB_ITEMS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{
            padding: "10px 6px", borderRadius: "10px", border: "none", cursor: "pointer",
            fontWeight: 600, fontSize: "12px",
            background: tab === t.key ? "#111827" : "#f3f4f6",
            color: tab === t.key ? "#fff" : "#6b7280",
            WebkitTapHighlightColor: "transparent",
            transition: "all .15s",
            display: "flex", flexDirection: "column", alignItems: "center", gap: "2px",
          }}>
            <span style={{ fontSize: "18px", lineHeight: 1 }}>{t.icon}</span>
            <span>{t.label}</span>
          </button>
        ))}
      </div>

      {/* ─── DASHBOARD ─── */}
      {tab === "Dashboard" && (
        <div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginBottom: "20px" }}>
            <StatCard label="Total Órdenes" value={stats.total} color="#2563eb" icon="📋" />
            <StatCard label="Pendientes" value={stats.pending} color="#d97706" icon="🕐" />
            <StatCard label="En Progreso" value={stats.inProgress} color="#2563eb" icon="📦" />
            <StatCard label="Entregadas" value={stats.delivered} color="#16a34a" icon="✅" />
            <StatCard label="Clientes" value={stats.uniqueUsers} color="#7c3aed" icon="👥" />
            <StatCard label="Productos" value={stats.totalItems} color="#0891b2" icon="🏷️" />
            {stats.revenue !== null && (
              <StatCard label="Ingreso (est.)" value={formatMXN(stats.revenue)} color="#15803d" icon="💰" />
            )}
          </div>

          {/* Charts */}
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: "14px", padding: "16px", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
              <h4 style={{ margin: "0 0 12px", fontSize: "14px", fontWeight: 700, color: "#374151" }}>Productos Más Pedidos</h4>
              {topProducts.length === 0 ? <p style={{ color: "#9ca3af", fontSize: "13px" }}>Sin datos</p> : (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={topProducts} layout="vertical" margin={{ left: 0 }}>
                    <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
                    <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 10 }} />
                    <Tooltip />
                    <Bar dataKey="count" radius={[0, 6, 6, 0]}>
                      {topProducts.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
            <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: "14px", padding: "16px", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
              <h4 style={{ margin: "0 0 12px", fontSize: "14px", fontWeight: 700, color: "#374151" }}>Órdenes por Cliente</h4>
              {ordersPerUser.length === 0 ? <p style={{ color: "#9ca3af", fontSize: "13px" }}>Sin datos</p> : (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={ordersPerUser} margin={{ left: 0 }}>
                    <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                      {ordersPerUser.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ─── ORDERS ─── */}
      {tab === "Orders" && (
        <div>
          <div style={{ display: "flex", gap: "8px", marginBottom: "14px" }}>
            <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
              style={{ flex: 1, padding: "10px 12px", borderRadius: "10px", border: "1.5px solid #e5e7eb", fontSize: "13px", background: "#f9fafb" }}>
              <option value="not_delivered">No entregadas</option>
              <option value="all">Todos</option>
              <option value="pending">Pendientes</option>
              <option value="in_progress">En Progreso</option>
              <option value="delivered">Entregadas</option>
            </select>
            <select value={filterUser} onChange={e => setFilterUser(e.target.value)}
              style={{ flex: 1, padding: "10px 12px", borderRadius: "10px", border: "1.5px solid #e5e7eb", fontSize: "13px", background: "#f9fafb" }}>
              <option value="all">Todos</option>
              {uniqueUsers.map(u => <option key={u} value={u}>{u?.split("@")[0]}</option>)}
            </select>
          </div>

          {Object.keys(ordersByUser).length === 0 ? (
            <div style={{ textAlign: "center", padding: "48px 20px", color: "#d1d5db" }}>
              <div style={{ fontSize: "48px", marginBottom: "8px" }}>📋</div>
              <p style={{ margin: 0, fontSize: "14px", color: "#9ca3af" }}>Sin órdenes</p>
            </div>
          ) : (
            Object.entries(ordersByUser).map(([email, userOrders]) => (
              <div key={email} style={{ marginBottom: "16px" }}>
                <div style={{ fontSize: "12px", color: "#9ca3af", fontWeight: 600, marginBottom: "8px", letterSpacing: "0.3px" }}>
                  👤 {email?.split("@")[0]} — {userOrders.length} {userOrders.length > 1 ? "órdenes" : "orden"}
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  {userOrders.map(order => (
                    <div key={order.id} style={{
                      background: "#fff", border: "1px solid #e5e7eb", borderRadius: "14px",
                      overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
                    }}>
                      {/* Order header */}
                      <div style={{
                        padding: "10px 14px", background: "#f9fafb", borderBottom: "1px solid #f3f4f6",
                        display: "flex", justifyContent: "space-between", alignItems: "center",
                      }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          <span style={{ fontSize: "14px", fontWeight: 700, color: "#374151" }}>#{order.id}</span>
                          {catalog.length > 0 && (
                            <span style={{ fontWeight: 700, color: "#15803d", fontSize: "13px" }}>
                              {formatMXN(calcOrderTotal(order.products, catalog))}
                            </span>
                          )}
                        </div>
                        <Badge status={order.status} />
                      </div>

                      <div style={{ padding: "10px 14px" }}>
                        {/* Products */}
                        {order.products.map((p, i) => (
                          <div key={i} style={{
                            display: "flex", alignItems: "center", gap: "8px",
                            padding: "4px 0", fontSize: "13px", color: "#374151",
                            borderBottom: i < order.products.length - 1 ? "1px solid #f3f4f6" : "none",
                          }}>
                            <span style={{ flex: 1 }}>{p.name}</span>
                            <span style={{ color: "#6b7280", fontSize: "12px" }}>{p.quantity} {p.unit === "pieces" ? "pz" : "kg"}</span>
                          </div>
                        ))}

                        {/* Status actions */}
                        <div style={{ display: "flex", gap: "6px", marginTop: "10px" }}>
                          {order.status === 'delivered' ? (
                            <ActionBtn onClick={() => handleStatusChange(order.id, 'pending')} bg="#f3f4f6" color="#6b7280">
                              ↩️ Reiniciar
                            </ActionBtn>
                          ) : (
                            <>
                              {order.status === 'pending' && (
                                <ActionBtn onClick={() => handleStatusChange(order.id, 'in_progress')} bg="#eff6ff" color="#2563eb">
                                  📦 Progreso
                                </ActionBtn>
                              )}
                              {(order.status === 'pending' || order.status === 'in_progress') && (
                                <ActionBtn onClick={() => handleDeliverOrder(order.id)} bg="#f0fdf4" color="#15803d">
                                  ✅ Entregar
                                </ActionBtn>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* ─── SHOPPING LIST ─── */}
      {tab === "ShoppingList" && <ShoppingListTab orders={orders} catalog={catalog} />}

      {/* ─── USERS ─── */}
      {tab === "Users" && (
        <div>
          {/* Invitations section (first for visibility) */}
          <div style={{ marginBottom: "20px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "10px" }}>
              <h4 style={{ margin: 0, fontSize: "15px", fontWeight: 700, color: "#111827" }}>🔗 Invitaciones</h4>
            </div>
            <div style={{ display: "flex", gap: "6px", marginBottom: "10px" }}>
              <ActionBtn onClick={() => handleCreateInvitation(false)} bg="#ede9fe" color="#7c3aed">
                + Individual
              </ActionBtn>
              <ActionBtn onClick={() => handleCreateInvitation(true)} bg="#f0fdf4" color="#15803d">
                + Multi-uso
              </ActionBtn>
            </div>
            <p style={{ color: "#9ca3af", fontSize: "11px", marginBottom: "10px" }}>
              Individuales: 7 días, un solo uso. Multi-uso: sin expiración.
            </p>

            {invitations.length === 0 ? (
              <p style={{ textAlign: "center", padding: "20px", color: "#d1d5db", fontSize: "13px" }}>No hay invitaciones</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {invitations.map(inv => {
                  const isDeactivated = inv.is_active === false;
                  const isUsed = !inv.multi_use && !!inv.used_by;
                  const isExpired = !isDeactivated && !isUsed && inv.expires_at && new Date(inv.expires_at) < new Date();
                  const isAvailable = !isDeactivated && !isUsed && !isExpired;
                  const link = `${window.location.origin}/register/${inv.code}`;

                  let statusLabel, statusBg, statusColor;
                  if (isDeactivated) { statusLabel = "Desactivado"; statusBg = "#f3f4f6"; statusColor = "#6b7280"; }
                  else if (isUsed) { statusLabel = "Usado"; statusBg = "#dcfce7"; statusColor = "#166534"; }
                  else if (isExpired) { statusLabel = "Expirado"; statusBg = "#fef2f2"; statusColor = "#dc2626"; }
                  else { statusLabel = "Activo"; statusBg = "#dbeafe"; statusColor = "#1d4ed8"; }

                  return (
                    <div key={inv.id} style={{
                      background: "#fff", border: "1px solid #e5e7eb", borderRadius: "12px",
                      padding: "10px 14px", boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
                    }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: isAvailable ? "8px" : "0" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                          <span style={{
                            padding: "3px 8px", borderRadius: "6px", fontSize: "11px", fontWeight: 600,
                            background: inv.multi_use ? "#f0fdf4" : "#f3f4f6",
                            color: inv.multi_use ? "#15803d" : "#6b7280",
                          }}>
                            {inv.multi_use ? "Multi-uso" : "Individual"}
                          </span>
                          <span style={{ padding: "3px 8px", borderRadius: "6px", fontSize: "11px", fontWeight: 600, background: statusBg, color: statusColor }}>
                            {statusLabel}
                          </span>
                        </div>
                        <span style={{ fontSize: "11px", color: "#9ca3af" }}>
                          {new Date(inv.created_at).toLocaleDateString("es-MX")}
                        </span>
                      </div>
                      {isAvailable && (
                        <div style={{ display: "flex", gap: "6px" }}>
                          <input readOnly value={link} style={{
                            flex: 1, padding: "8px 10px", borderRadius: "8px", border: "1.5px solid #e5e7eb",
                            fontSize: "11px", color: "#374151", background: "#f9fafb",
                          }} />
                          <button onClick={() => navigator.clipboard.writeText(link)} style={{
                            padding: "8px 12px", background: "#eff6ff", color: "#2563eb",
                            border: "none", borderRadius: "8px", cursor: "pointer", fontSize: "12px", fontWeight: 600,
                            WebkitTapHighlightColor: "transparent",
                          }}>Copiar</button>
                          <button onClick={() => handleDeactivateInvitation(inv.id)} style={{
                            padding: "8px 12px", background: "#fef2f2", color: "#dc2626",
                            border: "none", borderRadius: "8px", cursor: "pointer", fontSize: "12px", fontWeight: 600,
                            WebkitTapHighlightColor: "transparent",
                          }}>✕</button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Users list */}
          <div style={{ borderTop: "1px solid #e5e7eb", paddingTop: "16px" }}>
            <h4 style={{ margin: "0 0 10px", fontSize: "15px", fontWeight: 700, color: "#111827" }}>👥 Usuarios Registrados</h4>
            <p style={{ color: "#9ca3af", fontSize: "12px", marginBottom: "10px" }}>
              Aprueba o rechaza el acceso de cada usuario.
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {users.map(u => (
                <div key={u.uid} style={{
                  background: "#fff", border: "1px solid #e5e7eb", borderRadius: "12px",
                  padding: "12px 14px", display: "flex", alignItems: "center", gap: "10px",
                }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: "13px", fontWeight: 600, color: "#374151", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {u.email}
                      {u.is_admin && (
                        <span style={{ marginLeft: "6px", fontSize: "10px", background: "#ede9fe", color: "#7c3aed", padding: "2px 6px", borderRadius: "999px", fontWeight: 700 }}>Admin</span>
                      )}
                    </div>
                    <div style={{ fontSize: "11px", color: u.is_approved ? "#16a34a" : "#d97706", fontWeight: 600, marginTop: "2px" }}>
                      {u.is_approved ? "✓ Aprobado" : "⏳ Pendiente"}
                    </div>
                  </div>
                  {!u.is_approved && (
                    <button onClick={() => handleApprove(u.uid, true)} style={{
                      padding: "8px 14px", background: "#f0fdf4", color: "#15803d",
                      border: "none", borderRadius: "8px", cursor: "pointer", fontSize: "12px", fontWeight: 600,
                      WebkitTapHighlightColor: "transparent",
                    }}>Aprobar</button>
                  )}
                  {u.is_approved && !u.is_admin && (
                    <button onClick={() => handleApprove(u.uid, false)} style={{
                      padding: "8px 14px", background: "#fef2f2", color: "#dc2626",
                      border: "none", borderRadius: "8px", cursor: "pointer", fontSize: "12px", fontWeight: 600,
                      WebkitTapHighlightColor: "transparent",
                    }}>Revocar</button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ─── PRICES ─── */}
      {tab === "Prices" && (
        <PricesTab catalog={catalog} editingPrices={editingPrices} onPriceChange={handlePriceChange}
          onSaveOne={handleSavePrice} onSaveAll={handleSaveAll} onCsvUpload={handleCsvUpload}
          onAddProduct={handleAddProduct} onDeleteProduct={handleDeleteProduct}
          onToggleAvailable={handleToggleAvailable} categories={categories} onUpdateProduct={handleUpdateProduct} />
      )}

      {/* ─── CATEGORIES ─── */}
      {tab === "Categories" && <CategoriesTab categories={categories} onAddCategory={handleAddCategory} />}
    </div>
  );
};

export default Admin;
