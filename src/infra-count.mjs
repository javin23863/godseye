/**
 * Count infrastructure features by kind (pure logic, no DOM/Cesium).
 */
export function countByKind(features) {
  const counts = {
    chokepoint: 0,
    pipeline: 0,
    port: 0,
    refinery: 0,
    desalination: 0,
  }
  for (const feature of features) {
    const kind = feature.properties?.kind
    if (kind in counts) counts[kind]++
  }
  return counts
}
