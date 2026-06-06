import ItLayoutShell from "../../components/ItLayoutShell";

export const metadata = {
  title: "AIVAS - IT Portal",
  description: "IT management portal for AIVAS",
};

export default function ItLayout({ children }) {
  return <ItLayoutShell>{children}</ItLayoutShell>;
}
