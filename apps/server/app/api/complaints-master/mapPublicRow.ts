/* eslint-disable @typescript-eslint/no-explicit-any */

export function buildComplaintFileUrl(baseUrl: string, recordId: number, file: { name: string; type: string }): string {
  const fileName = file.name;
  const type = String(file.type || "file").toLowerCase();
  let urlPath: string;
  if (type === "image") {
    urlPath = `/api/complaints-master/${recordId}/get-image/${encodeURIComponent(fileName)}`;
  } else if (type === "audio") {
    urlPath = `/api/complaints-master/${recordId}/get-audio/${encodeURIComponent(fileName)}`;
  } else if (type === "video") {
    urlPath = `/api/complaints-master/${recordId}/get-video/${encodeURIComponent(fileName)}`;
  } else {
    urlPath = `/api/complaints-master/${recordId}/get-file/${encodeURIComponent(fileName)}`;
  }
  return `${baseUrl}${urlPath}`;
}

/** Fila pública alineada con GET por corpo (sin `c_anexos_quejas` crudo). */
export function mapComplaintMasterPublicRow(record: any, baseUrl: string, recordId: number) {
  const { c_anexos_quejas, ...rest } = record || {};
  const anexos = Array.isArray(c_anexos_quejas) ? c_anexos_quejas : [];
  return {
    ...rest,
    id: recordId,
    id_local: "",
    files: anexos.map((f: any) => ({
      id: f.id,
      name: f.name,
      original_name: f.original_name,
      type: f.type,
      extension: f.extension,
      url: buildComplaintFileUrl(baseUrl, recordId, f),
    })),
  };
}
