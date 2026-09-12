const TOKEN_REFRESH_URL =
  "http://127.0.0.1:8000/api/accounts/token/refresh/";

const LOGIN_PATH = "/temple-admin-login";

let activeRefreshRequest: Promise<string | null> | null = null;


function isUsableToken(token: string | null) {
  return Boolean(
    token &&
      token !== "undefined" &&
      token !== "null",
  );
}


export function clearAuthSession() {
  localStorage.removeItem("accessToken");
  localStorage.removeItem("refreshToken");
  localStorage.removeItem("user");
}


export function hasStoredSession() {
  const accessToken = localStorage.getItem("accessToken");
  const refreshToken = localStorage.getItem("refreshToken");

  return (
    isUsableToken(accessToken) ||
    isUsableToken(refreshToken)
  );
}


function redirectToLogin() {
  clearAuthSession();

  if (window.location.pathname !== LOGIN_PATH) {
    window.location.replace(LOGIN_PATH);
  }
}


async function requestNewAccessToken(): Promise<string | null> {
  const refreshToken = localStorage.getItem("refreshToken");

  if (!isUsableToken(refreshToken)) {
    return null;
  }

  try {
    const response = await fetch(TOKEN_REFRESH_URL, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        refresh: refreshToken,
      }),
    });

    const data = (await response.json().catch(() => null)) as {
      access?: string;
      refresh?: string;
    } | null;

    if (
      !response.ok ||
      !data?.access ||
      !isUsableToken(data.access)
    ) {
      return null;
    }

    localStorage.setItem(
      "accessToken",
      data.access,
    );

    // Future lo token rotation enable chesthe,
    // backend new refresh token kuda return cheyochu.
    if (
      data.refresh &&
      isUsableToken(data.refresh)
    ) {
      localStorage.setItem(
        "refreshToken",
        data.refresh,
      );
    }

    return data.access;
  } catch {
    return null;
  }
}


async function getNewAccessToken() {
  if (!activeRefreshRequest) {
    activeRefreshRequest = requestNewAccessToken().finally(
      () => {
        activeRefreshRequest = null;
      },
    );
  }

  return activeRefreshRequest;
}


export async function apiFetch(
  input: RequestInfo | URL,
  init: RequestInit = {},
): Promise<Response> {
  const accessToken = localStorage.getItem("accessToken");

  const requestHeaders = new Headers(init.headers);

  if (isUsableToken(accessToken)) {
    requestHeaders.set(
      "Authorization",
      `Bearer ${accessToken}`,
    );
  }

  let response = await fetch(input, {
    ...init,
    headers: requestHeaders,
  });

  if (response.status !== 401) {
    return response;
  }

  // Access token expire ayithe refresh token tho
  // new access token generate chestham.
  const newAccessToken = await getNewAccessToken();

  if (!newAccessToken) {
    redirectToLogin();
    return response;
  }

  // Original failed request-ni new access token tho
  // automatic-ga retry chestham.
  const retryHeaders = new Headers(init.headers);

  retryHeaders.set(
    "Authorization",
    `Bearer ${newAccessToken}`,
  );

  response = await fetch(input, {
    ...init,
    headers: retryHeaders,
  });

  // Refresh tarvatha kuda 401 vasthe session invalid.
  if (response.status === 401) {
    redirectToLogin();
  }

  return response;
}