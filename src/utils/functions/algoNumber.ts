export function convertBigNumToNumber(num: bigint, decimals: number): number {
  const singleUnit = BigInt('1' + '0'.repeat(decimals))
  const wholeUnits = num / singleUnit

  return parseInt(wholeUnits.toString())
}
