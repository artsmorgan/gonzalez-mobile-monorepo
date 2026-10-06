/** Ensambla el árbol anidado clásico a partir de `fragments` (artículos en `puesto_{id}_articulos`). */
export function mergeMainStructureFragments(fragments: Record<string, any>): any[] {
    const empresasRaw = fragments.empresas;
    if (!Array.isArray(empresasRaw)) return [];

    const divisionesList: any[] = Array.isArray(fragments.divisiones) ? fragments.divisiones : [];

    return empresasRaw.map((empresa: any) => {
        const eid = Number(empresa?.id);
        const clientesLight: any[] = Array.isArray(fragments[`empresa_${eid}_clientes`]) ? fragments[`empresa_${eid}_clientes`] : [];

        const clientes = clientesLight.map((c: any) => {
            const cid = Number(c?.id);
            const division = divisionesList.map((div: any) => {
                const did = Number(div?.id);
                const contratosLight: any[] = Array.isArray(fragments[`cliente_${cid}_division_${did}_contratos`])
                    ? fragments[`cliente_${cid}_division_${did}_contratos`]
                    : [];

                const contratos = contratosLight.map((ct: any) => {
                    const ctid = Number(ct?.id);
                    const sucursalesLight: any[] = Array.isArray(fragments[`contrato_${ctid}_sucursales`])
                        ? fragments[`contrato_${ctid}_sucursales`]
                        : [];

                    const sucursales = sucursalesLight.map((s: any) => {
                        const sid = Number(s?.id);
                        const puestosLight: any[] = Array.isArray(fragments[`sucursal_${sid}_puestos`])
                            ? fragments[`sucursal_${sid}_puestos`]
                            : [];

                        const puestos = puestosLight.map((p: any) => {
                            const pid = Number(p?.id);
                            const plazasLight: any[] = Array.isArray(fragments[`puesto_${pid}_plazas`])
                                ? fragments[`puesto_${pid}_plazas`]
                                : [];
                            const artKey = `puesto_${pid}_articulos`;
                            const articulos = Array.isArray(fragments[artKey]) ? fragments[artKey] : [];

                            const plazas = plazasLight.map((pl: any) => {
                                const plid = Number(pl?.id);
                                const empKey = `plaza_${plid}_empleados`;
                                return {
                                    ...pl,
                                    empleados: Array.isArray(fragments[empKey]) ? fragments[empKey] : [],
                                };
                            });

                            return {
                                ...p,
                                plazas,
                                articulos,
                            };
                        });

                        const vehKey = `sucursal_${sid}_vehiculos_corporativos`;
                        const bitKey = `sucursal_${sid}_bitacora_vehiculos_detenidos`;
                        const llavesKey = `sucursal_${sid}_llaves`;
                        const llaverosKey = `sucursal_${sid}_llaveros`;

                        return {
                            ...s,
                            vehiculos_corporativos: Array.isArray(fragments[vehKey]) ? fragments[vehKey] : [],
                            bitacoras_vehiculos_detenidos: Array.isArray(fragments[bitKey]) ? fragments[bitKey] : [],
                            llaves: Array.isArray(fragments[llavesKey]) ? fragments[llavesKey] : [],
                            llaveros: Array.isArray(fragments[llaverosKey]) ? fragments[llaverosKey] : [],
                            puestos,
                        };
                    });

                    return { ...ct, sucursales };
                });

                return { ...div, contratos };
            });

            return { ...c, division };
        });

        return { ...empresa, clientes };
    });
}
