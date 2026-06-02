const EMPTY_HIERARCHY = {
  rmaName: null,
  rmaSubType: null,
  psoAreaId: null,
  psoName: null,
  rfccName: null,
  eaAreaName: null
}

function buildHierarchyResult(rma, pso, ea) {
  return {
    rmaName: rma.name ?? null,
    rmaSubType: rma.sub_type ?? null,
    psoAreaId: pso?.id == null ? null : Number(pso.id),
    psoName: pso?.name ?? null,
    rfccName: pso?.name ?? null, // PSO name IS the RFCC committee name
    eaAreaName: ea?.name ?? null
  }
}

export async function resolveAreaHierarchy(prisma, areaId) {
  if (!areaId) {
    return { ...EMPTY_HIERARCHY }
  }

  // Step 1 — RMA
  const rma = await prisma.pafs_core_areas.findFirst({
    where: { id: BigInt(areaId) },
    select: { name: true, sub_type: true, parent_id: true }
  })

  if (!rma) {
    return { ...EMPTY_HIERARCHY }
  }

  // Step 2 — PSO (parent of RMA; its name = RFCC committee name)
  const pso = rma.parent_id
    ? await prisma.pafs_core_areas.findFirst({
        where: { id: BigInt(rma.parent_id) },
        select: { id: true, name: true, parent_id: true }
      })
    : null

  // Step 3 — EA Area (parent of PSO)
  const ea = pso?.parent_id
    ? await prisma.pafs_core_areas.findFirst({
        where: { id: BigInt(pso.parent_id) },
        select: { name: true }
      })
    : null

  return buildHierarchyResult(rma, pso, ea)
}
