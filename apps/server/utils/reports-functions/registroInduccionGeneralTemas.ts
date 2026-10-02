/** Catálogo de temas para inducción general (sincronizado con GeneralInductionRegisterScreen). */

export type TemaNode = { id: string; text: string; children?: TemaNode[] };

export type FlatDocxTemaRow = {
    kind: "section" | "leaf";
    id: string;
    text: string;
    level: number;
};

export const TEMAS_DIV_AYL: TemaNode[] = [
    { id: "1", text: "Presentación del Asistente de Operaciones de Aseo y Limpieza" },
    { id: "2", text: "Nombre de los Supervisores" },
    {
        id: "3",
        text: "Manual de Puesto",
        children: [
            { id: "3.1", text: "Información del cliente" },
            { id: "3.2", text: "Reporte de asistencia" },
            { id: "3.3", text: "Funciones y Responsabilidades" },
            { id: "3.4", text: "Servicio al cliente" },
            { id: "3.5", text: "Código de vestimenta" },
            { id: "3.6", text: "Uso del teléfono" },
            { id: "3.7", text: "Confidencialidad" },
            { id: "3.8", text: "Gestión Documental: uso de registros y bitácoras" },
            { id: "3.9", text: "Manejo de papelería del cliente (si aplica)" },
            { id: "3.10", text: "Cuidados del Equipo" },
            { id: "3.11", text: "Evaluación del Desempeño" },
        ],
    },
    {
        id: "4",
        text: "Horario de trabajo",
        children: [
            { id: "4.1", text: "Fecha y Hora de Primer día Ingreso" },
            { id: "4.2", text: "Rol de trabajo (hora de entrada y salida)" },
            { id: "4.3", text: "Prohibición de salida de las instalaciones" },
            { id: "4.4", text: "Tiempo de alimentación" },
            { id: "4.5", text: "Jornada laboral (8 horas/ 12 horas/ Mixta/ Diurna, etc)" },
            { id: "4.6", text: "Día de descanso" },
        ],
    },
    {
        id: "5",
        text: "Uso de Equipos",
        children: [
            { id: "5.1", text: "Uso Correcto y Cuidado de Cepillo Eléctrico" },
            { id: "5.2", text: "Uso Correcto y Cuidado de Aspiradora" },
            { id: "5.3", text: "Uso Correcto y Cuidado de Hidrolavadora" },
            { id: "5.4", text: "Uso Correcto y Cuidado de Máquina de vapor" },
            { id: "5.5", text: "Uso Correcto y Cuidado de Equipo de Jardinería (guadañas, chapeadoras, orilladoras,etc)" },
        ],
    },
    {
        id: "6",
        text: "Políticas",
        children: [
            { id: "6.1", text: "Incapacidad" },
            { id: "6.2", text: "Vacaciones" },
            { id: "6.3", text: "Permisos con y sin goce salarial" },
            { id: "6.4", text: "Devolución de uniformes, gafetes y otros" },
            { id: "6.5", text: "Disciplina Progresiva" },
            { id: "6.6", text: "Feriados" },
            { id: "6.7", text: "Reporte de Accidentes (inmediato)" },
            { id: "6.8", text: "Acoso Sexual y Laboral" },
        ],
    },
    {
        id: "7",
        text: "Tipo de contratación y modalidades de pago.",
        children: [
            { id: "7.1", text: "Comodín" },
            { id: "7.2", text: "Fijo" },
        ],
    },
    { id: "8", text: "Importancia de asistencia a capacitaciones" },
    {
        id: "9",
        text: "Importancia de uso de equipo de protección personal (EPP) y medidas de seguridad en el trabajo:",
        children: [
            { id: "9.1", text: "Lentes de seguridad" },
            { id: "9.2", text: "Mascarillas" },
            { id: "9.3", text: "Guantes" },
            { id: "9.4", text: "Zapatos Antideslizantes" },
            { id: "9.5", text: "Zapatos Seguridad" },
            { id: "9.6", text: "Fajas de Levantamiento de Peso (si aplica)" },
            { id: "9.7", text: "Batas/Gorrito/Cobertor zapatos hospitalario (si aplica)" },
            { id: "9.8", text: "Botas (si aplica)" },
            { id: "9.9", text: "Equipos de Trabajo en Altura" },
            { id: "9.10", text: "Equipos de Protección Jardinería" },
            { id: "9.11", text: "Rótulos Preventivos" },
            { id: "9.12", text: "Otros:" },
        ],
    },
    {
        id: "10",
        text: "Dilución y manipulación correcta de los químicos de limpieza",
        children: [
            { id: "10.1", text: "Cloro / Sustituto de Cloro" },
            { id: "10.2", text: "Desinfectante" },
            { id: "10.3", text: "Multiuso" },
            { id: "10.4", text: "Loza Sanitaria" },
            { id: "10.5", text: "Otros químicos de limpieza (manipulación)" },
        ],
    },
    { id: "11", text: "Procedimientos y Protocolos de Limpieza" },
    { id: "12", text: "Procedimiento Limpieza Hospitalaria (si aplica)" },
    { id: "13", text: "Protocolos de Emergencia o en Casos de Crisis" },
    { id: "14", text: "Manejo y Levantamiento de Cargas y Movimiento Postural" },
    { id: "15", text: "Manejo de Desechos Biopeligrosos" },
    { id: "16", text: "Manejo y clasificación de Residuos (Reciclaje)" },
];

export const TEMAS_DIV_SEG: TemaNode[] = [
    { id: "1", text: "Presentación del Ejecutivo de cuenta o Coordinador Regional" },
    { id: "2", text: "Nombre de los Supervisores" },
    { id: "3", text: "Nombre de los Coordinadores (cuando aplique)" },
    { id: "4", text: "Información sobre el Cliente y el Contrato" },
    { id: "5", text: "Enlace del cliente en el lugar de trabajo" },
    { id: "6", text: "Ubicación geográfica del puesto" },
    {
        id: "7",
        text: "Horario de trabajo",
        children: [
            { id: "7.1", text: "Fecha y Hora de Primer día Ingreso" },
            { id: "7.2", text: "Rol de trabajo" },
            { id: "7.3", text: "Jornada laboral (8 horas/ 12 horas/ Mixta/ Diurna, etc)" },
            { id: "7.4", text: "Día de descanso" },
            { id: "7.5", text: "Obligatoriedad de trabajar días feriados" },
        ],
    },
    {
        id: "8",
        text: "Manual del puesto",
        children: [
            {
                id: "8.1",
                text: "Descripción de funciones y responsabilidades en el puesto",
                children: [
                    { id: "8.1.i", text: "Espera de relevo" },
                    { id: "8.1.ii", text: "Reporte de asistencia" },
                    { id: "8.1.iii", text: "Tiempos de alimentación" },
                    { id: "8.1.iv", text: "Prohibición de salida de las instalaciones" },
                    { id: "8.1.v", text: "Revisión de perímetro" },
                    { id: "8.1.vi", text: "Manejo de llaves" },
                    { id: "8.1.vii", text: "Revisión de vehículos" },
                    { id: "8.1.viii", text: "Control de ingreso y salida de personas y activos" },
                ],
            },
            { id: "8.2", text: "Reporte de incidencias" },
            { id: "8.3", text: "Uso de sistemas de alarmas y CCTV" },
            { id: "8.4", text: "Guía de funciones del puesto" },
            { id: "8.5", text: "Correcto llenado de bitácoras." },
            { id: "8.6", text: "Gestión documental, uso y llenado de registros y papelería del cliente" },
            { id: "8.7", text: "Realización correcta de rondas y realización de marcas" },
            { id: "8.8", text: "Protocolos de Emergencia" },
            { id: "8.9", text: "Uso y cuidado de los equipos del puesto y propiedad del cliente" },
            { id: "8.10", text: "Evaluación de desempeño" },
            { id: "8.11", text: "Multas en caso de que apliquen" },
            { id: "8.12", text: "Servicio al cliente y trato de personas con capacidades reducidas" },
        ],
    },
    {
        id: "9",
        text: "Políticas y procedimientos",
        children: [
            { id: "9.1", text: "Código de Ética" },
            { id: "9.2", text: "Confidencialidad" },
            { id: "9.3", text: "Código de vestimenta" },
            { id: "9.4", text: "Permisos con y sin goce" },
            { id: "9.5", text: "Procedimiento para otorgar Horas extras" },
            { id: "9.6", text: "Procedimiento para otorgar Vacaciones" },
            { id: "9.7", text: "Procedimiento de incapacidades" },
            { id: "9.8", text: "Procedimiento de traslados" },
            { id: "9.9", text: "Manual de disciplina progresiva" },
            { id: "9.10", text: "Reporte de accidentes (inmediato)" },
            { id: "9.11", text: "Reglamento de Acoso Sexual y Acoso Laboral" },
        ],
    },
    { id: "10", text: "Asistencia obligatoria a las Capacitaciones, según contrato con el cliente en el que se le asigne." },
    {
        id: "11",
        text: "Capacitaciones básicas",
        children: [
            { id: "11.1", text: "Correcta entrega de puesto" },
            { id: "11.2", text: "Protocolo de entrega y manejo de arma de fuego de forma segura." },
            { id: "11.3", text: "Uso de legítima defensa" },
            { id: "11.4", text: "Uso de equipo contra incendio (extintores)" },
            { id: "11.5", text: "Uso correcto de arma letal (armas de fuego)" },
            { id: "11.6", text: "Vara de extensión (Black Jack)" },
            { id: "11.7", text: "Esposas" },
            { id: "11.8", text: "Uso correcto de arma menos letal (cuando corresponda)" },
            { id: "11.9", text: "Gas pimienta" },
            { id: "11.10", text: "Técnicas de aprensión o detención" },
            { id: "11.11", text: "Uso de computadora, correo electrónico, office básico." },
            { id: "11.12", text: "Técnicas de descripción de personal y detección de posibles amenazas" },
            { id: "11.13", text: "Uso de radio y sistemas de comunicación" },
        ],
    },
    {
        id: "12",
        text: "Equipo de protección personal (EPP), equipo de seguridad y uso correcto de uniforme",
        children: [
            { id: "12.1", text: "Chaleco antibalas" },
            { id: "12.2", text: "Chaleco reflectivo o de seguridad" },
            { id: "12.3", text: "Cinturón porta herramientas de seguridad" },
            { id: "12.4", text: "Botas de hule" },
            { id: "12.5", text: "Capa o poncho" },
            { id: "12.6", text: "Casco de seguridad" },
            { id: "12.7", text: "Calzado apropiado según el puesto de trabajo" },
            { id: "12.8", text: "Gorra" },
            { id: "12.9", text: "Cubre bocas o mascarilla" },
            { id: "12.10", text: "Bloqueador solar" },
            { id: "12.11", text: "Equipo Motorizados: casco, rodilleras, coderas, guantes, botas altas" },
            { id: "12.12", text: "Uso correcto y completo de uniforme (limpio, planchado)" },
        ],
    },
];

export function getTemaNodesForDivision(divisionId: number, divisionLabel?: string): TemaNode[] {
    if (divisionId === 4) return TEMAS_DIV_SEG;
    if (divisionId === 5) return TEMAS_DIV_AYL;
    const d = String(divisionLabel ?? "").toLowerCase();
    if (d.includes("seguridad")) return TEMAS_DIV_SEG;
    return TEMAS_DIV_AYL;
}

export function flattenTemasForDocx(nodes: TemaNode[]): FlatDocxTemaRow[] {
    const out: FlatDocxTemaRow[] = [];
    const walk = (list: TemaNode[], level: number) => {
        for (const n of list) {
            const hasChildren = !!(n.children && n.children.length > 0);
            if (hasChildren) {
                out.push({ kind: "section", id: n.id, text: n.text, level });
                walk(n.children!, level + 1);
            } else {
                out.push({ kind: "leaf", id: n.id, text: n.text, level });
            }
        }
    };
    walk(nodes, 0);
    return out;
}

export function getCheckedTemaIds(temasRaw: string | null | undefined): Set<string> {
    const checked = new Set<string>();
    if (!temasRaw || String(temasRaw).trim() === "") return checked;
    let obj: any;
    try {
        obj = JSON.parse(String(temasRaw));
    } catch {
        return checked;
    }
    if (Array.isArray(obj?.leafs)) {
        for (const l of obj.leafs) {
            if (l?.checked) checked.add(String(l.id));
        }
        return checked;
    }
    if (Array.isArray(obj?.sections)) {
        for (const sec of obj.sections) {
            const items = Array.isArray(sec?.items) ? sec.items : [];
            const hasSub = items.length > 1 || (items.length === 1 && items[0]?.id !== sec?.id);
            if (hasSub) {
                for (const it of items) {
                    if (it?.checked) checked.add(String(it.id));
                }
            } else if (items.length === 1 && items[0]?.checked) {
                checked.add(String(items[0].id));
            }
        }
        return checked;
    }
    if (Array.isArray(obj?.selected)) {
        for (const s of obj.selected) {
            if (s?.id) checked.add(String(s.id));
        }
    }
    return checked;
}

export function getDocxTitlesForDivision(divisionId: number, divisionLabel?: string): {
    headerTitle: string;
    subtitle: string;
    colaboradoresPuestoTitle: string;
} {
    if (divisionId === 4 || String(divisionLabel ?? "").toLowerCase().includes("seguridad")) {
        return {
            headerTitle: "REGISTRO DE INDUCCION GENERAL DE SEGURIDAD",
            subtitle: "COLABORADORES SEGURIDAD",
            colaboradoresPuestoTitle: "COLABORADORES DE SEGURIDAD",
        };
    }
    return {
        headerTitle: "REGISTRO DE INDUCCION GENERAL DE ASEO Y LIMPIEZA",
        subtitle: "COLABORADORES ASEO Y LIMPIEZA",
        colaboradoresPuestoTitle: "COLABORADORES DE ASEO Y LIMPIEZA",
    };
}
