// Calcula el total de una orden dado el catálogo de precios
export const calcOrderTotal = (products, catalog) => {
  return products.reduce((total, item) => {
    const found = catalog.find((p) => p.id === item.id || p.name === item.name);
    if (!found) return total;
    const price = item.unit === "kg" ? Number(found.price_kg) : Number(found.price_piece);
    return total + price * item.quantity;
  }, 0);
};

export const formatMXN = (amount) =>
  new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(amount);
