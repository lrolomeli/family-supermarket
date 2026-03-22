import { useState, useEffect, useRef, useMemo } from "react";
import API_BASE_URL from "../config";
import apiFetch from "../api";

const imgSrc = (image) => image || "/images/default-product.svg";

// Bottom sheet para seleccionar cantidad y unidad
const ProductSheet = ({ product, onAdd, onClose }) => {
  const sellBy = product.sell_by || "both";
  const defaultUnit = sellBy === "kg" ? "kg" : "pieces";
  const [quantity, setQuantity] = useState(defaultUnit === "kg" ? 0.5 : 1);
  const [unit, setUnit] = useState(defaultUnit);
  const unitOptions = sellBy === "both" ? ["pieces", "kg"] : [sellBy];

  const price = unit === "kg" ? Number(product.price_kg) : Number(product.price_piece);

  const handleAdd = () => {
    onAdd(product, quantity, unit);
    onClose();
  };

  return (
    <>
      <div onClick={onClose} style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 300,
        animation: "fadeIn .15s ease",
      }} />
      <div style={{
        position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 301,
        background: "#fff", borderRadius: "20px 20px 0 0",
        padding: "20px 20px calc(24px + env(safe-area-inset-bottom, 0px))",
        boxShadow: "0 -8px 30px rgba(0,0,0,0.15)",
      }}>
        <div style={{ width: "36px", height: "4px", background: "#e5e7eb", borderRadius: "2px", margin: "0 auto 16px" }} />

        {/* Product header */}
        <div style={{ display: "flex", alignItems: "center", gap: "14px", marginBottom: "20px" }}>
          <img src={imgSrc(product.image)} alt={product.name}
            style={{ width: "56px", height: "56px", borderRadius: "14px", objectFit: "cover", border: "1px solid #f3f4f6" }} />
          <div>
            <h3 style={{ margin: 0, fontSize: "18px", fontWeight: 700, color: "#111827" }}>{product.name}</h3>
            {price > 0 && (
              <span style={{ fontSize: "14px", color: "#15803d", fontWeight: 600 }}>
                ${price.toFixed(2)} / {unit === "kg" ? "kg" : "pz"}
              </span>
            )}
          </div>
        </div>

        {/* Unit selector */}
        {unitOptions.length > 1 && (
          <div style={{ display: "flex", gap: "8px", marginBottom: "16px" }}>
            {unitOptions.map(u => (
              <button key={u} onClick={() => { setUnit(u); setQuantity(u === "kg" ? 0.5 : 1); }} style={{
                flex: 1, padding: "10px", borderRadius: "10px", border: "2px solid",
                borderColor: unit === u ? "#15803d" : "#e5e7eb",
                background: unit === u ? "#f0fdf4" : "#fff",
                color: unit === u ? "#15803d" : "#6b7280",
                fontWeight: 600, fontSize: "14px", cursor: "pointer",
                WebkitTapHighlightColor: "transparent",
              }}>
                {u === "pieces" ? "🧺 Piezas" : "⚖️ Kilos"}
              </button>
            ))}
          </div>
        )}
        {unitOptions.length === 1 && (
          <p style={{ margin: "0 0 12px", fontSize: "13px", color: "#9ca3af" }}>
            Se vende por {unit === "pieces" ? "piezas" : "kilo"}
          </p>
        )}

        {/* Quantity selector */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "center",
          gap: "20px", marginBottom: "20px", padding: "8px 0",
        }}>
          <button onClick={() => { const step = unit === "kg" ? 0.5 : 1; const min = unit === "kg" ? 0.5 : 1; setQuantity(q => Math.max(min, +(q - step).toFixed(1))); }} style={{
            width: "44px", height: "44px", borderRadius: "50%", border: "2px solid #e5e7eb",
            background: "#fff", fontSize: "20px", cursor: "pointer", color: "#374151",
            display: "flex", alignItems: "center", justifyContent: "center",
            WebkitTapHighlightColor: "transparent",
          }}>−</button>
          <span style={{ fontSize: "32px", fontWeight: 700, color: "#111827", minWidth: "70px", textAlign: "center" }}>
            {quantity}{unit === "kg" ? " kg" : ""}
          </span>
          <button onClick={() => { const step = unit === "kg" ? 0.5 : 1; setQuantity(q => +(q + step).toFixed(1)); }} style={{
            width: "44px", height: "44px", borderRadius: "50%", border: "none",
            background: "#15803d", fontSize: "20px", cursor: "pointer", color: "#fff",
            display: "flex", alignItems: "center", justifyContent: "center",
            WebkitTapHighlightColor: "transparent",
          }}>+</button>
        </div>

        <button onClick={handleAdd} style={{
          width: "100%", padding: "14px", background: "#15803d", color: "#fff",
          border: "none", borderRadius: "12px", fontSize: "16px", fontWeight: 700,
          cursor: "pointer", WebkitTapHighlightColor: "transparent",
        }}>
          Agregar al carrito
        </button>
      </div>
    </>
  );
};

const normalize = (str) =>
  str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

const Order = () => {
  const [products, setProducts] = useState([]);
  const [unavailable, setUnavailable] = useState([]);
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState([]);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [focused, setFocused] = useState(false);
  const [showUnavailable, setShowUnavailable] = useState(false);
  const [viewMode, setViewMode] = useState("search"); // "search" | "list"
  const searchRef = useRef(null);
  const dropdownRef = useRef(null);

  useEffect(() => {
    apiFetch(`${API_BASE_URL}/products?all=true`)
      .then(r => r.json())
      .then(all => {
        setProducts(all.filter(p => p.available !== false));
        setUnavailable(all.filter(p => p.available === false));
      })
      .catch(e => console.error("Error loading products:", e));
  }, []);

  useEffect(() => {
    const handleClick = (e) => {
      if (
        searchRef.current && !searchRef.current.contains(e.target) &&
        dropdownRef.current && !dropdownRef.current.contains(e.target)
      ) {
        setFocused(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const filtered = search.trim()
    ? products.filter(p => normalize(p.name).includes(normalize(search)))
    : [];

  const sortedProducts = useMemo(() => [...products].sort((a, b) => a.name.localeCompare(b.name, "es")), [products]);
  const cartIdSet = useMemo(() => new Set(cart.map(i => i.product.id)), [cart]);

  const handleAddToCart = (product, quantity, unit) => {
    setCart(prev => {
      const idx = prev.findIndex(i => i.product.id === product.id && i.unit === unit);
      if (idx >= 0) {
        const updated = [...prev];
        updated[idx] = { ...updated[idx], quantity: updated[idx].quantity + quantity };
        return updated;
      }
      return [...prev, { product, quantity, unit }];
    });
    setSearch("");
    setFocused(false);
  };

  const handleRemoveFromCart = (index) => {
    setCart(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmitOrder = async () => {
    if (cart.length === 0 || submitting) return;
    setSubmitting(true);
    try {
      const products = cart.map(i => ({
        product_id: i.product.id,
        name: i.product.name,
        quantity: i.quantity,
        unit: i.unit,
        image: i.product.image || null,
      }));
      const res = await apiFetch(`${API_BASE_URL}/orders`, {
        method: "POST",
        body: JSON.stringify({ products }),
      });
      if (!res.ok) throw new Error("Error al enviar orden");
      setCart([]);
      setSubmitted(true);
      setTimeout(() => setSubmitted(false), 2500);
    } catch (e) {
      console.error("Submit order error:", e);
      alert("Error al enviar la orden. Intenta de nuevo.");
    } finally {
      setSubmitting(false);
    }
  };

  const cartTotal = cart.reduce((sum, i) => sum + i.quantity, 0);

  return (
    <div style={{ padding: "16px 16px 120px", maxWidth: "600px", margin: "0 auto" }}>
      {/* Toast de éxito */}
      {submitted && (
        <div style={{
          position: "fixed", top: "16px", left: "50%", transform: "translateX(-50%)",
          background: "#15803d", color: "#fff", padding: "12px 24px", borderRadius: "12px",
          fontSize: "15px", fontWeight: 600, zIndex: 400, boxShadow: "0 4px 20px rgba(0,0,0,0.15)",
          display: "flex", alignItems: "center", gap: "8px",
          animation: "toastIn 0.3s ease",
        }}>
          ✅ Orden enviada
        </div>
      )}
      {/* Header */}
      <div style={{ marginBottom: "16px" }}>
        <h2 style={{ margin: "0 0 4px", color: "#111827", fontSize: "22px", fontWeight: 700 }}>
          Nuevo Pedido
        </h2>
        <p style={{ margin: 0, fontSize: "13px", color: "#9ca3af" }}>
          Busca productos y agrégalos al carrito
        </p>
      </div>

      {/* View mode toggle */}
      <div style={{
        display: "flex", gap: "6px", marginBottom: "12px",
        background: "#f3f4f6", borderRadius: "12px", padding: "4px",
      }}>
        {[
          { key: "search", label: "🔍 Buscar" },
          { key: "list", label: "📋 Lista" },
        ].map(m => (
          <button key={m.key} onClick={() => setViewMode(m.key)} style={{
            flex: 1, padding: "10px 0", border: "none", borderRadius: "10px",
            fontSize: "14px", fontWeight: 600, cursor: "pointer",
            background: viewMode === m.key ? "#fff" : "transparent",
            color: viewMode === m.key ? "#111827" : "#9ca3af",
            boxShadow: viewMode === m.key ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
            WebkitTapHighlightColor: "transparent",
            transition: "all .15s",
          }}>
            {m.label}
          </button>
        ))}
      </div>

      {/* Search mode */}
      {viewMode === "search" && (
        <div style={{ position: "relative", marginBottom: "12px" }}>
        <div style={{ position: "relative" }}>
          <span style={{ position: "absolute", left: "14px", top: "50%", transform: "translateY(-50%)", fontSize: "16px", color: "#9ca3af", pointerEvents: "none" }}>🔍</span>
          <input
            ref={searchRef}
            type="text"
            placeholder="Buscar producto..."
            value={search}
            onChange={e => { setSearch(e.target.value); setFocused(true); }}
            onFocus={() => setFocused(true)}
            style={{
              width: "100%", padding: "12px 16px 12px 42px", fontSize: "16px",
              border: "2px solid #e5e7eb", borderRadius: "14px",
              outline: "none", boxSizing: "border-box",
              WebkitAppearance: "none", background: "#f9fafb",
              transition: "border-color .15s",
            }}
            onFocusCapture={e => e.target.style.borderColor = "#15803d"}
            onBlurCapture={e => e.target.style.borderColor = "#e5e7eb"}
          />
        </div>

        {/* Dropdown */}
        {focused && filtered.length > 0 && (
          <div ref={dropdownRef} style={{
            position: "absolute", top: "100%", left: 0, right: 0, zIndex: 50,
            background: "#fff", border: "1px solid #e5e7eb", borderRadius: "14px",
            marginTop: "6px", maxHeight: "280px", overflowY: "auto",
            boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
            WebkitOverflowScrolling: "touch",
          }}>
            {filtered.map((p, i) => (
              <div
                key={p.id}
                onClick={() => { setSelectedProduct(p); setFocused(false); }}
                style={{
                  display: "flex", alignItems: "center", gap: "12px",
                  padding: "10px 14px", cursor: "pointer",
                  borderBottom: i < filtered.length - 1 ? "1px solid #f3f4f6" : "none",
                  WebkitTapHighlightColor: "transparent",
                }}
              >
                <img src={imgSrc(p.image)} alt={p.name}
                  style={{ width: "38px", height: "38px", borderRadius: "10px", objectFit: "cover", flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: "15px", color: "#111827", fontWeight: 500 }}>{p.name}</div>
                  <div style={{ fontSize: "12px", color: "#9ca3af" }}>
                    {p.price_piece > 0 && `$${Number(p.price_piece).toFixed(0)}/pz`}
                    {p.price_piece > 0 && p.price_kg > 0 && " · "}
                    {p.price_kg > 0 && `$${Number(p.price_kg).toFixed(0)}/kg`}
                  </div>
                </div>
                <span style={{ fontSize: "18px", color: "#d1d5db" }}>›</span>
              </div>
            ))}
          </div>
        )}

        {focused && search.trim() && filtered.length === 0 && (
          <div style={{
            position: "absolute", top: "100%", left: 0, right: 0, zIndex: 50,
            background: "#fff", border: "1px solid #e5e7eb", borderRadius: "14px",
            marginTop: "6px", padding: "20px", textAlign: "center",
            boxShadow: "0 8px 24px rgba(0,0,0,0.12)", color: "#9ca3af", fontSize: "14px",
          }}>
            No se encontraron productos
          </div>
        )}
      </div>
      )}

      {/* List mode */}
      {viewMode === "list" && (
        <div style={{
          display: "flex", flexDirection: "column", gap: "6px", marginBottom: "12px",
        }}>
          {sortedProducts.map(p => {
            const inCart = cartIdSet.has(p.id);
            return (
              <div key={p.id} onClick={() => setSelectedProduct(p)} style={{
                display: "flex", alignItems: "center", gap: "10px",
                padding: "10px 12px", background: inCart ? "#f0fdf4" : "#fff",
                border: inCart ? "1.5px solid #bbf7d0" : "1px solid #e5e7eb",
                borderRadius: "12px", cursor: "pointer",
                WebkitTapHighlightColor: "transparent",
              }}>
                <img src={imgSrc(p.image)} alt={p.name}
                  style={{ width: "40px", height: "40px", borderRadius: "10px", objectFit: "cover", flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: "14px", color: "#111827", fontWeight: 500 }}>{p.name}</div>
                  <div style={{ fontSize: "12px", color: "#9ca3af" }}>
                    {p.price_piece > 0 && `$${Number(p.price_piece).toFixed(0)}/pz`}
                    {p.price_piece > 0 && p.price_kg > 0 && " · "}
                    {p.price_kg > 0 && `$${Number(p.price_kg).toFixed(0)}/kg`}
                  </div>
                </div>
                {inCart ? (
                  <span style={{ fontSize: "11px", fontWeight: 700, color: "#15803d", background: "#dcfce7", padding: "3px 8px", borderRadius: "6px" }}>
                    En carrito
                  </span>
                ) : (
                  <span style={{ fontSize: "20px", color: "#15803d" }}>+</span>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Unavailable products (collapsible) */}
      {unavailable.length > 0 && (
        <div style={{
          marginBottom: "16px", borderRadius: "12px", overflow: "hidden",
          border: "1px solid #fde68a", background: "#fffbeb",
        }}>
          <button onClick={() => setShowUnavailable(!showUnavailable)} style={{
            width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "10px 14px", background: "none", border: "none", cursor: "pointer",
            WebkitTapHighlightColor: "transparent",
          }}>
            <span style={{ fontSize: "13px", fontWeight: 600, color: "#92400e" }}>
              ⚠️ {unavailable.length} productos no disponibles
            </span>
            <span style={{ fontSize: "14px", color: "#92400e", transform: showUnavailable ? "rotate(180deg)" : "none", transition: "transform .2s" }}>▼</span>
          </button>
          {showUnavailable && (
            <div style={{ padding: "0 14px 12px" }}>
              <p style={{ margin: 0, fontSize: "12px", color: "#78350f", lineHeight: 1.7 }}>
                {unavailable.map(p => p.name).join(", ")}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Cart */}
      {cart.length > 0 && (
        <div style={{
          background: "#fff", borderRadius: "14px", border: "1px solid #e5e7eb",
          overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
        }}>
          <div style={{
            padding: "10px 14px", background: "#f9fafb", borderBottom: "1px solid #f3f4f6",
            display: "flex", alignItems: "center", justifyContent: "space-between",
          }}>
            <span style={{ fontSize: "13px", fontWeight: 700, color: "#374151", letterSpacing: "0.3px" }}>
              🛒 CARRITO ({cart.length})
            </span>
            <span style={{ fontSize: "12px", color: "#6b7280" }}>
              {cartTotal} {cartTotal === 1 ? "artículo" : "artículos"}
            </span>
          </div>
          {cart.map((item, idx) => (
            <div key={idx} style={{
              display: "flex", alignItems: "center", gap: "10px",
              padding: "10px 14px",
              borderBottom: idx < cart.length - 1 ? "1px solid #f3f4f6" : "none",
            }}>
              <img src={imgSrc(item.product.image)} alt={item.product.name}
                style={{ width: "36px", height: "36px", borderRadius: "8px", objectFit: "cover", flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: "14px", color: "#111827", fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {item.product.name}
                </div>
                <div style={{ fontSize: "12px", color: "#6b7280" }}>
                  {item.quantity} {item.unit === "pieces" ? "pz" : "kg"}
                </div>
              </div>
              <button onClick={() => handleRemoveFromCart(idx)} style={{
                background: "#fef2f2", border: "none", color: "#ef4444",
                width: "30px", height: "30px", borderRadius: "8px",
                fontSize: "14px", cursor: "pointer", flexShrink: 0,
                display: "flex", alignItems: "center", justifyContent: "center",
                WebkitTapHighlightColor: "transparent",
              }}>✕</button>
            </div>
          ))}
        </div>
      )}

      {/* Empty state */}
      {cart.length === 0 && !search && viewMode === "search" && (
        <div style={{ textAlign: "center", padding: "40px 20px", color: "#d1d5db" }}>
          <div style={{ fontSize: "48px", marginBottom: "8px" }}>🛒</div>
          <p style={{ margin: 0, fontSize: "14px", color: "#9ca3af" }}>
            Busca productos para empezar tu pedido
          </p>
        </div>
      )}

      {/* Floating submit */}
      {cart.length > 0 && (
        <div style={{
          position: "fixed", bottom: "60px", left: 0, right: 0, zIndex: 95,
          padding: "10px 16px calc(10px + env(safe-area-inset-bottom, 0px))",
          background: "linear-gradient(transparent, #fff 20%)",
          pointerEvents: "none",
        }}>
          <button
            onClick={handleSubmitOrder}
            disabled={submitting}
            style={{
              width: "100%", maxWidth: "600px", margin: "0 auto", display: "block",
              padding: "14px", background: submitting ? "#86efac" : "#15803d",
              color: "#fff", border: "none", borderRadius: "14px",
              fontSize: "16px", fontWeight: 700, cursor: submitting ? "default" : "pointer",
              WebkitTapHighlightColor: "transparent",
              boxShadow: "0 4px 12px rgba(21,128,61,0.3)",
              pointerEvents: "auto",
            }}
          >
            {submitting ? "Enviando..." : `Confirmar Orden (${cart.length} productos)`}
          </button>
        </div>
      )}

      {selectedProduct && (
        <ProductSheet
          product={selectedProduct}
          onAdd={handleAddToCart}
          onClose={() => setSelectedProduct(null)}
        />
      )}
    </div>
  );
};

export default Order;
