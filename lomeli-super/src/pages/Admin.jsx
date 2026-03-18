import React, { useEffect, useState, useMemo } from "react";
import { auth } from "../firebase";
import API_BASE_URL from "../config";
import apiFetch from "../api";
import { calcOrderTotal, formatMXN } from "../utils/pricing";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell
} from "recharts";

const STATUS_COLORS = {
  pending:   { bg: "#fff8e1", color: "#f59e0b" },
  completed: { bg: "#e8f5e9", color: "#22c55e" },
  cancelled: { bg: "#fce4ec", color: "#ef4444" },
};

const Badge = ({ status = "pending" }) => {
  const s = STATUS_COLORS[status] || STATUS_COLORS.pending;
  return (
    <span style={{
      background: s.bg, color: s.color, padding: "2px 10px",
      borderRadius: "999px", fontSize: "12px", fontWeight: 600, textTransform: "uppercase"
    }}>{status}</span>
  );
};

const StatCard = ({ label, value, color = "#3b82f6" }) => (
  <div style={{
    background: "#fff", border: "1px solid #e5e7eb", borderRadius: "12px",
    padding: "20px 24px", flex: 1, minWidth: "140px",
    boxShadow: "0 1px 4px rgba(0,0,0,0.06)"
  }}>
    <div style={{ fontSize: "13px", color: "#6b7280", marginBottom: "6px" }}>{label}</div>
    <div style={{ fontSize: "28px", fontWeight: 700, color }}>{value}</div>
  </div>
);

const TAB_DISPLAY_NAMES = {
  "Dashboard": "Panel",
  "Orders": "Órdenes", 
  "Users": "Usuarios",
  "Prices": "Productos",
  "Categories": "Categorías",
  "Requests": "Solicitudes"
};

const TABS = ["Dashboard", "Orders", "Users", "Prices", "Categories", "Requests"];

const PricesTab = ({ catalog, editingPrices, onPriceChange, onSaveOne, onSaveAll, onCsvUpload, onAddProduct, onDeleteProduct, categories, onUpdateProduct }) => {
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);
  const [csvStatus, setCsvStatus] = useState(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [newProduct, setNewProduct] = useState({
    name: "",
    price_piece: "",
    price_kg: "",
    category: categories[0]?.name || "general"
  });
  const [imageFile, setImageFile] = useState(null);
  const [editImageFile, setEditImageFile] = useState(null);

  const filtered = catalog.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase())
  );

  const handleSaveAll = async () => {
    setSaving(true);
    await onSaveAll();
    setSaving(false);
  };

  const handleFile = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setCsvStatus("uploading");
    try {
      await onCsvUpload(file);
      setCsvStatus("ok");
    } catch {
      setCsvStatus("error");
    }
    e.target.value = "";
  };

  const handleAddProduct = async () => {
    if (!newProduct.name.trim()) return;
    
    try {
      await onAddProduct(newProduct, imageFile);
      setNewProduct({ name: "", price_piece: "", price_kg: "", category: categories[0]?.name || "general" });
      setImageFile(null);
      setShowAddForm(false);
    } catch (error) {
      console.error("Error adding product:", error);
    }
  };

  const handleDeleteProduct = async (productId) => {
    if (confirm("¿Estás seguro de eliminar este producto?")) {
      await onDeleteProduct(productId);
    }
  };

  const handleEditProduct = (product) => {
    setEditingProduct({
      ...product,
      price_piece: product.price_piece.toString(),
      price_kg: product.price_kg.toString()
    });
    setEditImageFile(null);
  };

  const handleUpdateProduct = async () => {
    if (!editingProduct.name.trim()) return;
    
    try {
      const updateData = {
        name: editingProduct.name,
        category: editingProduct.category
      };
      
      await onUpdateProduct(editingProduct.id, updateData, editImageFile);
      setEditingProduct(null);
      setEditImageFile(null);
    } catch (error) {
      console.error("Error updating product:", error);
    }
  };

  const handleCancelEdit = () => {
    setEditingProduct(null);
    setEditImageFile(null);
  };

  return (
    <div>
      {/* Toolbar */}
      <div style={{ display: "flex", gap: "10px", marginBottom: "16px", flexWrap: "wrap", alignItems: "center" }}>
        <input
          placeholder="Buscar producto..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ padding: "7px 12px", borderRadius: "8px", border: "1px solid #d1d5db", fontSize: "14px", flex: 1, minWidth: "180px" }}
        />
        <button onClick={handleSaveAll} disabled={saving} style={{
          padding: "7px 18px", background: "#22c55e", color: "#fff",
          border: "none", borderRadius: "8px", cursor: "pointer", fontWeight: 600, fontSize: "14px"
        }}>
          {saving ? "Guardando..." : "Guardar Todo"}
        </button>
        <label style={{
          padding: "7px 18px", background: "#3b82f6", color: "#fff",
          borderRadius: "8px", cursor: "pointer", fontWeight: 600, fontSize: "14px"
        }}>
          {csvStatus === "uploading" ? "Subiendo..." : "Subir CSV"}
          <input type="file" accept=".csv" onChange={handleFile} style={{ display: "none" }} />
        </label>
        <a
          href={`data:text/csv;charset=utf-8,id,name,price_piece,price_kg\n${catalog.map(p => `${p.id},${p.name},${p.price_piece},${p.price_kg}`).join("\n")}`}
          download="precios.csv"
          style={{
            padding: "7px 18px", background: "#f3f4f6", color: "#374151",
            borderRadius: "8px", textDecoration: "none", fontWeight: 600, fontSize: "14px"
          }}
        >
          Exportar CSV
        </a>
        <button onClick={() => setShowAddForm(!showAddForm)} style={{
          padding: "7px 18px", background: "#8b5cf6", color: "#fff",
          border: "none", borderRadius: "8px", cursor: "pointer", fontWeight: 600, fontSize: "14px"
        }}>
          {showAddForm ? "Cancelar" : "Agregar Producto"}
        </button>
      </div>
      {csvStatus === "ok" && <p style={{ color: "#22c55e", marginBottom: "10px", fontSize: "13px" }}>✅ CSV importado correctamente</p>}
      {csvStatus === "error" && <p style={{ color: "#ef4444", marginBottom: "10px", fontSize: "13px" }}>❌ Error al importar CSV</p>}

      <p style={{ color: "#9ca3af", fontSize: "12px", marginBottom: "12px" }}>
        Formato CSV: columnas <code>id, name, price_piece, price_kg</code>
      </p>

      {/* Add Product Form */}
      {showAddForm && (
        <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "12px", padding: "20px", marginBottom: "16px" }}>
          <h3 style={{ margin: "0 0 16px", fontSize: "16px", fontWeight: 600, color: "#1e293b" }}>Agregar Nuevo Producto</h3>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "12px", marginBottom: "16px" }}>
            <input
              placeholder="Nombre del producto"
              value={newProduct.name}
              onChange={e => setNewProduct({...newProduct, name: e.target.value})}
              style={{ padding: "8px 12px", borderRadius: "8px", border: "1px solid #d1d5db", fontSize: "14px" }}
            />
            <input
              type="number"
              placeholder="Precio por pieza"
              value={newProduct.price_piece}
              onChange={e => setNewProduct({...newProduct, price_piece: e.target.value})}
              style={{ padding: "8px 12px", borderRadius: "8px", border: "1px solid #d1d5db", fontSize: "14px" }}
            />
            <input
              type="number"
              placeholder="Precio por kg"
              value={newProduct.price_kg}
              onChange={e => setNewProduct({...newProduct, price_kg: e.target.value})}
              style={{ padding: "8px 12px", borderRadius: "8px", border: "1px solid #d1d5db", fontSize: "14px" }}
            />
            <select
              value={newProduct.category}
              onChange={e => setNewProduct({...newProduct, category: e.target.value})}
              style={{ padding: "8px 12px", borderRadius: "8px", border: "1px solid #d1d5db", fontSize: "14px" }}
            >
              {categories.map(cat => (
                <option key={cat.id} value={cat.name}>{cat.name}</option>
              ))}
            </select>
          </div>
          <div style={{ marginBottom: "16px" }}>
            <label style={{ display: "block", marginBottom: "8px", fontSize: "14px", fontWeight: 500, color: "#374151" }}>
              Imagen del Producto (opcional)
            </label>
            <input
              type="file"
              accept="image/*"
              onChange={e => setImageFile(e.target.files[0])}
              style={{ padding: "8px 12px", borderRadius: "8px", border: "1px solid #d1d5db", fontSize: "14px", width: "100%" }}
            />
          </div>
          <div style={{ display: "flex", gap: "10px" }}>
            <button onClick={handleAddProduct} style={{
              padding: "8px 20px", background: "#8b5cf6", color: "#fff",
              border: "none", borderRadius: "8px", cursor: "pointer", fontWeight: 600, fontSize: "14px"
            }}>
              Agregar Producto
            </button>
            <button onClick={() => {
              setShowAddForm(false);
              setNewProduct({ name: "", price_piece: "", price_kg: "", category: categories[0]?.name || "general" });
              setImageFile(null);
            }} style={{
              padding: "8px 20px", background: "#f3f4f6", color: "#374151",
              border: "none", borderRadius: "8px", cursor: "pointer", fontWeight: 600, fontSize: "14px"
            }}>
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Table */}
      <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: "12px", overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "14px" }}>
          <thead>
            <tr style={{ background: "#f9fafb", borderBottom: "1px solid #e5e7eb" }}>
              <th style={{ padding: "12px 16px", textAlign: "left", color: "#6b7280" }}>Producto</th>
              <th style={{ padding: "12px 16px", textAlign: "right", color: "#6b7280" }}>$ / pieza</th>
              <th style={{ padding: "12px 16px", textAlign: "right", color: "#6b7280" }}>$ / kg</th>
              <th style={{ padding: "12px 16px", textAlign: "center", color: "#6b7280" }}>Categoría</th>
              <th style={{ padding: "12px 16px", textAlign: "center", color: "#6b7280" }}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((product, i) => (
              <tr key={product.id} style={{ borderBottom: i < filtered.length - 1 ? "1px solid #f3f4f6" : "none" }}>
                <td style={{ padding: "10px 16px", fontWeight: 500, color: "#374151" }}>{product.name}</td>
                <td style={{ padding: "10px 16px", textAlign: "right" }}>
                  <input type="number" min="0" step="0.5"
                    value={editingPrices[product.id]?.price_piece ?? product.price_piece}
                    onChange={e => onPriceChange(product.id, "price_piece", e.target.value)}
                    style={{ width: "80px", padding: "4px 8px", borderRadius: "6px", border: "1px solid #d1d5db", textAlign: "right" }}
                  />
                </td>
                <td style={{ padding: "10px 16px", textAlign: "right" }}>
                  <input type="number" min="0" step="0.5"
                    value={editingPrices[product.id]?.price_kg ?? product.price_kg}
                    onChange={e => onPriceChange(product.id, "price_kg", e.target.value)}
                    style={{ width: "80px", padding: "4px 8px", borderRadius: "6px", border: "1px solid #d1d5db", textAlign: "right" }}
                  />
                </td>
                <td style={{ padding: "10px 16px", textAlign: "center" }}>
                  <span style={{
                    padding: "4px 8px", background: "#f3f4f6", color: "#374151",
                    borderRadius: "4px", fontSize: "12px", fontWeight: 500
                  }}>
                    {product.category || 'general'}
                  </span>
                </td>
                <td style={{ padding: "10px 16px", textAlign: "center" }}>
                  <button onClick={() => handleEditProduct(product)} style={{
                    padding: "4px 14px", background: "#3b82f6", color: "#fff",
                    border: "none", borderRadius: "6px", cursor: "pointer", fontSize: "13px", marginRight: "6px"
                  }}>Editar</button>
                  <button onClick={() => onSaveOne(product.id)} style={{
                    padding: "4px 14px", background: "#f3f4f6", color: "#374151",
                    border: "none", borderRadius: "6px", cursor: "pointer", fontSize: "13px", marginRight: "6px"
                  }}>Guardar</button>
                  <button onClick={() => handleDeleteProduct(product.id)} style={{
                    padding: "4px 14px", background: "#fee2e2", color: "#ef4444",
                    border: "none", borderRadius: "6px", cursor: "pointer", fontSize: "13px"
                  }}>Eliminar</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Edit Product Modal */}
      {editingProduct && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000,
          display: "flex", alignItems: "center", justifyContent: "center"
        }}>
          <div style={{
            background: "#fff", borderRadius: "12px", padding: "24px",
            maxWidth: "500px", width: "90%", maxHeight: "90vh", overflow: "auto"
          }}>
            <h3 style={{ margin: "0 0 20px", fontSize: "18px", fontWeight: 600, color: "#1e293b" }}>
              Editar Producto: {editingProduct.name}
            </h3>
            
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <div>
                <label style={{ display: "block", marginBottom: "6px", fontSize: "14px", fontWeight: 500, color: "#374151" }}>
                  Nombre del Producto
                </label>
                <input
                  value={editingProduct.name}
                  onChange={e => setEditingProduct({...editingProduct, name: e.target.value})}
                  style={{ width: "100%", padding: "8px 12px", borderRadius: "8px", border: "1px solid #d1d5db", fontSize: "14px" }}
                />
              </div>

              <div>
                <label style={{ display: "block", marginBottom: "6px", fontSize: "14px", fontWeight: 500, color: "#374151" }}>
                  Categoría
                </label>
                <select
                  value={editingProduct.category || categories[0]?.name || 'general'}
                  onChange={e => setEditingProduct({...editingProduct, category: e.target.value})}
                  style={{ width: "100%", padding: "8px 12px", borderRadius: "8px", border: "1px solid #d1d5db", fontSize: "14px" }}
                >
                  {categories.map(cat => (
                    <option key={cat.id} value={cat.name}>{cat.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: "block", marginBottom: "6px", fontSize: "14px", fontWeight: 500, color: "#374151" }}>
                  Imagen del Producto (opcional)
                </label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={e => setEditImageFile(e.target.files[0])}
                  style={{ width: "100%", padding: "8px 12px", borderRadius: "8px", border: "1px solid #d1d5db", fontSize: "14px" }}
                />
                {editingProduct.image && (
                  <div style={{ marginTop: "8px", fontSize: "12px", color: "#6b7280" }}>
                    Actual: {editingProduct.image}
                  </div>
                )}
              </div>

              <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end", marginTop: "8px" }}>
                <button onClick={handleCancelEdit} style={{
                  padding: "8px 20px", background: "#f3f4f6", color: "#374151",
                  border: "none", borderRadius: "8px", cursor: "pointer", fontWeight: 600, fontSize: "14px"
                }}>
                  Cancelar
                </button>
                <button onClick={handleUpdateProduct} style={{
                  padding: "8px 20px", background: "#3b82f6", color: "#fff",
                  border: "none", borderRadius: "8px", cursor: "pointer", fontWeight: 600, fontSize: "14px"
                }}>
                  Actualizar Producto
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const CategoriesTab = ({ categories, onAddCategory }) => {
  const [newCategory, setNewCategory] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);

  const handleAddCategory = async () => {
    if (!newCategory.trim()) return;
    
    try {
      await onAddCategory(newCategory);
      setNewCategory("");
      setShowAddForm(false);
    } catch (error) {
      console.error("Error adding category:", error);
    }
  };

  return (
    <div>
      {/* Toolbar */}
      <div style={{ display: "flex", gap: "10px", marginBottom: "16px", alignItems: "center" }}>
        <button onClick={() => setShowAddForm(!showAddForm)} style={{
          padding: "7px 18px", background: "#8b5cf6", color: "#fff",
          border: "none", borderRadius: "8px", cursor: "pointer", fontWeight: 600, fontSize: "14px"
        }}>
          {showAddForm ? "Cancelar" : "Agregar Categoría"}
        </button>
      </div>

      {/* Add Category Form */}
      {showAddForm && (
        <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "12px", padding: "20px", marginBottom: "16px" }}>
          <h3 style={{ margin: "0 0 16px", fontSize: "16px", fontWeight: 600, color: "#1e293b" }}>Agregar Nueva Categoría</h3>
          <div style={{ display: "flex", gap: "12px", marginBottom: "16px" }}>
            <input
              placeholder="Nombre de la categoría"
              value={newCategory}
              onChange={e => setNewCategory(e.target.value)}
              style={{ flex: 1, padding: "8px 12px", borderRadius: "8px", border: "1px solid #d1d5db", fontSize: "14px" }}
            />
          </div>
          <div style={{ display: "flex", gap: "10px" }}>
            <button onClick={handleAddCategory} style={{
              padding: "8px 20px", background: "#8b5cf6", color: "#fff",
              border: "none", borderRadius: "8px", cursor: "pointer", fontWeight: 600, fontSize: "14px"
            }}>
              Agregar Categoría
            </button>
            <button onClick={() => {
              setShowAddForm(false);
              setNewCategory("");
            }} style={{
              padding: "8px 20px", background: "#f3f4f6", color: "#374151",
              border: "none", borderRadius: "8px", cursor: "pointer", fontWeight: 600, fontSize: "14px"
            }}>
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Categories List */}
      <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: "12px", overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "14px" }}>
          <thead>
            <tr style={{ background: "#f9fafb", borderBottom: "1px solid #e5e7eb" }}>
              <th style={{ padding: "12px 16px", textAlign: "left", color: "#6b7280" }}>Nombre de Categoría</th>
              <th style={{ padding: "12px 16px", textAlign: "center", color: "#6b7280" }}>Cantidad de Productos</th>
            </tr>
          </thead>
          <tbody>
            {categories.map((category, i) => (
              <tr key={category.id} style={{ borderBottom: i < categories.length - 1 ? "1px solid #f3f4f6" : "none" }}>
                <td style={{ padding: "12px 16px", fontWeight: 500, color: "#374151" }}>{category.name}</td>
                <td style={{ padding: "12px 16px", textAlign: "center", color: "#6b7280" }}>
                  {/* Product count would need to be calculated */}
                  -
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const RequestsTab = ({ requests, onRequestResponse }) => {
  const [respondingTo, setRespondingTo] = useState(null);
  const [response, setResponse] = useState("");

  const handleRespond = (request) => {
    console.log('Opening response form for request:', request.id, request);
    setRespondingTo(request.id);
    setResponse("");
  };

  const submitResponse = async (status) => {
    if (!respondingTo) return;
    
    // Use a default response if admin didn't type anything
    const finalResponse = response.trim() || (status === 'approved' ? 'Aprobado' : 'Rechazado');
    
    console.log('=== SUBMITTING ADMIN RESPONSE ===');
    console.log('respondingTo:', respondingTo);
    console.log('status:', status);
    console.log('finalResponse:', finalResponse);
    console.log('Current requests count:', requests.length);
    
    try {
      await onRequestResponse(respondingTo, status, finalResponse);
      console.log('✅ onRequestResponse completed successfully');
      console.log('Requests after response:', requests.length);
    } catch (error) {
      console.error('❌ Error in submitResponse:', error);
    }
    
    setRespondingTo(null);
    setResponse("");
  };

  const handleCleanup = async () => {
    if (!confirm("¿Eliminar todas las solicitudes pendientes? Esta acción no se puede deshacer.")) return;
    
    try {
      const response = await apiFetch(`${API_BASE_URL}/admin/requests/cleanup`, {
        method: "DELETE"
      });
      
      if (response.ok) {
        const data = await response.json();
        alert(`Se eliminaron ${data.deleted.length} solicitudes pendientes`);
        window.location.reload(); // Refresh to update the list
      }
    } catch (error) {
      console.error("Error cleaning up requests:", error);
      alert("Error al limpiar solicitudes");
    }
  };

  const getRequestTypeLabel = (type) => {
    switch(type) {
      case 'modify': return 'Modificar pedido';
      case 'cancel': return 'Cancelar pedido';
      case 'add_items': return 'Agregar productos';
      default: return type;
    }
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
        <h3 style={{ fontSize: "18px", color: "#374151", margin: 0 }}>Solicitudes Pendientes</h3>
        {requests.length > 0 && (
          <button onClick={handleCleanup} style={{
            padding: "6px 16px", background: "#ef4444", color: "#fff",
            border: "none", borderRadius: "8px", cursor: "pointer", fontSize: "13px"
          }}>
            Limpiar Todo
          </button>
        )}
      </div>
      
      {requests.length === 0 ? (
        <div style={{
          textAlign: "center", padding: "48px", background: "#f9fafb",
          borderRadius: "12px", border: "1px solid #e5e7eb"
        }}>
          <p style={{ fontSize: "16px", color: "#6b7280" }}>No hay solicitudes pendientes</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {requests.map((request) => (
            <div key={request.id} style={{
              background: "#fff", border: "1px solid #e5e7eb", borderRadius: "12px",
              padding: "20px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)"
            }}>
              {/* Header */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                <div>
                  <span style={{ fontWeight: 600, color: "#374151" }}>Orden #{request.order_id}</span>
                  <span style={{ margin: "0 12px", color: "#9ca3af" }}>•</span>
                  <span style={{ color: "#6b7280" }}>{request.user_email}</span>
                </div>
                <div style={{ fontSize: "12px", color: "#9ca3af" }}>
                  {new Date(request.created_at).toLocaleString('es-MX')}
                </div>
              </div>

              {/* Request Type */}
              <div style={{ marginBottom: "8px" }}>
                <span style={{
                  padding: "4px 8px", borderRadius: "6px", fontSize: "12px",
                  background: "#fef3c7", color: "#92400e", fontWeight: 500
                }}>
                  {getRequestTypeLabel(request.request_type)}
                </span>
              </div>

              {/* Message */}
              <div style={{ marginBottom: "12px" }}>
                <p style={{ margin: "0", color: "#374151", lineHeight: "1.5" }}>
                  {request.message}
                </p>
              </div>

              {/* Actions */}
              {respondingTo !== request.id && (
                <div style={{ display: "flex", gap: "8px" }}>
                  <button onClick={() => handleRespond(request)} style={{
                    padding: "6px 16px", background: "#3b82f6", color: "#fff",
                    border: "none", borderRadius: "8px", cursor: "pointer", fontSize: "13px"
                  }}>
                    Responder
                  </button>
                </div>
              )}

              {/* Response Form */}
              {respondingTo === request.id && (
                <div style={{ marginTop: "12px", padding: "12px", backgroundColor: "#f8fafc", borderRadius: "8px" }}>
                  <textarea
                    value={response}
                    onChange={(e) => setResponse(e.target.value)}
                    placeholder="Escribe tu respuesta al cliente..."
                    style={{
                      width: "100%", minHeight: "80px", padding: "8px",
                      borderRadius: "6px", border: "1px solid #d1d5db", fontSize: "14px",
                      resize: "vertical", marginBottom: "8px"
                    }}
                  />
                  <div style={{ display: "flex", gap: "8px" }}>
                    <button onClick={() => submitResponse('approved')} style={{
                      padding: "6px 16px", background: "#22c55e", color: "#fff",
                      border: "none", borderRadius: "8px", cursor: "pointer", fontSize: "13px"
                    }}>
                      Aprobar y permitir edición
                    </button>
                    <button onClick={() => submitResponse('rejected')} style={{
                      padding: "6px 16px", background: "#ef4444", color: "#fff",
                      border: "none", borderRadius: "8px", cursor: "pointer", fontSize: "13px"
                    }}>
                      Rechazar (pedido bloqueado)
                    </button>
                    <button onClick={() => { setRespondingTo(null); setResponse(""); }} style={{
                      padding: "6px 16px", background: "#f3f4f6", color: "#374151",
                      border: "none", borderRadius: "8px", cursor: "pointer", fontSize: "13px"
                    }}>
                      Cancelar
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const Admin = () => {
  const [orders, setOrders] = useState([]);
  const [users, setUsers] = useState([]);
  const [catalog, setCatalog] = useState([]);
  const [categories, setCategories] = useState([]);
  const [editingPrices, setEditingPrices] = useState({});
  const [requests, setRequests] = useState([]);
  const [tab, setTab] = useState("Dashboard");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterUser, setFilterUser] = useState("all");

  const fetchOrders = async () => {
    try {
      const response = await apiFetch(`${API_BASE_URL}/admin/orders`);
      const data = await response.json();
      setOrders(data);
    } catch (error) {
      console.error("Error fetching orders:", error);
    }
  };

  const fetchUsers = async () => {
    try {
      const res = await apiFetch(`${API_BASE_URL}/admin/users`);
      setUsers(await res.json());
    } catch (error) {
      console.error("Error fetching users:", error);
    }
  };

  const fetchCategories = async () => {
    try {
      const res = await apiFetch(`${API_BASE_URL}/categories`);
      setCategories(await res.json());
    } catch (error) {
      console.error("Error fetching categories:", error);
    }
  };

  const fetchRequests = async () => {
    try {
      const res = await apiFetch(`${API_BASE_URL}/admin/requests`);
      const data = await res.json();
      // Only show pending requests
      setRequests(data.filter(req => req.status === 'pending'));
    } catch (error) {
      console.error("Error fetching requests:", error);
    }
  };

  useEffect(() => {
    fetchOrders();
    fetchUsers();
    fetchCategories();
    fetchRequests();
    fetch(`${API_BASE_URL}/products`)
      .then(r => r.json())
      .then(data => {
        setCatalog(data);
        const initial = {};
        data.forEach(p => { initial[p.id] = { price_piece: p.price_piece, price_kg: p.price_kg }; });
        setEditingPrices(initial);
      })
      .catch(console.error);
  }, []);

  const handleApprove = async (uid, approved) => {
    await apiFetch(`${API_BASE_URL}/admin/users/${uid}/approve`, {
      method: "PATCH",
      body: JSON.stringify({ approved }),
    });
    await fetchUsers();
  };

  const handleDeliverOrder = async (orderId) => {
    if (confirm("¿Estás seguro de que quieres marcar este pedido como entregado? Esta acción no se puede deshacer.")) {
      try {
        await apiFetch(`${API_BASE_URL}/admin/orders/${orderId}/status`, {
          method: "PUT",
          body: JSON.stringify({ status: 'delivered' }),
        });
        await fetchOrders();
      } catch (error) {
        console.error("Error delivering order:", error);
      }
    }
  };

  const handleStatusChange = async (orderId, status) => {
    try {
      await apiFetch(`${API_BASE_URL}/admin/orders/${orderId}/status`, {
        method: "PUT",
        body: JSON.stringify({ status }),
      });
      await fetchOrders();
    } catch (error) {
      console.error("Error updating order status:", error);
    }
  };

  const handleRequestResponse = async (requestId, status, adminResponse) => {
    try {
      console.log('=== HANDLE REQUEST RESPONSE ===');
      console.log('requestId:', requestId);
      console.log('status:', status);
      console.log('adminResponse:', adminResponse);
      console.log('Current requests before:', requests.length);
      
      const response = await apiFetch(`${API_BASE_URL}/admin/requests/${requestId}/respond`, {
        method: "PUT",
        body: JSON.stringify({ status, admin_response: adminResponse }),
      });
      
      console.log('Admin response API status:', response.status);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Admin response error:', errorText);
        throw new Error(`Failed to respond to request: ${errorText}`);
      }
      
      const responseData = await response.json();
      console.log('Admin response success:', responseData);
      
      // Remove the request from the list since it's no longer pending
      console.log('Removing request from list...');
      const newRequests = requests.filter(req => req.id !== requestId);
      console.log('Requests after filter:', newRequests.length);
      setRequests(newRequests);
      
      console.log('Fetching updated orders...');
      await fetchOrders(); // Refresh orders in case status changed
      
      console.log('✅ handleRequestResponse completed');
    } catch (error) {
      console.error("❌ Error responding to request:", error);
    }
  };

  const handlePriceChange = (id, field, value) => {
    setEditingPrices(prev => ({ ...prev, [id]: { ...prev[id], [field]: value } }));
  };

  const handleSavePrice = async (id) => {
    await apiFetch(`${API_BASE_URL}/admin/products/${id}`, {
      method: "PUT",
      body: JSON.stringify(editingPrices[id]),
    });
    const updated = await fetch(`${API_BASE_URL}/products`).then(r => r.json());
    setCatalog(updated);
  };

  const handleSaveAll = async () => {
    const products = Object.entries(editingPrices).map(([id, prices]) => ({
      id: Number(id), ...prices,
    }));
    await apiFetch(`${API_BASE_URL}/admin/products/bulk`, {
      method: "POST",
      body: JSON.stringify({ products }),
    });
    const updated = await fetch(`${API_BASE_URL}/products`).then(r => r.json());
    setCatalog(updated);
  };

  const handleCsvUpload = async (file) => {
    const formData = new FormData();
    formData.append("file", file);
    const token = await auth.currentUser.getIdToken();
    const res = await fetch(`${API_BASE_URL}/admin/products/csv`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    });
    const result = await res.json();
    const updated = await fetch(`${API_BASE_URL}/products`).then(r => r.json());
    setCatalog(updated);
    const initial = {};
    updated.forEach(p => { initial[p.id] = { price_piece: p.price_piece, price_kg: p.price_kg }; });
    setEditingPrices(initial);
    alert(`✅ ${result.updated} productos actualizados`);
  };

  const handleAddProduct = async (productData, imageFile) => {
    const formData = new FormData();
    formData.append("name", productData.name);
    formData.append("price_piece", productData.price_piece);
    formData.append("price_kg", productData.price_kg);
    formData.append("category", productData.category);
    if (imageFile) {
      formData.append("image", imageFile);
    }

    const token = await auth.currentUser.getIdToken();
    const res = await fetch(`${API_BASE_URL}/admin/products`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    });

    if (res.ok) {
      const updated = await fetch(`${API_BASE_URL}/products`).then(r => r.json());
      setCatalog(updated);
      const initial = {};
      updated.forEach(p => { initial[p.id] = { price_piece: p.price_piece, price_kg: p.price_kg }; });
      setEditingPrices(initial);
    } else {
      throw new Error("Failed to add product");
    }
  };

  const handleDeleteProduct = async (productId) => {
    await apiFetch(`${API_BASE_URL}/admin/products/${productId}`, {
      method: "DELETE",
    });
    const updated = await fetch(`${API_BASE_URL}/products`).then(r => r.json());
    setCatalog(updated);
    const initial = {};
    updated.forEach(p => { initial[p.id] = { price_piece: p.price_piece, price_kg: p.price_kg }; });
    setEditingPrices(initial);
  };

  const handleUpdateProduct = async (productId, productData, imageFile) => {
    const formData = new FormData();
    formData.append("name", productData.name);
    formData.append("category", productData.category);
    if (imageFile) {
      formData.append("image", imageFile);
    }

    const token = await auth.currentUser.getIdToken();
    const res = await fetch(`${API_BASE_URL}/admin/products/${productId}/details`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    });

    if (res.ok) {
      const updated = await fetch(`${API_BASE_URL}/products`).then(r => r.json());
      setCatalog(updated);
      const initial = {};
      updated.forEach(p => { initial[p.id] = { price_piece: p.price_piece, price_kg: p.price_kg }; });
      setEditingPrices(initial);
    } else {
      throw new Error("Failed to update product");
    }
  };

  const handleAddCategory = async (categoryName) => {
    await apiFetch(`${API_BASE_URL}/admin/categories`, {
      method: "POST",
      body: JSON.stringify({ name: categoryName }),
    });
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
      ? orders.filter(o => o.status !== "cancelled")
          .reduce((acc, o) => acc + calcOrderTotal(o.products, catalog), 0)
      : null;
    return { total, pending, inProgress, delivered, uniqueUsers, totalItems, revenue };
  }, [orders, catalog]);

  // Top products chart data
  const topProducts = useMemo(() => {
    const counts = {};
    orders.forEach(o => {
      o.products?.forEach(p => {
        counts[p.name] = (counts[p.name] || 0) + 1;
      });
    });
    return Object.entries(counts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);
  }, [orders]);

  // Orders per user chart data
  const ordersPerUser = useMemo(() => {
    const counts = {};
    orders.forEach(o => {
      const email = o.user_email?.split("@")[0] || o.uid;
      counts[email] = (counts[email] || 0) + 1;
    });
    return Object.entries(counts).map(([name, count]) => ({ name, count }));
  }, [orders]);

  // Filtered orders
  const uniqueUsers = useMemo(() => [...new Set(orders.map(o => o.user_email))], [orders]);
  const filteredOrders = useMemo(() => orders.filter(o => {
    const statusMatch = filterStatus === "all" || (o.status || "pending") === filterStatus;
    const userMatch = filterUser === "all" || o.user_email === filterUser;
    return statusMatch && userMatch;
  }), [orders, filterStatus, filterUser]);

  // Group filtered orders by user
  const ordersByUser = useMemo(() => {
    const groups = {};
    filteredOrders.forEach(o => {
      const key = o.user_email || o.uid;
      if (!groups[key]) groups[key] = [];
      groups[key].push(o);
    });
    return groups;
  }, [filteredOrders]);

  const CHART_COLORS = ["#3b82f6","#22c55e","#f59e0b","#ef4444","#8b5cf6","#06b6d4","#f97316","#ec4899"];

  return (
    <div style={{ maxWidth: "960px", margin: "0 auto", padding: "24px 16px" }}>
      <h2 style={{ marginBottom: "20px" }}>Panel de Administración</h2>

      {/* Tabs */}
      <div style={{ display: "flex", gap: "8px", marginBottom: "24px" }}>
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            padding: "8px 20px", borderRadius: "8px", border: "none", cursor: "pointer",
            fontWeight: 600, fontSize: "14px",
            background: tab === t ? "#3b82f6" : "#f3f4f6",
            color: tab === t ? "#fff" : "#374151",
          }}>{TAB_DISPLAY_NAMES[t]}</button>
        ))}
      </div>

      {/* DASHBOARD TAB */}
      {tab === "Dashboard" && (
        <div>
          {/* Stat cards */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: "12px", marginBottom: "28px" }}>
            <StatCard label="Total Orders" value={stats.total} color="#3b82f6" />
            <StatCard label="Pendientes" value={stats.pending} color="#f59e0b" />
            <StatCard label="En Progreso" value={stats.inProgress} color="#3b82f6" />
            <StatCard label="Entregadas" value={stats.delivered} color="#22c55e" />
            <StatCard label="Customers" value={stats.uniqueUsers} color="#8b5cf6" />
            <StatCard label="Total Items" value={stats.totalItems} color="#06b6d4" />
            {stats.revenue !== null && (
              <StatCard label="Revenue (est.)" value={formatMXN(stats.revenue)} color="#10b981" />
            )}
          </div>

          {/* Charts */}
          <div style={{ display: "flex", gap: "16px", flexWrap: "wrap" }}>
            <div style={{
              flex: 1, minWidth: "280px", background: "#fff", border: "1px solid #e5e7eb",
              borderRadius: "12px", padding: "20px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)"
            }}>
              <h3 style={{ marginBottom: "16px", fontSize: "15px", color: "#374151" }}>Top Products Ordered</h3>
              {topProducts.length === 0 ? <p style={{ color: "#9ca3af" }}>No data yet</p> : (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={topProducts} layout="vertical" margin={{ left: 10 }}>
                    <XAxis type="number" allowDecimals={false} tick={{ fontSize: 12 }} />
                    <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Bar dataKey="count" radius={[0, 6, 6, 0]}>
                      {topProducts.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>

            <div style={{
              flex: 1, minWidth: "280px", background: "#fff", border: "1px solid #e5e7eb",
              borderRadius: "12px", padding: "20px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)"
            }}>
              <h3 style={{ marginBottom: "16px", fontSize: "15px", color: "#374151" }}>Orders per Customer</h3>
              {ordersPerUser.length === 0 ? <p style={{ color: "#9ca3af" }}>No data yet</p> : (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={ordersPerUser} margin={{ left: 0 }}>
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
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

      {/* ORDERS TAB */}
      {tab === "Orders" && (
        <div>
          {/* Filters */}
          <div style={{ display: "flex", gap: "12px", marginBottom: "20px", flexWrap: "wrap" }}>
            <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
              style={{ padding: "7px 12px", borderRadius: "8px", border: "1px solid #d1d5db", fontSize: "14px" }}>
              <option value="all">Todos los estados</option>
              <option value="pending">Pendientes</option>
              <option value="in_progress">En Progreso</option>
              <option value="delivered">Entregadas</option>
            </select>
            <select value={filterUser} onChange={e => setFilterUser(e.target.value)}
              style={{ padding: "7px 12px", borderRadius: "8px", border: "1px solid #d1d5db", fontSize: "14px" }}>
              <option value="all">All customers</option>
              {uniqueUsers.map(u => <option key={u} value={u}>{u}</option>)}
            </select>
          </div>

          {/* Orders grouped by user */}
          {Object.keys(ordersByUser).length === 0 ? (
            <p style={{ color: "#9ca3af" }}>No orders match the filter.</p>
          ) : (
            Object.entries(ordersByUser).map(([email, userOrders]) => (
              <div key={email} style={{ marginBottom: "24px" }}>
                <h3 style={{ fontSize: "15px", color: "#6b7280", marginBottom: "10px" }}>
                  {email} — {userOrders.length} order{userOrders.length > 1 ? "s" : ""}
                </h3>
                <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                  {userOrders.map(order => (
                    <div key={order.id} style={{
                      background: "#fff", border: "1px solid #e5e7eb", borderRadius: "12px",
                      padding: "16px 20px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)"
                    }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
                        <span style={{ fontWeight: 600, color: "#374151" }}>Order #{order.id}</span>
                        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                          {catalog.length > 0 && (
                            <span style={{ fontWeight: 700, color: "#22c55e" }}>
                              {formatMXN(calcOrderTotal(order.products, catalog))}
                            </span>
                          )}
                          <span style={{
                            padding: "4px 8px", borderRadius: "6px", fontSize: "12px", fontWeight: 600,
                            backgroundColor: order.status === 'delivered' ? '#dcfce7' : 
                                           order.status === 'in_progress' ? '#dbeafe' : '#fef3c7',
                            color: order.status === 'delivered' ? '#166534' : 
                                  order.status === 'in_progress' ? '#1d4ed8' : '#92400e'
                          }}>
                            {order.status === 'delivered' ? 'Entregada' : 
                             order.status === 'in_progress' ? 'En Progreso' : 'Pendiente'}
                          </span>
                          <div style={{ display: "flex", gap: "6px" }}>
                            {order.status === 'delivered' ? (
                              <button 
                                onClick={() => handleStatusChange(order.id, 'pending')}
                                style={{
                                  padding: "4px 8px", 
                                  background: "#6b7280", 
                                  color: "#fff",
                                  border: "none", 
                                  borderRadius: "6px", 
                                  fontSize: "12px",
                                  cursor: "pointer"
                                }}
                              >
                                Reiniciar
                              </button>
                            ) : (
                              <>
                                {order.status === 'pending' && (
                                  <button 
                                    onClick={() => handleStatusChange(order.id, 'in_progress')}
                                    style={{
                                      padding: "4px 8px", 
                                      background: "#3b82f6", 
                                      color: "#fff",
                                      border: "none", 
                                      borderRadius: "6px", 
                                      fontSize: "12px",
                                      cursor: "pointer"
                                    }}
                                  >
                                    Iniciar Progreso
                                  </button>
                                )}
                                {(order.status === 'pending' || order.status === 'in_progress') && (
                                  <button 
                                    onClick={() => handleDeliverOrder(order.id)}
                                    style={{
                                      padding: "4px 8px", 
                                      background: "#22c55e", 
                                      color: "#fff",
                                      border: "none", 
                                      borderRadius: "6px", 
                                      fontSize: "12px",
                                      cursor: "pointer"
                                    }}
                                  >
                                    Entregar
                                  </button>
                                )}
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                        {order.products.map((p, i) => (
                          <span key={i} style={{
                            background: "#f9fafb", border: "1px solid #e5e7eb",
                            borderRadius: "6px", padding: "4px 10px", fontSize: "13px", color: "#374151"
                          }}>
                            {p.name} — {p.quantity} {p.unit}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      )}
      {/* USERS TAB */}
      {tab === "Users" && (
        <div>
          <p style={{ color: "#6b7280", fontSize: "14px", marginBottom: "16px" }}>
            Aprueba o rechaza el acceso de cada usuario.
          </p>
          <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: "12px", overflow: "hidden" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "14px" }}>
              <thead>
                <tr style={{ background: "#f9fafb", borderBottom: "1px solid #e5e7eb" }}>
                  <th style={{ padding: "12px 16px", textAlign: "left", color: "#6b7280" }}>Email</th>
                  <th style={{ padding: "12px 16px", textAlign: "center", color: "#6b7280" }}>Estado</th>
                  <th style={{ padding: "12px 16px", textAlign: "center", color: "#6b7280" }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u, i) => (
                  <tr key={u.uid} style={{ borderBottom: i < users.length - 1 ? "1px solid #f3f4f6" : "none" }}>
                    <td style={{ padding: "12px 16px", color: "#374151" }}>
                      {u.email}
                      {u.is_admin && <span style={{ marginLeft: "8px", fontSize: "11px", background: "#ede9fe", color: "#7c3aed", padding: "2px 8px", borderRadius: "999px", fontWeight: 600 }}>Admin</span>}
                    </td>
                    <td style={{ padding: "12px 16px", textAlign: "center" }}>
                      {u.is_approved
                        ? <span style={{ color: "#22c55e", fontWeight: 600 }}>✓ Aprobado</span>
                        : <span style={{ color: "#f59e0b", fontWeight: 600 }}>⏳ Pendiente</span>}
                    </td>
                    <td style={{ padding: "12px 16px", textAlign: "center", display: "flex", gap: "8px", justifyContent: "center" }}>
                      {!u.is_approved && (
                        <button onClick={() => handleApprove(u.uid, true)} style={{
                          padding: "5px 14px", background: "#22c55e", color: "#fff",
                          border: "none", borderRadius: "6px", cursor: "pointer", fontSize: "13px", fontWeight: 600
                        }}>Aprobar</button>
                      )}
                      {u.is_approved && !u.is_admin && (
                        <button onClick={() => handleApprove(u.uid, false)} style={{
                          padding: "5px 14px", background: "#fee2e2", color: "#ef4444",
                          border: "none", borderRadius: "6px", cursor: "pointer", fontSize: "13px", fontWeight: 600
                        }}>Revocar</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* PRICES TAB */}
      {tab === "Prices" && (
        <PricesTab
          catalog={catalog}
          editingPrices={editingPrices}
          onPriceChange={handlePriceChange}
          onSaveOne={handleSavePrice}
          onSaveAll={handleSaveAll}
          onCsvUpload={handleCsvUpload}
          onAddProduct={handleAddProduct}
          onDeleteProduct={handleDeleteProduct}
          categories={categories}
          onUpdateProduct={handleUpdateProduct}
        />
      )}

      {/* CATEGORIES TAB */}
      {tab === "Categories" && (
        <CategoriesTab
          categories={categories}
          onAddCategory={handleAddCategory}
        />
      )}

      {/* REQUESTS TAB */}
      {tab === "Requests" && (
        <RequestsTab
          requests={requests}
          onRequestResponse={handleRequestResponse}
        />
      )}
    </div>
  );
};

export default Admin;
