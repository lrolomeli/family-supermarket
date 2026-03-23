import { createContext, useContext, useEffect, useState } from "react";
import API_BASE_URL from "../config";

const SettingsContext = createContext({ showPrices: true });

export const useSettings = () => useContext(SettingsContext);

export const SettingsProvider = ({ children }) => {
  const [showPrices, setShowPrices] = useState(true);

  useEffect(() => {
    fetch(`${API_BASE_URL}/settings`)
      .then(r => r.json())
      .then(s => setShowPrices(s.show_prices !== "false"))
      .catch(() => {});
  }, []);

  return (
    <SettingsContext.Provider value={{ showPrices }}>
      {children}
    </SettingsContext.Provider>
  );
};
