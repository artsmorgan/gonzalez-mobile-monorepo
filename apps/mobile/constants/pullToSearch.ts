import type { RefreshControlProps } from 'react-native';

/**
 * Propiedades del `RefreshControl` de las listas con "jalar para buscar": el gesto funciona (dispara la búsqueda) pero el
 * indicador de carga no se ve.
 *
 * - Android: el círculo del `SwipeRefreshLayout` se dibuja siempre (aunque sus colores sean transparentes), así que se manda
 *   muy por encima de la pantalla con `progressViewOffset`; el umbral para disparar la recarga no depende de su posición.
 * - iOS: el indicador usa `tintColor`, que aquí es transparente (el rebote de la lista deja un espacio vacío mientras busca).
 */
export const HIDDEN_REFRESH_CONTROL_PROPS: Pick<RefreshControlProps, 'colors' | 'progressBackgroundColor' | 'progressViewOffset' | 'tintColor'> = {
    colors: ['transparent'],
    progressBackgroundColor: 'transparent',
    progressViewOffset: -2000,
    tintColor: 'transparent',
};
