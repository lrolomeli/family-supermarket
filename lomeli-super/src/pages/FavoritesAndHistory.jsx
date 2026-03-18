import React, { useEffect, useState } from "react";
import { auth } from "../firebase";
import API_BASE_URL from "../config";
import apiFetch from "../api";
import { calcOrderTotal, formatMXN } from "../utils/pricing";

const FavoritesAndHistory = () => {
  const [activeTab, setActiveTab] = useState('favorites');
  const [favorites, setFavorites] = useState([]);
  const [orderHistory, setOrderHistory] = useState([]);
  const [productCatalog, setProductCatalog] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const user = auth.currentUser;

  useEffect(() => {
    fetch(`${API_BASE_URL}/products`)
      .then(r => r.json())
      .then(data => setProductCatalog(data))
      .catch(console.error);
  }, []);

  useEffect(() => {
    if (!user) return;
    loadData().catch((e) => console.error("Error loading data:", e));
  }, [user, activeTab]);

  const loadData = async () => {
    setLoading(true);
    setError("");
    setSuccess("");
    
    try {
      if (activeTab === 'favorites') {
        const response = await apiFetch(`${API_BASE_URL}/favorites`);
        const data = await response.json();
        setFavorites(data);
      } else {
        const response = await apiFetch(`${API_BASE_URL}/orders/history`);
        const data = await response.json();
        setOrderHistory(data);
      }
    } catch (error) {
      setError("Error loading data");
      console.error("Error loading data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleReorder = async (favoriteId) => {
    try {
      const response = await apiFetch(`${API_BASE_URL}/favorites/${favoriteId}/reorder`, {
        method: "POST"
      });
      
      if (response.ok) {
        setSuccess("✅ Pedido creado exitosamente desde favoritos!");
        setTimeout(() => setSuccess(""), 3000);
      } else {
        const errorData = await response.json();
        setError(errorData.message || "No se pudo crear el pedido");
      }
    } catch (error) {
      setError("Error de conexión. Intenta nuevamente.");
      console.error("Error reordering:", error);
    }
  };

  const handleDeleteFavorite = async (favoriteId) => {
    if (!confirm("¿Eliminar este pedido de favoritos?")) return;
    
    try {
      const response = await apiFetch(`${API_BASE_URL}/favorites/${favoriteId}`, {
        method: "DELETE"
      });
      
      if (response.ok) {
        setFavorites(prev => prev.filter(fav => fav.id !== favoriteId));
        setSuccess("✅ Favorito eliminado exitosamente!");
        setTimeout(() => setSuccess(""), 3000);
      } else {
        const errorData = await response.json();
        setError(errorData.message || "No se pudo eliminar el favorito");
      }
    } catch (error) {
      setError("Error de conexión. Intenta nuevamente.");
      console.error("Error deleting favorite:", error);
    }
  };

  const getProductImage = (name) => {
    const found = productCatalog.find((p) => p.name === name);
    return found ? (found.image || '/assets/default-product.svg') : '/assets/default-product.svg';
  };

  const getStatusBadge = (status) => {
    const colors = {
      pending: { bg: "#fff8e1", color: "#f59e0b", label: "Pendiente" },
      in_progress: { bg: "#dbeafe", color: "#3b82f6", label: "En Progreso" },
      delivered: { bg: "#dcfce7", color: "#22c55e", label: "Entregado" },
    };
    const s = colors[status] || colors.pending;
    return (
      <span style={{
        background: s.bg, color: s.color,
        padding: "2px 8px", borderRadius: "999px",
        fontSize: "11px", fontWeight: 600, textTransform: "uppercase",
      }}>
        {s.label}
      </span>
    );
  };

  return (
    <div style={{ maxWidth: "720px", margin: "0 auto", padding: "24px 16px" }}>
      <h2 style={{ marginBottom: "20px" }}>Mis Pedidos</h2>

      {/* Tabs */}
      <div style={{ 
        display: "flex", gap: "4px", marginBottom: "20px",
        borderBottom: "1px solid #e5e7eb"
      }}>
        <button
          onClick={() => setActiveTab('favorites')}
          style={{
            padding: "8px 16px",
            background: activeTab === 'favorites' ? "#3b82f6" : "transparent",
            color: activeTab === 'favorites' ? "#fff" : "#6b7280",
            border: "none",
            borderRadius: "8px 8px 0 0",
            cursor: "pointer",
            fontSize: "14px",
            fontWeight: 500
          }}
        >
          Favoritos
        </button>
        <button
          onClick={() => setActiveTab('history')}
          style={{
            padding: "8px 16px",
            background: activeTab === 'history' ? "#3b82f6" : "transparent",
            color: activeTab === 'history' ? "#fff" : "#6b7280",
            border: "none",
            borderRadius: "8px 8px 0 0",
            cursor: "pointer",
            fontSize: "14px",
            fontWeight: 500
          }}
        >
          Historial
        </button>
      </div>

      {/* Messages */}
      {error && (
        <div style={{
          marginBottom: "16px", padding: "12px 16px", borderRadius: "8px",
          backgroundColor: "#fef2f2", border: "1px solid #fecaca", color: "#dc2626"
        }}>
          ⚠️ {error}
        </div>
      )}
      
      {success && (
        <div style={{
          marginBottom: "16px", padding: "12px 16px", borderRadius: "8px",
          backgroundColor: "#f0fdf4", border: "1px solid #bbf7d0", color: "#16a34a"
        }}>
          ✅ {success}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div style={{ textAlign: "center", padding: "48px", color: "#6b7280" }}>
          Cargando...
        </div>
      )}

      {/* Favorites Tab */}
      {activeTab === 'favorites' && !loading && (
        <div>
          {favorites.length === 0 ? (
            <div style={{
              textAlign: "center", padding: "48px", background: "#f9fafb",
              borderRadius: "12px", border: "1px solid #e5e7eb"
            }}>
              <p style={{ fontSize: "16px", color: "#6b7280" }}>No tienes pedidos favoritos</p>
              <p style={{ fontSize: "14px", color: "#9ca3af", marginTop: "8px" }}>
                Guarda tus pedidos frecuentes para pedirlos rápidamente
              </p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              {favorites.map((favorite) => (
                <div key={favorite.id} style={{
                  background: "#fff", border: "1px solid #e5e7eb", borderRadius: "12px",
                  padding: "16px", boxShadow: "0 1px 3px rgba(0,0,0,0.1)"
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "12px" }}>
                    <div>
                      <h3 style={{ margin: "0 0 4px 0", fontSize: "16px", color: "#374151" }}>
                        {favorite.name}
                      </h3>
                      <p style={{ margin: "0", fontSize: "12px", color: "#9ca3af" }}>
                        Guardado el {new Date(favorite.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <div style={{ display: "flex", gap: "8px" }}>
                      <button
                        onClick={() => handleReorder(favorite.id)}
                        style={{
                          padding: "6px 12px", background: "#22c55e", color: "#fff",
                          border: "none", borderRadius: "6px", cursor: "pointer", fontSize: "12px"
                        }}
                      >
                        Pedir de nuevo
                      </button>
                      <button
                        onClick={() => handleDeleteFavorite(favorite.id)}
                        style={{
                          padding: "6px 12px", background: "#ef4444", color: "#fff",
                          border: "none", borderRadius: "6px", cursor: "pointer", fontSize: "12px"
                        }}
                      >
                        Eliminar
                      </button>
                    </div>
                  </div>
                  
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                    {favorite.products.map((product, i) => (
                      <span key={i} style={{
                        background: "#f9fafb", border: "1px solid #e5e7eb",
                        borderRadius: "6px", padding: "4px 8px", fontSize: "13px", color: "#374151"
                      }}>
                        {product.name} — {product.quantity} {product.unit}
                      </span>
                    ))}
                  </div>
                  
                  <div style={{ marginTop: "12px", textAlign: "right" }}>
                    <span style={{ fontSize: "16px", fontWeight: 600, color: "#374151" }}>
                      {formatMXN(calcOrderTotal(favorite.products, productCatalog))}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* History Tab */}
      {activeTab === 'history' && !loading && (
        <div>
          {orderHistory.length === 0 ? (
            <div style={{
              textAlign: "center", padding: "48px", background: "#f9fafb",
              borderRadius: "12px", border: "1px solid #e5e7eb"
            }}>
              <p style={{ fontSize: "16px", color: "#6b7280" }}>No tienes historial de pedidos</p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              {orderHistory.map((order) => (
                <div key={order.id} style={{
                  background: "#fff", border: "1px solid #e5e7eb", borderRadius: "12px",
                  padding: "16px", boxShadow: "0 1px 3px rgba(0,0,0,0.1)"
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                    <div>
                      <h3 style={{ margin: "0 0 4px 0", fontSize: "16px", color: "#374151" }}>
                        Pedido #{order.id}
                      </h3>
                      <p style={{ margin: "0", fontSize: "12px", color: "#9ca3af" }}>
                        {new Date(order.created_at).toLocaleDateString()} {new Date(order.created_at).toLocaleTimeString()}
                      </p>
                    </div>
                    {getStatusBadge(order.status)}
                  </div>
                  
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                    {order.products.map((product, i) => (
                      <span key={i} style={{
                        background: "#f9fafb", border: "1px solid #e5e7eb",
                        borderRadius: "6px", padding: "4px 8px", fontSize: "13px", color: "#374151"
                      }}>
                        {product.name} — {product.quantity} {product.unit}
                      </span>
                    ))}
                  </div>
                  
                  <div style={{ marginTop: "12px", textAlign: "right" }}>
                    <span style={{ fontSize: "16px", fontWeight: 600, color: "#374151" }}>
                      {formatMXN(calcOrderTotal(order.products, productCatalog))}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default FavoritesAndHistory;
