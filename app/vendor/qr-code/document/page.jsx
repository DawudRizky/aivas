import VendorQrDocumentClient from "./document-client";

export default function VendorQrDocumentPage({ searchParams }) {
  const deliveryOrderId = searchParams?.delivery_order_id || "";

  return <VendorQrDocumentClient deliveryOrderId={deliveryOrderId} />;
}
