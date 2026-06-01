import Sidebar from "../../components/Sidebar";
import TopbarUser from "../../components/TopbarUser";

export const metadata = {
  title: "AIVAS - IT Portal",
  description: "IT management portal for AIVAS",
};

export default function ItLayout({ children }) {
  return (
    <div className="flex h-[100dvh] bg-[#f8fafc] font-sans text-slate-800 overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6 z-10 shrink-0">
          <div />
          <TopbarUser />
        </header>
        <main className="flex-1 overflow-y-auto p-6 md:p-8">{children}</main>
      </div>
    </div>
  );
}
