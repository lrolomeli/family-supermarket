import React, { useEffect, useState } from "react";
import API_BASE_URL from "../config";
import apiFetch from "../api";

const Admin = () => {
  const [orders, setOrders] = useState([]);

  const fetchOrders = async () => {
    try {
      const response = await apiFetch(`${API_BASE_URL}/admin/orders`);
      const data = await response.json();
      setOrders(data);
    } catch (error) {
      console.error("Error fetching orders:", error);
    }
  };

  useEffect(() => { fetchOrders(); }, []);

  const handleStatusChange = async (orderId, status) => {
    try {
      await apiFetch(`${API_BASE_URL}/admin/orders/${orderId}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      await fetchOrders();
    } catch (error) {
      console.error("Error updating status:", error);
    }
  };

  return (
    <div>
      <h2>All Orders</h2>
      {orders.length === 0 ? (
        <p>No orders found.</p>
      ) : (
        <ul>
          {orders.map((order) => (
            <li key={order.id}>
              <h3>Order #{order.id} — {order.user_email}</h3>
              <p>
                Status:
                <select
                  value={order.status || "pending"}
                  onChange={(e) => handleStatusChange(order.id, e.target.value)}
                  style={{ marginLeft: "8px" }}
                >
                  <option value="pending">Pending</option>
                  <option value="completed">Completed</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </p>
              <ul>
                {order.products.map((product, index) => (
                  <li key={index}>
                    {product.quantity} {product.unit} of {product.name}
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default Admin;
