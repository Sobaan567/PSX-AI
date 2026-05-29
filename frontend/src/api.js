export async function readJson(res, fallbackMessage = 'Could not read API response.') {
  const text = await res.text()

  if (!res.ok) {
    throw new Error(parseErrorText(text, fallbackMessage))
  }

  const contentType = res.headers.get('content-type') || ''
  if (!contentType.includes('application/json')) {
    const preview = text.trim().slice(0, 80)
    throw new Error(
      preview.startsWith('<!DOCTYPE') || preview.startsWith('<html')
        ? 'Backend returned HTML instead of JSON. Check VITE_API_URL points to the backend Vercel URL.'
        : `Backend returned ${contentType || 'an unknown content type'} instead of JSON.`
    )
  }

  return text ? JSON.parse(text) : null
}

export async function readErrorMessage(res, fallbackMessage) {
  const text = await res.text()
  return parseErrorText(text, fallbackMessage)
}

function parseErrorText(text, fallbackMessage) {
  if (!text) return fallbackMessage

  try {
    const payload = JSON.parse(text)
    return payload.detail || payload.message || text
  } catch {
    return text.trim().startsWith('<')
      ? 'Backend returned HTML instead of JSON. Check VITE_API_URL points to the backend Vercel URL.'
      : text
  }
}
