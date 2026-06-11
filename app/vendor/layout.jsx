import VendorLayoutShell from "../../components/VendorLayoutShell";

export const metadata = {
  title: "AIVAS - Vendor Portal",
  description: "Vendor Portal for AIVAS",
};

export default function VendorLayout({ children }) {
  return <VendorLayoutShell>{children}</VendorLayoutShell>;
}
