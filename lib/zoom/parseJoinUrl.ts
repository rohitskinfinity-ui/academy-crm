export type ParsedZoomJoinUrl = {
  meeting_id: string;
  passcode: string;
};

/**
 * Extract meeting ID and passcode from a Zoom join URL.
 * e.g. https://us05web.zoom.us/j/84475057132?pwd=zvDWtEbJlBSU8GpiFkRXFdMTaWgZbH.1
 */
export function parseZoomJoinUrl(url: string): ParsedZoomJoinUrl {
  const empty = { meeting_id: "", passcode: "" };
  if (!url?.trim()) return empty;

  try {
    const parsed = new URL(url.trim());
    const pathMatch = parsed.pathname.match(/\/j\/(\d+)/);
    const meeting_id = pathMatch?.[1] ?? "";
    const passcode = parsed.searchParams.get("pwd") ?? "";
    return { meeting_id, passcode };
  } catch {
    const idMatch = url.match(/\/j\/(\d+)/);
    const pwdMatch = url.match(/[?&]pwd=([^&#]+)/);
    return {
      meeting_id: idMatch?.[1] ?? "",
      passcode: pwdMatch?.[1] ? decodeURIComponent(pwdMatch[1]) : "",
    };
  }
}
