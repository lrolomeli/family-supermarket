import React, { useEffect, useState } from "react";
import API_BASE_URL from "../config";
import apiFetch from "../api";

const Admin = () => {
  const [orders, setOrders] = useState([]);
  const user = null; // auth handled via token

  useEffect(() => {
    const fetchAllOrders = async () => {
      try {
        const response = await apiFetch(`${API_BASE_URL}/admin/orders`);
        const data = await response.json();
        setOrders(data);
      } catch (error) {
        console.error("Error fetching orders:", error);
      }
    };

    fetchAllOrders();
  }, []);

  return (
    <div>
      <h2>All Orders</h2>
      {orders.length === 0 ? (
        <p>No orders found.</p>
      ) : (
        <ul>
          {orders.map((order) => (
            <li key={order.id}>
              <h3>Order ID: {order.id}</h3>
              <p>User: {order.uid}</p>
              <ul>
                {order.products.map((product, index) => (
                  <li key={index}>
                    {product.quantity} x {product.item}
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