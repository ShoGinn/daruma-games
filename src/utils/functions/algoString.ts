export function formatBigNumWithDecimals(
  num: bigint,
  decimals: number
): string {
  const singleUnit = BigInt('1' + '0'.repeat(decimals))
  const wholeUnits = num / singleUnit
  const fractionalUnits = num % singleUnit

  return (
    wholeUnits.toString() +
    '.' +
    fractionalUnits.toString().padStart(decimals, '0')
  )
}

export function ellipseAddress(address = '', start = 5, end = 5): string {
  return `${address.slice(0, start)}...${address.slice(-end)}`
}
