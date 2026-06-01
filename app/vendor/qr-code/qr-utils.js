export const chunkBySize = (items = [], size = 6) => {
  const chunks = [];

  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }

  return chunks;
};

export const dedupeQrRows = (rows = []) => {
  const map = new Map();

  [...rows]
    .sort((left, right) => Number(left?.id || 0) - Number(right?.id || 0))
    .forEach((row) => {
      const deliveryOrderItemId = Number(row?.delivery_order_item_id || row?.delivery_order_item?.id || 0);
      const deliveryOrderId = Number(row?.delivery_order_id || row?.delivery_order?.id || row?.delivery_order_item?.delivery_order_id || 0);
      const boxNumber = Number(row?.box_number || row?.delivery_order_item?.box_number || 0);

      if (Number.isFinite(deliveryOrderItemId) && deliveryOrderItemId > 0) {
        map.set(`doi:${deliveryOrderItemId}`, row);
        return;
      }

      if (!Number.isFinite(deliveryOrderId) || deliveryOrderId <= 0 || !Number.isFinite(boxNumber) || boxNumber <= 0) {
        return;
      }

      map.set(`${deliveryOrderId}:${boxNumber}`, row);
    });

  return Array.from(map.values()).sort((left, right) => {
    const leftDo = Number(left?.delivery_order_id || left?.delivery_order?.id || 0);
    const rightDo = Number(right?.delivery_order_id || right?.delivery_order?.id || 0);

    if (leftDo !== rightDo) return rightDo - leftDo;

    const leftBox = Number(left?.box_number || 0);
    const rightBox = Number(right?.box_number || 0);
    if (leftBox !== rightBox) return leftBox - rightBox;

    return Number(left?.id || 0) - Number(right?.id || 0);
  });
};

export const resolveBoxLabel = (row, fallbackIndex = 0) => {
  const boxNumber = Number(row?.delivery_order_item?.box_number || row?.box_number || fallbackIndex + 1);
  return `Box-${String(boxNumber).padStart(3, "0")}`;
};

export const resolveItemName = (row) => {
  return row?.delivery_order_item?.item?.name || row?.item?.name || `Item ${row?.item_id || "-"}`;
};

export const resolveQuantity = (row) => Number(row?.delivery_order_item?.quantity || row?.quantity || 0);

export const resolveDeliveryOrderOptions = (rows = []) => {
  const unique = new Map();

  rows.forEach((row) => {
    const deliveryOrderId = Number(row?.delivery_order_id || row?.delivery_order?.id);
    if (!Number.isFinite(deliveryOrderId) || deliveryOrderId <= 0) return;

    if (!unique.has(deliveryOrderId)) {
      unique.set(deliveryOrderId, {
        id: deliveryOrderId,
        doNumber: row?.delivery_order?.do_number || `DO-${deliveryOrderId}`,
        poNumber: row?.purchase_order?.po_number || "-",
      });
    }
  });

  return Array.from(unique.values()).sort((left, right) => right.id - left.id);
};