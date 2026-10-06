/** Reads `{ message }` from a failed API response for user-facing sync errors. */
export async function parseApiErrorResponse(
  response: Response,
  fallback: string
): Promise<{ status: false; message: string }> {
  try {
    const data = await response.json();
    const message = String(data?.message ?? '').trim() || fallback;
    return { status: false, message };
  } catch {
    return { status: false, message: fallback };
  }
}
