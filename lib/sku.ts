const SKU_PREFIX = 'SKU-'
const SKU_WIDTH = 6
const MAX_SKU_NUMBER = 999999

export function formatSku(value: number) {
  return `${SKU_PREFIX}${String(value).padStart(SKU_WIDTH, '0')}`
}

export async function generateNextSku(supabase: any) {
  const { data, error } = await supabase
    .from('item')
    .select('sku')

  if (error) {
    throw new Error(error.message)
  }

  const usedNumbers = new Set<number>()

  for (const row of data || []) {
    const sku = String(row?.sku || '')
    const match = sku.match(/^SKU-(\d{6})$/)
    if (!match) continue

    const value = Number(match[1])
    if (value > 0 && value <= MAX_SKU_NUMBER) {
      usedNumbers.add(value)
    }
  }

  for (let value = 1; value <= MAX_SKU_NUMBER; value += 1) {
    if (!usedNumbers.has(value)) {
      return formatSku(value)
    }
  }

  throw new Error('No available SKU values remaining')
}