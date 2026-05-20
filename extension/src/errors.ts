// 표준화된 에러 계층
// ApiClient 인터셉터에서 모든 에러를 이 타입으로 변환하여 컴포넌트에 전달

export class AppError extends Error {
  constructor(
    public code: string,
    message: string,
    public statusCode?: number,
  ) {
    super(message)
    this.name = 'AppError'
  }
}

export class OfflineError extends AppError {
  constructor() {
    super('OFFLINE', '오프라인 상태입니다')
    this.name = 'OfflineError'
  }
}

export class AuthError extends AppError {
  constructor(message = '로그인이 필요합니다') {
    super('AUTH_REQUIRED', message, 401)
    this.name = 'AuthError'
  }
}

export class ApiError extends AppError {
  constructor(statusCode: number, message: string) {
    super('API_ERROR', message, statusCode)
    this.name = 'ApiError'
  }
}

export class NetworkError extends AppError {
  constructor() {
    super('NETWORK_ERROR', '네트워크 오류가 발생했습니다')
    this.name = 'NetworkError'
  }
}

export class TimeoutError extends AppError {
  constructor() {
    super('TIMEOUT', '요청 시간이 초과되었습니다')
    this.name = 'TimeoutError'
  }
}

// 에러 → 사용자 메시지 변환
export function getErrorMessage(error: unknown): string {
  if (error instanceof AppError) {
    return error.message
  }
  if (error instanceof Error) {
    return error.message
  }
  return '알 수 없는 오류가 발생했습니다'
}
