import { createContext, useContext, useEffect, useState } from "react";
import API_BASE_URL from "../config";

const SettingsContext = createContext({ showPrices: true, storeClosed: false });

export const useSettings = () => useContext(SettingsContext);

export const SettingsProvider = ({ children }) => {
  const [showPrices, setShowPrices] = useState(true);
  const [storeClosed, setStoreClosed] = useState(false);

  useEffect(() => {
    fetch(`${API_BASE_URL}/settings`)
      .then(r => r.json())
      .then(s => {
        setShowPrices(s.show_prices !== "false");
        setStoreClosed(s.store_closed === "true");
      })
      .catch(() => {});
  }, []);

  return (
    <SettingsContext.Provider value={{ showPrices, storeClosed }}>
      {children}
    </SettingsContext.Provider>
  );
};
