import SupervisorLayoutShell from "../../components/SupervisorLayoutShell";

export const metadata = {
  title: "AIVAS - Supervisor Dashboard",
  description: "Supervisor Dashboard for AIVAS",
};

export default function SupervisorLayout({ children }) {
  return <SupervisorLayoutShell>{children}</SupervisorLayoutShell>;
}
