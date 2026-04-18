import { LoginForm } from "@/components/login-form";

export default function Home() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-background p-6">
      <div className="w-full max-w-md">
        <h1 className="text-2xl sm:text-3xl font-bold text-center mb-6">
          AIVAS: Automated Inbound Verification & Analytics System
        </h1>
        <LoginForm />
      </div>
    </main>
  );
}
