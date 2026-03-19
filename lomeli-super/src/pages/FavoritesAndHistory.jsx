import { useEffect, useState } from "react";
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
  const [notification, setNotification] = useState(null);

  const firebaseUser = auth.currentUser;
  const localUser = !firebaseUser ? JSON.parse(localStorage.getItem("local_user") || "null") : null;
  const isAuthenticated = !!firebaseUser || !!localUser;

  const showNotification = (title, message, type = 'success') => {
    setNotification({ title, message, type });
  };

  const closeNotification = () => setNotification(null);

  useEffect(() => {
    fetch(`${API_BASE_URL}/products`)
      .then(r => r.json())
      .then(data => setProductCatalog(data))
      .catch(console.error);
  }, []);

  useEffect(() => {
    if (!isAuthenticated) return;
    setFavorites([]);
    setOrderHistory([]);
    loadData().catch(console.error);
  }, [isAuthenticated, activeTab]);

  const loadData = async () => {
    setLoading(true);
    setError("");
    setSuccess("");
    if (activeTab === 'favorites') setFavorites([]);
    else setOrderHistory([]);

    try {
      if (activeTab === 'favorites') {
        const response = await apiFetch(`${API_BASE_URL}/favorites?t=${Date.now()}`);
        setFavorites(await response.json());
      } else {
        const response = await apiFetch(`${API_BASE_URL}/orders/history?t=${Date.now()}`);
        setOrderHistory(await response.json());
      }
    } catch (err) {
      setError("Error al cargar datos");
      console.error("Error loading data:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveAsFavorite = async (order) => {
    const name = prompt("¿Cómo quieres llamar a este pedido favorito?");
    if (!name || !name.trim()) return;

    try {
      const response = await apiFetch(`${API_BASE_URL}/favorites`, {
        method: "POST",
        body: JSON.stringify({ name: name.trim(), products: order.products }),
      });

      if (response.ok) {
        showNotification("Favorito Guardado", `Pedido guardado como "${name.trim()}" en tus favoritos.`, 'success');
        const refreshRes = await apiFetch(`${API_BASE_URL}/favorites?t=${Date.now()}`);
        setFavorites(await refreshRes.json());
      } else {
        const errText = await response.text();
        setError(errText || "No se pudo guardar el favorito");
      }
    } catch (err) {
      setError("Error de conexión. Intenta nuevamente.");
      console.error("Error saving favorite:", err);
    }
  };

  const handleReorder = async (order, isHistory = false) => {
    try {
      let response;
      if (isHistory) {
        response = await apiFetch(`${API_BASE_URL}/orders`, {
          method: "POST",
          body: JSON.stringify({ products: order.products }),
        });
      } else {
        response = await apiFetch(`${API_BASE_URL}/favorites/${order.id}/reorder`, {
          method: "POST",
        });
      }

      if (response.ok) {
        const newOrder = await response.json();
        showNotification("Pedido Creado", `Nuevo pedido #${newOrder.id} creado exitosamente!`, 'success');
      } else {
        const errText = await response.text();
        setError(errText || "No se pudo crear el pedido");
      }
    } catch (err) {
      setError("Error de conexión. Intenta nuevamente.");
      console.error("Error reordering:", err);
    }
  };

  const handleDeleteFavorite = async (favoriteId) => {
    if (!confirm("¿Eliminar este pedido de favoritos?")) return;
    try {
      const response = await apiFetch(`${API_BASE_URL}/favorites/${favoriteId}`, { method: "DELETE" });
      if (response.ok) {
        setFavorites(prev => prev.filter(fav => fav.id !== favoriteId));
        setSuccess("Favorito eliminado exitosamente");
        setTimeout(() => setSuccess(""), 3000);
      } else {
        const errText = await response.text();
        setError(errText || "No se pudo eliminar el favorito");
      }
    } catch (err) {
      setError("Error de conexión. Intenta nuevamente.");
      console.error("Error deleting favorite:", err);
    }
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
    <div style={{ padding: "20px", maxWidth: "800px", margin: "0 auto" }}>
      <h1 style={{ margin: "0 0 20px 0", fontSize: "24px", color: "#1f2937" }}>⭐ Favoritos e Historial</h1>

      {/* Tabs */}
      <div style={{ display: "flex", gap: "4px", marginBottom: "20px", borderBottom: "1px solid #e5e7eb" }}>
        {['favorites', 'history'].map(t => (
          <button key={t} onClick={() => setActiveTab(t)} style={{
            padding: "8px 16px",
            background: activeTab === t ? "#3b82f6" : "transparent",
            color: activeTab === t ? "#fff" : "#6b7280",
            border: "none", borderRadius: "8px 8px 0 0",
            cursor: "pointer", fontSize: "14px", fontWeight: 500
          }}>
            {t === 'favorites' ? 'Favoritos' : 'Historial'}
          </button>
        ))}
      </div>

      {error && (
        <div style={{ marginBottom: "16px", padding: "12px 16px", borderRadius: "8px", backgroundColor: "#fef2f2", border: "1px solid #fecaca", color: "#dc2626" }}>
          ⚠️ {error}
        </div>
      )}
      {success && (
        <div style={{ marginBottom: "16px", padding: "12px 16px", borderRadius: "8px", backgroundColor: "#f0fdf4", border: "1px solid #bbf7d0", color: "#16a34a" }}>
          ✅ {success}
        </div>
      )}

      {loading && <div style={{ textAlign: "center", padding: "48px", color: "#6b7280" }}>Cargando...</div>}

      {/* Favorites Tab */}
      {activeTab === 'favorites' && !loading && (
        <div>
          {favorites.length === 0 ? (
            <div style={{ textAlign: "center", padding: "48px", background: "#f9fafb", borderRadius: "12px", border: "1px solid #e5e7eb" }}>
              <p style={{ fontSize: "16px", color: "#6b7280" }}>No tienes pedidos favoritos</p>
              <p style={{ fontSize: "14px", color: "#9ca3af", marginTop: "8px" }}>Guarda tus pedidos frecuentes para pedirlos rápidamente</p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              {favorites.map((favorite) => (
                <div key={favorite.id} style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: "12px", padding: "16px", boxShadow: "0 1px 3px rgba(0,0,0,0.1)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "12px" }}>
                    <div>
                      <h3 style={{ margin: "0 0 4px 0", fontSize: "16px", color: "#374151" }}>{favorite.name || 'Sin nombre'}</h3>
                      <p style={{ margin: "0", fontSize: "12px", color: "#9ca3af" }}>Guardado el {new Date(favorite.created_at).toLocaleDateString()}</p>
                    </div>
                    <div style={{ display: "flex", gap: "8px" }}>
                      <button onClick={() => handleReorder(favorite, false)} style={{ padding: "6px 12px", background: "#22c55e", color: "#fff", border: "none", borderRadius: "6px", cursor: "pointer", fontSize: "12px" }}>🛒 Pedir de nuevo</button>
                      <button onClick={() => handleDeleteFavorite(favorite.id)} style={{ padding: "6px 12px", background: "#ef4444", color: "#fff", border: "none", borderRadius: "6px", cursor: "pointer", fontSize: "12px" }}>Eliminar</button>
                    </div>
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                    {favorite.products.map((product, i) => (
                      <span key={i} style={{ background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: "6px", padding: "4px 8px", fontSize: "13px", color: "#374151" }}>
                        {product.name} — {product.quantity} {product.unit}
                      </span>
                    ))}
                  </div>
                  <div style={{ marginTop: "12px", textAlign: "right" }}>
                    <span style={{ fontSize: "16px", fontWeight: 600, color: "#374151" }}>{formatMXN(calcOrderTotal(favorite.products, productCatalog))}</span>
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
            <div style={{ textAlign: "center", padding: "48px", background: "#f9fafb", borderRadius: "12px", border: "1px solid #e5e7eb" }}>
              <p style={{ fontSize: "16px", color: "#6b7280" }}>No tienes historial de pedidos</p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              {orderHistory.map((order) => (
                <div key={order.id} style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: "12px", padding: "16px", boxShadow: "0 1px 3px rgba(0,0,0,0.1)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                    <div>
                      <h3 style={{ margin: "0 0 4px 0", fontSize: "16px", color: "#374151" }}>Pedido #{order.id}</h3>
                      <p style={{ margin: "0", fontSize: "12px", color: "#9ca3af" }}>
                        {new Date(order.created_at).toLocaleDateString()} {new Date(order.created_at).toLocaleTimeString()}
                        {order.delivered_at && ` • Entregado el ${new Date(order.delivered_at).toLocaleDateString()}`}
                      </p>
                    </div>
                    <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                      {getStatusBadge(order.status)}
                      <div style={{ display: "flex", gap: "6px" }}>
                        <button onClick={() => handleSaveAsFavorite(order)} style={{ padding: "4px 8px", background: "#f59e0b", color: "#fff", border: "none", borderRadius: "6px", cursor: "pointer", fontSize: "11px" }}>⭐ Favorito</button>
                        <button onClick={() => handleReorder(order, true)} style={{ padding: "4px 8px", background: "#22c55e", color: "#fff", border: "none", borderRadius: "6px", cursor: "pointer", fontSize: "11px" }}>🛒 Pedir de nuevo</button>
                      </div>
                    </div>
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                    {order.products.map((product, i) => (
                      <span key={i} style={{ background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: "6px", padding: "4px 8px", fontSize: "13px", color: "#374151" }}>
                        {product.name} — {product.quantity} {product.unit}
                      </span>
                    ))}
                  </div>
                  <div style={{ marginTop: "12px", textAlign: "right" }}>
                    <span style={{ fontSize: "16px", fontWeight: 600, color: "#374151" }}>{formatMXN(calcOrderTotal(order.products, productCatalog))}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Notification */}
      {notification && (
        <div style={{
          position: "fixed", top: "20px", right: "20px",
          background: notification.type === 'success' ? "#f0fdf4" : notification.type === 'error' ? "#fef2f2" : "#eff6ff",
          border: `1px solid ${notification.type === 'success' ? "#bbf7d0" : notification.type === 'error' ? "#fecaca" : "#bfdbfe"}`,
          color: notification.type === 'success' ? "#166a34" : notification.type === 'error' ? "#dc2626" : "#1e40af",
          padding: "16px 20px", borderRadius: "8px", boxShadow: "0 4px 6px rgba(0, 0, 0, 0.1)", maxWidth: "300px", zIndex: 1000
        }}>
          <div style={{ fontWeight: 600, marginBottom: "4px" }}>{notification.title}</div>
          <div style={{ fontSize: "14px" }}>{notification.message}</div>
          <button onClick={closeNotification} style={{ position: "absolute", top: "8px", right: "8px", background: "none", border: "none", fontSize: "16px", cursor: "pointer", color: "inherit" }}>×</button>
        </div>
      )}
    </div>
  );
};

export default FavoritesAndHistory;