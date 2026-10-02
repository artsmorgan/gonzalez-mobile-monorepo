/** Misma forma que el GET de lista: id, name, url get-image (autenticado vía token en query). */

export function mapActaEntregaImagesForClient(
  actaId: number,
  rows: Array<{ id?: number; name?: string }> | undefined | null,
  baseUrl: string,
): Array<{ id: number | undefined; name: string; url: string }> {
  const list = Array.isArray(rows) ? rows : [];
  const origin = baseUrl || '';
  return list.map((img: any) => {
    const name = String(img?.name ?? '');
    return {
      id: img?.id,
      name,
      url: origin ? `${origin}/api/acta-entrega-productos/${actaId}/get-image/${name}` : '',
    };
  });
}
