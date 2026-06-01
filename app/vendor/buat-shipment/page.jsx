import { Suspense } from "react";
import ShipmentClient from "./shipment-client";

export default function BuatShipmentPage() {
  return (
    <Suspense fallback={<div className="text-sm text-slate-500">Loading...</div>}>
      <ShipmentClient />
    </Suspense>
  );
}