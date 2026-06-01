import Sidebar from "../../components/Sidebar";
import TopbarUser from "../../components/TopbarUser";

export const metadata = {
  title: "AIVAS - PPIC Portal",
  description: "PPIC Portal for AIVAS",
};

export default function PpicLayout({ children }) {
  return (
    <div className="flex h-screen bg-[#f8fafc] font-sans text-slate-800">
      {/* Sidebar */}
      <Sidebar />

      {/* Area Konten Utama */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        
        {/* Topbar */}
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6 z-10 shrink-0">
          <div />

          <TopbarUser />
        </header>

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto p-6 md:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
