// ApiClient — 모든 HTTP 통신의 단일 진입점
// axios 인터셉터 체인으로 횡단 관심사 처리:
//   - 오프라인 감지
//   - 토큰 자동 첨부
//   - 401 토큰 갱신 재시도 (_retryAuth)
//   - GET 1회 재시도 (_retryNetwork)
//   - Mock/Real 분기

import axios, { AxiosError, AxiosInstance, InternalAxiosRequestConfig } from 'axios'
import type {
  CreateBookmarkInput,
  Group,
  RecentBookmark,
} from './types'
import {
  ApiError,
  AuthError,
  NetworkError,
  OfflineError,
  TimeoutError,
} from './errors'
import { AuthManager } from './auth-manager'
import { mockApiClient } from './mocks/handlers'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL
const USE_MOCK = import.meta.env.VITE_USE_MOCK === 'true'
const TIMEOUT_MS = 3_000
const RETRY_DELAY_MS = 500

// ─────────────────────────────────────────────────────────
// 인터셉터 내부 플래그 타입 (충돌 방지를 위해 분리)
// ─────────────────────────────────────────────────────────

type RetryConfig = InternalAxiosRequestConfig & {
  _retryAuth?: boolean
  _retryNetwork?: boolean
}

const delay = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms))

// ─────────────────────────────────────────────────────────
// IApiClient 인터페이스
// ─────────────────────────────────────────────────────────

export interface IApiClient {
  postBookmark(input: CreateBookmarkInput): Promise<void>
  getRecentBookmarks(limit: number): Promise<RecentBookmark[]>
  getSavedUrls(): Promise<string[]>
  getGroups(): Promise<Group[]>
}

// ─────────────────────────────────────────────────────────
// 실제 API 클라이언트 (axios)
// ─────────────────────────────────────────────────────────

function createAxiosClient(): AxiosInstance {
  const client = axios.create({
    baseURL: API_BASE_URL,
    timeout: TIMEOUT_MS,
    headers: { 'Content-Type': 'application/json' },
  })

  // Request: 오프라인 감지 + 토큰 첨부
  client.interceptors.request.use(async (config) => {
    if (!navigator.onLine) {
      throw new OfflineError()
    }

    const token = await AuthManager.getValidToken()
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  })

  // Response: 401 갱신 재시도 + GET 재시도 + 에러 표준화
  client.interceptors.response.use(
    (response) => response,
    async (error: AxiosError) => {
      const config = error.config as RetryConfig | undefined
      if (!config) {
        throw normalizeError(error)
      }

      // 401: 토큰 갱신 후 재시도 (GET/POST 공통, 1회만)
      if (error.response?.status === 401 && !config._retryAuth) {
        config._retryAuth = true
        const newToken = await AuthManager.refreshToken()
        if (newToken) {
          config.headers.Authorization = `Bearer ${newToken}`
          return client(config)
        }
        // 갱신 실패 → AuthError throw
        throw new AuthError()
      }

      // 네트워크 에러 / 5xx: GET만 1회 재시도 (401 재시도와 독립적)
      const isRetryable = !error.response || error.response.status >= 500
      const isGet = config.method?.toUpperCase() === 'GET'
      if (isRetryable && isGet && !config._retryNetwork) {
        config._retryNetwork = true
        await delay(RETRY_DELAY_MS)
        return client(config)
      }

      throw normalizeError(error)
    },
  )

  return client
}

// ─────────────────────────────────────────────────────────
// 에러 표준화
// ─────────────────────────────────────────────────────────

function normalizeError(error: AxiosError): Error {
  // 이미 표준화된 에러는 그대로 전달
  if (error instanceof OfflineError || error instanceof AuthError) {
    return error
  }

  if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
    return new TimeoutError()
  }

  if (!error.response) {
    return new NetworkError()
  }

  const status = error.response.status
  const data = error.response.data as { error?: string; message?: string } | undefined
  const message = data?.error || data?.message || `요청 실패 (${status})`

  if (status === 401) {
    return new AuthError(message)
  }
  return new ApiError(status, message)
}

// ─────────────────────────────────────────────────────────
// Real API 구현
// ─────────────────────────────────────────────────────────

const realClient = createAxiosClient()

const realApiClient: IApiClient = {
  async postBookmark(input) {
    await realClient.post('/api/bookmarks', input)
  },

  async getRecentBookmarks(limit) {
    const { data } = await realClient.get<RecentBookmark[]>(
      `/api/bookmarks/recent`,
      { params: { limit } },
    )
    return data
  },

  async getSavedUrls() {
    const { data } = await realClient.get<{ urls: string[] }>('/api/bookmarks/urls')
    return data.urls
  },

  async getGroups() {
    const { data } = await realClient.get<Group[]>('/api/groups')
    return data
  },
}

// ─────────────────────────────────────────────────────────
// Mock/Real 분기 (단일 export)
// ─────────────────────────────────────────────────────────

export const apiClient: IApiClient = USE_MOCK ? mockApiClient : realApiClient
