import { useSettings } from "../contexts/SettingsContext";
import { formatMXN } from "../utils/pricing";

const Price = ({ value, style, raw = false }) => {
  const { showPrices } = useSettings();
  if (!showPrices || value == null) return null;
  return <span style={style}>{raw ? value : formatMXN(value)}</span>;
};

export default Price;
