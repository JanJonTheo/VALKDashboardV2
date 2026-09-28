export class DashboardRequestError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "DashboardRequestError";
  }
}

// A gateway timeout already spent the upstream request budget. Repeating it
// immediately can keep the same overloaded API busy for another 40 seconds.
export function retryDashboardQuery(failureCount: number, error: Error) {
  if (error.name === "AbortError" || error.name === "TimeoutError")
    return false;
  if (error instanceof DashboardRequestError) {
    if (error.status >= 400 && error.status < 500) return false;
    if ([502, 503, 504].includes(error.status)) return false;
  }
  return failureCount < 1;
}
