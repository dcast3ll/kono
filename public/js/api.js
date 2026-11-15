let unauthorizedHandler = () => {}

export function setUnauthorizedHandler(handler) {
  unauthorizedHandler = handler
}

export async function api(path, { method = "GET", body, unlockToken } = {}) {
  const headers = {}
  if (body !== undefined) headers["content-type"] = "application/json"
  if (unlockToken) headers["x-unlock-token"] = unlockToken

  const response = await fetch(path, {
    method,
    headers,
    credentials: "same-origin",
    body: body === undefined ? undefined : JSON.stringify(body),
  })

  let payload = null
  const text = await response.text()
  if (text) {
    try {
      payload = JSON.parse(text)
    } catch {
      payload = null
    }
  }

  if (response.status === 401 && payload?.error?.code === "unauthorized") {
    unauthorizedHandler()
  }

  if (!response.ok) {
    const error = new Error(payload?.error?.message ?? `Request failed (${response.status})`)
    error.code = payload?.error?.code
    error.status = response.status
    throw error
  }

  return payload
}
