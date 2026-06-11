import PpicLayoutShell from "../../components/PpicLayoutShell";

export const metadata = {
  title: "AIVAS - PPIC Portal",
  description: "PPIC Portal for AIVAS",
};

export default function PpicLayout({ children }) {
  return <PpicLayoutShell>{children}</PpicLayoutShell>;
}
