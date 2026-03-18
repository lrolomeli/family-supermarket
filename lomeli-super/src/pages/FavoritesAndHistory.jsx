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
  const [notification, setNotification] = useState(null);

  const user = auth.currentUser;

  const showNotification = (title, message, type = 'success') => {
    setNotification({
      title,
      message,
      type,
      timestamp: new Date()
    });
  };

  const closeNotification = () => {
    setNotification(null);
  };

  useEffect(() => {
    fetch(`${API_BASE_URL}/products`)
      .then(r => r.json())
      .then(data => setProductCatalog(data))
      .catch(console.error);
  }, []);

  useEffect(() => {
    if (!user) return;
    // Clear any stale data on user change or initial load
    setFavorites([]);
    setOrderHistory([]);
    loadData().catch((e) => console.error("Error loading data:", e));
  }, [user, activeTab]);

  const loadData = async () => {
    setLoading(true);
    setError("");
    setSuccess("");
    
    // Clear state immediately to prevent stale data showing
    if (activeTab === 'favorites') {
      setFavorites([]);
    } else {
      setOrderHistory([]);
    }
    
    try {
      if (activeTab === 'favorites') {
        // Add cache-busting timestamp
        const response = await apiFetch(`${API_BASE_URL}/favorites?t=${Date.now()}`);
        const data = await response.json();
        console.log('Favorites data loaded:', data);
        setFavorites(data);
      } else {
        // Add cache-busting timestamp
        const response = await apiFetch(`${API_BASE_URL}/orders/history?t=${Date.now()}`);
        const data = await response.json();
        console.log('History data loaded:', data);
        setOrderHistory(data);
      }
    } catch (error) {
      setError("Error loading data");
      console.error("Error loading data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveAsFavorite = async (order, isHistory = false) => {
    console.log('=== SAVE FAVORITE DEBUG ===');
    console.log('isHistory:', isHistory);
    console.log('order:', order);
    console.log('order.products:', order.products);
    
    const name = prompt("¿Cómo quieres llamar a este pedido favorito?");
    if (!name || !name.trim()) return;
    
    console.log('Favorite name:', name.trim());
    
    try {
      const requestBody = {
        name: name.trim(),
        products: order.products
      };
      
      console.log('Request body being sent:', requestBody);
      
      const response = await apiFetch(`${API_BASE_URL}/favorites`, {
        method: "POST",
        body: JSON.stringify(requestBody),
      });
      
      console.log('Response status:', response.status);
      console.log('Response ok:', response.ok);
      
      if (response.ok) {
        const newFavorite = await response.json();
        console.log('Favorite created:', newFavorite);
        
        showNotification(
          "Favorito Guardado",
          `Este pedido ha sido guardado como "${name.trim()}" en tus favoritos.`,
          'success'
        );
        
        // Refresh favorites if we're on the favorites tab
        if (activeTab === 'favorites') {
          console.log('Refreshing favorites data...');
          loadData();
        }
      } else {
        let errorMessage = "No se pudo guardar el favorito";
        const contentType = response.headers.get('content-type');
        
        if (contentType && contentType.includes('application/json')) {
          try {
            const errorData = await response.json();
            errorMessage = errorData.message || errorMessage;
          } catch (jsonError) {
            console.log('Failed to parse JSON error response');
          }
        } else {
          try {
            const errorText = await response.text();
            errorMessage = errorText || errorMessage;
          } catch (textError) {
            console.log('Failed to read text error response');
          }
        }
        setError(errorMessage);
      }
    } catch (error) {
      setError("Error de conexión. Intenta nuevamente.");
      console.error("Error saving favorite:", error);
    }
  };

  const handleReorder = async (order, isHistory = false) => {
    try {
      console.log('=== FRONTEND REORDER DEBUG ===');
      console.log('isHistory:', isHistory);
      console.log('order:', order);
      console.log('order.products:', order.products);
      console.log('order.products length:', order.products?.length || 'undefined');
      
      // Log each product in detail
      if (order.products && Array.isArray(order.products)) {
        console.log('Products in order:');
        order.products.forEach((product, index) => {
          console.log(`  ${index + 1}. ${product.name} - ${product.quantity} ${product.unit}`);
        });
      } else {
        console.log('❌ order.products is not an array or is undefined');
      }
      
      let response;
      
      if (isHistory) {
        // Create new order from history
        console.log('Calling POST /orders for history reorder');
        response = await apiFetch(`${API_BASE_URL}/orders`, {
          method: "POST",
          body: JSON.stringify({
            products: order.products
          }),
        });
      } else {
        // Create new order from favorite
        console.log('Calling POST /favorites/:id/reorder for favorite reorder');
        response = await apiFetch(`${API_BASE_URL}/favorites/${order.id}/reorder`, {
          method: "POST"
        });
      }
      
      console.log('Response status:', response.status);
      console.log('Response ok:', response.ok);
      
      if (response.ok) {
        const newOrder = await response.json();
        console.log('New order received:', newOrder);
        console.log('New order ID:', newOrder.id);
        
        showNotification(
          "Pedido Creado",
          `Nuevo pedido #${newOrder.id} creado exitosamente!`,
          'success'
        );
      } else {
        let errorMessage = "No se pudo crear el pedido";
        const contentType = response.headers.get('content-type');
        
        if (contentType && contentType.includes('application/json')) {
          try {
            const errorData = await response.json();
            errorMessage = errorData.message || errorMessage;
          } catch (jsonError) {
            console.log('Failed to parse JSON error response');
          }
        } else {
          try {
            const errorText = await response.text();
            errorMessage = errorText || errorMessage;
          } catch (textError) {
            console.log('Failed to read text error response');
          }
        }
        
        console.log('Error response:', errorMessage);
        setError(errorMessage);
      }
    } catch (error) {
      console.log('=== FRONTEND CATCH BLOCK ===');
      console.log('Error caught:', error);
      console.log('Error message:', error.message);
      console.log('Error stack:', error.stack);
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
        let errorMessage = "No se pudo eliminar el favorito";
        const contentType = response.headers.get('content-type');
        
        if (contentType && contentType.includes('application/json')) {
          try {
            const errorData = await response.json();
            errorMessage = errorData.message || errorMessage;
          } catch (jsonError) {
            console.log('Failed to parse JSON error response');
          }
        } else {
          try {
            const errorText = await response.text();
            errorMessage = errorText || errorMessage;
          } catch (textError) {
            console.log('Failed to read text error response');
          }
        }
        
        setError(errorMessage);
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
    <div style={{ padding: "20px", maxWidth: "800px", margin: "0 auto" }}>
      <h1 style={{ margin: "0 0 20px 0", fontSize: "24px", color: "#1f2937" }}>⭐ Favoritos e Historial</h1>

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
              {favorites.map((favorite, index) => {
                console.log(`Rendering favorite ${index + 1}:`, favorite);
                console.log(`Favorite ID: ${favorite.id}, Name: ${favorite.name}, Products:`, favorite.products);
                
                return (
                  <div key={favorite.id} style={{
                    background: "#fff", border: "1px solid #e5e7eb", borderRadius: "12px",
                    padding: "16px", boxShadow: "0 1px 3px rgba(0,0,0,0.1)"
                  }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "12px" }}>
                      <div>
                        <h3 style={{ margin: "0 0 4px 0", fontSize: "16px", color: "#374151" }}>
                          {favorite.name || 'Sin nombre'}
                        </h3>
                        <p style={{ margin: "0", fontSize: "12px", color: "#9ca3af" }}>
                          Guardado el {new Date(favorite.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    <div style={{ display: "flex", gap: "8px" }}>
                      <button
                        onClick={() => handleReorder(favorite, false)}
                        style={{
                          padding: "6px 12px", background: "#22c55e", color: "#fff",
                          border: "none", borderRadius: "6px", cursor: "pointer", fontSize: "12px"
                        }}
                      >
                        🛒 Pedir de nuevo
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
                );
              })}
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
                        {order.delivered_at && ` • Entregado el ${new Date(order.delivered_at).toLocaleDateString()}`}
                      </p>
                    </div>
                    <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                      {getStatusBadge(order.status)}
                      <div style={{ display: "flex", gap: "6px" }}>
                        <button
                          onClick={() => handleSaveAsFavorite(order, true)}
                          style={{
                            padding: "4px 8px", background: "#f59e0b", color: "#fff",
                            border: "none", borderRadius: "6px", cursor: "pointer", fontSize: "11px"
                          }}
                        >
                          ⭐ Favorito
                        </button>
                        <button
                          onClick={() => handleReorder(order, true)}
                          style={{
                            padding: "4px 8px", background: "#22c55e", color: "#fff",
                            border: "none", borderRadius: "6px", cursor: "pointer", fontSize: "11px"
                          }}
                        >
                          🛒 Pedir de nuevo
                        </button>
                      </div>
                    </div>
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
      
      {/* Notification Display */}
      {notification && (
        <div style={{
          position: "fixed",
          top: "20px",
          right: "20px",
          background: notification.type === 'success' ? "#f0fdf4" : 
                     notification.type === 'error' ? "#fef2f2" : "#eff6ff",
          border: `1px solid ${notification.type === 'success' ? "#bbf7d0" : 
                           notification.type === 'error' ? "#fecaca" : "#bfdbfe"}`,
          color: notification.type === 'success' ? "#166a34" : 
                 notification.type === 'error' ? "#dc2626" : "#1e40af",
          padding: "16px 20px",
          borderRadius: "8px",
          boxShadow: "0 4px 6px rgba(0, 0, 0, 0.1)",
          maxWidth: "300px",
          zIndex: 1000
        }}>
          <div style={{ fontWeight: 600, marginBottom: "4px" }}>
            {notification.title}
          </div>
          <div style={{ fontSize: "14px" }}>
            {notification.message}
          </div>
          <button
            onClick={closeNotification}
            style={{
              position: "absolute",
              top: "8px",
              right: "8px",
              background: "none",
              border: "none",
              fontSize: "16px",
              cursor: "pointer",
              color: "inherit"
            }}
          >
            ×
          </button>
        </div>
      )}
    </div>
  );
};

export default FavoritesAndHistory;
