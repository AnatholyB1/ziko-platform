const OFF_URL = (barcode: string) =>
  `https://world.openfoodfacts.net/api/v2/product/${barcode}?fields=product_name,product_name_fr`;

export async function lookupBarcode(barcode: string): Promise<string | null> {
  try {
    const res = await fetch(OFF_URL(barcode));
    const json = await res.json();
    if (json.status !== 1) return null;
    return json.product?.product_name_fr ?? json.product?.product_name ?? null;
  } catch {
    return null;
  }
}
