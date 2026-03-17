import React, { useEffect, useState, useMemo } from "react";
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

const TABS = ["Dashboard", "Orders", "Prices"];

const Admin = () => {
  const [orders, setOrders] = useState([]);
  const [catalog, setCatalog] = useState([]);
  const [editingPrices, setEditingPrices] = useState({});
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

  useEffect(() => {
    fetchOrders();
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

  const handleStatusChange = async (orderId, status) => {
    await apiFetch(`${API_BASE_URL}/admin/orders/${orderId}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    });
    await fetchOrders();
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

  // --- Stats ---
  const stats = useMemo(() => {
    const total = orders.length;
    const pending = orders.filter(o => o.status === "pending" || !o.status).length;
    const completed = orders.filter(o => o.status === "completed").length;
    const cancelled = orders.filter(o => o.status === "cancelled").length;
    const uniqueUsers = new Set(orders.map(o => o.user_email)).size;
    const totalItems = orders.reduce((acc, o) => acc + (o.products?.length || 0), 0);
    const revenue = catalog.length
      ? orders.filter(o => o.status !== "cancelled")
          .reduce((acc, o) => acc + calcOrderTotal(o.products, catalog), 0)
      : null;
    return { total, pending, completed, cancelled, uniqueUsers, totalItems, revenue };
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
      <h2 style={{ marginBottom: "20px" }}>Admin Panel</h2>

      {/* Tabs */}
      <div style={{ display: "flex", gap: "8px", marginBottom: "24px" }}>
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            padding: "8px 20px", borderRadius: "8px", border: "none", cursor: "pointer",
            fontWeight: 600, fontSize: "14px",
            background: tab === t ? "#3b82f6" : "#f3f4f6",
            color: tab === t ? "#fff" : "#374151",
          }}>{t}</button>
        ))}
      </div>

      {/* DASHBOARD TAB */}
      {tab === "Dashboard" && (
        <div>
          {/* Stat cards */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: "12px", marginBottom: "28px" }}>
            <StatCard label="Total Orders" value={stats.total} color="#3b82f6" />
            <StatCard label="Pending" value={stats.pending} color="#f59e0b" />
            <StatCard label="Completed" value={stats.completed} color="#22c55e" />
            <StatCard label="Cancelled" value={stats.cancelled} color="#ef4444" />
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
              <option value="all">All statuses</option>
              <option value="pending">Pending</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
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
                          <Badge status={order.status} />
                          <select value={order.status || "pending"}
                            onChange={e => handleStatusChange(order.id, e.target.value)}
                            style={{ padding: "4px 8px", borderRadius: "6px", border: "1px solid #d1d5db", fontSize: "13px" }}>
                            <option value="pending">Pending</option>
                            <option value="completed">Completed</option>
                            <option value="cancelled">Cancelled</option>
                          </select>
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
      {/* PRICES TAB */}
      {tab === "Prices" && (
        <div>
          <p style={{ color: "#6b7280", marginBottom: "16px", fontSize: "14px" }}>
            Edita los precios y presiona Save en cada fila. Los cambios aplican de inmediato.
          </p>
          <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: "12px", overflow: "hidden" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "14px" }}>
              <thead>
                <tr style={{ background: "#f9fafb", borderBottom: "1px solid #e5e7eb" }}>
                  <th style={{ padding: "12px 16px", textAlign: "left", color: "#6b7280" }}>Producto</th>
                  <th style={{ padding: "12px 16px", textAlign: "right", color: "#6b7280" }}>Precio / pieza</th>
                  <th style={{ padding: "12px 16px", textAlign: "right", color: "#6b7280" }}>Precio / kg</th>
                  <th style={{ padding: "12px 16px" }}></th>
                </tr>
              </thead>
              <tbody>
                {catalog.map((product, i) => (
                  <tr key={product.id} style={{ borderBottom: i < catalog.length - 1 ? "1px solid #f3f4f6" : "none" }}>
                    <td style={{ padding: "10px 16px", fontWeight: 500, color: "#374151" }}>{product.name}</td>
                    <td style={{ padding: "10px 16px", textAlign: "right" }}>
                      <input
                        type="number" min="0" step="0.5"
                        value={editingPrices[product.id]?.price_piece ?? product.price_piece}
                        onChange={e => handlePriceChange(product.id, "price_piece", e.target.value)}
                        style={{ width: "80px", padding: "4px 8px", borderRadius: "6px", border: "1px solid #d1d5db", textAlign: "right" }}
                      />
                    </td>
                    <td style={{ padding: "10px 16px", textAlign: "right" }}>
                      <input
                        type="number" min="0" step="0.5"
                        value={editingPrices[product.id]?.price_kg ?? product.price_kg}
                        onChange={e => handlePriceChange(product.id, "price_kg", e.target.value)}
                        style={{ width: "80px", padding: "4px 8px", borderRadius: "6px", border: "1px solid #d1d5db", textAlign: "right" }}
                      />
                    </td>
                    <td style={{ padding: "10px 16px", textAlign: "center" }}>
                      <button onClick={() => handleSavePrice(product.id)} style={{
                        padding: "4px 14px", background: "#3b82f6", color: "#fff",
                        border: "none", borderRadius: "6px", cursor: "pointer", fontSize: "13px"
                      }}>Save</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default Admin;
