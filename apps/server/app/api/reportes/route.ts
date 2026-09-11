/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { verifyAccessToken } from "../../../utils/verifyToken";
import { callDynamicReportesApi } from "../../../utils/callDynamicReportesApi";
import { reportError } from "../../../utils/reportError";

function parseCreatedByIds(raw: string | null): number[] | undefined {
    if (!raw || raw.trim() === "") return undefined;
    const parts = raw.split(",").map((s) => Number(s.trim()));
    const nums = parts.filter((n) => Number.isFinite(n) && n > 0);
    return nums.length ? nums : undefined;
}

function parseListModuleFilters(searchParams: URLSearchParams): any {
    const out: any = {};
    const cdesde = searchParams.get("listCreadoDesde");
    const chasta = searchParams.get("listCreadoHasta");
    const emp = searchParams.get("listEmpleadoIngresoId") ?? searchParams.get("listEmpleadoIngresoIds");
    const multi = searchParams.get("listSoloMultiDispositivo");
    if (cdesde) out.creadoDesde = cdesde;
    if (chasta) out.creadoHasta = chasta;
    if (emp && emp.trim() !== "") {
        const parts = emp
            .split(",")
            .map((s) => Number(s.trim()))
            .filter((n) => Number.isFinite(n) && n > 0);
        if (parts.length === 1) out.empleadoIngresoId = parts[0];
        else if (parts.length > 1) out.empleadoIngresoIds = parts;
    }
    if (multi === "1" || multi === "true") out.soloMultiDispositivo = true;

    const lmEmp = searchParams.get("listLmEmpleadoIds");
    if (lmEmp && lmEmp.trim() !== "") {
        const ids = lmEmp
            .split(",")
            .map((s) => Number(s.trim()))
            .filter((n) => Number.isFinite(n) && n > 0);
        if (ids.length > 0) out.empleadoIds = [...new Set(ids)];
    }

    const aDesde = searchParams.get("listActaCreadoDesde");
    const aHasta = searchParams.get("listActaCreadoHasta");
    const vDesde = searchParams.get("listVulnCreadoDesde");
    const vHasta = searchParams.get("listVulnCreadoHasta");
    if (aDesde) out.creadoDesde = aDesde;
    if (aHasta) out.creadoHasta = aHasta;
    if (vDesde) out.creadoDesde = vDesde;
    if (vHasta) out.creadoHasta = vHasta;
    const mapActaIds: Array<[string, string]> = [
        ["listEmpresaIds", "empresaIds"],
        ["listClienteIds", "clienteIds"],
        ["listDivisionIds", "divisionIds"],
        ["listContratoIds", "contratoIds"],
        ["listCorpoIds", "corpoIds"],
        ["listPuestoIds", "puestoIds"],
    ];
    for (const [paramKey, outKey] of mapActaIds) {
        const raw = searchParams.get(paramKey);
        if (!raw || raw.trim() === "") continue;
        const ids = raw
            .split(",")
            .map((s) => Number(s.trim()))
            .filter((n) => Number.isFinite(n) && n > 0);
        if (ids.length > 0) out[outKey] = [...new Set(ids)];
    }
    const mapVulnIds: Array<[string, string]> = [
        ["listVulnEmpresaIds", "empresaIds"],
        ["listVulnClienteIds", "clienteIds"],
        ["listVulnDivisionIds", "divisionIds"],
        ["listVulnContratoIds", "contratoIds"],
        ["listVulnCorpoIds", "corpoIds"],
        ["listVulnPuestoIds", "puestoIds"],
    ];
    for (const [paramKey, outKey] of mapVulnIds) {
        const raw = searchParams.get(paramKey);
        if (!raw || raw.trim() === "") continue;
        const ids = raw
            .split(",")
            .map((s) => Number(s.trim()))
            .filter((n) => Number.isFinite(n) && n > 0);
        if (ids.length > 0) out[outKey] = [...new Set(ids)];
    }
    const activDesde = searchParams.get("listActivCreadoDesde");
    const activHasta = searchParams.get("listActivCreadoHasta");
    if (activDesde) out.creadoDesde = activDesde;
    if (activHasta) out.creadoHasta = activHasta;
    const mapActivIds: Array<[string, string]> = [
        ["listActivEmpresaIds", "empresaIds"],
        ["listActivClienteIds", "clienteIds"],
        ["listActivDivisionIds", "divisionIds"],
        ["listActivContratoIds", "contratoIds"],
        ["listActivCorpoIds", "corpoIds"],
        ["listActivPuestoIds", "puestoIds"],
    ];
    for (const [paramKey, outKey] of mapActivIds) {
        const raw = searchParams.get(paramKey);
        if (!raw || raw.trim() === "") continue;
        const ids = raw
            .split(",")
            .map((s) => Number(s.trim()))
            .filter((n) => Number.isFinite(n) && n > 0);
        if (ids.length > 0) out[outKey] = [...new Set(ids)];
    }
    const asisDesde = searchParams.get("listAsisCreadoDesde");
    const asisHasta = searchParams.get("listAsisCreadoHasta");
    if (asisDesde) out.creadoDesde = asisDesde;
    if (asisHasta) out.creadoHasta = asisHasta;
    const mapAsisIds: Array<[string, string]> = [
        ["listAsisEmpresaIds", "empresaIds"],
        ["listAsisClienteIds", "clienteIds"],
        ["listAsisDivisionIds", "divisionIds"],
        ["listAsisContratoIds", "contratoIds"],
        ["listAsisCorpoIds", "corpoIds"],
        ["listAsisPuestoIds", "puestoIds"],
    ];
    for (const [paramKey, outKey] of mapAsisIds) {
        const raw = searchParams.get(paramKey);
        if (!raw || raw.trim() === "") continue;
        const ids = raw
            .split(",")
            .map((s) => Number(s.trim()))
            .filter((n) => Number.isFinite(n) && n > 0);
        if (ids.length > 0) out[outKey] = [...new Set(ids)];
    }
    const asisTurno = searchParams.get("listAsisTurno");
    if (asisTurno && ["D", "M", "N"].includes(String(asisTurno).toUpperCase())) {
        out.tipoTurno = String(asisTurno).toUpperCase();
    }
    const docDesde = searchParams.get("listDocCreadoDesde");
    const docHasta = searchParams.get("listDocCreadoHasta");
    if (docDesde) out.creadoDesde = docDesde;
    if (docHasta) out.creadoHasta = docHasta;
    const mapDocIds: Array<[string, string]> = [
        ["listDocEmpresaIds", "empresaIds"],
        ["listDocClienteIds", "clienteIds"],
        ["listDocDivisionIds", "divisionIds"],
        ["listDocContratoIds", "contratoIds"],
        ["listDocCorpoIds", "corpoIds"],
        ["listDocPuestoIds", "puestoIds"],
    ];
    for (const [paramKey, outKey] of mapDocIds) {
        const raw = searchParams.get(paramKey);
        if (!raw || raw.trim() === "") continue;
        const ids = raw
            .split(",")
            .map((s) => Number(s.trim()))
            .filter((n) => Number.isFinite(n) && n > 0);
        if (ids.length > 0) out[outKey] = [...new Set(ids)];
    }
    const docTipo = searchParams.get("listDocTipoDocumento");
    if (docTipo && docTipo.trim() !== "") out.tipoDocumento = docTipo.trim();

    const encDesde = searchParams.get("listEncCreadoDesde");
    const encHasta = searchParams.get("listEncCreadoHasta");
    if (encDesde) out.creadoDesde = encDesde;
    if (encHasta) out.creadoHasta = encHasta;
    const mapEncIds: Array<[string, string]> = [
        ["listEncEmpresaIds", "empresaIds"],
        ["listEncClienteIds", "clienteIds"],
        ["listEncDivisionIds", "divisionIds"],
        ["listEncContratoIds", "contratoIds"],
        ["listEncCorpoIds", "corpoIds"],
        ["listEncPuestoIds", "puestoIds"],
        ["listEncResponsableIds", "responsableIds"],
    ];
    for (const [paramKey, outKey] of mapEncIds) {
        const raw = searchParams.get(paramKey);
        if (!raw || raw.trim() === "") continue;
        const ids = raw
            .split(",")
            .map((s) => Number(s.trim()))
            .filter((n) => Number.isFinite(n) && n > 0);
        if (ids.length > 0) out[outKey] = [...new Set(ids)];
    }

    const rvDesde = searchParams.get("listRvCreadoDesde");
    const rvHasta = searchParams.get("listRvCreadoHasta");
    if (rvDesde) out.creadoDesde = rvDesde;
    if (rvHasta) out.creadoHasta = rvHasta;
    const mapRvIds: Array<[string, string]> = [
        ["listRvEmpresaIds", "empresaIds"],
        ["listRvClienteIds", "clienteIds"],
        ["listRvDivisionIds", "divisionIds"],
        ["listRvContratoIds", "contratoIds"],
        ["listRvCorpoIds", "corpoIds"],
        ["listRvPuestoIds", "puestoIds"],
        ["listRvResponsableIds", "responsableIds"],
    ];
    for (const [paramKey, outKey] of mapRvIds) {
        const raw = searchParams.get(paramKey);
        if (!raw || raw.trim() === "") continue;
        const ids = raw
            .split(",")
            .map((s) => Number(s.trim()))
            .filter((n) => Number.isFinite(n) && n > 0);
        if (ids.length > 0) out[outKey] = [...new Set(ids)];
    }
    const rvCedula = searchParams.get("listRvCedulaVisitante");
    if (rvCedula && rvCedula.trim() !== "") out.cedulaVisitante = rvCedula.trim();
    const rvTipo = searchParams.get("listRvTipoVisitante");
    if (rvTipo === "todos" || rvTipo === "normal" || rvTipo === "funcionario") out.tipoVisitante = rvTipo;

    const mutDesde = searchParams.get("listMutFechaReporteDesde");
    const mutHasta = searchParams.get("listMutFechaReporteHasta");
    if (mutDesde) out.fechaReporteDesde = mutDesde;
    if (mutHasta) out.fechaReporteHasta = mutHasta;
    const mapMutIds: Array<[string, string]> = [
        ["listMutEmpresaIds", "empresaIds"],
        ["listMutClienteIds", "clienteIds"],
        ["listMutDivisionIds", "divisionIds"],
        ["listMutContratoIds", "contratoIds"],
        ["listMutCorpoIds", "corpoIds"],
        ["listMutPuestoIds", "puestoIds"],
        ["listMutEmpleadoAusenteIds", "empleadoAusenteIds"],
        ["listMutEmpleadoReemplazaIds", "empleadoReemplazaIds"],
        ["listMutEjecutivoCuentaIds", "ejecutivoCuentaIds"],
    ];
    for (const [paramKey, outKey] of mapMutIds) {
        const raw = searchParams.get(paramKey);
        if (!raw || raw.trim() === "") continue;
        const ids = raw
            .split(",")
            .map((s) => Number(s.trim()))
            .filter((n) => Number.isFinite(n) && n > 0);
        if (ids.length > 0) out[outKey] = [...new Set(ids)];
    }
    const mutEstado = searchParams.get("listMutEstado");
    if (mutEstado) {
        const me = mutEstado.trim().toLowerCase();
        if (me === "aprobado" || me === "rechazado" || me === "pendiente") out.estado = me;
    }

    const mapAccIds: Array<[string, string]> = [
        ["listAccEmpleadoIds", "empleadoIds"],
        ["listAccEmpresaIds", "empresaIds"],
        ["listAccClienteIds", "clienteIds"],
        ["listAccDivisionIds", "divisionIds"],
        ["listAccContratoIds", "contratoIds"],
        ["listAccCorpoIds", "corpoIds"],
        ["listAccPuestoIds", "puestoIds"],
        ["listAccPlazaIds", "plazaIds"],
    ];
    for (const [paramKey, outKey] of mapAccIds) {
        const raw = searchParams.get(paramKey);
        if (!raw || raw.trim() === "") continue;
        const ids = raw
            .split(",")
            .map((s) => Number(s.trim()))
            .filter((n) => Number.isFinite(n) && n > 0);
        if (ids.length > 0) out[outKey] = [...new Set(ids)];
    }
    const agendaEst = searchParams.get("listAgendaEstado");
    if (agendaEst === "todos" || agendaEst === "completado" || agendaEst === "pendiente") {
        out.estadoMinuta = agendaEst;
    }
    const acpTipo = searchParams.get("listAcpTipo");
    if (acpTipo === "todos" || acpTipo === "apertura" || acpTipo === "cierre") {
        out.tipo = acpTipo;
    }
    const acpCreatedBy = searchParams.get("listAcpCreatedByIds");
    if (acpCreatedBy && acpCreatedBy.trim() !== "") {
        const ids = acpCreatedBy
            .split(",")
            .map((s) => Number(s.trim()))
            .filter((n) => Number.isFinite(n) && n > 0);
        if (ids.length > 0) out.createdByIds = [...new Set(ids)];
    }
    const incMapIds: Array<[string, string]> = [
        ["listIncEmpresaIds", "empresaIds"],
        ["listIncClienteIds", "clienteIds"],
        ["listIncDivisionIds", "divisionIds"],
        ["listIncContratoIds", "contratoIds"],
        ["listIncCorpoIds", "corpoIds"],
        ["listIncPuestoIds", "puestoIds"],
    ];
    for (const [paramKey, outKey] of incMapIds) {
        const raw = searchParams.get(paramKey);
        if (!raw || raw.trim() === "") continue;
        const ids = raw
            .split(",")
            .map((s) => Number(s.trim()))
            .filter((n) => Number.isFinite(n) && n > 0);
        if (ids.length > 0) out[outKey] = [...new Set(ids)];
    }
    const incCreadoDesde = searchParams.get("listIncCreadoDesde");
    const incCreadoHasta = searchParams.get("listIncCreadoHasta");
    const incSolDesde = searchParams.get("listIncSolucionadoDesde");
    const incSolHasta = searchParams.get("listIncSolucionadoHasta");
    const incRealDesde = searchParams.get("listIncSolucionadoRealDesde");
    const incRealHasta = searchParams.get("listIncSolucionadoRealHasta");
    if (incCreadoDesde) out.creadoDesde = incCreadoDesde;
    if (incCreadoHasta) out.creadoHasta = incCreadoHasta;
    if (incSolDesde) out.solucionadoDesde = incSolDesde;
    if (incSolHasta) out.solucionadoHasta = incSolHasta;
    if (incRealDesde) out.solucionadoRealDesde = incRealDesde;
    if (incRealHasta) out.solucionadoRealHasta = incRealHasta;
    const incClasificacionId = Number(searchParams.get("listIncClasificacionId"));
    if (Number.isFinite(incClasificacionId) && incClasificacionId > 0) out.clasificacionId = incClasificacionId;
    const incEstado = String(searchParams.get("listIncEstado") || "").trim().toLowerCase();
    if (incEstado === "solucionado" || incEstado === "true" || incEstado === "1") out.estado = true;
    if (incEstado === "no_solucionado" || incEstado === "false" || incEstado === "0") out.estado = false;
    const llvDesde = searchParams.get("listLlvCreadoDesde");
    const llvHasta = searchParams.get("listLlvCreadoHasta");
    if (llvDesde) out.creadoDesde = llvDesde;
    if (llvHasta) out.creadoHasta = llvHasta;
    const llvMapIds: Array<[string, string]> = [
        ["listLlvEmpresaIds", "empresaIds"],
        ["listLlvClienteIds", "clienteIds"],
        ["listLlvDivisionIds", "divisionIds"],
        ["listLlvContratoIds", "contratoIds"],
        ["listLlvCorpoIds", "corpoIds"],
        ["listLlvPuestoIds", "puestoIds"],
        ["listLlvLlaveroIds", "llaveroIds"],
    ];
    for (const [paramKey, outKey] of llvMapIds) {
        const raw = searchParams.get(paramKey);
        if (!raw || raw.trim() === "") continue;
        const ids = raw
            .split(",")
            .map((s) => Number(s.trim()))
            .filter((n) => Number.isFinite(n) && n > 0);
        if (ids.length > 0) out[outKey] = [...new Set(ids)];
    }
    const llvEntregado = searchParams.get("listLlvEntregadoPor");
    const llvRecibido = searchParams.get("listLlvRecibidoPor");
    if (llvEntregado && llvEntregado.trim() !== "") out.entregadoPorContains = llvEntregado.trim();
    if (llvRecibido && llvRecibido.trim() !== "") out.recibidoPorContains = llvRecibido.trim();

    const llrDesde = searchParams.get("listLlrCreadoDesde");
    const llrHasta = searchParams.get("listLlrCreadoHasta");
    if (llrDesde) out.creadoDesde = llrDesde;
    if (llrHasta) out.creadoHasta = llrHasta;
    const llrMapIds: Array<[string, string]> = [
        ["listLlrEmpresaIds", "empresaIds"],
        ["listLlrClienteIds", "clienteIds"],
        ["listLlrDivisionIds", "divisionIds"],
        ["listLlrContratoIds", "contratoIds"],
        ["listLlrCorpoIds", "corpoIds"],
        ["listLlrPuestoIds", "puestoIds"],
    ];
    for (const [paramKey, outKey] of llrMapIds) {
        const raw = searchParams.get(paramKey);
        if (!raw || raw.trim() === "") continue;
        const ids = raw
            .split(",")
            .map((s) => Number(s.trim()))
            .filter((n) => Number.isFinite(n) && n > 0);
        if (ids.length > 0) out[outKey] = [...new Set(ids)];
    }
    const llrEntregado = searchParams.get("listLlrEntregadoPor");
    const llrRecibido = searchParams.get("listLlrRecibidoPor");
    if (llrEntregado && llrEntregado.trim() !== "") out.entregadoPorContains = llrEntregado.trim();
    if (llrRecibido && llrRecibido.trim() !== "") out.recibidoPorContains = llrRecibido.trim();

    const bnvDesde = searchParams.get("listBnvCreadoDesde");
    const bnvHasta = searchParams.get("listBnvCreadoHasta");
    if (bnvDesde) out.creadoDesde = bnvDesde;
    if (bnvHasta) out.creadoHasta = bnvHasta;
    const bnvMapIds: Array<[string, string]> = [
        ["listBnvEmpresaIds", "empresaIds"],
        ["listBnvClienteIds", "clienteIds"],
        ["listBnvDivisionIds", "divisionIds"],
        ["listBnvContratoIds", "contratoIds"],
        ["listBnvCorpoIds", "corpoIds"],
        ["listBnvPuestoIds", "puestoIds"],
    ];
    for (const [paramKey, outKey] of bnvMapIds) {
        const raw = searchParams.get(paramKey);
        if (!raw || raw.trim() === "") continue;
        const ids = raw
            .split(",")
            .map((s) => Number(s.trim()))
            .filter((n) => Number.isFinite(n) && n > 0);
        if (ids.length > 0) out[outKey] = [...new Set(ids)];
    }
    const bnvCat = Number(searchParams.get("listBnvCategoriaId"));
    if (Number.isFinite(bnvCat) && bnvCat > 0) out.categoriaId = bnvCat;
    const bnvRel = String(searchParams.get("listBnvRelevancia") || "").trim();
    if (bnvRel === "Alta" || bnvRel === "Media" || bnvRel === "Baja") out.relevancia = bnvRel;

    const mqjDesde = searchParams.get("listMqjCreadoDesde");
    const mqjHasta = searchParams.get("listMqjCreadoHasta");
    if (mqjDesde) out.creadoDesde = mqjDesde;
    if (mqjHasta) out.creadoHasta = mqjHasta;
    const mqjMapIds: Array<[string, string]> = [
        ["listMqjEmpresaIds", "empresaIds"],
        ["listMqjClienteIds", "clienteIds"],
        ["listMqjDivisionIds", "divisionIds"],
        ["listMqjContratoIds", "contratoIds"],
        ["listMqjCorpoIds", "corpoIds"],
        ["listMqjPuestoIds", "puestoIds"],
    ];
    for (const [paramKey, outKey] of mqjMapIds) {
        const raw = searchParams.get(paramKey);
        if (!raw || raw.trim() === "") continue;
        const ids = raw
            .split(",")
            .map((s) => Number(s.trim()))
            .filter((n) => Number.isFinite(n) && n > 0);
        if (ids.length > 0) out[outKey] = [...new Set(ids)];
    }
    const mqjMedio = String(searchParams.get("listMqjMedioRecepcion") || "").trim();
    if (mqjMedio && mqjMedio !== "todos") out.medioRecepcionQueja = mqjMedio;
    const mqjTipoQ = String(searchParams.get("listMqjTipoQueja") || "").trim();
    if (mqjTipoQ && mqjTipoQ !== "todos") out.tipoQueja = mqjTipoQ;
    const mqjNivel = String(searchParams.get("listMqjNivelQueja") || "").trim();
    if (mqjNivel && mqjNivel !== "todos") out.nivelQueja = mqjNivel;

    const evpDesde = searchParams.get("listEvpCreadoDesde");
    const evpHasta = searchParams.get("listEvpCreadoHasta");
    if (evpDesde) out.creadoDesde = evpDesde;
    if (evpHasta) out.creadoHasta = evpHasta;
    const mapEvpIds: Array<[string, string]> = [
        ["listEvpEmpresaIds", "empresaIds"],
        ["listEvpClienteIds", "clienteIds"],
        ["listEvpDivisionIds", "divisionIds"],
        ["listEvpContratoIds", "contratoIds"],
        ["listEvpCorpoIds", "corpoIds"],
        ["listEvpPuestoIds", "puestoIds"],
        ["listEvpEmpleadoEvaluadoIds", "empleadoEvaluadoIds"],
        ["listEvpEvaluadorIds", "evaluadorIds"],
    ];
    for (const [paramKey, outKey] of mapEvpIds) {
        const raw = searchParams.get(paramKey);
        if (!raw || raw.trim() === "") continue;
        const ids = raw
            .split(",")
            .map((s) => Number(s.trim()))
            .filter((n) => Number.isFinite(n) && n > 0);
        if (ids.length > 0) out[outKey] = [...new Set(ids)];
    }
    const evpTipo = searchParams.get("listEvpTipoEvaluacion");
    if (evpTipo && ["Seguridad", "Aseo & limpieza", "Otros"].includes(evpTipo.trim())) {
        out.tipoEvaluacion = evpTipo.trim();
    }

    const pncDesde = searchParams.get("listPncCreadoDesde");
    const pncHasta = searchParams.get("listPncCreadoHasta");
    if (pncDesde) out.creadoDesde = pncDesde;
    if (pncHasta) out.creadoHasta = pncHasta;
    const mapPncIds: Array<[string, string]> = [
        ["listPncEmpresaIds", "empresaIds"],
        ["listPncClienteIds", "clienteIds"],
        ["listPncDivisionIds", "divisionIds"],
        ["listPncContratoIds", "contratoIds"],
        ["listPncCorpoIds", "corpoIds"],
        ["listPncPuestoIds", "puestoIds"],
    ];
    for (const [paramKey, outKey] of mapPncIds) {
        const raw = searchParams.get(paramKey);
        if (!raw || raw.trim() === "") continue;
        const ids = raw
            .split(",")
            .map((s) => Number(s.trim()))
            .filter((n) => Number.isFinite(n) && n > 0);
        if (ids.length > 0) out[outKey] = [...new Set(ids)];
    }
    const pncTipo = String(searchParams.get("listPncTipoServicio") || "").trim();
    if (pncTipo && pncTipo !== "todos") out.tipoServicioNoConforme = pncTipo;

    const irDesde = searchParams.get("listIrCreadoDesde");
    const irHasta = searchParams.get("listIrCreadoHasta");
    if (irDesde) out.creadoDesde = irDesde;
    if (irHasta) out.creadoHasta = irHasta;
    const mapIrIds: Array<[string, string]> = [
        ["listIrEmpresaIds", "empresaIds"],
        ["listIrClienteIds", "clienteIds"],
        ["listIrDivisionIds", "divisionIds"],
        ["listIrContratoIds", "contratoIds"],
        ["listIrCorpoIds", "corpoIds"],
        ["listIrPuestoIds", "puestoIds"],
        ["listIrResponsableEmpleadoIds", "responsableEmpleadoIds"],
        ["listIrEmpleadoIds", "empleadoIds"],
    ];
    for (const [paramKey, outKey] of mapIrIds) {
        const raw = searchParams.get(paramKey);
        if (!raw || raw.trim() === "") continue;
        const ids = raw
            .split(",")
            .map((s) => Number(s.trim()))
            .filter((n) => Number.isFinite(n) && n > 0);
        if (ids.length > 0) out[outKey] = [...new Set(ids)];
    }
    const irPart = searchParams.get("listIrParticipanteCedulas");
    if (irPart && irPart.trim() !== "") {
        const ceds = irPart
            .split(",")
            .map((s) => s.trim().replace(/\s+/g, ""))
            .filter((s) => s.length > 0);
        if (ceds.length > 0) out.participanteCedulas = [...new Set(ceds)];
    }

    const nvDesde = searchParams.get("listNvCreadoDesde");
    const nvHasta = searchParams.get("listNvCreadoHasta");
    if (nvDesde) out.creadoDesde = nvDesde;
    if (nvHasta) out.creadoHasta = nvHasta;
    const mapNvIds: Array<[string, string]> = [
        ["listNvEmpresaIds", "empresaIds"],
        ["listNvClienteIds", "clienteIds"],
        ["listNvDivisionIds", "divisionIds"],
        ["listNvContratoIds", "contratoIds"],
        ["listNvCorpoIds", "corpoIds"],
        ["listNvPuestoIds", "puestoIds"],
    ];
    for (const [paramKey, outKey] of mapNvIds) {
        const raw = searchParams.get(paramKey);
        if (!raw || raw.trim() === "") continue;
        const ids = raw
            .split(",")
            .map((s) => Number(s.trim()))
            .filter((n) => Number.isFinite(n) && n > 0);
        if (ids.length > 0) out[outKey] = [...new Set(ids)];
    }

    const cupDesde = searchParams.get("listCupCreadoDesde");
    const cupHasta = searchParams.get("listCupCreadoHasta");
    if (cupDesde) out.creadoDesde = cupDesde;
    if (cupHasta) out.creadoHasta = cupHasta;
    const mapCupIds: Array<[string, string]> = [
        ["listCupEmpresaIds", "empresaIds"],
        ["listCupClienteIds", "clienteIds"],
        ["listCupDivisionIds", "divisionIds"],
        ["listCupContratoIds", "contratoIds"],
        ["listCupCorpoIds", "corpoIds"],
        ["listCupPuestoIds", "puestoIds"],
        ["listCupResponsableIds", "responsableIds"],
    ];
    for (const [paramKey, outKey] of mapCupIds) {
        const raw = searchParams.get(paramKey);
        if (!raw || raw.trim() === "") continue;
        const ids = raw
            .split(",")
            .map((s) => Number(s.trim()))
            .filter((n) => Number.isFinite(n) && n > 0);
        if (ids.length > 0) out[outKey] = [...new Set(ids)];
    }

    const rcDesde = searchParams.get("listRcCreadoDesde");
    const rcHasta = searchParams.get("listRcCreadoHasta");
    if (rcDesde) out.creadoDesde = rcDesde;
    if (rcHasta) out.creadoHasta = rcHasta;
    const rcTipo = searchParams.get("listRcTipoCapacitacion");
    if (rcTipo && rcTipo.trim() !== "" && rcTipo !== "todos") out.tipoCapacitacion = rcTipo.trim();
    const mapRcIds: Array<[string, string]> = [
        ["listRcEmpresaIds", "empresaIds"],
        ["listRcClienteIds", "clienteIds"],
        ["listRcDivisionIds", "divisionIds"],
        ["listRcContratoIds", "contratoIds"],
        ["listRcCorpoIds", "corpoIds"],
        ["listRcPuestoIds", "puestoIds"],
        ["listRcCapacitacionEmpleadoIds", "capacitacionEmpleadoIds"],
        ["listRcCapacitacionPuestoIds", "capacitacionPuestoIds"],
        ["listRcResponsableIds", "responsableIds"],
    ];
    for (const [paramKey, outKey] of mapRcIds) {
        const raw = searchParams.get(paramKey);
        if (!raw || raw.trim() === "") continue;
        const ids = raw
            .split(",")
            .map((s) => Number(s.trim()))
            .filter((n) => Number.isFinite(n) && n > 0);
        if (ids.length > 0) out[outKey] = [...new Set(ids)];
    }

    const rigDesde = searchParams.get("listRigCreadoDesde");
    const rigHasta = searchParams.get("listRigCreadoHasta");
    if (rigDesde) out.creadoDesde = rigDesde;
    if (rigHasta) out.creadoHasta = rigHasta;
    const mapRigIds: Array<[string, string]> = [
        ["listRigEmpresaIds", "empresaIds"],
        ["listRigClienteIds", "clienteIds"],
        ["listRigDivisionIds", "divisionIds"],
        ["listRigContratoIds", "contratoIds"],
        ["listRigCorpoIds", "corpoIds"],
        ["listRigPuestoIds", "puestoIds"],
    ];
    for (const [paramKey, outKey] of mapRigIds) {
        const raw = searchParams.get(paramKey);
        if (!raw || raw.trim() === "") continue;
        const ids = raw
            .split(",")
            .map((s) => Number(s.trim()))
            .filter((n) => Number.isFinite(n) && n > 0);
        if (ids.length > 0) out[outKey] = [...new Set(ids)];
    }
    const rigCol = searchParams.get("listRigColaboradorCedulas");
    if (rigCol && rigCol.trim() !== "") {
        const ceds = rigCol
            .split(",")
            .map((s) => s.trim().replace(/\s+/g, ""))
            .filter((s) => s.length > 0);
        if (ceds.length > 0) out.colaboradorCedulas = [...new Set(ceds)];
    }
    const rigCap = searchParams.get("listRigCapacitadorCedulas");
    if (rigCap && rigCap.trim() !== "") {
        const ceds = rigCap
            .split(",")
            .map((s) => s.trim().replace(/\s+/g, ""))
            .filter((s) => s.length > 0);
        if (ceds.length > 0) out.capacitadorCedulas = [...new Set(ceds)];
    }

    const mpDesde = searchParams.get("listMpCreadoDesde");
    const mpHasta = searchParams.get("listMpCreadoHasta");
    if (mpDesde) out.creadoDesde = mpDesde;
    if (mpHasta) out.creadoHasta = mpHasta;
    const mapMpIds: Array<[string, string]> = [
        ["listMpEmpresaIds", "empresaIds"],
        ["listMpClienteIds", "clienteIds"],
        ["listMpDivisionIds", "divisionIds"],
        ["listMpContratoIds", "contratoIds"],
        ["listMpCorpoIds", "corpoIds"],
        ["listMpPuestoIds", "puestoIds"],
    ];
    for (const [paramKey, outKey] of mapMpIds) {
        const raw = searchParams.get(paramKey);
        if (!raw || raw.trim() === "") continue;
        const ids = raw
            .split(",")
            .map((s) => Number(s.trim()))
            .filter((n) => Number.isFinite(n) && n > 0);
        if (ids.length > 0) out[outKey] = [...new Set(ids)];
    }
    const mpClasif = searchParams.get("listMpClasificaciones");
    if (mpClasif && mpClasif.trim() !== "") {
        const vals = mpClasif
            .split(",")
            .map((s) => s.trim())
            .filter((s) => s.length > 0);
        if (vals.length > 0) out.classificaciones = [...new Set(vals)];
    }

    const mapApIds: Array<[string, string]> = [
        ["listApEmpresaIds", "empresaIds"],
        ["listApClienteIds", "clienteIds"],
        ["listApDivisionIds", "divisionIds"],
        ["listApContratoIds", "contratoIds"],
        ["listApCorpoIds", "corpoIds"],
        ["listApPuestoIds", "puestoIds"],
    ];
    for (const [paramKey, outKey] of mapApIds) {
        const raw = searchParams.get(paramKey);
        if (!raw || raw.trim() === "") continue;
        const ids = raw
            .split(",")
            .map((s) => Number(s.trim()))
            .filter((n) => Number.isFinite(n) && n > 0);
        if (ids.length > 0) out[outKey] = [...new Set(ids)];
    }

    const maDesde = searchParams.get("listMaCreadoDesde");
    const maHasta = searchParams.get("listMaCreadoHasta");
    if (maDesde) out.creadoDesde = maDesde;
    if (maHasta) out.creadoHasta = maHasta;
    const maSolDesde = searchParams.get("listMaSolucionadoDesde");
    const maSolHasta = searchParams.get("listMaSolucionadoHasta");
    if (maSolDesde) out.solucionadoDesde = maSolDesde;
    if (maSolHasta) out.solucionadoHasta = maSolHasta;
    const mapMaIds: Array<[string, string]> = [
        ["listMaEmpresaIds", "empresaIds"],
        ["listMaClienteIds", "clienteIds"],
        ["listMaDivisionIds", "divisionIds"],
        ["listMaContratoIds", "contratoIds"],
        ["listMaCorpoIds", "corpoIds"],
        ["listMaPuestoIds", "puestoIds"],
    ];
    for (const [paramKey, outKey] of mapMaIds) {
        const raw = searchParams.get(paramKey);
        if (!raw || raw.trim() === "") continue;
        const ids = raw
            .split(",")
            .map((s) => Number(s.trim()))
            .filter((n) => Number.isFinite(n) && n > 0);
        if (ids.length > 0) out[outKey] = [...new Set(ids)];
    }
    const maEstados = searchParams.get("listMaEstados");
    if (maEstados && maEstados.trim() !== "") {
        const ee = maEstados
            .split(",")
            .map((s) => s.trim())
            .filter((s) => s.length > 0);
        if (ee.length > 0) out.estados = [...new Set(ee)];
    }
    const maAcciones = searchParams.get("listMaAcciones");
    if (maAcciones && maAcciones.trim() !== "") {
        const aa = maAcciones
            .split(",")
            .map((s) => s.trim())
            .filter((s) => s.length > 0);
        if (aa.length > 0) out.tiposAccion = [...new Set(aa)];
    }

    const rvcDesde = searchParams.get("listRvcCreadoDesde");
    const rvcHasta = searchParams.get("listRvcCreadoHasta");
    if (rvcDesde) out.creadoDesde = rvcDesde;
    if (rvcHasta) out.creadoHasta = rvcHasta;
    const mapRvcIds: Array<[string, string]> = [
        ["listRvcEmpresaIds", "empresaIds"],
        ["listRvcClienteIds", "clienteIds"],
        ["listRvcDivisionIds", "divisionIds"],
        ["listRvcContratoIds", "contratoIds"],
        ["listRvcCorpoIds", "corpoIds"],
        ["listRvcPuestoIds", "puestoIds"],
    ];
    for (const [paramKey, outKey] of mapRvcIds) {
        const raw = searchParams.get(paramKey);
        if (!raw || raw.trim() === "") continue;
        const ids = raw
            .split(",")
            .map((s) => Number(s.trim()))
            .filter((n) => Number.isFinite(n) && n > 0);
        if (ids.length > 0) out[outKey] = [...new Set(ids)];
    }
    const rvcTipos = searchParams.get("listRvcTiposVehiculo");
    if (rvcTipos && rvcTipos.trim() !== "") {
        const tt = rvcTipos
            .split(",")
            .map((s) => s.trim())
            .filter((s) => s.length > 0);
        if (tt.length > 0) out.tiposVehiculo = [...new Set(tt)];
    }
    const rvcAutoria = searchParams.get("listRvcTiposAutoria");
    if (rvcAutoria && rvcAutoria.trim() !== "") {
        const ta = rvcAutoria
            .split(",")
            .map((s) => s.trim())
            .filter((s) => s.length > 0);
        if (ta.length > 0) out.tiposAutoria = [...new Set(ta)];
    }
    const rvcPlaca = searchParams.get("listRvcPlaca");
    if (rvcPlaca && rvcPlaca.trim() !== "") out.placaContains = rvcPlaca.trim();
    const rvcAnno = searchParams.get("listRvcAnno");
    if (rvcAnno && rvcAnno.trim() !== "") {
        const n = Number(rvcAnno.trim());
        if (Number.isFinite(n)) out.anno = n;
    }
    const rvcModelo = searchParams.get("listRvcModelo");
    if (rvcModelo && rvcModelo.trim() !== "") out.modeloContains = rvcModelo.trim();

    const revDesde = searchParams.get("listRevCreadoDesde");
    const revHasta = searchParams.get("listRevCreadoHasta");
    if (revDesde) out.creadoDesde = revDesde;
    if (revHasta) out.creadoHasta = revHasta;
    const mapRevIds: Array<[string, string]> = [
        ["listRevEmpresaIds", "empresaIds"],
        ["listRevClienteIds", "clienteIds"],
        ["listRevDivisionIds", "divisionIds"],
        ["listRevContratoIds", "contratoIds"],
        ["listRevCorpoIds", "corpoIds"],
        ["listRevPuestoIds", "puestoIds"],
        ["listRevVehiculoIds", "vehiculoIds"],
    ];
    for (const [paramKey, outKey] of mapRevIds) {
        const raw = searchParams.get(paramKey);
        if (!raw || raw.trim() === "") continue;
        const ids = raw
            .split(",")
            .map((s) => Number(s.trim()))
            .filter((n) => Number.isFinite(n) && n > 0);
        if (ids.length > 0) out[outKey] = [...new Set(ids)];
    }

    const cksDesde = searchParams.get("listCksFechaReporteDesde");
    const cksHasta = searchParams.get("listCksFechaReporteHasta");
    if (cksDesde) out.fechaReporteDesde = cksDesde;
    if (cksHasta) out.fechaReporteHasta = cksHasta;
    const cksMapIds: Array<[string, string]> = [
        ["listCksEmpresaIds", "empresaIds"],
        ["listCksClienteIds", "clienteIds"],
        ["listCksDivisionIds", "divisionIds"],
        ["listCksContratoIds", "contratoIds"],
        ["listCksCorpoIds", "corpoIds"],
        ["listCksPuestoIds", "puestoIds"],
        ["listCksEjecutivoIds", "ejecutivoCuentaIds"],
    ];
    for (const [paramKey, outKey] of cksMapIds) {
        const raw = searchParams.get(paramKey);
        if (!raw || raw.trim() === "") continue;
        const ids = raw
            .split(",")
            .map((s) => Number(s.trim()))
            .filter((n) => Number.isFinite(n) && n > 0);
        if (ids.length > 0) out[outKey] = [...new Set(ids)];
    }

    const incFrDesde = searchParams.get("listIncFechaReporteDesde");
    const incFrHasta = searchParams.get("listIncFechaReporteHasta");
    if (incFrDesde) out.fechaReporteDesde = incFrDesde;
    if (incFrHasta) out.fechaReporteHasta = incFrHasta;
    const incEj = searchParams.get("listIncEjecutivoIds");
    if (incEj && incEj.trim() !== "") {
        const ids = incEj
            .split(",")
            .map((s) => Number(s.trim()))
            .filter((n) => Number.isFinite(n) && n > 0);
        if (ids.length > 0) out.ejecutivoCuentaIds = [...new Set(ids)];
    }

    const taInicioDesde = searchParams.get("listTaInicioDesde");
    const taFinHasta = searchParams.get("listTaFinHasta");
    if (taInicioDesde) out.inicioDesde = taInicioDesde;
    if (taFinHasta) out.finHasta = taFinHasta;
    const mapTaIds: Array<[string, string]> = [
        ["listTaEmpresaIds", "empresaIds"],
        ["listTaClienteIds", "clienteIds"],
        ["listTaDivisionIds", "divisionIds"],
        ["listTaContratoIds", "contratoIds"],
        ["listTaCorpoIds", "corpoIds"],
        ["listTaPuestoIds", "puestoIds"],
        ["listTaEmpleadoIds", "empleadoIds"],
    ];
    for (const [paramKey, outKey] of mapTaIds) {
        const raw = searchParams.get(paramKey);
        if (!raw || raw.trim() === "") continue;
        const ids = raw
            .split(",")
            .map((s) => Number(s.trim()))
            .filter((n) => Number.isFinite(n) && n > 0);
        if (ids.length > 0) out[outKey] = [...new Set(ids)];
    }
    const taCed = searchParams.get("listTaCedulas");
    if (taCed && taCed.trim() !== "") {
        const ceds = taCed
            .split(",")
            .map((s) => s.trim().replace(/\s+/g, ""))
            .filter((s) => s.length > 0);
        if (ceds.length > 0) out.cedulas = [...new Set(ceds)];
    }

    const spDesde = searchParams.get("listSpCreadoDesde");
    const spHasta = searchParams.get("listSpCreadoHasta");
    if (spDesde) out.creadoDesde = spDesde;
    if (spHasta) out.creadoHasta = spHasta;
    const mapSpIds: Array<[string, string]> = [
        ["listSpEmpresaIds", "empresaIds"],
        ["listSpClienteIds", "clienteIds"],
        ["listSpDivisionIds", "divisionIds"],
        ["listSpContratoIds", "contratoIds"],
        ["listSpCorpoIds", "corpoIds"],
        ["listSpPuestoIds", "puestoIds"],
        ["listSpEmpleadoIds", "empleadoIds"],
        ["listSpEjecutivoIds", "ejecutivoCuentaIds"],
    ];
    for (const [paramKey, outKey] of mapSpIds) {
        const raw = searchParams.get(paramKey);
        if (!raw || raw.trim() === "") continue;
        const ids = raw
            .split(",")
            .map((s) => Number(s.trim()))
            .filter((n) => Number.isFinite(n) && n > 0);
        if (ids.length > 0) out[outKey] = [...new Set(ids)];
    }
    const spTurnos = searchParams.get("listSpTiposTurno");
    if (spTurnos && spTurnos.trim() !== "") {
        const tt = spTurnos
            .split(",")
            .map((s) => s.trim())
            .filter((s) => s.length > 0);
        if (tt.length > 0) out.tiposTurno = [...new Set(tt)];
    }
    const spTipoSal = searchParams.get("listSpTipoSalario");
    if (spTipoSal && spTipoSal.trim() !== "" && spTipoSal !== "todos") out.tipoSalario = spTipoSal;
    const spEst = searchParams.get("listSpEstado");
    if (spEst && spEst.trim() !== "" && spEst !== "todos") out.estado = spEst;

    const vvDesde = searchParams.get("listVvCreadoDesde");
    const vvHasta = searchParams.get("listVvCreadoHasta");
    if (vvDesde) out.creadoDesde = vvDesde;
    if (vvHasta) out.creadoHasta = vvHasta;
    const mapVvIds: Array<[string, string]> = [
        ["listVvEmpresaIds", "empresaIds"],
        ["listVvClienteIds", "clienteIds"],
        ["listVvDivisionIds", "divisionIds"],
        ["listVvContratoIds", "contratoIds"],
        ["listVvCorpoIds", "corpoIds"],
        ["listVvPuestoIds", "puestoIds"],
        ["listVvResponsableIds", "responsableIds"],
    ];
    for (const [paramKey, outKey] of mapVvIds) {
        const raw = searchParams.get(paramKey);
        if (!raw || raw.trim() === "") continue;
        const ids = raw
            .split(",")
            .map((s) => Number(s.trim()))
            .filter((n) => Number.isFinite(n) && n > 0);
        if (ids.length > 0) out[outKey] = [...new Set(ids)];
    }
    const vvCedula = searchParams.get("listVvCedulaVisitante");
    if (vvCedula && vvCedula.trim() !== "") out.cedulaVisitante = vvCedula.trim();
    const vvTipos = searchParams.get("listVvTiposVehiculo");
    if (vvTipos && vvTipos.trim() !== "") {
        const tt = vvTipos
            .split(",")
            .map((s) => s.trim())
            .filter((s) => s.length > 0);
        if (tt.length > 0) out.tiposVehiculo = [...new Set(tt)];
    }
    const vvPlacas = searchParams.get("listVvPlacas");
    if (vvPlacas && vvPlacas.trim() !== "") {
        const pp = vvPlacas
            .split(",")
            .map((s) => s.trim())
            .filter((s) => s.length > 0);
        if (pp.length > 0) out.placas = [...new Set(pp)];
    }

    return Object.keys(out).length ? out : undefined;
}

/**
 * GET: listado de `e_reportes_mobile` (operation listReports).
 * POST: preview, búsqueda de empleados, creación en segundo plano vía `executeReportesOperation`.
 */
export async function GET(req: NextRequest) {
    try {
        const tv = verifyAccessToken(req);
        if (!tv.valid) {
            return NextResponse.json({ status: false, message: tv.message }, { status: tv.expired ? 401 : 403 });
        }

        const sp = req.nextUrl.searchParams;
        const listModuleFilters = parseListModuleFilters(sp);

        const payload = await callDynamicReportesApi({
            req,
            body: {
                operation: "listReports",
                token: undefined,
                modulo: sp.get("modulo") || undefined,
                nombreContains: sp.get("nombreContains") || undefined,
                numeroContains: sp.get("numeroContains") || undefined,
                nomenclaturaContains: sp.get("nomenclaturaContains") || undefined,
                descripcionContains: sp.get("descripcionContains") || undefined,
                tipoReporte: sp.get("tipoReporte") || undefined,
                estado: sp.get("estado") || undefined,
                createdByIds: parseCreatedByIds(sp.get("createdByIds")),
                fechaInicio: sp.get("fechaInicio") || undefined,
                fechaFin: sp.get("fechaFin") || undefined,
                listModuleFilters,
            },
        });

        return NextResponse.json(payload, { status: 200 });
    } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : "Error desconocido";
        await reportError(req, "api/reportes", "GET", 500, msg);
        return NextResponse.json({ status: false, message: msg }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    try {
        const tv = verifyAccessToken(req);
        if (!tv.valid) {
            return NextResponse.json({ status: false, message: tv.message }, { status: tv.expired ? 401 : 403 });
        }

        const json = (await req.json()) as Record<string, any>;
        const operation = String(json.operation || "").trim();
        if (!operation) {
            await reportError(req, "api/reportes", "POST", 400, "operation es obligatorio");
            return NextResponse.json({ status: false, message: "operation es obligatorio" }, { status: 400 });
        }

        const payload = await callDynamicReportesApi({
            req,
            body: {
                ...json,
                operation,
            },
        });

        return NextResponse.json(payload, { status: 200 });
    } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : "Error desconocido";
        console.error(msg);
        await reportError(req, "api/reportes", "POST", 500, msg);
        return NextResponse.json({ status: false, message: msg }, { status: 500 });
    }
}
